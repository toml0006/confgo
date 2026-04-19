import { useEffect, useMemo, useRef, useState } from "react";
import { getSharedWithUsers, searchUsers } from "../lib/api";
import type { Conference, UserSummary } from "../lib/types";
import { UserAvatar } from "./UserAvatar";

interface Props {
  conferences: Conference[];
  onPickConference: (c: Conference) => void;
  onSelectionChange: (info: {
    users: UserSummary[];
    sharedConferences: Conference[];
  }) => void;
}

export function SearchStack({ conferences, onPickConference, onSelectionChange }: Props) {
  return (
    <div className="search-stack">
      <ConferenceSearch conferences={conferences} onPick={onPickConference} />
      <UserSearch onChange={onSelectionChange} />
    </div>
  );
}

function ConferenceSearch({
  conferences,
  onPick,
}: {
  conferences: Conference[];
  onPick: (c: Conference) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return conferences
      .filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.locationName.toLowerCase().includes(needle)
      )
      .slice(0, 12);
  }, [q, conferences]);

  return (
    <div className="glass" style={{ padding: 10, position: "relative", zIndex: 10 }}>
      <input
        type="search"
        placeholder="Search conferences…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search conferences"
      />
      {open && results.length > 0 && (
        <div
          className="glass"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            padding: 6,
            maxHeight: 320,
            overflowY: "auto",
          }}
          role="listbox"
        >
          {results.map((c) => (
            <button
              key={c.id}
              className="list-item"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              role="option"
            >
              <div className="meta">
                <span className="title">{c.name}</span>
                <span className="sub">{c.locationName}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserSearch({
  onChange,
}: {
  onChange: (info: { users: UserSummary[]; sharedConferences: Conference[] }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<UserSummary[]>([]);
  const [shared, setShared] = useState<Conference[]>([]);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        const { users } = await searchUsers(q);
        setResults(users);
      } catch {
        setResults([]);
      }
    }, 260);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    if (!selected.length) {
      setShared([]);
      onChange({ users: [], sharedConferences: [] });
      return;
    }
    setBusy(true);
    getSharedWithUsers(selected.map((u) => u.id))
      .then(({ conferences }) => {
        if (cancelled) return;
        setShared(conferences);
        onChange({ users: selected, sharedConferences: conferences });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function toggle(u: UserSummary) {
    setSelected((prev) =>
      prev.find((p) => p.id === u.id)
        ? prev.filter((p) => p.id !== u.id)
        : [...prev, u]
    );
    setResults([]);
    setQ("");
  }

  return (
    <div className="glass" style={{ padding: 10, position: "relative", zIndex: 1 }}>
      <input
        type="search"
        placeholder="Search people…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search people"
      />
      {results.length > 0 && (
        <div
          className="glass"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 40,
            padding: 6,
            maxHeight: 260,
            overflowY: "auto",
          }}
          role="listbox"
        >
          {results.map((u) => (
            <button
              key={u.id}
              className="list-item"
              onClick={() => toggle(u)}
              role="option"
            >
              <UserAvatar
                avatarId={u.avatarId}
                photoURL={u.photoURL}
                displayName={u.displayName}
                size={32}
              />
              <div className="meta">
                <span className="title">{u.displayName || "Unnamed"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {selected.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="soft-button quiet"
              style={{ fontSize: "0.66rem", padding: "4px 8px" }}
            >
              {u.displayName || "Unnamed"} ×
            </button>
          ))}
        </div>
      )}

      {busy && (
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 10 }}>
          Finding shared conferences…
        </div>
      )}

      {shared.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
          <div
            style={{
              fontSize: "0.64rem",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--text-muted)",
              padding: "4px 8px",
            }}
          >
            Shared conferences
          </div>
          {shared.map((c) => (
            <button key={c.id} className="list-item">
              <div className="meta">
                <span className="title">{c.name}</span>
                <span className="sub">{c.locationName}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
