import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import { apiFetch, type Conference, type AttendanceIntent } from "../../api";
import { conferenceGlow, isFuture, isPast } from "../../lib/decay";
import { useTheme } from "../../lib/theme";
import {
  coreColor,
  coreOpacity,
  coreRadius,
  haloColor,
  haloOpacity,
  haloRadius,
  type Colors,
} from "./styleExpressions";

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function readPalette(): Colors {
  // mapbox-gl's color parser only understands sRGB inputs (hex / rgb /
  // hsl), so we read the `-hex` companion vars rather than the p3
  // `color()` form used by CSS-side surfaces.
  return {
    future: readCssVar("--future-color-hex", "#65a30d"),
    futureMine: readCssVar("--future-mine-color-hex", "#3f6212"),
    past: readCssVar("--past-color-hex", "#be185d"),
    pastMine: readCssVar("--past-mine-color-hex", "#9f1239"),
    premium: readCssVar("--premium-color-hex", "#b794f6"),
    hover: readCssVar("--accent-color-hex", "#c2410c"),
    haloHover: readCssVar("--accent-soft-hex", "#fde6d6"),
  };
}

export type MapViewProps = {
  conferences: Conference[];
  myAttendances: Map<string, AttendanceIntent>;
  showPast: boolean;
  showFuture: boolean;
  onSelect: (confs: Conference[], anchor: Conference) => void;
  flyTo: { longitude: number; latitude: number; zoom?: number } | null;
};

const SOURCE_ID = "conferences";
const CORE_LAYER = "conferences-core";
const HALO_LAYER = "conferences-halo";
const CLICK_TOLERANCE = 14; // px

const STYLE_FOR_MODE = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};

function stateOf(conf: Conference, mine: boolean, now: Date): string {
  const past = isPast(conf.endDate, now);
  if (mine && past) return "past-mine";
  if (mine) return "mine";
  if (past) return "past";
  return "default";
}

// Cheap string hash → 32-bit unsigned int. Used to derive a stable PRNG
// stream from each conference id so pin jitter is deterministic per event
// and survives across reloads.
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Two values in [-1, 1) seeded from a conference id. Different multipliers
// for the two axes so x/y jitter aren't correlated.
function jitter(id: string): [number, number] {
  const h = hash32(id);
  const x = ((h & 0xffff) / 0xffff) * 2 - 1;
  const y = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return [x, y];
}

// Approximate degree-radius for the dot scatter. Roughly 8 km at the
// equator — small enough that a city-coordinate stays in its city, large
// enough that ~10 events at the same coords visually separate.
const JITTER_DEG = 0.08;

