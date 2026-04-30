#!/usr/bin/env node
/**
 * Orchestrator: run every collector, merge, NA-filter, geocode, and write
 * functions/data/real-conferences.json.
 *
 * Each collector under ./collectors/ exports `async collect()` returning
 * normalized records: { name, city, country, startDate, endDate, topics[],
 * url, online, source }. Cross-collector dedupe is done here on
 * name|startDate; topics are unioned, source is preserved as the first-seen
 * collector (with confs.tech taking precedence for backward compat).
 *
 * Usage:  MAPBOX_TOKEN=pk.xxxx node functions/scripts/collect-conferences.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collect as collectConfsTech } from "./collectors/confs-tech.mjs";
import { collect as collectDataMl } from "./collectors/data-ml.mjs";
import { collect as collectLinuxFoundation } from "./collectors/linux-foundation.mjs";
import { collect as collectMinnestar } from "./collectors/minnestar.mjs";
import { collect as collectSecurityArchives } from "./collectors/security-archives.mjs";
import { collect as collectVendorFlagships } from "./collectors/vendor-flagships.mjs";
import { collect as collectWikipedia } from "./collectors/wikipedia.mjs";
import { lookupHq } from "./collectors/organizer-hq.mjs";

const COLLECTORS = [
  ["confs.tech", collectConfsTech],
  ["vendor-flagships", collectVendorFlagships],
  ["security-archives", collectSecurityArchives],
  ["wikipedia", collectWikipedia],
  ["linux-foundation", collectLinuxFoundation],
  ["data-ml", collectDataMl],
  ["minnestar", collectMinnestar],
];

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error("MAPBOX_TOKEN env var is required");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "..", "data", "real-conferences.json");

function normalizeCountry(c) {
  if (!c) return "";
  const s = c.trim().toUpperCase().replace(/\./g, "");
  if (s === "USA" || s === "US" || s === "UNITED STATES" || s === "UNITED STATES OF AMERICA")
    return "U.S.A.";
  if (s === "CANADA") return "Canada";
  return c.trim();
}

function isNorthAmericanAnchored(c) {
  if (!c.city || !c.city.trim()) return false;
  const country = normalizeCountry(c.country);
  return country === "U.S.A." || country === "Canada";
}

function dedupeKey(c) {
  return `${(c.name ?? "").toLowerCase()}|${c.startDate ?? ""}`;
}

// confs.tech wins on source-name attribution when an event appears in
// multiple sources, since it's the established baseline. Otherwise the
// first collector to claim the event keeps it.
function preferSource(a, b) {
  if (a === "confs.tech" || b === "confs.tech") return "confs.tech";
  return a;
}

async function geocode(city, country) {
  const query = encodeURIComponent(`${city}, ${country}`);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${query}&limit=1&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocode ${res.status} for ${city}, ${country}`);
  const json = await res.json();
  const feat = json.features?.[0];
  if (!feat?.geometry?.coordinates) return null;
  const [lng, lat] = feat.geometry.coordinates;
  return { latitude: lat, longitude: lng };
}

async function main() {
  const all = [];
  for (const [name, fn] of COLLECTORS) {
    console.log(`\n→ ${name}`);
    const records = await fn();
    console.log(`  ${records.length} records`);
    all.push(...records);
  }
  console.log(`\nMerged: ${all.length} raw records`);

  let hqResolved = 0;
  const resolved = all.map((c) => {
    if (c.online === true && (!c.city || !c.city.trim())) {
      const hq = lookupHq(c.name);
      if (hq) {
        hqResolved += 1;
        return { ...c, city: hq.city, country: hq.country };
      }
    }
    return c;
  });
  console.log(`  ${hqResolved} online events anchored via organizer HQ`);

  const eligible = resolved.filter(isNorthAmericanAnchored);
  console.log(`  ${eligible.length} after NA-anchored filter`);

  const byKey = new Map();
  for (const c of eligible) {
    const key = dedupeKey(c);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...c,
        topics: [...new Set(c.topics ?? [])],
        online: c.online === true,
      });
    } else {
      for (const t of c.topics ?? []) {
        if (!existing.topics.includes(t)) existing.topics.push(t);
      }
      existing.source = preferSource(existing.source, c.source);
      existing.url = existing.url ?? c.url;
      existing.endDate = existing.endDate ?? c.endDate;
      existing.online = existing.online || c.online === true;
    }
  }
  const deduped = [...byKey.values()];
  console.log(`  ${deduped.length} after cross-source dedupe`);

  const cityKey = (c) => `${c.city}|${normalizeCountry(c.country)}`;
  const uniqueCities = [...new Set(deduped.map(cityKey))];
  console.log(`\nGeocoding ${uniqueCities.length} unique cities…`);
  const coords = new Map();
  let i = 0;
  for (const key of uniqueCities) {
    i += 1;
    const [city, country] = key.split("|");
    try {
      const pt = await geocode(city, country);
      if (pt) coords.set(key, pt);
      if (i % 25 === 0) console.log(`  ${i}/${uniqueCities.length} geocoded`);
    } catch (e) {
      console.warn(`  geocode failed for ${key}: ${e.message}`);
    }
  }

  const out = [];
  for (const c of deduped) {
    const pt = coords.get(cityKey(c));
    if (!pt) continue;
    const country = normalizeCountry(c.country);
    const end = c.endDate || c.startDate;
    const record = {
      name: c.name,
      location_name: `${c.city}, ${country === "U.S.A." ? "USA" : country}`,
      latitude: pt.latitude,
      longitude: pt.longitude,
      start_date: new Date(`${c.startDate}T00:00:00Z`).toISOString(),
      end_date: new Date(`${end}T23:59:59Z`).toISOString(),
      source: c.source,
      topics: c.topics ?? [],
      url: c.url ?? null,
    };
    if (c.online) record.online = true;
    out.push(record);
  }

  out.sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${out.length} conferences → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
