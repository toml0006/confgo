import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConferenceMap, type ConferenceMapHandle } from "./components/Map";
import { Toolbar } from "./components/Toolbar";
import { SearchStack } from "./components/SearchStack";
import { ConferenceSheet } from "./components/ConferenceSheet";
import { LocationSheet } from "./components/LocationSheet";
import { PeerSheet } from "./components/PeerSheet";
import { PingInbox } from "./components/PingInbox";
import { SettingsPanel } from "./components/SettingsPanel";
import { MyConferencesPanel } from "./components/MyConferencesPanel";
import { AddConferenceModal } from "./components/AddConferenceModal";
import { ProfileImageEditor } from "./components/ProfileImageEditor";
import { CoAttendanceToast } from "./components/CoAttendanceToast";
import { useConferences } from "./hooks/useConferences";
import { useMyAttendances } from "./hooks/useMyAttendances";
import { useIncomingPingCount } from "./hooks/useIncomingPingCount";
import { getCoAttendance } from "./lib/api";
import type { Conference, CoPeer, UserSummary } from "./lib/types";

type ActiveSheet =
  | { kind: "conference"; conference: Conference; fromLocation: boolean }
  | { kind: "location"; conferences: Conference[] }
  | { kind: "peer"; userId: string }
  | null;

