/**
 * Collector: Minnestar community events (Minnebar, Minnedemo).
 * Hand-curated; small, recurring, Minneapolis-only.
 */

const EVENTS = [
  ["Minnebar 17", "2023-04-22"],
  ["Minnebar 18", "2024-04-27"],
  ["Minnebar 19", "2025-04-26"],
  ["Minnebar 20", "2026-05-02"],
  ["Minnedemo 38", "2023-10-19"],
  ["Minnedemo 39", "2024-05-23"],
  ["Minnedemo 40", "2025-05-22"],
  ["Minnedemo 41", "2026-05-21"],
];

export async function collect() {
  return EVENTS.map(([name, date]) => ({
    name,
    city: "Minneapolis",
    country: "USA",
    startDate: date,
    endDate: date,
    topics: ["general", "community"],
    url: "https://minnestar.org",
    online: false,
    source: "minnestar",
  }));
}
