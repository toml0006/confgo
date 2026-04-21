#!/usr/bin/env node
/**
 * Fetch conference JSON from github.com/tech-conferences/conference-data,
 * filter to U.S.A. / Canada in-person events, deduplicate, geocode, and
 * write functions/data/real-conferences.json.
 *
 * Usage:  MAPBOX_TOKEN=pk.xxxx node functions/scripts/collect-conferences.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const YEARS = [2022, 2023, 2024, 2025, 2026];
const TOPICS = [
  "android",
  "architecture",
  "clojure",
  "cloud",
  "cpp",
  "css",
  "data",
  "devops",
  "dotnet",
  "elixir",
  "general",
  "golang",
  "graphql",
  "ios",
  "java",
  "javascript",
  "kotlin",
  "networking",
  "nodejs",
  "php",
  "product",
  "python",
  "ruby",
  "rust",
  "scala",
  "security",
  "sre",
  "tech-comms",
  "typescript",
  "ux",
];

const RAW_BASE =
  "https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error("MAPBOX_TOKEN env var is required");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "..", "data", "real-conferences.json");

async function fetchTopic(year, topic) {
  const url = `${RAW_BASE}/${year}/${topic}.json`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) {
    console.warn(`  skip ${year}/${topic} — status ${res.status}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data.map((c) => ({ ...c, topic })) : [];
}

function normalizeCountry(c) {
  if (!c) return "";
  const s = c.trim().toUpperCase().replace(/\./g, "");
  if (s === "USA" || s === "US" || s === "UNITED STATES" || s === "UNITED STATES OF AMERICA")
    return "U.S.A.";
  if (s === "CANADA") return "Canada";
  return c.trim();
}

function isInPersonNorthAmerican(c) {
  if (c.online === true) return false;
  if (!c.city || !c.city.trim()) return false;
  const country = normalizeCountry(c.country);
  return country === "U.S.A." || country === "Canada";
}

function dedupeKey(c) {
  return `${(c.name ?? "").toLowerCase()}|${c.startDate ?? ""}`;
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
  console.log(`Collecting conferences for ${YEARS.join(", ")} × ${TOPICS.length} topics…`);
  const raw = [];
  for (const year of YEARS) {
    for (const topic of TOPICS) {
      const items = await fetchTopic(year, topic);
      raw.push(...items);
    }
    console.log(`  year ${year}: ${raw.length} rows cumulative`);
  }
  console.log(`Fetched ${raw.length} raw entries`);

  const inPerson = raw.filter(isInPersonNorthAmerican);
  console.log(`  ${inPerson.length} U.S./Canada in-person`);

  // dedupe by name+startDate, gathering topics
  const byKey = new Map();
  for (const c of inPerson) {
    const key = dedupeKey(c);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...c, topics: c.topic ? [c.topic] : [] });
    } else {
      if (c.topic && !existing.topics.includes(c.topic)) existing.topics.push(c.topic);
    }
  }
  const deduped = [...byKey.values()];
  console.log(`  ${deduped.length} after dedupe`);

  // geocode unique cities
  const cityKey = (c) => `${c.city}|${normalizeCountry(c.country)}`;
  const uniqueCities = [...new Set(deduped.map(cityKey))];
  console.log(`Geocoding ${uniqueCities.length} unique cities…`);
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
    out.push({
      name: c.name,
      location_name: `${c.city}, ${country === "U.S.A." ? "USA" : country}`,
      latitude: pt.latitude,
      longitude: pt.longitude,
      start_date: new Date(`${c.startDate}T00:00:00Z`).toISOString(),
      end_date: new Date(`${end}T23:59:59Z`).toISOString(),
      source: "confs.tech",
      topics: c.topics ?? [],
      url: c.url ?? null,
    });
  }

  // add Minnestar events
  const minneapolis = coords.get("Minneapolis|U.S.A.") ?? { latitude: 44.9778, longitude: -93.265 };
  const minnestar = [
    ["Minnebar 17", "2023-04-22"],
    ["Minnebar 18", "2024-04-27"],
    ["Minnebar 19", "2025-04-26"],
    ["Minnebar 20", "2026-04-25"],
    ["Minnedemo 38", "2023-10-19"],
    ["Minnedemo 39", "2024-05-23"],
    ["Minnedemo 40", "2025-05-22"],
    ["Minnedemo 41", "2026-05-21"],
  ];
  for (const [name, date] of minnestar) {
    out.push({
      name,
      location_name: "Minneapolis, USA",
      latitude: minneapolis.latitude,
      longitude: minneapolis.longitude,
      start_date: new Date(`${date}T14:00:00Z`).toISOString(),
      end_date: new Date(`${date}T23:00:00Z`).toISOString(),
      source: "confs.tech",
      topics: ["general", "community"],
      url: "https://minnestar.org",
    });
  }

  out.sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} conferences → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
