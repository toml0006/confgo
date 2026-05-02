import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { apiFetch, type Conference, type MeUser, type PublicUser } from "./api";
import { useAuth } from "./auth/AuthContext";
import { useMyAttendances } from "./hooks/useMyAttendances";
import { useConferenceUpdates } from "./hooks/useConferenceUpdates";
import { useIncomingPingCount } from "./hooks/useIncomingPingCount";
import { useLiveFeed, useMyTopics } from "./hooks/useLiveFeed";
import { MapView } from "./components/map/MapView";
import { Toolbar } from "./components/Toolbar";
import { CommandK } from "./components/CommandK";
import { ConferenceSheet } from "./components/ConferenceSheet";
import { LocationSheet } from "./components/LocationSheet";
import { UserSheet } from "./components/UserSheet";
import { MyConferencesPanel } from "./components/MyConferencesPanel";
import { PingInbox } from "./components/PingInbox";
import { SettingsPanel } from "./components/SettingsPanel";
import { VersionBadge } from "./components/VersionBadge";
import { Footer } from "./components/Footer";
import { LiveFeed } from "./components/LiveFeed";
import { IntroTour, hasSeenIntro } from "./components/IntroTour";
import { Caption, FloatingPanel } from "./components/ui/floating-panel";
import { Kicker } from "./components/ui/kicker";

