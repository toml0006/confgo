import { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";

import type {
  AttendanceIntent,
  AttendeeSummary,
  CoAttendancePeer,
  ConferenceRecord,
  IncomingPing,
  MeResponse,
  MutualContact,
  OutgoingPing,
  PingIndicator
} from "@shared/domain";

import { apiFetch } from "./lib/api";
import { useAuthSession } from "./hooks/useAuthSession";
import { useConferenceUpdates } from "./hooks/useConferenceUpdates";
import { useIncomingPingCount } from "./hooks/useIncomingPingCount";
import { useMyAttendances } from "./hooks/useMyAttendances";
import { usePingRefresh } from "./hooks/usePingRefresh";
import { AddConferenceModal } from "./components/AddConferenceModal";
import { ConferenceMap } from "./components/ConferenceMap";
import { ConferenceSheet } from "./components/ConferenceSheet";
import { LocationSheet } from "./components/LocationSheet";
import { MyConferencesPanel } from "./components/MyConferencesPanel";
import { PeerSheet } from "./components/PeerSheet";
import { PingInbox } from "./components/PingInbox";
import { ProfileImageEditor } from "./components/ProfileImageEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { UserAvatar } from "./components/UserAvatar";

type View = "conference" | "location" | "peer" | null;

export default function App() {
  const session = useAuthSession();
  const myAttendances = useMyAttendances(session.user);
  const incomingPingCount = useIncomingPingCount(session.user);
  const pingRefreshTick = usePingRefresh(session.user);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [conferences, setConferences] = useState<ConferenceRecord[]>([]);
  const [conferenceQuery, setConferenceQuery] = useState("");
  const [selectedConferenceId, setSelectedConferenceId] = useState<string | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[] | null>(null);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<{
    id: string;
    avatarId: number;
    displayName: string | null;
    photoURL: string | null;
  } | null>(null);
  const [selectedPeerShared, setSelectedPeerShared] = useState<ConferenceRecord[]>([]);
  const [selectedPeerIndicator, setSelectedPeerIndicator] = useState<PingIndicator>(null);
  const [view, setView] = useState<View>(null);
  const [conferenceAttendees, setConferenceAttendees] = useState<AttendeeSummary[]>([]);
  const [coAttendanceEnabled, setCoAttendanceEnabled] = useState(false);
  const [coPeers, setCoPeers] = useState<CoAttendancePeer[]>([]);
  const [showPast, setShowPast] = useState(true);
  const [showFuture, setShowFuture] = useState(true);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<Array<{ id: string; avatarId: number; displayName: string | null; photoURL: string | null }>>([]);
  const [selectedUsers, setSelectedUsers] = useState<Array<{ id: string; avatarId: number; displayName: string | null; photoURL: string | null }>>([]);
  const [sharedSelectedConferences, setSharedSelectedConferences] = useState<ConferenceRecord[]>([]);
  const [pingInboxOpen, setPingInboxOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myConferencesOpen, setMyConferencesOpen] = useState(false);
  const [profileImageOpen, setProfileImageOpen] = useState(false);
  const [addConferenceOpen, setAddConferenceOpen] = useState(false);
  const [incoming, setIncoming] = useState<IncomingPing[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingPing[]>([]);
  const [contacts, setContacts] = useState<MutualContact[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const selectedConference = useMemo(
    () => conferences.find((conference) => conference.id === selectedConferenceId) ?? null,
    [conferences, selectedConferenceId]
  );

  const selectedLocationConferences = useMemo(() => {
    if (!selectedLocationIds) {
      return [];
    }
    return conferences.filter((conference) => selectedLocationIds.includes(conference.id));
  }, [conferences, selectedLocationIds]);

  const filteredConferenceSearch = useMemo(() => {
    const query = conferenceQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return conferences
      .filter((conference) => `${conference.name} ${conference.locationName}`.toLowerCase().includes(query))
      .slice(0, 12);
  }, [conferenceQuery, conferences]);

  const anonymous = Boolean(session.user?.isAnonymous);

  async function loadMe(currentUser: User | null) {
    if (!currentUser) {
      setMe(null);
      return;
    }
    const response = await apiFetch<MeResponse>("/me", {}, currentUser);
    setMe(response);
  }

  async function loadConferences() {
    const response = await apiFetch<{ conferences: ConferenceRecord[] }>("/conferences");
    setConferences(response.conferences);
  }

  async function loadAttendees(conferenceId: string) {
    const response = await apiFetch<{ attendees: AttendeeSummary[] }>(`/conferences/${conferenceId}/attendees`, {}, session.user);
    setConferenceAttendees(response.attendees);
  }

  async function loadCoAttendance() {
    if (!session.user) {
      return;
    }
    const response = await apiFetch<{ peers: CoAttendancePeer[] }>("/me/co-attendance", {}, session.user);
    setCoPeers(response.peers);
  }

  async function loadPingInbox() {
    if (!session.user) {
      return;
    }
    const [incomingResponse, outgoingResponse, contactsResponse] = await Promise.all([
      apiFetch<{ incoming: IncomingPing[] }>("/pings/incoming", {}, session.user),
      apiFetch<{ outgoing: OutgoingPing[] }>("/pings/outgoing", {}, session.user),
      apiFetch<{ contacts: MutualContact[] }>("/pings/mutual-contacts", {}, session.user)
    ]);
    setIncoming(incomingResponse.incoming);
    setOutgoing(outgoingResponse.outgoing);
    setContacts(contactsResponse.contacts);
  }

  useEffect(() => {
    if (!session.ready) {
      return;
    }
    void loadConferences();
  }, [session.ready]);

  useEffect(() => {
    if (!session.user) {
      return;
    }
    void loadMe(session.user);
  }, [session.user]);

  useEffect(() => {
    if (!selectedConferenceId) {
      setConferenceAttendees([]);
      return;
    }
    void loadAttendees(selectedConferenceId);
  }, [selectedConferenceId, pingRefreshTick]);

  useEffect(() => {
    if (!coAttendanceEnabled || !session.user) {
      setCoPeers([]);
      return;
    }
    void loadCoAttendance();
  }, [coAttendanceEnabled, pingRefreshTick, session.user, myAttendances]);

  useEffect(() => {
    if (!pingInboxOpen || !session.user) {
      return;
    }
    void loadPingInbox();
  }, [pingInboxOpen, pingRefreshTick, session.user]);

  useEffect(() => {
    if (!session.user || !userQuery.trim()) {
      setUserResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const response = await apiFetch<{ users: Array<{ id: string; avatarId: number; displayName: string | null; photoURL: string | null }> }>(
        `/users/search?q=${encodeURIComponent(userQuery.trim())}`,
        {},
        session.user
      );
      setUserResults(response.users.filter((user) => !selectedUsers.some((selected) => selected.id === user.id)));
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [selectedUsers, session.user, userQuery]);

  useEffect(() => {
    if (!session.user || !selectedUsers.length) {
      setSharedSelectedConferences([]);
      return;
    }

    void apiFetch<{ conferences: ConferenceRecord[] }>("/users/shared-conferences", {
      method: "POST",
      body: JSON.stringify({
        userIds: selectedUsers.map((user) => user.id)
      })
    }, session.user).then((response) => {
      setSharedSelectedConferences(response.conferences);
    });
  }, [selectedUsers, session.user]);

  useEffect(() => {
    const conferenceCount = Array.from(myAttendances.keys()).length;
    if (!coAttendanceEnabled) {
      setToast(null);
      return;
    }
    if (!conferenceCount) {
      setToast("Mark conferences to see co-attendees.");
      return;
    }
    if (!coPeers.length) {
      setToast("No co-attendees yet.");
      return;
    }
    const selectedLine = selectedUsers.length
      ? ` Selected: ${sharedSelectedConferences.length} conferences, ${selectedUsers.length} co-attendees.`
      : "";
    setToast(`Co-attendance: ${new Set(coPeers.flatMap((peer) => peer.sharedConferenceIds)).size} conferences, ${coPeers.length} co-attendees.${selectedLine}`);
  }, [coAttendanceEnabled, coPeers, myAttendances, selectedUsers.length, sharedSelectedConferences.length]);

  useConferenceUpdates(Boolean(session.user), () => {
    void loadConferences();
  });

  async function refreshPeer(peerId: string) {
    if (!session.user) {
      return;
    }
    const response = await apiFetch<{
      user: { id: string; avatarId: number; displayName: string | null; photoURL: string | null };
      shared: ConferenceRecord[];
    }>(`/users/${peerId}/profile`, {}, session.user);
    setSelectedPeer(response.user);
    setSelectedPeerShared(response.shared);
    setSelectedPeerIndicator(findPeerIndicator(peerId, coPeers, conferenceAttendees));
  }

  async function openConference(conferenceId: string, preserveLocation = false) {
    setSelectedConferenceId(conferenceId);
    if (!preserveLocation) {
      setSelectedLocationIds(null);
    }
    setSelectedPeerId(null);
    setView("conference");
    await loadAttendees(conferenceId);
  }

  async function openPeer(peerId: string) {
    setSelectedPeerId(peerId);
    setView("peer");
    await refreshPeer(peerId);
  }

  async function markAttendance(conferenceId: string, intent: AttendanceIntent) {
    if (!session.user) {
      return;
    }
    await apiFetch(`/conferences/${conferenceId}/attend`, {
      method: "POST",
      body: JSON.stringify({ intent })
    }, session.user);
    await loadAttendees(conferenceId);
  }

  async function unmarkAttendance(conferenceId: string) {
    if (!session.user) {
      return;
    }
    await apiFetch(`/conferences/${conferenceId}/attend`, {
      method: "DELETE"
    }, session.user);
    await loadAttendees(conferenceId);
  }

  async function sendPing(userId: string) {
    if (!session.user || anonymous) {
      return;
    }
    await apiFetch(`/users/${userId}/ping`, {
      method: "POST"
    }, session.user);
    if (selectedConferenceId) {
      await loadAttendees(selectedConferenceId);
    }
    if (selectedPeerId) {
      await refreshPeer(selectedPeerId);
    }
    await loadCoAttendance();
  }

  return (
    <div className="app-shell">
      <ConferenceMap
        conferences={conferences}
        attendances={myAttendances}
        coPeers={coAttendanceEnabled ? coPeers : []}
        selectedPeer={selectedPeerId ? coPeers.find((peer) => peer.user.id === selectedPeerId) ?? null : null}
        overlayEnabled={coAttendanceEnabled}
        showPast={showPast}
        showFuture={showFuture}
        onSelectLocation={(conferenceIds) => {
          if (conferenceIds.length === 1) {
            void openConference(conferenceIds[0]!);
          } else {
            setSelectedLocationIds(conferenceIds);
            setSelectedConferenceId(null);
            setView("location");
          }
        }}
      />

      <section className="top-left-stack">
        <div className="glass-panel search-panel">
          <div className="sheet-kicker">Conference Search</div>
          <input
            className="search-input"
            value={conferenceQuery}
            onChange={(event) => setConferenceQuery(event.target.value)}
            placeholder="Find conferences"
          />
          {filteredConferenceSearch.length ? (
            <div className="dropdown-list">
              {filteredConferenceSearch.map((conference) => (
                <button key={conference.id} className="dropdown-item" onClick={() => void openConference(conference.id)}>
                  <span>{conference.name}</span>
                  <span>{conference.locationName}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="glass-panel search-panel user-search-panel">
          <div className="sheet-kicker">People Search</div>
          <input
            className="search-input"
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder="Search by display name"
          />
          <div className="chip-row">
            {selectedUsers.map((user) => (
              <button key={user.id} className="user-chip" onClick={() => setSelectedUsers((current) => current.filter((candidate) => candidate.id !== user.id))}>
                <UserAvatar avatarId={user.avatarId} photoURL={user.photoURL} displayName={user.displayName} size={26} />
                <span>{user.displayName?.trim() || "Unnamed"}</span>
              </button>
            ))}
          </div>
          {userResults.length ? (
            <div className="dropdown-list low">
              {userResults.map((user) => (
                <button
                  key={user.id}
                  className="dropdown-item"
                  onClick={() => {
                    setSelectedUsers((current) => [...current, user]);
                    setUserQuery("");
                    setUserResults([]);
                  }}
                >
                  <span>{user.displayName?.trim() || "Unnamed"}</span>
                </button>
              ))}
            </div>
          ) : null}
          {sharedSelectedConferences.length ? (
            <div className="shared-list">
              {sharedSelectedConferences.map((conference) => (
                <button key={conference.id} className="dropdown-item" onClick={() => void openConference(conference.id)}>
                  <span>{conference.name}</span>
                  <span>{conference.locationName}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="top-right-stack glass-panel toolbar-panel">
        <div className="toolbar-row">
          <button className="icon-button" onClick={() => setPingInboxOpen(true)}>
            Signals
            {incomingPingCount ? <span className="count-badge">{incomingPingCount}</span> : null}
          </button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
        <button className="soft-button quiet" onClick={() => setMyConferencesOpen(true)}>
          My conferences
          <span className="count-badge">{myAttendances.size}</span>
        </button>
        <button className={`soft-button ${coAttendanceEnabled ? "primary" : "quiet"}`} onClick={() => setCoAttendanceEnabled((value) => !value)}>
          Co-attendance {coAttendanceEnabled ? "On" : "Off"}
        </button>
        <div className="filter-row">
          <label><input type="checkbox" checked={showPast} onChange={(event) => setShowPast(event.target.checked)} /> Past</label>
          <label><input type="checkbox" checked={showFuture} onChange={(event) => setShowFuture(event.target.checked)} /> Future</label>
        </div>
      </section>

      {toast ? <div className="toast-panel">{toast}</div> : null}

      {view === "conference" && selectedConference ? (
        <ConferenceSheet
          conference={selectedConference}
          attendees={conferenceAttendees}
          attendanceIntent={myAttendances.get(selectedConference.id)}
          anonymous={anonymous}
          onClose={() => setView(null)}
          onBack={selectedLocationIds ? () => setView("location") : undefined}
          onAttend={(intent) => void markAttendance(selectedConference.id, intent)}
          onUnmark={() => void unmarkAttendance(selectedConference.id)}
          onOpenPeer={(peerId) => void openPeer(peerId)}
          onPing={(peerId) => void sendPing(peerId)}
        />
      ) : null}

      {view === "location" && selectedLocationConferences.length ? (
        <LocationSheet
          locationName={selectedLocationConferences[0]!.locationName}
          conferences={selectedLocationConferences}
          attendances={myAttendances}
          onClose={() => setView(null)}
          onOpenConference={(conferenceId) => void openConference(conferenceId, true)}
        />
      ) : null}

      {view === "peer" ? (
        <PeerSheet
          peer={selectedPeer}
          sharedConferences={selectedPeerShared}
          pingIndicator={selectedPeerIndicator}
          canPing={!anonymous && selectedPeerId !== session.user?.uid && !["incoming", "outgoing", "mutual"].includes(selectedPeerIndicator ?? "")}
          onPing={() => {
            if (selectedPeerId) {
              void sendPing(selectedPeerId);
            }
          }}
          onClose={() => setView(null)}
          onBack={selectedConferenceId ? () => setView("conference") : undefined}
          onOpenConference={(conferenceId) => void openConference(conferenceId)}
        />
      ) : null}

      {pingInboxOpen ? (
        <PingInbox
          incoming={incoming}
          outgoing={outgoing}
          contacts={contacts}
          canRespond={!anonymous}
          onClose={() => setPingInboxOpen(false)}
          onPingBack={(pingId) => void apiFetch(`/pings/${pingId}/ping-back`, { method: "POST" }, session.user).then(loadPingInbox)}
          onReject={(pingId) => void apiFetch(`/pings/${pingId}/reject`, { method: "POST" }, session.user).then(loadPingInbox)}
          onRevoke={(pingId) => void apiFetch(`/pings/${pingId}/revoke`, { method: "POST" }, session.user).then(loadPingInbox)}
          onDematch={(peerId) => void apiFetch(`/pings/dematch/${peerId}`, { method: "POST" }, session.user).then(loadPingInbox)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          me={me}
          firebaseUser={session.user}
          onClose={() => setSettingsOpen(false)}
          onSaveDisplayName={async (displayName) => {
            if (!session.user) {
              return;
            }
            const nextMe = await apiFetch<MeResponse>("/me", {
              method: "PATCH",
              body: JSON.stringify({ displayName })
            }, session.user);
            setMe(nextMe);
          }}
          onOpenProfileImage={() => setProfileImageOpen(true)}
          onOpenAddConference={() => setAddConferenceOpen(true)}
          onLinkEmailPassword={session.linkEmailPassword}
          onSignInEmailPassword={session.signInEmailPassword}
          onGoogle={session.signInGoogle}
          onLinkGoogle={session.linkGoogle}
          onSignOut={session.signOutCurrent}
        />
      ) : null}

      {myConferencesOpen ? (
        <MyConferencesPanel
          conferences={conferences}
          attendances={myAttendances}
          onClose={() => setMyConferencesOpen(false)}
          onOpenConference={(conferenceId) => void openConference(conferenceId)}
        />
      ) : null}

      {profileImageOpen && me && session.user ? (
        <ProfileImageEditor
          userId={session.user.uid}
          avatarId={me.avatarId}
          existingPhotoURL={me.photoURL}
          onClose={() => setProfileImageOpen(false)}
          onSave={async (value) => {
            const nextMe = await apiFetch<MeResponse>("/me", {
              method: "PATCH",
              body: JSON.stringify(value)
            }, session.user);
            setMe(nextMe);
          }}
        />
      ) : null}

      {addConferenceOpen ? (
        <AddConferenceModal
          onClose={() => setAddConferenceOpen(false)}
          onSubmit={async (input) => {
            if (!session.user) {
              return;
            }
            await apiFetch("/conferences", {
              method: "POST",
              body: JSON.stringify(input)
            }, session.user);
            await loadConferences();
            setAddConferenceOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function findPeerIndicator(peerId: string, coPeers: CoAttendancePeer[], attendees: AttendeeSummary[]): PingIndicator {
  const peer = coPeers.find((candidate) => candidate.user.id === peerId);
  if (peer?.pingIndicator) {
    return peer.pingIndicator;
  }

  const attendee = attendees.find((candidate) => candidate.id === peerId);
  if (attendee?.hasPingedYou && attendee?.youPinged) {
    return "mutual";
  }
  if (attendee?.hasPingedYou) {
    return "incoming";
  }
  if (attendee?.youPinged) {
    return "outgoing";
  }
  return null;
}
