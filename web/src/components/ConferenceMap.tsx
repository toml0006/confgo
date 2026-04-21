import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource, LngLatBoundsLike, MapLayerMouseEvent } from "mapbox-gl";

import { conferenceGlow, isPastConference } from "@shared/domain";
import type { CoAttendancePeer, ConferenceRecord, AttendanceIntent } from "@shared/domain";

import { env } from "../env";

type Props = {
  conferences: ConferenceRecord[];
  attendances: Map<string, AttendanceIntent>;
  coPeers: CoAttendancePeer[];
  selectedPeer: CoAttendancePeer | null;
  overlayEnabled: boolean;
  showPast: boolean;
  showFuture: boolean;
  onSelectLocation: (conferenceIds: string[]) => void;
};

type GroupedLocation = {
  key: string;
  latitude: number;
  longitude: number;
  conferenceIds: string[];
  locationName: string;
  glow: number;
  opacity: number;
  color: string;
  haloColor: string;
  size: number;
};

export function ConferenceMap({
  conferences,
  attendances,
  coPeers,
  selectedPeer,
  overlayEnabled,
  showPast,
  showFuture,
  onSelectLocation
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [styleReady, setStyleReady] = useState(false);
  const [containerChildren, setContainerChildren] = useState(0);
  const [canvasSize, setCanvasSize] = useState<string>("0x0");
  const showDebug = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("dv") === "1";
  }, []);

  const coCountByConference = useMemo(() => {
    const counts = new Map<string, number>();
    for (const peer of coPeers) {
      for (const conferenceId of peer.sharedConferenceIds) {
        counts.set(conferenceId, (counts.get(conferenceId) ?? 0) + 1);
      }
    }
    return counts;
  }, [coPeers]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const locations = new Map<string, GroupedLocation>();

    for (const conference of conferences) {
      const past = isPastConference(conference.endDate, now);
      if ((past && !showPast) || (!past && !showFuture)) {
        continue;
      }

      const mine = attendances.has(conference.id);
      const coCount = coCountByConference.get(conference.id) ?? 0;
      const glow = conferenceGlow(conference.startDate, conference.endDate, now);
      const size = overlayEnabled
        ? interpolate(Math.min(coCount, 15), 1, 15, 5, 16)
        : interpolate(glow, 0.04, 1, 3.5, 9);
      const opacity = overlayEnabled
        ? (coCount > 0 ? 0.2 + Math.min(coCount / 15, 1) * 0.8 : 0.06)
        : 0.18 + glow * 0.82;
      const color = past
        ? (mine ? "#8ca0dc" : "#c3a0b4")
        : (mine ? "#5ee7d9" : "#f6d4a3");

      const key = `${conference.latitude.toFixed(4)}:${conference.longitude.toFixed(4)}`;
      const existing = locations.get(key);
      if (existing) {
        existing.conferenceIds.push(conference.id);
        existing.glow = Math.max(existing.glow, glow);
        existing.opacity = Math.max(existing.opacity, opacity);
        existing.size = Math.max(existing.size, size);
        if (mine) {
          existing.color = color;
          existing.haloColor = color;
        }
      } else {
        locations.set(key, {
          key,
          latitude: conference.latitude,
          longitude: conference.longitude,
          conferenceIds: [conference.id],
          locationName: conference.locationName,
          glow,
          opacity,
          color,
          haloColor: color,
          size
        });
      }
    }

    return Array.from(locations.values());
  }, [attendances, coCountByConference, conferences, overlayEnabled, showFuture, showPast]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !env.mapboxToken) {
      return;
    }

    mapboxgl.accessToken = env.mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.35, 39.5],
      zoom: 3.85,
      projection: "mercator" as const
    });

    mapRef.current = map;
    setMapReady(true);
    const resizeMap = () => map.resize();
    const updateDomDebug = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      setContainerChildren(container.children.length);
      const canvas = container.querySelector("canvas");
      if (canvas instanceof HTMLCanvasElement) {
        setCanvasSize(`${canvas.clientWidth}x${canvas.clientHeight}`);
      } else {
        setCanvasSize("0x0");
      }
    };
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("error", (event) => {
      console.error("Mapbox error", event.error);
    });

    map.on("load", () => {
      resizeMap();
      requestAnimationFrame(resizeMap);
      requestAnimationFrame(updateDomDebug);
      setStyleReady(true);
      map.setFog({
        color: "rgb(3, 4, 10)",
        "high-color": "rgb(10, 12, 20)",
        "horizon-blend": 0.08,
        "space-color": "rgb(3, 4, 10)",
        "star-intensity": 0.05
      });

      map.addSource("conference-points", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addSource("peer-points", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addSource("peer-trail", {
        type: "geojson",
        data: emptyFeatureCollection()
      });

      map.addLayer({
        id: "conference-halo",
        type: "circle",
        source: "conference-points",
        paint: {
          "circle-radius": ["+", ["get", "size"], 8],
          "circle-color": ["get", "haloColor"],
          "circle-opacity": ["*", ["get", "opacity"], 0.2],
          "circle-blur": 0.9
        }
      });

      map.addLayer({
        id: "conference-core",
        type: "circle",
        source: "conference-points",
        paint: {
          "circle-radius": ["get", "size"],
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.16)",
          "circle-blur": 0.25
        }
      });

      map.addLayer({
        id: "peer-halo",
        type: "circle",
        source: "peer-points",
        paint: {
          "circle-radius": 22,
          "circle-color": "#5ee7d9",
          "circle-opacity": 0.15,
          "circle-blur": 0.8
        }
      });

      map.addLayer({
        id: "peer-core",
        type: "circle",
        source: "peer-points",
        paint: {
          "circle-radius": 9,
          "circle-color": "#5ee7d9",
          "circle-opacity": 0.88,
          "circle-stroke-color": "#d8fff8",
          "circle-stroke-width": 1
        }
      });

      map.addLayer({
        id: "peer-trail-line",
        type: "line",
        source: "peer-trail",
        paint: {
          "line-color": "#5ee7d9",
          "line-width": 2,
          "line-opacity": 0.55
        }
      });

      const handleClick = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) {
          return;
        }
        const encoded = feature.properties?.conferenceIds;
        if (!encoded || typeof encoded !== "string") {
          return;
        }
        onSelectLocation(JSON.parse(encoded));
      };

      map.on("click", "conference-core", handleClick);
      map.on("mouseenter", "conference-core", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "conference-core", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    window.addEventListener("resize", resizeMap);
    requestAnimationFrame(resizeMap);
    requestAnimationFrame(updateDomDebug);

    return () => {
      window.removeEventListener("resize", resizeMap);
      setMapReady(false);
      setStyleReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const apply = () => {
      syncConferencePoints(map, grouped);
    };

    if (!map.isStyleLoaded()) {
      map.once("load", apply);
      return () => {
        map.off("load", apply);
      };
    }

    apply();
  }, [grouped]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const apply = () => {
      syncPeerOverlay(map, selectedPeer, conferences);
    };

    if (!map.isStyleLoaded()) {
      map.once("load", apply);
      return () => {
        map.off("load", apply);
      };
    }

    apply();
  }, [conferences, selectedPeer]);

  if (!env.mapboxToken) {
    return (
      <div className="map-placeholder">
        <p>Set `VITE_MAPBOX_ACCESS_TOKEN` in `web/.env` to enable the map.</p>
      </div>
    );
  }

  return (
    <>
      <div className="map-canvas" ref={containerRef} />
      {showDebug ? (
        <div className="map-debug">
          <div>map ready: {mapReady ? "yes" : "no"}</div>
          <div>style loaded: {styleReady ? "yes" : "no"}</div>
          <div>conferences fetched: {conferences.length}</div>
          <div>points rendered: {grouped.length}</div>
          <div>container children: {containerChildren}</div>
          <div>canvas size: {canvasSize}</div>
        </div>
      ) : null}
    </>
  );
}

