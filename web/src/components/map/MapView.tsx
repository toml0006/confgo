import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import type { Conference, AttendanceIntent } from "../../api";
import { conferenceGlow, isFuture, isPast } from "../../lib/decay";
import {
  coreColor,
  coreOpacity,
  coreRadius,
  haloOpacity,
  haloRadius,
} from "./styleExpressions";

export type MapViewProps = {
  conferences: Conference[];
  myAttendances: Map<string, AttendanceIntent>;
  showPast: boolean;
  showFuture: boolean;
  onSelect: (confs: Conference[], lngLat: [number, number]) => void;
  flyTo: { longitude: number; latitude: number; zoom?: number } | null;
};

const SOURCE_ID = "conferences";
const CORE_LAYER = "conferences-core";
const HALO_LAYER = "conferences-halo";
const CLICK_TOLERANCE = 14; // px

function stateOf(conf: Conference, mine: boolean, now: Date): string {
  const past = isPast(conf.endDate, now);
  if (mine && past) return "past-mine";
  if (mine) return "mine";
  if (past) return "past";
  return "default";
}

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

  // init map
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.35, 39.5],
      zoom: 3.85,
      projection: "mercator",
      attributionControl: false,
    });
    map.on("load", () => {
      styleLoadedRef.current = true;
      map.setFog({
        color: "rgba(12, 16, 32, 0.8)",
        "high-color": "#1a1a2e",
        "horizon-blend": 0.1,
        "space-color": "#03040a",
        "star-intensity": 0.15,
      } as never);
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: HALO_LAYER,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": haloRadius,
          "circle-color": coreColor,
          "circle-opacity": haloOpacity,
          "circle-blur": 0.9,
        },
      });
      map.addLayer({
        id: CORE_LAYER,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": coreRadius,
          "circle-color": coreColor,
          "circle-opacity": coreOpacity,
          "circle-blur": 0.25,
          "circle-stroke-width": 0,
        },
      });
    });

    mapRef.current = map;
    return () => {
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
        return {
          type: "Feature" as const,
          id: c.id,
          geometry: {
            type: "Point" as const,
            coordinates: [c.longitude, c.latitude],
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

  // push features into the source
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(featureCollection);
    };
    if (styleLoadedRef.current) apply();
    else map.once("load", apply);
  }, [featureCollection]);

  // hover cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");
    map.on("mouseenter", CORE_LAYER, onEnter);
    map.on("mouseleave", CORE_LAYER, onLeave);
    map.on("mouseenter", HALO_LAYER, onEnter);
    map.on("mouseleave", HALO_LAYER, onLeave);
    return () => {
      map.off("mouseenter", CORE_LAYER, onEnter);
      map.off("mouseleave", CORE_LAYER, onLeave);
      map.off("mouseenter", HALO_LAYER, onEnter);
      map.off("mouseleave", HALO_LAYER, onLeave);
    };
  }, []);

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
      // group by lat/lng (4 decimals ≈ 11m)
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
      // also include any non-rendered conferences at the same city
      for (const c of conferences) {
        if (seen.has(c.id)) continue;
        if (key(c) === targetKey) {
          seen.add(c.id);
          group.push(c);
        }
      }
      group.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
      onSelect(group, [anchor.longitude, anchor.latitude]);
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
      style={{ position: "fixed", inset: 0, background: "var(--void)" }}
    />
  );
}
