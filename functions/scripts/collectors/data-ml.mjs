/**
 * Collector: Data and ML community conferences, NA editions only.
 *
 * Hand-curated. Dates verified via the conference home pages / Wayback /
 * announcements at time of writing — re-check announced future editions
 * periodically. Series whose past dates I couldn't confirm with a primary
 * source were omitted rather than guessed. Editions already covered by
 * confs.tech are intentionally skipped to keep this collector focused on
 * gap-fill rather than reinforcement.
 *
 * Excluded on purpose because they live in other collectors:
 *   - Databricks Data + AI Summit, Snowflake Summit, NVIDIA GTC →
 *     vendor-flagships
 *   - NeurIPS, ICML, CVPR, AAAI → wikipedia
 *   - AI Engineer Summit / World's Fair, Ray Summit 2024+ → confs.tech
 */

const SERIES = [
  // Ray Summit (Anyscale). 2024+ already in confs.tech; backfilling 2022/2023.
  {
    name: "Ray Summit",
    url: "https://raysummit.anyscale.com/",
    topics: ["data"],
    editions: [
      ["San Francisco", "USA", "2022-08-22", "2022-08-24"],
      ["San Francisco", "USA", "2023-09-18", "2023-09-20"],
    ],
  },
  // MLOps World (+ Generative AI World since 2023). Toronto early years,
  // Austin from 2024. 2023 already in confs.tech.
  {
    name: "MLOps World",
    url: "https://mlopsworld.com/",
    topics: ["data", "devops"],
    editions: [
      ["Toronto", "Canada", "2022-06-07", "2022-06-10"],
      ["Austin", "USA", "2024-11-06", "2024-11-08"],
    ],
  },
  // dbt Coalesce — annual, varies city.
  {
    name: "dbt Coalesce",
    url: "https://coalesce.getdbt.com/",
    topics: ["data"],
    editions: [
      ["New Orleans", "USA", "2022-10-17", "2022-10-21"],
      ["San Diego", "USA", "2023-10-16", "2023-10-20"],
      ["Las Vegas", "USA", "2024-10-07", "2024-10-10"],
    ],
  },
  // ODSC East — Boston annually. 2022/2023 already in confs.tech.
  {
    name: "ODSC East",
    url: "https://odsc.com/boston/",
    topics: ["data"],
    editions: [
      ["Boston", "USA", "2024-04-23", "2024-04-25"],
    ],
  },
  // ODSC West — Burlingame/SF Bay annually. 2022/2023 already in confs.tech.
  {
    name: "ODSC West",
    url: "https://odsc.com/california/",
    topics: ["data"],
    editions: [
      ["Burlingame", "USA", "2024-10-29", "2024-10-31"],
    ],
  },
  // PyData NYC — Microsoft Times Square office, annually in fall.
  {
    name: "PyData NYC",
    url: "https://pydata.org/nyc2024/",
    topics: ["data", "python"],
    editions: [
      ["New York", "USA", "2022-11-09", "2022-11-11"],
      ["New York", "USA", "2023-11-01", "2023-11-03"],
      ["New York", "USA", "2024-11-06", "2024-11-08"],
    ],
  },
  // Ai4 — MGM Grand, Las Vegas, annually in August.
  {
    name: "Ai4",
    url: "https://ai4.io/",
    topics: ["data"],
    editions: [
      ["Las Vegas", "USA", "2022-08-16", "2022-08-18"],
      ["Las Vegas", "USA", "2023-08-07", "2023-08-09"],
      ["Las Vegas", "USA", "2024-08-12", "2024-08-14"],
    ],
  },
  // Knowledge Graph Conference — Cornell Tech NYC + virtual, annually in May.
  {
    name: "Knowledge Graph Conference",
    url: "https://www.knowledgegraph.tech/",
    topics: ["data"],
    editions: [
      ["New York", "USA", "2022-05-02", "2022-05-05"],
      ["New York", "USA", "2023-05-08", "2023-05-12"],
      ["New York", "USA", "2024-05-06", "2024-05-10"],
    ],
  },
  // Current (Confluent) — formerly Kafka Summit. Annual.
  {
    name: "Current",
    url: "https://current.confluent.io/",
    topics: ["data"],
    editions: [
      ["Austin", "USA", "2022-10-04", "2022-10-05"],
      ["San Jose", "USA", "2023-09-26", "2023-09-27"],
      ["Austin", "USA", "2024-09-17", "2024-09-18"],
    ],
  },
];

export async function collect() {
  console.log(`data-ml: ${SERIES.length} series`);
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
        source: "data-ml",
      });
    }
  }
  return out;
}
