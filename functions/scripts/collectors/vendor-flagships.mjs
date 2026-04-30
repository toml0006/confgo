/**
 * Collector: hand-curated catalog of major NA tech vendor flagship events.
 *
 * Editions list per vendor: [city, country, startDate (YYYY-MM-DD), endDate].
 * Dates verified against vendor sites at time of writing — re-check
 * announced future editions periodically. Online-only years are skipped.
 *
 * Adding a vendor: append an entry to VENDORS. Each edition becomes its own
 * conference doc (orchestrator dedupe key is name|startDate).
 */

const VENDORS = [
  {
    name: "AWS re:Invent",
    url: "https://reinvent.awsevents.com/",
    topics: ["cloud", "devops"],
    editions: [
      ["Las Vegas", "USA", "2021-11-29", "2021-12-03"],
      ["Las Vegas", "USA", "2022-11-28", "2022-12-02"],
      ["Las Vegas", "USA", "2023-11-27", "2023-12-01"],
      ["Las Vegas", "USA", "2024-12-02", "2024-12-06"],
      ["Las Vegas", "USA", "2025-12-01", "2025-12-05"],
      ["Las Vegas", "USA", "2026-11-30", "2026-12-04"],
    ],
  },
  {
    name: "Microsoft Build",
    url: "https://build.microsoft.com/",
    topics: ["general", "dotnet", "cloud"],
    editions: [
      ["Seattle", "USA", "2022-05-24", "2022-05-26"],
      ["Seattle", "USA", "2023-05-23", "2023-05-25"],
      ["Seattle", "USA", "2024-05-21", "2024-05-23"],
      ["Seattle", "USA", "2025-05-19", "2025-05-22"],
    ],
  },
  {
    name: "Google I/O",
    url: "https://io.google/",
    topics: ["general", "android", "cloud"],
    editions: [
      ["Mountain View", "USA", "2022-05-11", "2022-05-12"],
      ["Mountain View", "USA", "2023-05-10", "2023-05-10"],
      ["Mountain View", "USA", "2024-05-14", "2024-05-15"],
      ["Mountain View", "USA", "2025-05-20", "2025-05-21"],
    ],
  },
  {
    name: "Apple WWDC",
    url: "https://developer.apple.com/wwdc/",
    topics: ["ios", "general"],
    editions: [
      ["Cupertino", "USA", "2022-06-06", "2022-06-10"],
      ["Cupertino", "USA", "2023-06-05", "2023-06-09"],
      ["Cupertino", "USA", "2024-06-10", "2024-06-14"],
      ["Cupertino", "USA", "2025-06-09", "2025-06-13"],
    ],
  },
  {
    name: "Salesforce Dreamforce",
    url: "https://www.salesforce.com/dreamforce/",
    topics: ["general", "product"],
    editions: [
      ["San Francisco", "USA", "2022-09-20", "2022-09-22"],
      ["San Francisco", "USA", "2023-09-12", "2023-09-14"],
      ["San Francisco", "USA", "2024-09-17", "2024-09-19"],
      ["San Francisco", "USA", "2025-10-14", "2025-10-16"],
    ],
  },
  {
    name: "GitHub Universe",
    url: "https://githubuniverse.com/",
    topics: ["general", "devops"],
    editions: [
      ["San Francisco", "USA", "2023-11-08", "2023-11-09"],
      ["San Francisco", "USA", "2024-10-29", "2024-10-30"],
      ["San Francisco", "USA", "2025-10-28", "2025-10-29"],
    ],
  },
  {
    name: "HashiConf",
    url: "https://hashiconf.com/",
    topics: ["devops", "cloud"],
    editions: [
      ["Los Angeles", "USA", "2022-10-04", "2022-10-06"],
      ["San Francisco", "USA", "2023-10-10", "2023-10-12"],
      ["Boston", "USA", "2024-10-15", "2024-10-17"],
    ],
  },
  {
    name: "Snowflake Summit",
    url: "https://www.snowflake.com/summit/",
    topics: ["data"],
    editions: [
      ["Las Vegas", "USA", "2022-06-13", "2022-06-16"],
      ["Las Vegas", "USA", "2023-06-26", "2023-06-29"],
      ["San Francisco", "USA", "2024-06-03", "2024-06-06"],
      ["San Francisco", "USA", "2025-06-02", "2025-06-05"],
    ],
  },
  {
    name: "Databricks Data + AI Summit",
    url: "https://www.databricks.com/dataaisummit",
    topics: ["data"],
    editions: [
      ["San Francisco", "USA", "2022-06-27", "2022-06-30"],
      ["San Francisco", "USA", "2023-06-26", "2023-06-29"],
      ["San Francisco", "USA", "2024-06-10", "2024-06-13"],
      ["San Francisco", "USA", "2025-06-09", "2025-06-12"],
    ],
  },
  {
    name: "NVIDIA GTC",
    url: "https://www.nvidia.com/gtc/",
    topics: ["data", "general"],
    editions: [
      ["San Jose", "USA", "2024-03-18", "2024-03-21"],
      ["San Jose", "USA", "2025-03-17", "2025-03-21"],
      ["San Jose", "USA", "2026-03-16", "2026-03-20"],
    ],
  },
  {
    name: "Cisco Live US",
    url: "https://www.ciscolive.com/us.html",
    topics: ["networking"],
    editions: [
      ["Las Vegas", "USA", "2022-06-12", "2022-06-16"],
      ["Las Vegas", "USA", "2023-06-04", "2023-06-08"],
      ["Las Vegas", "USA", "2024-06-02", "2024-06-06"],
      ["San Diego", "USA", "2025-06-08", "2025-06-12"],
    ],
  },
  {
    name: "Adobe MAX",
    url: "https://max.adobe.com/",
    topics: ["ux", "general"],
    editions: [
      ["Los Angeles", "USA", "2022-10-18", "2022-10-20"],
      ["Los Angeles", "USA", "2023-10-10", "2023-10-12"],
      ["Miami Beach", "USA", "2024-10-14", "2024-10-16"],
      ["Los Angeles", "USA", "2025-10-28", "2025-10-30"],
    ],
  },
  {
    name: "Oracle CloudWorld",
    url: "https://www.oracle.com/cloudworld/",
    topics: ["cloud", "data"],
    editions: [
      ["Las Vegas", "USA", "2022-10-17", "2022-10-20"],
      ["Las Vegas", "USA", "2023-09-18", "2023-09-21"],
      ["Las Vegas", "USA", "2024-09-09", "2024-09-12"],
    ],
  },
  {
    name: "HubSpot INBOUND",
    url: "https://www.inbound.com/",
    topics: ["product", "general"],
    editions: [
      ["Boston", "USA", "2022-09-06", "2022-09-09"],
      ["Boston", "USA", "2023-09-05", "2023-09-08"],
      ["Boston", "USA", "2024-09-18", "2024-09-20"],
    ],
  },
  {
    name: "SaaStr Annual",
    url: "https://www.saastrannual.com/",
    topics: ["product", "general"],
    editions: [
      ["San Mateo", "USA", "2022-09-13", "2022-09-15"],
      ["San Mateo", "USA", "2023-09-06", "2023-09-08"],
      ["San Mateo", "USA", "2024-09-10", "2024-09-12"],
    ],
  },
  {
    name: "Salesforce TrailblazerDX",
    url: "https://www.salesforce.com/trailblazerdx/",
    topics: ["general"],
    editions: [
      ["San Francisco", "USA", "2023-03-07", "2023-03-09"],
      ["San Francisco", "USA", "2024-03-06", "2024-03-07"],
      ["San Francisco", "USA", "2025-03-05", "2025-03-06"],
    ],
  },
  {
    name: "Atlassian Team",
    url: "https://www.atlassian.com/team",
    topics: ["product", "general"],
    editions: [
      ["Las Vegas", "USA", "2023-04-18", "2023-04-20"],
      ["Las Vegas", "USA", "2024-04-30", "2024-05-02"],
      ["Anaheim", "USA", "2025-04-08", "2025-04-10"],
    ],
  },
  {
    name: "DockerCon",
    url: "https://www.docker.com/dockercon/",
    topics: ["devops", "cloud"],
    editions: [
      ["Los Angeles", "USA", "2023-10-04", "2023-10-05"],
      ["Los Angeles", "USA", "2024-10-09", "2024-10-10"],
    ],
  },
  {
    name: "ServiceNow Knowledge",
    url: "https://www.servicenow.com/knowledge/",
    topics: ["general"],
    editions: [
      ["Las Vegas", "USA", "2024-05-06", "2024-05-09"],
      ["Las Vegas", "USA", "2025-05-05", "2025-05-08"],
    ],
  },
  {
    name: "Twilio SIGNAL",
    url: "https://signal.twilio.com/",
    topics: ["general"],
    editions: [
      ["San Francisco", "USA", "2023-08-23", "2023-08-24"],
      ["San Francisco", "USA", "2024-08-27", "2024-08-28"],
    ],
  },
  {
    name: "KubeCon + CloudNativeCon North America",
    url: "https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/",
    topics: ["devops", "cloud"],
    editions: [
      ["Detroit", "USA", "2022-10-24", "2022-10-28"],
      ["Chicago", "USA", "2023-11-06", "2023-11-09"],
      ["Salt Lake City", "USA", "2024-11-12", "2024-11-15"],
      ["Atlanta", "USA", "2025-11-10", "2025-11-13"],
    ],
  },
];

export async function collect() {
  console.log(`vendor-flagships: ${VENDORS.length} vendors`);
  const out = [];
  for (const v of VENDORS) {
    for (const [city, country, startDate, endDate] of v.editions) {
      out.push({
        name: v.name,
        city,
        country,
        startDate,
        endDate,
        topics: [...v.topics],
        url: v.url,
        online: false,
        source: "vendor-flagships",
      });
    }
  }
  return out;
}
