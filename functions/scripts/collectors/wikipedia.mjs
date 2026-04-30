/**
 * Collector: hand-curated catalog of major academic-research and
 * industry-research conferences, NA editions only.
 *
 * Source attribution is "wikipedia" since dates were cross-referenced
 * against Wikipedia + each conference's official archive page. Confidence
 * is high for the editions listed; conferences whose NA editions had
 * uncertain dates were omitted rather than guessed.
 *
 * Editions list per series: [city, country, startDate, endDate]. Series
 * that hop between continents are listed only with their NA editions —
 * EU/APAC editions are intentionally excluded.
 */

const SERIES = [
  {
    name: "NeurIPS",
    url: "https://neurips.cc/",
    topics: ["data", "python"],
    editions: [
      ["New Orleans", "USA", "2022-11-28", "2022-12-09"],
      ["New Orleans", "USA", "2023-12-10", "2023-12-16"],
      ["Vancouver", "Canada", "2024-12-10", "2024-12-15"],
    ],
  },
  {
    name: "ICML",
    url: "https://icml.cc/",
    topics: ["data", "python"],
    editions: [
      ["Baltimore", "USA", "2022-07-17", "2022-07-23"],
      ["Honolulu", "USA", "2023-07-23", "2023-07-29"],
      ["Vancouver", "Canada", "2025-07-13", "2025-07-19"],
    ],
  },
  {
    name: "CVPR",
    url: "https://cvpr.thecvf.com/",
    topics: ["data"],
    editions: [
      ["New Orleans", "USA", "2022-06-19", "2022-06-24"],
      ["Vancouver", "Canada", "2023-06-17", "2023-06-24"],
      ["Seattle", "USA", "2024-06-17", "2024-06-21"],
      ["Nashville", "USA", "2025-06-11", "2025-06-15"],
    ],
  },
  {
    name: "AAAI Conference on Artificial Intelligence",
    url: "https://aaai.org/conference/aaai/",
    topics: ["data"],
    editions: [
      ["Washington", "USA", "2023-02-07", "2023-02-14"],
      ["Vancouver", "Canada", "2024-02-20", "2024-02-27"],
      ["Philadelphia", "USA", "2025-02-25", "2025-03-04"],
    ],
  },
  {
    name: "SIGGRAPH",
    url: "https://www.siggraph.org/",
    topics: ["general"],
    editions: [
      ["Vancouver", "Canada", "2022-08-08", "2022-08-11"],
      ["Los Angeles", "USA", "2023-08-06", "2023-08-10"],
      ["Denver", "USA", "2024-07-28", "2024-08-01"],
      ["Vancouver", "Canada", "2025-08-10", "2025-08-14"],
    ],
  },
  {
    name: "IEEE Symposium on Security and Privacy",
    url: "https://www.ieee-security.org/TC/SP/",
    topics: ["security"],
    editions: [
      ["San Francisco", "USA", "2022-05-23", "2022-05-26"],
      ["San Francisco", "USA", "2023-05-22", "2023-05-25"],
      ["San Francisco", "USA", "2024-05-20", "2024-05-23"],
      ["San Francisco", "USA", "2025-05-12", "2025-05-15"],
    ],
  },
  {
    name: "USENIX ATC",
    url: "https://www.usenix.org/conference/atc",
    topics: ["architecture", "sre"],
    editions: [
      ["Carlsbad", "USA", "2022-07-11", "2022-07-13"],
      ["Boston", "USA", "2023-07-10", "2023-07-12"],
      ["Santa Clara", "USA", "2024-07-10", "2024-07-12"],
    ],
  },
  {
    name: "OSDI",
    url: "https://www.usenix.org/conference/osdi",
    topics: ["architecture"],
    editions: [
      ["Carlsbad", "USA", "2022-07-11", "2022-07-13"],
      ["Boston", "USA", "2023-07-10", "2023-07-12"],
      ["Santa Clara", "USA", "2024-07-10", "2024-07-12"],
    ],
  },
  {
    name: "NSDI",
    url: "https://www.usenix.org/conference/nsdi",
    topics: ["networking", "architecture"],
    editions: [
      ["Renton", "USA", "2022-04-04", "2022-04-06"],
      ["Boston", "USA", "2023-04-17", "2023-04-19"],
      ["Santa Clara", "USA", "2024-04-16", "2024-04-18"],
      ["Philadelphia", "USA", "2025-04-28", "2025-04-30"],
    ],
  },
  {
    name: "SOSP",
    url: "https://sosp.org/",
    topics: ["architecture"],
    editions: [
      ["Austin", "USA", "2024-11-04", "2024-11-06"],
    ],
  },
  {
    name: "POPL",
    url: "https://popl25.sigplan.org/",
    topics: ["general"],
    editions: [
      ["Boston", "USA", "2023-01-15", "2023-01-21"],
      ["Denver", "USA", "2025-01-19", "2025-01-25"],
    ],
  },
  {
    name: "PLDI",
    url: "https://pldi23.sigplan.org/",
    topics: ["general"],
    editions: [
      ["San Diego", "USA", "2022-06-13", "2022-06-17"],
      ["Orlando", "USA", "2023-06-17", "2023-06-21"],
    ],
  },
  {
    name: "SPLASH",
    url: "https://www.splashcon.org/",
    topics: ["general"],
    editions: [
      ["Pasadena", "USA", "2024-10-20", "2024-10-25"],
    ],
  },
  {
    name: "ICSE",
    url: "https://conf.researchr.org/series/icse",
    topics: ["general"],
    editions: [
      ["Pittsburgh", "USA", "2022-05-21", "2022-05-29"],
      ["Ottawa", "Canada", "2025-04-27", "2025-05-03"],
    ],
  },
  {
    name: "NDSS Symposium",
    url: "https://www.ndss-symposium.org/",
    topics: ["security"],
    editions: [
      ["San Diego", "USA", "2022-04-24", "2022-04-28"],
      ["San Diego", "USA", "2023-02-27", "2023-03-03"],
      ["San Diego", "USA", "2024-02-26", "2024-03-01"],
      ["San Diego", "USA", "2025-02-24", "2025-02-28"],
    ],
  },
  {
    name: "ACM SIGMOD",
    url: "https://sigmod.org/",
    topics: ["data"],
    editions: [
      ["Philadelphia", "USA", "2022-06-12", "2022-06-17"],
      ["Seattle", "USA", "2023-06-18", "2023-06-23"],
    ],
  },
  {
    name: "VLDB",
    url: "https://vldb.org/",
    topics: ["data"],
    editions: [
      ["Vancouver", "Canada", "2023-08-28", "2023-09-01"],
    ],
  },
  {
    name: "ACM SIGCOMM",
    url: "https://www.sigcomm.org/",
    topics: ["networking"],
    editions: [
      ["New York", "USA", "2023-09-10", "2023-09-14"],
    ],
  },
  {
    name: "ACM CCS",
    url: "https://www.sigsac.org/ccs.html",
    topics: ["security"],
    editions: [
      ["Los Angeles", "USA", "2022-11-07", "2022-11-11"],
      ["Salt Lake City", "USA", "2024-10-14", "2024-10-18"],
    ],
  },
  {
    name: "USENIX FAST",
    url: "https://www.usenix.org/conference/fast",
    topics: ["architecture", "data"],
    editions: [
      ["Santa Clara", "USA", "2022-02-22", "2022-02-24"],
      ["Santa Clara", "USA", "2023-02-21", "2023-02-23"],
      ["Santa Clara", "USA", "2024-02-26", "2024-02-29"],
      ["Santa Clara", "USA", "2025-02-25", "2025-02-27"],
    ],
  },
  {
    name: "The Web Conference (WWW)",
    url: "https://www2024.thewebconf.org/",
    topics: ["general"],
    editions: [
      ["Austin", "USA", "2023-04-30", "2023-05-04"],
    ],
  },
];

export async function collect() {
  console.log(`wikipedia: ${SERIES.length} series`);
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
        source: "wikipedia",
      });
    }
  }
  return out;
}
