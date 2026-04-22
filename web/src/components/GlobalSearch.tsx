import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch, type Conference, type PublicUser } from "../api";
import { UserAvatar } from "./UserAvatar";

const DEBOUNCE_MS = 260;

type Tab = "all" | "confs" | "people";

type Item =
  | { kind: "conf"; conf: Conference }
  | { kind: "user"; user: PublicUser };

type Props = {
  onPickConference: (conf: Conference) => void;
  onPickUser: (user: PublicUser) => void;
};

export function GlobalSearch({ onPickConference, onPickUser }: Props) {
  const [q, setQ] = useState("");
  const [confs, setConfs] = useState<Conference[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);
  const location = useLocation();
  const onRoot = location.pathname === "/";

  // collapse dropdown when a sheet route takes over, reopen on return to /
  // only fire on path transitions — typing opens the dropdown via onChange
  useEffect(() => {
    if (!onRoot) {
      setOpen(false);
    } else if (q.trim().length > 0) {
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRoot]);

  useEffect(() => {
    // bump on every q change so responses from any superseded request are
    // dropped — even ones already in flight from a prior query.
    const seq = ++requestSeq.current;

    if (!q.trim()) {
      setConfs([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const enc = encodeURIComponent(q.trim());
      const [confRes, userRes] = await Promise.allSettled([
        apiFetch<{ conferences: Conference[] }>(`/conferences?q=${enc}`),
        apiFetch<{ users: PublicUser[] }>(`/users?q=${enc}`),
      ]);
      // ignore stale responses — only the most recent query's request wins
      if (seq !== requestSeq.current) return;
      if (confRes.status === "fulfilled") setConfs(confRes.value.conferences);
      else console.error(confRes.reason);
      if (userRes.status === "fulfilled") setPeople(userRes.value.users);
      else console.error(userRes.reason);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const items = useMemo<Item[]>(() => {
    const confItems: Item[] = confs.map((c) => ({ kind: "conf", conf: c }));
    const userItems: Item[] = people.map((u) => ({ kind: "user", user: u }));
    if (tab === "confs") return confItems.slice(0, 40);
    if (tab === "people") return userItems.slice(0, 40);
    // All: round-robin so the 40-cap never starves one type when the other
    // has many matches. People first per pair (usually the scarcer type).
    const out: Item[] = [];
    const maxLen = Math.max(userItems.length, confItems.length);
    for (let i = 0; i < maxLen && out.length < 40; i += 1) {
      if (i < userItems.length && out.length < 40) out.push(userItems[i]);
      if (i < confItems.length && out.length < 40) out.push(confItems[i]);
    }
    return out;
  }, [confs, people, tab]);

  const show = open && (loading || items.length > 0 || q.trim().length > 0);
  const totalCount = confs.length + people.length;

  return (
    <div className="global-search" ref={wrapRef}>
      <label className="glass-panel global-search-input-wrap">
        <svg
          className="global-search-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="global-search-input"
          placeholder="Search conferences or people…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      {show ? (
        <div className="glass-panel global-search-results">
          {q.trim() ? (
            <div className="global-search-tabs" role="tablist">
              <TabButton
                active={tab === "all"}
                onClick={() => setTab("all")}
                label="All"
                count={totalCount}
              />
              <TabButton
                active={tab === "confs"}
                onClick={() => setTab("confs")}
                label="Confs"
                count={confs.length}
              />
              <TabButton
                active={tab === "people"}
                onClick={() => setTab("people")}
                label="People"
                count={people.length}
              />
            </div>
          ) : null}

          {loading ? <div className="muted row">Searching…</div> : null}
          {!loading && items.length === 0 && q.trim() ? (
            <div className="muted row">
              {tab === "people"
                ? "No people match"
                : tab === "confs"
                  ? "No conferences match"
                  : "No matches"}
            </div>
          ) : null}

          {items.map((it) =>
            it.kind === "conf" ? (
              <button
                key={`c:${it.conf.id}`}
                className="global-search-result"
                onClick={() => {
                  onPickConference(it.conf);
                  setOpen(false);
                }}
              >
                <span className="result-icon" aria-hidden>
                  📍
                </span>
                <span className="result-body">
                  <span className="name">{it.conf.name}</span>
                  <span className="meta">
                    {it.conf.locationName} ·{" "}
                    {new Date(it.conf.startDate).toLocaleDateString()}
                  </span>
                </span>
              </button>
            ) : (
              <button
                key={`u:${it.user.id}`}
                className="global-search-result"
                onClick={() => {
                  onPickUser(it.user);
                  setOpen(false);
                }}
              >
                <span className="result-icon result-icon--avatar" aria-hidden>
                  <UserAvatar
                    avatarId={it.user.avatarId}
                    photoURL={it.user.photoURL}
                    displayName={it.user.displayName}
                    size="xs"
                  />
                </span>
                <span className="result-body">
                  <span className="name">{it.user.displayName ?? "Unnamed"}</span>
                  <span className="meta">person</span>
                </span>
              </button>
            ),
          )}
        </div>
      ) : null}
      <style>{`
        .global-search {
          position: fixed;
          top: 18px;
          left: 18px;
          width: min(500px, calc(100vw - 260px));
          z-index: 30;
        }
        .global-search-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          width: 100%;
          padding: 0.7rem 1rem;
          border-radius: 18px;
          cursor: text;
        }
        .global-search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .global-search-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          color: inherit;
          font: inherit;
          font-size: 0.85rem;
          padding: 0;
        }
        .global-search-results {
          margin-top: 8px;
          max-height: 420px;
          overflow-y: auto;
          padding: 6px;
          z-index: 50;
        }
        .global-search-tabs {
          display: flex;
          gap: 4px;
          padding: 4px 4px 8px;
          position: sticky;
          top: 0;
          background: inherit;
        }
        .global-search-tab {
          flex: 1;
          padding: 0.4rem 0.6rem;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-muted);
          background: transparent;
          cursor: pointer;
        }
        .global-search-tab:hover {
          border-color: var(--mist);
        }
        .global-search-tab--active {
          border-color: var(--mist);
          background: rgba(232, 240, 255, 0.06);
          background: color(display-p3 0.91 0.941 1 / 0.06);
          color: var(--text);
        }
        .global-search-tab .tab-count {
          margin-left: 0.3rem;
          font-size: 0.64rem;
          opacity: 0.7;
        }
        .global-search-results .row {
          padding: 0.65rem 0.85rem;
          font-size: 0.78rem;
        }
        .global-search-result {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.55rem 0.75rem;
          width: 100%;
          text-align: left;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
        }
        .global-search-result:hover {
          border-color: var(--mist);
          background: rgba(232, 240, 255, 0.04);
          background: color(display-p3 0.91 0.941 1 / 0.04);
        }
        .result-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          flex-shrink: 0;
          font-size: 0.95rem;
        }
        .result-icon--avatar {
          width: auto;
        }
        .result-body {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          min-width: 0;
        }
        .global-search-result .name {
          font-size: 0.85rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .global-search-result .meta {
          font-size: 0.68rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
      `}</style>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      className={`global-search-tab${active ? " global-search-tab--active" : ""}`}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {label}
      <span className="tab-count">{count}</span>
    </button>
  );
}
