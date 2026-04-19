#!/usr/bin/env node
// Collects conferences from github.com/tech-conferences/conference-data
// and writes functions/data/real-conferences.json.
// Requires MAPBOX_TOKEN env var for geocoding.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outPath = join(__dirname, "..", "data", "real-conferences.json");

const YEARS = [2022, 2023, 2024, 2025, 2026];
const TOPICS = [
  "general", "javascript", "ruby", "python", "dotnet", "golang", "rust",
  "php", "java", "scala", "elixir", "elm", "ios", "android", "tech-comm",
  "devops", "security", "data", "ai", "product", "ux", "design", "cloud",
  "agile", "gaming", "wordpress",
];
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

async function geocode(city) {
  if (!MAPBOX_TOKEN) return null;
  const q = encodeURIComponent(city);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${q}&access_token=${MAPBOX_TOKEN}&limit=1&types=place`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  const feat = body.features?.[0];
  if (!feat) return null;
  const [longitude, latitude] = feat.geometry.coordinates;
  return { latitude, longitude };
}

const seen = new Map();
const cityCache = new Map();

for (const year of YEARS) {
  for (const topic of TOPICS) {
    const url = `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${year}/${topic}.json`;
    const records = await fetchJson(url);
    for (const r of records) {
      if (!r.country || !["U.S.A.", "Canada"].includes(r.country)) continue;
      if (!r.city) continue;
      const key = `${String(r.name).toLowerCase()}|${r.startDate}`;
      if (seen.has(key)) continue;
      const cityKey = `${r.city}, ${r.country}`;
      let coords = cityCache.get(cityKey);
      if (!coords) {
        coords = await geocode(cityKey);
        if (!coords) continue;
        cityCache.set(cityKey, coords);
      }
      seen.set(key, {
        name: r.name,
        locationName: `${r.city}${r.country === "Canada" ? ", CA" : ""}`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        startDate: r.startDate,
        endDate: r.endDate || r.startDate,
        topics: [topic],
        url: r.url || null,
      });
    }
  }
}

const out = [...seen.values()];
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} records to ${outPath}`);
