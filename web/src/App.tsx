import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { apiFetch, type Conference, type MeUser, type PublicUser } from "./api";
import { useAuth } from "./auth/AuthContext";
import { useMyAttendances } from "./hooks/useMyAttendances";
import { useConferenceUpdates } from "./hooks/useConferenceUpdates";
import { MapView } from "./components/map/MapView";
import { Toolbar } from "./components/Toolbar";
import { GlobalSearch } from "./components/GlobalSearch";
import { ConferenceSheet } from "./components/ConferenceSheet";
import { LocationSheet } from "./components/LocationSheet";
import { UserSheet } from "./components/UserSheet";
import { MyConferencesPanel } from "./components/MyConferencesPanel";
import { SettingsPanel } from "./components/SettingsPanel";

type LocationSelection = {
  conferences: Conference[];
  locationName: string;
};

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const confMatch = useMatch("/c/:id");
  const userMatch = useMatch("/u/:id");

  const { user, ready } = useAuth();
  const myAttendances = useMyAttendances(user?.uid ?? null);

  const [me, setMe] = useState<MeUser | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [showPast, setShowPast] = useState(true);
  const [showFuture, setShowFuture] = useState(true);
  const [locationSel, setLocationSel] = useState<LocationSelection | null>(null);
  const [userCache, setUserCache] = useState<PublicUser | null>(null);
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

  // derive active conference from URL
  const activeConference = useMemo<Conference | null>(() => {
    if (!confMatch) return null;
    return conferences.find((c) => c.id === confMatch.params.id) ?? null;
  }, [confMatch, conferences]);

  // fly the map when a conference route becomes active
  useEffect(() => {
    if (activeConference) {
      setFlyTo({
        longitude: activeConference.longitude,
        latitude: activeConference.latitude,
        zoom: 7,
      });
    }
  }, [activeConference]);

  // fetch user on /u/:id; prefer state passed from search
  useEffect(() => {
    if (!userMatch) {
      setUserCache(null);
      return;
    }
    const passed = (location.state as { user?: PublicUser } | null)?.user;
    if (passed && passed.id === userMatch.params.id) {
      setUserCache(passed);
      return;
    }
    let cancelled = false;
    apiFetch<PublicUser>(`/users/${userMatch.params.id}`)
      .then((u) => {
        if (!cancelled) setUserCache(u);
      })
      .catch((err) => {
        console.error("[user]", err);
        if (!cancelled) setUserCache(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userMatch, location.state]);

  const myCount = myAttendances.size;

  const handleMapSelect = useCallback(
    (confs: Conference[], _lngLat: [number, number]) => {
      if (confs.length === 1) {
        navigate(`/c/${confs[0].id}`);
      } else {
        setLocationSel({
          conferences: confs,
          locationName: confs[0].locationName,
        });
      }
    },
    [navigate],
  );

  const openFromSearch = useCallback(
    (conf: Conference) => {
      navigate(`/c/${conf.id}`);
      setPanel("none");
    },
    [navigate],
  );

  const openUserFromSearch = useCallback(
    (u: PublicUser) => {
      navigate(`/u/${u.id}`, { state: { user: u } });
      setPanel("none");
    },
    [navigate],
  );

  const openFromMine = useCallback(
    (conf: Conference) => {
      navigate(`/c/${conf.id}`);
    },
    [navigate],
  );

  // Back if there's app history, else home. location.key === "default"
  // means we landed directly and have no prior in-app history.
  const closeSheet = useCallback(() => {
    if (location.key && location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [navigate, location.key]);

  const closeLocationSheet = useCallback(() => setLocationSel(null), []);

  const hasToken = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

  const sheet = useMemo(() => {
    if (confMatch) {
      if (!activeConference) return null; // conferences still loading
      return (
        <ConferenceSheet
          conference={activeConference}
          myIntent={myAttendances.get(activeConference.id)}
          onBack={locationSel ? () => navigate(-1) : undefined}
          onClose={closeSheet}
          onMarked={() => {
            // onSnapshot will update myAttendances; no manual refresh needed.
          }}
        />
      );
    }
    if (userMatch) {
      if (!userCache) return null; // fetching
      return (
        <UserSheet
          user={userCache}
          conferences={conferences}
          onClose={closeSheet}
          onPickConference={openFromSearch}
        />
      );
    }
    if (locationSel) {
      return (
        <LocationSheet
          conferences={locationSel.conferences}
          locationName={locationSel.locationName}
          myAttendances={myAttendances}
          onClose={closeLocationSheet}
          onPick={(conf) => navigate(`/c/${conf.id}`)}
        />
      );
    }
    return null;
  }, [
    confMatch,
    activeConference,
    userMatch,
    userCache,
    locationSel,
    myAttendances,
    conferences,
    closeSheet,
    closeLocationSheet,
    openFromSearch,
    navigate,
  ]);

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

      <GlobalSearch
        onPickConference={openFromSearch}
        onPickUser={openUserFromSearch}
      />

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
