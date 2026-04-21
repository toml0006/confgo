#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error("Set MAPBOX_ACCESS_TOKEN to collect and geocode conferences.");
  process.exit(1);
}

const years = [2022, 2023, 2024, 2025, 2026];
const topics = [
  "android", "aws", "data", "devops", "elixir", "golang", "graphql", "ios",
  "java", "javascript", "kotlin", "ml", "php", "python", "ruby", "rust",
  "security", "software", "web"
];

const seen = new Set();
const geocodes = new Map();
const conferences = [];

for (const year of years) {
  for (const topic of topics) {
    const url = `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${year}/${topic}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }
    const data = await response.json();
    for (const conference of data) {
      if (!conference.city || !["U.S.A.", "Canada"].includes(conference.country)) {
        continue;
      }
      if (String(conference.online || "").toLowerCase() === "true") {
        continue;
      }
      const key = `${conference.name.toLowerCase()}|${conference.startDate}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const place = `${conference.city}, ${conference.state || conference.country}`;
      if (!geocodes.has(place)) {
        geocodes.set(place, await geocode(place));
      }
      const coords = geocodes.get(place);
      if (!coords) {
        continue;
      }
      conferences.push({
        name: conference.name,
        locationName: place,
        latitude: coords.latitude,
        longitude: coords.longitude,
        startDate: conference.startDate,
        endDate: conference.endDate,
        source: "confs.tech",
        topics: [topic],
        url: conference.url ?? null
      });
    }
  }
}

const outputPath = path.resolve("data/real-conferences.json");
await fs.writeFile(outputPath, JSON.stringify(conferences, null, 2));
console.log(JSON.stringify({ ok: true, outputPath, count: conferences.length }, null, 2));

async function geocode(place) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", place);
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("limit", "1");
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature?.geometry?.coordinates) {
    return null;
  }
  return {
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1]
  };
}