function syncConferencePoints(map: mapboxgl.Map, grouped: GroupedLocation[]) {
  const source = map.getSource("conference-points") as GeoJSONSource | undefined;
  if (!source) {
    return;
  }

  source.setData({
    type: "FeatureCollection",
    features: grouped.map((location) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [location.longitude, location.latitude]
      },
      properties: {
        conferenceIds: JSON.stringify(location.conferenceIds),
        locationName: location.locationName,
        size: location.size,
        opacity: location.opacity,
        color: location.color,
        haloColor: location.haloColor
      }
    }))
  });
}

function syncPeerOverlay(map: mapboxgl.Map, selectedPeer: CoAttendancePeer | null, conferences: ConferenceRecord[]) {
  if (!map.isStyleLoaded()) {
    return;
  }

  const pointSource = map.getSource("peer-points") as GeoJSONSource | undefined;
  const trailSource = map.getSource("peer-trail") as GeoJSONSource | undefined;
  if (!pointSource || !trailSource || !selectedPeer) {
    pointSource?.setData(emptyFeatureCollection());
    trailSource?.setData(emptyFeatureCollection());
    return;
  }

  const sharedConferences = selectedPeer.sharedConferenceIds
    .map((conferenceId) => conferences.find((conference) => conference.id === conferenceId))
    .filter((conference): conference is ConferenceRecord => Boolean(conference))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  pointSource.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [selectedPeer.averageLongitude, selectedPeer.averageLatitude]
        },
        properties: {}
      }
    ]
  });

  trailSource.setData({
    type: "FeatureCollection",
    features: sharedConferences.length > 1 ? [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: sharedConferences.map((conference) => [conference.longitude, conference.latitude])
      },
      properties: {}
    }] : []
  });

  if (sharedConferences.length) {
    map.fitBounds(boundsForConferences(sharedConferences), {
      padding: 90,
      duration: 900,
      maxZoom: 5.2
    });
  }
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection" as const,
    features: []
  };
}

function interpolate(value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
  if (inputMax === inputMin) {
    return outputMin;
  }
  const ratio = Math.max(0, Math.min(1, (value - inputMin) / (inputMax - inputMin)));
  return outputMin + ratio * (outputMax - outputMin);
}

function boundsForConferences(conferences: ConferenceRecord[]): LngLatBoundsLike {
  const longitudes = conferences.map((conference) => conference.longitude);
  const latitudes = conferences.map((conference) => conference.latitude);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)]
  ];
}