type TopRightPanel = "pings" | "settings" | "mine" | null;

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { user, fbUser, loading, isLinked } = useAuth();
  const { conferences } = useConferences();
  const attendances = useMyAttendances(fbUser?.uid ?? null);
  const pingCount = useIncomingPingCount(fbUser?.uid ?? null);

  const mapRef = useRef<ConferenceMapHandle>(null);

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [sheetStack, setSheetStack] = useState<ActiveSheet[]>([]);
  const [topRight, setTopRight] = useState<TopRightPanel>(null);
  const [modal, setModal] = useState<"addConference" | "profileImage" | null>(null);
  const [coMode, setCoMode] = useState(false);
  const [showPast, setShowPast] = useState(true);
  const [showFuture, setShowFuture] = useState(true);
  const [coPeers, setCoPeers] = useState<CoPeer[]>([]);
  const [selection, setSelection] = useState<{
    users: UserSummary[];
    sharedConferences: Conference[];
  }>({ users: [], sharedConferences: [] });

  const myIds = useMemo(() => new Set(attendances.keys()), [attendances]);

  // Fetch co-attendance when mode toggled or attendances change
  useEffect(() => {
    if (!coMode || !user) return;
    let cancelled = false;
    getCoAttendance()
      .then(({ peers }) => {
        if (!cancelled) setCoPeers(peers);
      })
      .catch(() => {
        if (!cancelled) setCoPeers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [coMode, user, attendances]);

  const openConference = useCallback((c: Conference, fromLocation = false) => {
    setActiveSheet({ kind: "conference", conference: c, fromLocation });
    mapRef.current?.flyTo(c.latitude, c.longitude, 6);
  }, []);

  const openLocation = useCallback((confs: Conference[]) => {
    if (confs.length === 1) {
      setActiveSheet({ kind: "conference", conference: confs[0], fromLocation: false });
    } else {
      setActiveSheet({ kind: "location", conferences: confs });
    }
    mapRef.current?.flyTo(confs[0].latitude, confs[0].longitude, 5.2);
  }, []);

  function pushSheet(next: ActiveSheet) {
    if (activeSheet) setSheetStack((s) => [...s, activeSheet]);
    setActiveSheet(next);
  }
  function popSheet() {
    const stack = [...sheetStack];
    const prev = stack.pop() ?? null;
    setSheetStack(stack);
    setActiveSheet(prev);
  }

  const coSummary = useMemo(() => {
    const confSet = new Set<string>();
    for (const p of coPeers) for (const cid of p.sharedConferenceIds) confSet.add(cid);
    return { conferenceCount: confSet.size, peerCount: coPeers.length };
  }, [coPeers]);

  const selectedCoInfo = useMemo(() => {
    if (!coMode) return null;
    if (selection.users.length === 0) return null;
    const sharedIds = new Set(selection.sharedConferences.map((c) => c.id));
    const peers = coPeers.filter((p) =>
      p.sharedConferenceIds.some((id) => sharedIds.has(id))
    );
    return {
      conferenceCount: selection.sharedConferences.length,
      coAttendeeCount: peers.length,
    };
  }, [coMode, selection, coPeers]);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--text-muted)" }}>
        <p style={{ fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Loading Confgo…
        </p>
      </div>
    );
  }

  return (
    <>
      <a href="#search-stack" className="skip-link">
        Skip to search
      </a>
      <ConferenceMap
        ref={mapRef}
        conferences={conferences}
        myConferenceIds={myIds}
        coAttendanceMode={coMode}
        coPeers={coPeers}
        showPast={showPast}
        showFuture={showFuture}
        onSelectLocation={openLocation}
      />

      <div id="search-stack">
        <SearchStack
          conferences={conferences}
          onPickConference={openConference}
          onSelectionChange={setSelection}
        />
      </div>

      <Toolbar
        pingCount={pingCount}
        myCount={myIds.size}
        coMode={coMode}
        showPast={showPast}
        showFuture={showFuture}
        onTogglePingInbox={() => setTopRight(topRight === "pings" ? null : "pings")}
        onToggleSettings={() => setTopRight(topRight === "settings" ? null : "settings")}
        onToggleMyConferences={() => setTopRight(topRight === "mine" ? null : "mine")}
        onToggleCoMode={() => setCoMode((v) => !v)}
        onTogglePast={() => setShowPast((v) => !v)}
        onToggleFuture={() => setShowFuture((v) => !v)}
      />

      {coMode && (
        <>
          <CoAttendanceToast
            conferenceCount={coSummary.conferenceCount}
            peerCount={coSummary.peerCount}
            selectedInfo={selectedCoInfo}
          />
          {coSummary.conferenceCount === 0 && coSummary.peerCount === 0 && (
            <div className="empty-over-map glass">
              {myIds.size === 0 ? (
                <p>Mark conferences to see co-attendees.</p>
              ) : (
                <p>No co-attendees yet.</p>
              )}
            </div>
          )}
        </>
      )}

      {activeSheet?.kind === "location" && (
        <LocationSheet
          conferences={activeSheet.conferences}
          myAttendances={attendances}
          onPick={(c) => pushSheet({ kind: "conference", conference: c, fromLocation: true })}
          onClose={() => setActiveSheet(null)}
        />
      )}

      {activeSheet?.kind === "conference" && (
        <ConferenceSheet
          conference={activeSheet.conference}
          myIntent={attendances.get(activeSheet.conference.id) ?? null}
          selfUserId={user?.id ?? null}
          onBack={popSheet}
          onShowBackButton={sheetStack.length > 0 || activeSheet.fromLocation}
          onClose={() => {
            setActiveSheet(null);
            setSheetStack([]);
          }}
          onAttendanceChange={() => {
            /* attendances update via onSnapshot */
          }}
          onOpenPeer={(uid) => pushSheet({ kind: "peer", userId: uid })}
        />
      )}

      {activeSheet?.kind === "peer" && (
        <PeerSheet
          userId={activeSheet.userId}
          selfId={user?.id ?? null}
          isLinked={isLinked}
          onBack={popSheet}
          onClose={() => {
            setActiveSheet(null);
            setSheetStack([]);
          }}
          onPickConference={(c) =>
            pushSheet({ kind: "conference", conference: c, fromLocation: false })
          }
        />
      )}

      {topRight === "pings" && (
        <PingInbox
          selfId={user?.id ?? null}
          isLinked={isLinked}
          onClose={() => setTopRight(null)}
          onOpenPeer={(uid) => {
            setTopRight(null);
            pushSheet({ kind: "peer", userId: uid });
          }}
        />
      )}

      {topRight === "mine" && (
        <MyConferencesPanel
          conferences={conferences}
          myAttendances={attendances}
          onPickConference={(c) => {
            setTopRight(null);
            openConference(c);
          }}
          onClose={() => setTopRight(null)}
        />
      )}

      {topRight === "settings" && user && (
        <SettingsPanel
          user={user}
          onClose={() => setTopRight(null)}
          onEditProfileImage={() => setModal("profileImage")}
          onAddConference={() => setModal("addConference")}
        />
      )}

      {modal === "addConference" && (
        <AddConferenceModal
          onClose={() => setModal(null)}
          onCreated={() => {
            /* conferences live-refresh */
          }}
        />
      )}

      {modal === "profileImage" && <ProfileImageEditor onClose={() => setModal(null)} />}
    </>
  );
}
