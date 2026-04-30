/**
 * Collector: github.com/tech-conferences/conference-data
 *
 * Pulls per-year, per-topic JSON files for the configured year window.
 * Returns normalized records pre-geocoding; the orchestrator handles
 * NA filtering, cross-collector dedupe, and geocoding.
 */

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

export async function collect() {
  console.log(`confs.tech: ${YEARS.join(", ")} × ${TOPICS.length} topics`);
  const raw = [];
  for (const year of YEARS) {
    for (const topic of TOPICS) {
      const items = await fetchTopic(year, topic);
      raw.push(...items);
    }
  }

  // Dedupe within source; union topics.
  const byKey = new Map();
  for (const c of raw) {
    if (!c.name || !c.startDate) continue;
    const key = `${c.name.toLowerCase()}|${c.startDate}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        name: c.name,
        city: c.city ?? null,
        country: c.country ?? null,
        startDate: c.startDate,
        endDate: c.endDate || c.startDate,
        topics: c.topic ? [c.topic] : [],
        url: c.url ?? null,
        online: c.online === true,
        source: "confs.tech",
      });
    } else if (c.topic && !existing.topics.includes(c.topic)) {
      existing.topics.push(c.topic);
    }
  }
  return [...byKey.values()];
}
