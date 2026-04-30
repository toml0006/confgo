/**
 * Collector: Linux Foundation and adjacent open-source community events,
 * NA editions only. EU/APAC editions are intentionally excluded.
 *
 * Hand-curated. Dates verified against the conference home pages /
 * Wayback at time of writing — re-check announced future editions
 * periodically. Series with uncertain past dates were omitted rather
 * than guessed.
 *
 * "Linux Foundation" here is shorthand for the broader OSS event
 * ecosystem (LF, USENIX, Red Hat, OCP Foundation, OpenInfra Foundation,
 * community-run). KubeCon NA lives in vendor-flagships.mjs since it's
 * already represented there.
 */

const SERIES = [
  {
    name: "Open Source Summit North America",
    url: "https://events.linuxfoundation.org/open-source-summit-north-america/",
    topics: ["devops", "general"],
    editions: [
      ["Austin", "USA", "2022-06-21", "2022-06-24"],
      ["Vancouver", "Canada", "2023-05-10", "2023-05-12"],
      ["Seattle", "USA", "2024-04-16", "2024-04-18"],
      ["Denver", "USA", "2025-06-23", "2025-06-25"],
    ],
  },
  {
    name: "All Things Open",
    url: "https://allthingsopen.org/",
    topics: ["general"],
    editions: [
      ["Raleigh", "USA", "2022-10-30", "2022-11-01"],
      ["Raleigh", "USA", "2023-10-15", "2023-10-17"],
      ["Raleigh", "USA", "2024-10-27", "2024-10-29"],
      ["Raleigh", "USA", "2025-10-19", "2025-10-21"],
    ],
  },
  {
    name: "OCP Global Summit",
    url: "https://www.opencompute.org/summit",
    topics: ["architecture"],
    editions: [
      ["San Jose", "USA", "2022-10-18", "2022-10-20"],
      ["San Jose", "USA", "2023-10-17", "2023-10-19"],
      ["San Jose", "USA", "2024-10-15", "2024-10-17"],
    ],
  },
  {
    name: "DevConf.US",
    url: "https://www.devconf.info/us/",
    topics: ["devops", "general"],
    editions: [
      ["Boston", "USA", "2023-08-11", "2023-08-13"],
      ["Boston", "USA", "2024-08-09", "2024-08-11"],
    ],
  },
  {
    name: "Linux Plumbers Conference",
    url: "https://lpc.events/",
    topics: ["architecture"],
    editions: [
      ["Richmond", "USA", "2023-11-13", "2023-11-15"],
    ],
  },
  {
    name: "Open Infrastructure Summit",
    url: "https://openinfra.dev/summit/",
    topics: ["cloud", "devops"],
    editions: [
      ["Vancouver", "Canada", "2023-06-13", "2023-06-15"],
    ],
  },
  // SCaLE 20x / 22x are in confs.tech; fill the gaps with 19x / 21x.
  {
    name: "SCaLE 19x",
    url: "https://www.socallinuxexpo.org/",
    topics: ["devops", "general"],
    editions: [
      ["Pasadena", "USA", "2022-03-03", "2022-03-06"],
    ],
  },
  {
    name: "SCaLE 21x",
    url: "https://www.socallinuxexpo.org/",
    topics: ["devops", "general"],
    editions: [
      ["Pasadena", "USA", "2024-03-14", "2024-03-17"],
    ],
  },
];

export async function collect() {
  console.log(`linux-foundation: ${SERIES.length} series`);
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
        source: "linux-foundation",
      });
    }
  }
  return out;
}
