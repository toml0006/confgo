/**
 * Curated organizer → HQ city lookup for online events that lack a
 * physical city. Used by the orchestrator only for records with
 * `online: true` and no city — anchors them to the company HQ so they
 * still get a map pin.
 *
 * Patterns are intentionally narrow (anchored phrases, not single-token
 * brand names) to avoid false positives like a generic "Knowledge"
 * conference matching ServiceNow Knowledge. First match wins.
 *
 * "HQ" means the organizing company's headquarters city, not the event
 * venue — re:Invent is in Vegas every year, but for an unanchored
 * online edition we'd pin AWS at Seattle.
 */

const HQ = [
  // tech vendor flagships — mostly already represented in vendor-flagships
  // as in-person editions; this catches virtual / unanchored editions that
  // confs.tech lists with online: true and no city.
  { match: /\b(aws|amazon)\s*re:?invent\b/i, city: "Seattle", country: "U.S.A." },
  { match: /\bmicrosoft (build|ignite|inspire)\b|\bazure (cosmos db|friday|saturday)\b/i, city: "Redmond", country: "U.S.A." },
  { match: /\bgoogle (i\/o|cloud next|developer)\b/i, city: "Mountain View", country: "U.S.A." },
  { match: /\b(apple\s+)?wwdc\b/i, city: "Cupertino", country: "U.S.A." },
  { match: /\bgithub (universe|satellite|galaxy)\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\b(dreamforce|trailblazerdx|salesforce world tour)\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\bhashiconf\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\bsnowflake summit\b/i, city: "Bozeman", country: "U.S.A." },
  { match: /\bdatabricks (data\s*\+\s*ai|world tour)\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\bnvidia gtc\b|\bgtc\s+(20\d\d|ai|digital)\b/i, city: "Santa Clara", country: "U.S.A." },
  { match: /\bcisco live\b/i, city: "San Jose", country: "U.S.A." },
  { match: /\badobe max\b/i, city: "San Jose", country: "U.S.A." },
  { match: /\boracle (cloudworld|openworld|code one)\b/i, city: "Austin", country: "U.S.A." },
  { match: /\bhubspot (inbound|spotlight)\b|\binbound\s+20\d\d\b/i, city: "Cambridge", country: "U.S.A." },
  { match: /\bservicenow knowledge\b/i, city: "Santa Clara", country: "U.S.A." },
  { match: /\btwilio\s+signal\b|\btwilio\s+(20\d\d|engage|connect)\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\batlassian team '?\d/i, city: "San Francisco", country: "U.S.A." },
  { match: /\bdockercon\b/i, city: "Palo Alto", country: "U.S.A." },
  { match: /\bred hat (summit|developer day)\b/i, city: "Raleigh", country: "U.S.A." },
  { match: /\bibm think\b/i, city: "Armonk", country: "U.S.A." },
  { match: /\bmongodb (\.local|world)\b/i, city: "New York", country: "U.S.A." },
  { match: /\bdigitalocean (deploy|tide|currents)\b/i, city: "New York", country: "U.S.A." },
  { match: /\bcloudflare (connect|tv)\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\belasticon\b/i, city: "Mountain View", country: "U.S.A." },
  { match: /\b(grafanacon|observabilitycon)\b/i, city: "New York", country: "U.S.A." },
  { match: /\bpulumi up\b/i, city: "Seattle", country: "U.S.A." },
  // observed in confs.tech online no-city catalog
  { match: /\bnext\.?js conf\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\bp99 conf\b/i, city: "Palo Alto", country: "U.S.A." },
  { match: /\bneo4j\s+(connections|nodes)\b|^nodes\b/i, city: "San Mateo", country: "U.S.A." },
  { match: /\bdeveloperweek\b/i, city: "San Francisco", country: "U.S.A." },
  { match: /\btwimlcon\b/i, city: "Seattle", country: "U.S.A." },
  { match: /\bdevops enterprise summit\b/i, city: "Portland", country: "U.S.A." },
];

export function lookupHq(name) {
  if (!name) return null;
  for (const { match, city, country } of HQ) {
    if (match.test(name)) return { city, country };
  }
  return null;
}
