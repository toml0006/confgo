import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import mapboxgl from "mapbox-gl";
import type { Conference, CoPeer } from "../lib/types";
import { conferenceGlow } from "../lib/decay";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

export interface ConferenceMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface Props {
  conferences: Conference[];
  myConferenceIds: Set<string>;
  coAttendanceMode: boolean;
  coPeers: CoPeer[];
  showPast: boolean;
  showFuture: boolean;
  onSelectLocation: (conferences: Conference[]) => void;
}

type LocationGroup = {
  key: string;
  latitude: number;
  longitude: number;
  conferences: Conference[];
};

function groupByLocation(conferences: Conference[]): LocationGroup[] {
  const m = new Map<string, LocationGroup>();
  for (const c of conferences) {
    const key = `${c.latitude.toFixed(4)}|${c.longitude.toFixed(4)}`;
    let g = m.get(key);
    if (!g) {
      g = { key, latitude: c.latitude, longitude: c.longitude, conferences: [] };
      m.set(key, g);
    }
    g.conferences.push(c);
  }
  return [...m.values()];
}

function buildFeatureCollection(
  conferences: Conference[],
  groups: LocationGroup[],
  myIds: Set<string>,
  coMode: boolean,
  coCountByConf: Map<string, number>,
  showPast: boolean,
  showFuture: boolean,
  now: number
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const group of groups) {
    // Filter applicable conferences for this group based on past/future toggles
    const filtered = group.conferences.filter((c) => {
      const end = Date.parse(c.endDate);
      const start = Date.parse(c.startDate);
      const past = end < now;
      const future = start > now;
      if (past && !showPast) return false;
      if (future && !showFuture) return false;
      return true;
    });
    if (!filtered.length) continue;

    // "Featured" conference for the group = highest-glow
    let top = filtered[0];
    let topGlow = conferenceGlow(top.startDate, top.endDate, now);
    for (const c of filtered) {
      const g = conferenceGlow(c.startDate, c.endDate, now);
      if (g > topGlow) {
        top = c;
        topGlow = g;
      }
    }

    const mine = filtered.some((c) => myIds.has(c.id));
    const past = Date.parse(top.endDate) < now;

    // Co-attendance mode: use max co-count across group
    let coCount = 0;
    if (coMode) {
      for (const c of filtered) {
        coCount = Math.max(coCount, coCountByConf.get(c.id) ?? 0);
      }
    }

    const sizeBoost = 1 + Math.log2(filtered.length + 1) * 0.35;

    features.push({
      type: "Feature",
      properties: {
        id: top.id,
        groupKey: group.key,
        glow: topGlow,
        sizeBoost,
        mine,
        past,
        coCount,
        count: filtered.length,
      },
      geometry: {
        type: "Point",
        coordinates: [group.longitude, group.latitude],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export const ConferenceMap = forwardRef<ConferenceMapHandle, Props>(function ConferenceMap(
  {
    conferences,
    myConferenceIds,
    coAttendanceMode,
    coPeers,
    showPast,
    showFuture,
    onSelectLocation,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const groupsRef = useRef<LocationGroup[]>([]);
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;

  const groups = useMemo(() => groupByLocation(conferences), [conferences]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(lat, lng, zoom = 6) {
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom,
          duration: 1100,
          curve: 1.4,
          speed: 0.9,
          essential: true,
        });
      },
    }),
    []
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.35, 39.5],
      zoom: 3.85,
      projection: "mercator",
      attributionControl: true,
    });
    map.on("load", () => {
      map.setFog({
        range: [0.8, 8],
        color: "rgb(9, 12, 22)",
        "high-color": "rgb(36, 44, 72)",
        "horizon-blend": 0.18,
        "star-intensity": 0.25,
      });
      map.addSource("conferences", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "conferences-halo",
        type: "circle",
        source: "conferences",
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["get", "coModeActive"], false],
            ["*", 2.2, ["+", 5, ["min", 11, ["get", "coCount"]]]],
            [
              "*",
              ["get", "sizeBoost"],
              ["interpolate", ["linear"], ["get", "glow"], 0, 7, 1, 18],
            ],
          ],
          "circle-color": [
            "case",
            ["all", ["get", "mine"], ["get", "past"]],
            "#8ca0dc",
            ["get", "mine"],
            "#5ee7d9",
            ["get", "past"],
            "#c3a0b4",
            "#f6d4a3",
          ],
          "circle-opacity": [
            "case",
            ["boolean", ["get", "coModeZero"], false],
            0.06,
            ["*", 0.35, ["get", "glow"]],
          ],
          "circle-blur": 0.9,
        },
      });

      map.addLayer({
        id: "conferences-core",
        type: "circle",
        source: "conferences",
        paint: {
          "circle-radius": [
            "case",
            ["boolean", ["get", "coModeActive"], false],
            ["min", 16, ["+", 5, ["/", ["get", "coCount"], 1.2]]],
            [
              "*",
              ["get", "sizeBoost"],
              ["interpolate", ["linear"], ["get", "glow"], 0, 3.5, 1, 9],
            ],
          ],
          "circle-color": [
            "case",
            ["all", ["get", "mine"], ["get", "past"]],
            "#8ca0dc",
            ["get", "mine"],
            "#5ee7d9",
            ["get", "past"],
            "#c3a0b4",
            "#f6d4a3",
          ],
          "circle-opacity": [
            "case",
            ["boolean", ["get", "coModeZero"], false],
            0.06,
            ["+", 0.35, ["*", 0.65, ["get", "glow"]]],
          ],
          "circle-blur": 0.25,
        },
      });

      map.on("click", "conferences-core", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const groupKey = f.properties?.groupKey as string;
        const g = groupsRef.current.find((gg) => gg.key === groupKey);
        if (g) onSelectRef.current(g.conferences);
      });
      map.on("mouseenter", "conferences-core", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "conferences-core", () => {
        map.getCanvas().style.cursor = "";
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Rebuild source data when inputs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    groupsRef.current = groups;
    const now = Date.now();

    const coCountByConf = new Map<string, number>();
    if (coAttendanceMode) {
      for (const p of coPeers) {
        for (const cid of p.sharedConferenceIds) {
          coCountByConf.set(cid, (coCountByConf.get(cid) ?? 0) + 1);
        }
      }
    }

    const fc = buildFeatureCollection(
      conferences,
      groups,
      myConferenceIds,
      coAttendanceMode,
      coCountByConf,
      showPast,
      showFuture,
      now
    );

    // Inject co-mode flags per feature (Mapbox expression reads flat props).
    for (const feat of fc.features) {
      const props = feat.properties as Record<string, unknown>;
      props.coModeActive = coAttendanceMode;
      props.coModeZero =
        coAttendanceMode && ((props.coCount as number) ?? 0) === 0;
    }

    const src = map.getSource("conferences") as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
    } else {
      map.once("load", () => {
        const s = map.getSource("conferences") as mapboxgl.GeoJSONSource | undefined;
        s?.setData(fc);
      });
    }
  }, [conferences, groups, myConferenceIds, coAttendanceMode, coPeers, showPast, showFuture]);

  return <div id="map-canvas" ref={containerRef} aria-label="Conference map" role="region" />;
});
