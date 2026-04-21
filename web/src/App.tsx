import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, type Conference, type MeUser } from "./api";
import { useAuth } from "./auth/AuthContext";
import { useMyAttendances } from "./hooks/useMyAttendances";
import { useConferenceUpdates } from "./hooks/useConferenceUpdates";
import { MapView } from "./components/map/MapView";
import { Toolbar } from "./components/Toolbar";
import { ConferenceSearch } from "./components/ConferenceSearch";
import { ConferenceSheet } from "./components/ConferenceSheet";
import { LocationSheet } from "./components/LocationSheet";
import { MyConferencesPanel } from "./components/MyConferencesPanel";
import { SettingsPanel } from "./components/SettingsPanel";

type Selection =
  | { kind: "single"; conference: Conference; backTo: Conference[] | null }
  | { kind: "location"; conferences: Conference[]; locationName: string }
  | null;

export function App() {
  const { user, ready } = useAuth();
  const myAttendances = useMyAttendances(user?.uid ?? null);

  const [me, setMe] = useState<MeUser | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [showPast, setShowPast] = useState(true);
  const [showFuture, setShowFuture] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [panel, setPanel] = useState<"none" | "settings" | "mine">("none");
  const [flyTo, setFlyTo] = useState<{
    longitude: number;
    latitude: number;
    zoom?: number;
  } | null>(null);

  // load /me once signed in
  useEffect(() => {
    if (!ready || !user) return;
    apiFetch<MeUser>("/me")
      .then(setMe)
      .catch((err) => console.error("[me]", err));
  }, [ready, user]);

  // load conferences (once, then on new-conference event)
  const reloadConferences = useCallback(async () => {
    try {
      const data = await apiFetch<{ conferences: Conference[] }>("/conferences");
      setConferences(data.conferences);
    } catch (err) {
      console.error("[conferences]", err);
    }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    reloadConferences();
  }, [ready, user, reloadConferences]);

  useConferenceUpdates(reloadConferences);

  const myCount = myAttendances.size;

  const handleMapSelect = useCallback(
    (confs: Conference[], _lngLat: [number, number]) => {
      if (confs.length === 1) {
        setSelection({ kind: "single", conference: confs[0], backTo: null });
      } else {
        setSelection({
          kind: "location",
          conferences: confs,
          locationName: confs[0].locationName,
        });
      }
    },
    [],
  );

  const openFromSearch = useCallback((conf: Conference) => {
    setFlyTo({ longitude: conf.longitude, latitude: conf.latitude, zoom: 7 });
    setSelection({ kind: "single", conference: conf, backTo: null });
    setPanel("none");
  }, []);

  const openFromMine = useCallback((conf: Conference) => {
    setFlyTo({ longitude: conf.longitude, latitude: conf.latitude, zoom: 7 });
    setSelection({ kind: "single", conference: conf, backTo: null });
  }, []);

  const closeSelection = useCallback(() => setSelection(null), []);

  const hasToken = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

  const sheet = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "single") {
      return (
        <ConferenceSheet
          conference={selection.conference}
          myIntent={myAttendances.get(selection.conference.id)}
          onBack={
            selection.backTo
              ? () =>
                  setSelection({
                    kind: "location",
                    conferences: selection.backTo!,
                    locationName: selection.backTo![0].locationName,
                  })
              : undefined
          }
          onClose={closeSelection}
          onMarked={() => {
            // onSnapshot will update myAttendances; no manual refresh needed.
          }}
        />
      );
    }
    return (
      <LocationSheet
        conferences={selection.conferences}
        locationName={selection.locationName}
        myAttendances={myAttendances}
        onClose={closeSelection}
        onPick={(conf) =>
          setSelection({
            kind: "single",
            conference: conf,
            backTo: selection.conferences,
          })
        }
      />
    );
  }, [selection, myAttendances, closeSelection]);

  return (
    <>
      {hasToken ? (
        <MapView
          conferences={conferences}
          myAttendances={myAttendances}
          showPast={showPast}
          showFuture={showFuture}
          onSelect={handleMapSelect}
          flyTo={flyTo}
        />
      ) : (
        <MissingTokenNotice />
      )}

      <ConferenceSearch onPick={openFromSearch} />

      <Toolbar
        myCount={myCount}
        showPast={showPast}
        showFuture={showFuture}
        onTogglePast={setShowPast}
        onToggleFuture={setShowFuture}
        onOpenSettings={() =>
          setPanel((p) => (p === "settings" ? "none" : "settings"))
        }
        onOpenMyConferences={() =>
          setPanel((p) => (p === "mine" ? "none" : "mine"))
        }
      />

      {sheet}

      {panel === "mine" ? (
        <MyConferencesPanel
          conferences={conferences}
          myAttendances={myAttendances}
          onPick={(conf) => {
            openFromMine(conf);
            setPanel("none");
          }}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {panel === "settings" && me ? (
        <SettingsPanel
          me={me}
          onClose={() => setPanel("none")}
          onUpdated={setMe}
        />
      ) : null}
    </>
  );
}

function MissingTokenNotice() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        padding: 32,
        textAlign: "center",
      }}
    >
      <div className="glass-panel" style={{ padding: 24, maxWidth: 480 }}>
        <div className="section-label">Mapbox token missing</div>
        <p className="caption">
          Set <code>VITE_MAPBOX_ACCESS_TOKEN</code> in <code>web/.env</code> and
          restart the dev server.
        </p>
      </div>
    </div>
  );
}
