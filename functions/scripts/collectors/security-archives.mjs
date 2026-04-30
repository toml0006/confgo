/**
 * Collector: hand-curated catalog of major NA infosec conferences.
 *
 * Same shape as vendor-flagships: list editions per series, each becomes
 * its own conference doc. Dates verified against the conference sites at
 * time of writing — re-check announced future editions periodically.
 *
 * Adding a series: append an entry to SERIES.
 */

const SERIES = [
  {
    name: "DEF CON",
    url: "https://defcon.org/",
    topics: ["security"],
    editions: [
      ["Las Vegas", "USA", "2022-08-11", "2022-08-14"],
      ["Las Vegas", "USA", "2023-08-10", "2023-08-13"],
      ["Las Vegas", "USA", "2024-08-08", "2024-08-11"],
      ["Las Vegas", "USA", "2025-08-07", "2025-08-10"],
    ],
  },
  {
    name: "Black Hat USA",
    url: "https://www.blackhat.com/us-25/",
    topics: ["security"],
    editions: [
      ["Las Vegas", "USA", "2022-08-06", "2022-08-11"],
      ["Las Vegas", "USA", "2023-08-05", "2023-08-10"],
      ["Las Vegas", "USA", "2024-08-03", "2024-08-08"],
      ["Las Vegas", "USA", "2025-08-02", "2025-08-07"],
    ],
  },
  {
    name: "RSA Conference",
    url: "https://www.rsaconference.com/usa",
    topics: ["security"],
    editions: [
      ["San Francisco", "USA", "2022-06-06", "2022-06-09"],
      ["San Francisco", "USA", "2023-04-24", "2023-04-27"],
      ["San Francisco", "USA", "2024-05-06", "2024-05-09"],
      ["San Francisco", "USA", "2025-04-28", "2025-05-01"],
    ],
  },
  {
    name: "USENIX Security Symposium",
    url: "https://www.usenix.org/conference/usenixsecurity",
    topics: ["security"],
    editions: [
      ["Boston", "USA", "2022-08-10", "2022-08-12"],
      ["Anaheim", "USA", "2023-08-09", "2023-08-11"],
      ["Philadelphia", "USA", "2024-08-14", "2024-08-16"],
      ["Seattle", "USA", "2025-08-13", "2025-08-15"],
    ],
  },
  {
    name: "ShmooCon",
    url: "https://shmoocon.org/",
    topics: ["security"],
    editions: [
      ["Washington", "USA", "2023-01-27", "2023-01-29"],
      ["Washington", "USA", "2024-01-12", "2024-01-14"],
      ["Washington", "USA", "2025-01-10", "2025-01-12"],
    ],
  },
  {
    name: "BSides Las Vegas",
    url: "https://bsideslv.org/",
    topics: ["security"],
    editions: [
      ["Las Vegas", "USA", "2022-08-09", "2022-08-10"],
      ["Las Vegas", "USA", "2023-08-08", "2023-08-09"],
      ["Las Vegas", "USA", "2024-08-06", "2024-08-07"],
      ["Las Vegas", "USA", "2025-08-05", "2025-08-06"],
    ],
  },
  {
    name: "BSides San Francisco",
    url: "https://bsidessf.org/",
    topics: ["security"],
    editions: [
      ["San Francisco", "USA", "2023-04-22", "2023-04-23"],
      ["San Francisco", "USA", "2024-05-04", "2024-05-05"],
      ["San Francisco", "USA", "2025-04-26", "2025-04-27"],
    ],
  },
  {
    name: "OWASP Global AppSec North America",
    url: "https://owasp.org/events/",
    topics: ["security"],
    editions: [
      ["Austin", "USA", "2022-09-26", "2022-09-30"],
      ["Washington", "USA", "2023-10-30", "2023-11-03"],
      ["San Francisco", "USA", "2024-09-23", "2024-09-26"],
    ],
  },
  {
    name: "THOTCON",
    url: "https://thotcon.org/",
    topics: ["security"],
    editions: [
      ["Chicago", "USA", "2022-05-13", "2022-05-14"],
      ["Chicago", "USA", "2023-05-05", "2023-05-06"],
      ["Chicago", "USA", "2024-05-03", "2024-05-04"],
    ],
  },
  {
    name: "WildWestHackin'Fest",
    url: "https://wildwesthackinfest.com/",
    topics: ["security"],
    editions: [
      ["Deadwood", "USA", "2022-10-05", "2022-10-07"],
      ["Deadwood", "USA", "2023-10-04", "2023-10-06"],
      ["Deadwood", "USA", "2024-10-09", "2024-10-11"],
    ],
  },
];

export async function collect() {
  console.log(`security-archives: ${SERIES.length} series`);
  const out = [];
  for (const s of SERIES) {
    for (const [city, country, startDate, endDate] of s.editions) {
      out.push({
        name: s.name,
        city,
        country,
        startDate,
        endDate,
        topics: [...s.topics],
        url: s.url,
        online: false,
        source: "security-archives",
      });
    }
  }
  return out;
}