type LocationSelection = {
  conferences: Conference[];
  locationName: string;
  // The dot the user actually clicked. LocationSheet uses this to scroll the
  // matching row into view and highlight it, so a multi-event city pin
  // doesn't dump the user into a list with no anchor.
  anchorId?: string;
};

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const confMatch = useMatch("/c/:id");
  const userMatch = useMatch("/u/:id");

  const { user, ready } = useAuth();
  const myAttendances = useMyAttendances(user?.uid ?? null);
  const signalsCount = useIncomingPingCount(user?.uid ?? null);

  const [me, setMe] = useState<MeUser | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [showPast, setShowPast] = useState(true);
  const [showFuture, setShowFuture] = useState(true);
  const [locationSel, setLocationSel] = useState<LocationSelection | null>(null);
  const [userCache, setUserCache] = useState<PublicUser | null>(null);
  const [panel, setPanel] = useState<"none" | "settings" | "mine" | "signals">("none");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Auto-fire the intro on a brand-new device once auth is ready, so the
  // tour appears for first-time visitors without us prompting. Returning
  // visitors flip vb.intro.v1 in localStorage so they don't see it twice.
  useEffect(() => {
    if (!ready || !user) return;
    if (!hasSeenIntro()) setShowIntro(true);
  }, [ready, user]);
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

  // fly the map when a conference route becomes active. Depend on the conf
  // id (not the full object) so a fresh `conferences` array — same data,
  // new identity from a refetch — doesn't re-fire flyTo and re-zoom.
  useEffect(() => {
    if (activeConference) {
      setFlyTo({
        longitude: activeConference.longitude,
        latitude: activeConference.latitude,
        zoom: 7,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConference?.id]);

  // fetch user on /u/:id; prefer state passed from search.
  // Wait for auth readiness so cold deep-links don't fire an unauthed request.
  useEffect(() => {
    if (!userMatch) {
      setUserCache(null);
      return;
    }
    const targetId = userMatch.params.id;
    // drop any cache from a previous user so we don't flash their profile
    setUserCache((prev) => (prev && prev.id === targetId ? prev : null));

    const passed = (location.state as { user?: PublicUser } | null)?.user;
    if (passed && passed.id === targetId) {
      setUserCache(passed);
      return;
    }

    if (!ready || !user) return; // wait for auth; effect will rerun when ready

    let cancelled = false;
    apiFetch<PublicUser>(`/users/${targetId}`)
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
  }, [userMatch, location.state, ready, user]);

  const myCount = myAttendances.size;

  // Live feed inputs. Conference index lets the hook resolve topics from the
  // viewer's attendance ids; the viewer's union of those topics drives the
  // "match" filter.
  const conferenceById = useMemo(() => {
    const map = new Map<string, { topics: string[] }>();
    for (const c of conferences) map.set(c.id, { topics: c.topics ?? [] });
    return map;
  }, [conferences]);
  const myConferenceIds = useMemo(
    () => new Set(myAttendances.keys()),
    [myAttendances],
  );
  const myTopics = useMyTopics(conferenceById, myConferenceIds);
  const liveEvents = useLiveFeed({
    myId: user?.uid ?? null,
    myConferenceIds,
    myTopics,
  });

  const handleMapSelect = useCallback(
    (confs: Conference[], anchor: Conference) => {
      if (confs.length === 1) {
        navigate(`/c/${confs[0].id}`);
      } else {
        setLocationSel({
          conferences: confs,
          locationName: anchor.locationName,
          anchorId: anchor.id,
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

  const openPeerFromAttendee = useCallback(
    (userId: string) => {
      navigate(`/u/${userId}`);
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

  // Show Back when the current sheet was opened via in-app navigation
  // (drilled in from another sheet). location.key === "default" means a
  // cold deep-link, in which case there's no prior view to return to.
  const hasHistory = Boolean(location.key && location.key !== "default");
  const goBack = useCallback(() => navigate(-1), [navigate]);

  const closeLocationSheet = useCallback(() => setLocationSel(null), []);

  // Esc anywhere closes the topmost overlay. Order: side panels first
  // (settings / mine / signals), then the location list, then the route
  // sheet (/c/:id, /u/:id). Modals (PingComposer, PhotoCropper, CommandK)
  // already self-handle Esc via their own Dialog primitives.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (panel !== "none") {
        setPanel("none");
        return;
      }
      if (locationSel) {
        setLocationSel(null);
        return;
      }
      if (confMatch || userMatch) {
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, locationSel, confMatch, userMatch, closeSheet]);

  const hasToken = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

  const sheet = useMemo(() => {
    if (confMatch) {
      if (!activeConference) return null; // conferences still loading
      return (
        <ConferenceSheet
          conference={activeConference}
          myIntent={myAttendances.get(activeConference.id)}
          onBack={hasHistory || locationSel ? goBack : undefined}
          onClose={closeSheet}
          onMarked={() => {
            // onSnapshot will update myAttendances; no manual refresh needed.
          }}
          onOpenPeer={openPeerFromAttendee}
        />
      );
    }
    if (userMatch) {
      // Guard: id must match to avoid flashing a stale profile mid-transition.
      if (!userCache || userCache.id !== userMatch.params.id) return null;
      return (
        <UserSheet
          user={userCache}
          conferences={conferences}
          onBack={hasHistory ? goBack : undefined}
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
          anchorId={locationSel.anchorId}
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
    openPeerFromAttendee,
    navigate,
    hasHistory,
    goBack,
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

      <Toolbar
        me={me}
        myCount={myCount}
        signalsCount={signalsCount}
        showPast={showPast}
        showFuture={showFuture}
        onTogglePast={setShowPast}
        onToggleFuture={setShowFuture}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() =>
          setPanel((p) => (p === "settings" ? "none" : "settings"))
        }
        onOpenMyConferences={() =>
          setPanel((p) => (p === "mine" ? "none" : "mine"))
        }
        onOpenSignals={() =>
          setPanel((p) => (p === "signals" ? "none" : "signals"))
        }
      />

      <CommandK
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPickConference={(c) => {
          setSearchOpen(false);
          openFromSearch(c);
        }}
        onPickUser={(u) => {
          setSearchOpen(false);
          openUserFromSearch(u);
        }}
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

      {panel === "settings" ? (
        me ? (
          <SettingsPanel
            me={me}
            onClose={() => setPanel("none")}
            onUpdated={setMe}
            onShowIntro={() => {
              setPanel("none");
              setShowIntro(true);
            }}
          />
        ) : (
          <FloatingPanel side="top-right" onClose={() => setPanel("none")}>
            <div className="flex flex-col gap-1.5">
              <Kicker>Profile</Kicker>
              <Caption>
                {ready
                  ? "Loading your profile… if this hangs, /me may be failing — check the console."
                  : "Signing you in…"}
              </Caption>
            </div>
          </FloatingPanel>
        )
      ) : null}

      {panel === "signals" ? (
        <PingInbox onClose={() => setPanel("none")} />
      ) : null}

      {showIntro ? <IntroTour onClose={() => setShowIntro(false)} /> : null}

      <LiveFeed events={liveEvents} />

      <Footer />
      <VersionBadge />
    </>
  );
}

function MissingTokenNotice() {
  return (
    <div className="fixed inset-0 flex items-center justify-center text-ink2 p-8 text-center">
      <div className="bg-paper border border-hair rounded-[14px] shadow-[var(--shadow-card)] p-6 max-w-[480px]">
        <div className="font-ui text-[10px] font-semibold uppercase tracking-[0.22em] text-ink2">
          Mapbox token missing
        </div>
        <p className="font-display italic text-[14px] text-ink2 leading-[1.55] mt-2">
          Set <code>VITE_MAPBOX_ACCESS_TOKEN</code> in <code>web/.env</code> and
          restart the dev server.
        </p>
      </div>
    </div>
  );
}