export function MapView({
  conferences,
  myAttendances,
  showPast,
  showFuture,
  onSelect,
  flyTo,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const styleLoadedRef = useRef(false);
  const featuresRef = useRef<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const lastModeRef = useRef<"light" | "dark" | null>(null);
  const { mode, accent } = useTheme();
  // Attendee counts cached across hovers. -1 means fetch in flight, positive
  // = resolved count. Held in a ref because the value is consumed inside
  // non-React mapbox event handlers — no need to re-render React on
  // every popup paint.
  const attendeeCountsRef = useRef<Record<string, number>>({});

  // (Re)install source + layers on every style load — needed both for the
  // initial style load AND for setStyle() swaps when the user toggles mode.
  // We seed the source with whatever features we currently have so a style
  // swap doesn't wipe the heatmap until the next React effect fires.
  function installLayers(map: MapboxMap) {
    if (map.getSource(SOURCE_ID)) return; // already installed for this style
    const palette = readPalette();
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: featuresRef.current,
    });
    map.addLayer({
      id: HALO_LAYER,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": haloRadius(),
        "circle-color": haloColor(palette),
        "circle-opacity": haloOpacity,
        "circle-pitch-alignment": "map",
        "circle-blur": 0.6,
        "circle-radius-transition": { duration: 200, delay: 0 },
      },
    });
    map.addLayer({
      id: CORE_LAYER,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": coreRadius(),
        "circle-color": coreColor(palette),
        "circle-opacity": coreOpacity,
        "circle-stroke-width": 0,
        "circle-radius-transition": { duration: 200, delay: 0 },
        "circle-color-transition": { duration: 200, delay: 0 },
      },
    });
  }

  // init map (once)
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_FOR_MODE[mode],
      center: [-98.35, 39.5],
      zoom: 3.85,
      projection: "mercator",
      attributionControl: false,
    });
    const onStyleLoad = () => {
      styleLoadedRef.current = true;
      installLayers(map);
    };
    map.on("style.load", onStyleLoad);
    mapRef.current = map;
    lastModeRef.current = mode;
    return () => {
      map.off("style.load", onStyleLoad);
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode change — swap tile style. The style.load listener installed in init
  // re-runs `installLayers`, which seeds from `featuresRef.current` so the
  // heatmap survives the swap. Skip on first render: the constructor already
  // loaded the right style URL, so calling setStyle again would only churn.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lastModeRef.current === mode) return;
    lastModeRef.current = mode;
    styleLoadedRef.current = false;
    map.setStyle(STYLE_FOR_MODE[mode]);
  }, [mode]);

  // compute filtered feature collection
  const featureCollection = useMemo(() => {
    const now = new Date();
    const features = conferences
      .filter((c) => {
        const past = isPast(c.endDate, now);
        const future = isFuture(c.startDate, now);
        if (past && !showPast) return false;
        if (future && !showFuture) return false;
        return true;
      })
      .map((c) => {
        const mine = myAttendances.has(c.id);
        const [jx, jy] = jitter(c.id);
        return {
          type: "Feature" as const,
          id: c.id,
          geometry: {
            type: "Point" as const,
            coordinates: [
              c.longitude + jx * JITTER_DEG,
              c.latitude + jy * JITTER_DEG,
            ],
          },
          properties: {
            confId: c.id,
            state: stateOf(c, mine, now),
            glow: conferenceGlow(c.startDate, c.endDate, now),
            premium: c.premium === true,
          },
        };
      });
    return { type: "FeatureCollection" as const, features };
  }, [conferences, myAttendances, showPast, showFuture]);

  // push features into the source (waits for style.load if needed)
  useEffect(() => {
    featuresRef.current = featureCollection;
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(featureCollection);
    };
    if (styleLoadedRef.current) apply();
    else {
      const onLoad = () => {
        apply();
        map.off("style.load", onLoad);
      };
      map.on("style.load", onLoad);
    }
  }, [featureCollection]);

  // Accent change — recompute heatmap palette and re-set color paint props.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const palette = readPalette();
    if (map.getLayer(CORE_LAYER)) {
      map.setPaintProperty(CORE_LAYER, "circle-color", coreColor(palette));
    }
    if (map.getLayer(HALO_LAYER)) {
      map.setPaintProperty(HALO_LAYER, "circle-color", haloColor(palette));
    }
  }, [accent, mode]);

  // hover popup — uses mapbox-gl's own Popup primitive per the
  // mouseenter/mouseleave pattern from
  // https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const byId = new Map(conferences.map((c) => [c.id, c]));
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "vb-map-popup",
    });
    let hoveredId: string | null = null;
    const setHovered = (id: string | null) => {
      if (id === hoveredId) return;
      if (hoveredId) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredId },
          { hover: false },
        );
      }
      hoveredId = id;
      if (hoveredId) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredId },
          { hover: true },
        );
      }
    };
    const renderHTML = (conf: Conference, count: number | null) => {
      const date = formatDateRange(conf.startDate, conf.endDate);
      const att =
        count === null
          ? `<div class="vb-line vb-att">— attendees</div>`
          : `<div class="vb-line vb-att">${count} attendee${count === 1 ? "" : "s"}</div>`;
      return `<div class="vb-name">${escapeHtml(conf.name)}</div>
<div class="vb-line">${escapeHtml(conf.locationName)}</div>
<div class="vb-line">${escapeHtml(date)}</div>${att}`;
    };
    const onEnter = (
      e: mapboxgl.MapMouseEvent & {
        features?: mapboxgl.MapboxGeoJSONFeature[];
      },
    ) => {
      const f = e.features?.[0];
      if (!f) return;
      const id = f.id as string | undefined;
      const conf = id ? byId.get(id) : undefined;
      if (!conf) return;
      map.getCanvas().style.cursor = "pointer";
      setHovered(id ?? null);
      const cached = id ? attendeeCountsRef.current[id] : undefined;
      const initial =
        cached === undefined || cached === -1 ? null : cached;
      popup
        .setLngLat([conf.longitude, conf.latitude])
        .setHTML(renderHTML(conf, initial))
        .addTo(map);
      // Lazy-fetch attendee count if we don't have it yet, then update the
      // popup HTML in place — only if popup still showing the same conf.
      if (id && cached === undefined) {
        attendeeCountsRef.current[id] = -1;
        apiFetch<{ attendees: { userId: string }[] }>(
          `/conferences/${id}/attendees`,
        )
          .then((r) => {
            attendeeCountsRef.current[id] = r.attendees.length;
            if (hoveredId === id) {
              popup.setHTML(renderHTML(conf, r.attendees.length));
            }
          })
          .catch(() => {
            attendeeCountsRef.current[id] = 0;
          });
      }
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      setHovered(null);
      popup.remove();
    };
    map.on("mouseenter", CORE_LAYER, onEnter);
    map.on("mousemove", CORE_LAYER, onEnter);
    map.on("mouseleave", CORE_LAYER, onLeave);
    return () => {
      map.off("mouseenter", CORE_LAYER, onEnter);
      map.off("mousemove", CORE_LAYER, onEnter);
      map.off("mouseleave", CORE_LAYER, onLeave);
      popup.remove();
    };
  }, [conferences]);

  // click → grouped by shared lat/lng
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const byId = new Map(conferences.map((c) => [c.id, c]));
    const handler = (e: mapboxgl.MapMouseEvent) => {
      const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
        [e.point.x - CLICK_TOLERANCE, e.point.y - CLICK_TOLERANCE],
        [e.point.x + CLICK_TOLERANCE, e.point.y + CLICK_TOLERANCE],
      ];
      const hits = map.queryRenderedFeatures(bbox, {
        layers: [CORE_LAYER, HALO_LAYER],
      });
      if (hits.length === 0) return;
      const firstId = hits[0].properties?.confId as string | undefined;
      if (!firstId) return;
      const anchor = byId.get(firstId);
      if (!anchor) return;
      const key = (c: Conference) =>
        `${c.latitude.toFixed(4)}|${c.longitude.toFixed(4)}`;
      const targetKey = key(anchor);
      const group: Conference[] = [];
      const seen = new Set<string>();
      for (const f of hits) {
        const id = f.properties?.confId as string | undefined;
        if (!id || seen.has(id)) continue;
        const c = byId.get(id);
        if (!c) continue;
        if (key(c) !== targetKey) continue;
        seen.add(id);
        group.push(c);
      }
      for (const c of conferences) {
        if (seen.has(c.id)) continue;
        if (key(c) === targetKey) {
          seen.add(c.id);
          group.push(c);
        }
      }
      group.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
      onSelect(group, anchor);
    };
    map.on("click", handler);
    return () => void map.off("click", handler);
  }, [conferences, onSelect]);

  // programmatic fly
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.longitude, flyTo.latitude],
      zoom: flyTo.zoom ?? 7,
      speed: 0.8,
      curve: 1.4,
    });
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      // Inline styles so mapbox-gl's own `.mapboxgl-map { position:
      // relative }` (loaded into the same cascade level via the CSS
      // import) can't collapse the container.
      style={{ position: "fixed", inset: 0 }}
      className="bg-bg"
    />
  );
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sStr = s.toLocaleDateString();
  if (!end || end === start) return sStr;
  // Same day after time-strip → single date
  if (sStr === e.toLocaleDateString()) return sStr;
  return `${sStr} – ${e.toLocaleDateString()}`;
}

// HTML-escape user-controlled strings before injecting into a Popup's
// innerHTML. Conference names + locations are user-input via the data
// pipeline, so we treat them as untrusted.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
