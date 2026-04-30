import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch, type Conference, type PublicUser, type TagsResponse } from "../api";
import { UserAvatar } from "./UserAvatar";
import { VennEgg } from "./VennEgg";

// 3 Escape presses within this window arms the Venn easter egg, but only
// when the user has 2+ tags selected. Non-Escape keys reset the streak.
const VENN_EGG_WINDOW_MS = 1500;

const DEBOUNCE_MS = 260;

type Tab = "all" | "confs" | "people";

type Item =
  | { kind: "conf"; conf: Conference }
  | { kind: "user"; user: PublicUser };

type Props = {
  onPickConference: (conf: Conference) => void;
  onPickUser: (user: PublicUser) => void;
};

// Cache the /tags fetch across mounts so the autocomplete dropdown is instant
// after the first time the search bar opens. Tags rarely change.
let tagsCache: TagsResponse | null = null;
let tagsInflight: Promise<TagsResponse> | null = null;
async function loadTags(): Promise<TagsResponse> {
  if (tagsCache) return tagsCache;
  if (!tagsInflight) {
    tagsInflight = apiFetch<TagsResponse>("/tags").then((r) => {
      tagsCache = r;
      tagsInflight = null;
      return r;
    });
  }
  return tagsInflight;
}

export function GlobalSearch({ onPickConference, onPickUser }: Props) {
  const [q, setQ] = useState("");
  const [confs, setConfs] = useState<Conference[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagsData, setTagsData] = useState<TagsResponse | null>(tagsCache);
  const [vennOpen, setVennOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);
  const escStreak = useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  const location = useLocation();
  const onRoot = location.pathname === "/";

  // Window-level keydown: detect 3 Escape presses within the streak window
  // while 2+ tags are selected. Anything else (or expiry) resets the streak.
  // Stored on a ref so we don't bind/unbind the listener as state churns.
  const selectedTagsRef = useRef(selectedTags);
  selectedTagsRef.current = selectedTags;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        escStreak.current = { count: 0, last: 0 };
        return;
      }
      const now = Date.now();
      if (now - escStreak.current.last > VENN_EGG_WINDOW_MS) {
        escStreak.current = { count: 1, last: now };
      } else {
        escStreak.current = { count: escStreak.current.count + 1, last: now };
      }
      if (
        escStreak.current.count >= 3 &&
        selectedTagsRef.current.length >= 2
      ) {
        escStreak.current = { count: 0, last: 0 };
        setVennOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load /tags the first time the user focuses the bar or opens the picker.
  useEffect(() => {
    if (!tagsData && (open || tagPickerOpen)) {
      loadTags().then(setTagsData).catch((err) => console.error("load tags", err));
    }
  }, [open, tagPickerOpen, tagsData]);

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
    // requestSeq is bumped synchronously in the input onChange, so by the
    // time this passive effect runs the seq already reflects the latest
    // user intent. Capture it to compare against when responses return.
    const seq = requestSeq.current;

    const hasQuery = q.trim().length > 0;
    const hasTags = selectedTags.length > 0;
    if (!hasQuery && !hasTags) {
      setConfs([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (hasQuery) params.set("q", q.trim());
      if (hasTags) params.set("tags", selectedTags.join(","));
      const confPromise = apiFetch<{ conferences: Conference[] }>(
        `/conferences?${params.toString()}`,
      );
      // People search is text-only for now (tag-based people search is the
      // next milestone). Skip the request entirely when there's no text.
      const userPromise = hasQuery
        ? apiFetch<{ users: PublicUser[] }>(`/users?q=${encodeURIComponent(q.trim())}`)
        : Promise.resolve({ users: [] });
      const [confRes, userRes] = await Promise.allSettled([confPromise, userPromise]);
      // ignore stale responses — only the most recent query's request wins
      if (seq !== requestSeq.current) return;
      if (confRes.status === "fulfilled") setConfs(confRes.value.conferences);
      else console.error(confRes.reason);
      if (userRes.status === "fulfilled") setPeople(userRes.value.users);
      else console.error(userRes.reason);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q, selectedTags]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setTagPickerOpen(false);
      }
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

  const show =
    open &&
    (loading || items.length > 0 || q.trim().length > 0 || selectedTags.length > 0);
  const totalCount = confs.length + people.length;

  // Tag picker dropdown: filter the grouped vocab by tagQuery substring,
  // hide already-selected tags. Show top N per category to keep it tight.
  const filteredGroups = useMemo(() => {
    if (!tagsData) return null;
    const needle = tagQuery.trim().toLowerCase();
    const selected = new Set(selectedTags);
    const out: Array<{ category: string; tags: { tag: string; count: number; subgroup: string }[] }> = [];
    for (const [cat, subs] of Object.entries(tagsData.groups)) {
      const flat = Object.entries(subs).flatMap(([sub, ts]) =>
        ts.map((t) => ({ tag: t.tag, count: t.count, subgroup: sub })),
      );
      const filtered = flat
        .filter((t) => !selected.has(t.tag))
        .filter((t) => (needle ? t.tag.includes(needle) : true))
        .sort((a, b) => b.count - a.count);
      if (filtered.length > 0) {
        out.push({ category: cat, tags: needle ? filtered.slice(0, 8) : filtered.slice(0, 6) });
      }
    }
    // When there's a search needle, sort categories by number of matches for relevance.
    if (needle) out.sort((a, b) => b.tags.length - a.tags.length);
    return out;
  }, [tagsData, tagQuery, selectedTags]);

  function addTag(tag: string) {
    if (selectedTags.includes(tag)) return;
    requestSeq.current += 1;
    setSelectedTags([...selectedTags, tag]);
    setTagQuery("");
    setTagPickerOpen(false);
    setOpen(true);
  }

  function removeTag(tag: string) {
    requestSeq.current += 1;
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  }

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
        {selectedTags.map((tag) => (
          <button
            key={`chip:${tag}`}
            type="button"
            className="tag-chip"
            onClick={() => removeTag(tag)}
            title="Remove tag"
          >
            {tag}
            <span className="tag-chip-x" aria-hidden>×</span>
          </button>
        ))}
        <input
          className="global-search-input"
          placeholder={
            selectedTags.length > 0
              ? "Refine by name or location…"
              : "Search conferences, people, or tags…"
          }
          value={q}
          onChange={(e) => {
            // invalidate any prior in-flight request synchronously so a late
            // response from a previous query cannot clobber the new state.
            requestSeq.current += 1;
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // Backspace on empty input pops the last tag, keyboard-friendly removal.
            if (e.key === "Backspace" && q.length === 0 && selectedTags.length > 0) {
              removeTag(selectedTags[selectedTags.length - 1]);
            }
          }}
        />
        <button
          type="button"
          className={`tag-add${tagPickerOpen ? " tag-add--open" : ""}`}
          onClick={() => {
            setTagPickerOpen((v) => !v);
            setOpen(true);
          }}
          title="Filter by tag"
          aria-label="Filter by tag"
        >
          # tag
        </button>
      </label>
      {tagPickerOpen ? (
        <div className="glass-panel tag-picker">
          <input
            autoFocus
            className="tag-picker-input"
            placeholder="Search tags…"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTagPickerOpen(false);
              } else if (e.key === "Enter" && filteredGroups && filteredGroups.length > 0) {
                // Pick top match across all categories on Enter.
                const top = filteredGroups[0]?.tags[0]?.tag;
                if (top) addTag(top);
              }
            }}
          />
          <div className="tag-picker-list">
            {filteredGroups === null ? (
              <div className="muted row">Loading tags…</div>
            ) : filteredGroups.length === 0 ? (
              <div className="muted row">No matching tags</div>
            ) : (
              filteredGroups.map((g) => (
                <div key={g.category} className="tag-picker-group">
                  <div className="tag-picker-group-label">{g.category}</div>
                  <div className="tag-picker-tags">
                    {g.tags.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        className="tag-picker-tag"
                        onClick={() => addTag(t.tag)}
                      >
                        {t.tag}
                        <span className="tag-picker-tag-count">{t.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
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
                className={`global-search-result${it.conf.premium ? " premium" : ""}`}
                onClick={() => {
                  onPickConference(it.conf);
                  setOpen(false);
                }}
              >
                <span className="result-icon" aria-hidden>
                  {it.conf.premium && it.conf.premiumImage ? (
                    <img
                      src={it.conf.premiumImage}
                      alt=""
                      className="result-thumb"
                    />
                  ) : it.conf.premium ? (
                    "★"
                  ) : (
                    "📍"
                  )}
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
          flex-wrap: wrap;
          gap: 0.4rem;
          width: 100%;
          padding: 0.55rem 0.7rem;
          border-radius: 18px;
          cursor: text;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid var(--mist);
          background: rgba(232, 240, 255, 0.06);
          background: color(display-p3 0.91 0.941 1 / 0.06);
          color: var(--text);
          font-size: 0.72rem;
          cursor: pointer;
          flex-shrink: 0;
        }
        .tag-chip:hover {
          border-color: var(--aurora-dim, var(--mist));
          background: var(--aurora-wash, rgba(232, 240, 255, 0.1));
        }
        .tag-chip-x {
          opacity: 0.7;
          font-size: 0.85rem;
          line-height: 1;
        }
        .tag-add {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px dashed var(--mist);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.7rem;
          cursor: pointer;
          flex-shrink: 0;
        }
        .tag-add:hover, .tag-add--open {
          border-style: solid;
          color: var(--text);
        }
        .tag-picker {
          margin-top: 8px;
          padding: 8px;
          max-height: 360px;
          overflow-y: auto;
          z-index: 51;
        }
        .tag-picker-input {
          width: 100%;
          padding: 0.45rem 0.6rem;
          border-radius: 10px;
          border: 1px solid var(--mist);
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 0.78rem;
          outline: none;
          margin-bottom: 6px;
        }
        .tag-picker-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tag-picker-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tag-picker-group-label {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--text-muted);
          padding: 0 4px;
        }
        .tag-picker-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .tag-picker-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--mist);
          background: transparent;
          color: var(--text);
          font-size: 0.72rem;
          cursor: pointer;
        }
        .tag-picker-tag:hover {
          background: rgba(232, 240, 255, 0.06);
          background: color(display-p3 0.91 0.941 1 / 0.06);
        }
        .tag-picker-tag-count {
          opacity: 0.55;
          font-size: 0.62rem;
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
        .global-search-result.premium {
          border-color: var(--aurora-dim);
          background: var(--aurora-wash);
        }
        .global-search-result.premium:hover {
          border-color: var(--aurora);
          background: var(--aurora-wash);
        }
        .global-search-result.premium .result-icon {
          color: var(--aurora);
        }
        .result-thumb {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          object-fit: contain;
          background: var(--aurora-wash);
          padding: 1px;
          box-sizing: border-box;
        }
      `}</style>
      {vennOpen && selectedTags.length >= 2 ? (
        <VennEgg tags={selectedTags} onClose={() => setVennOpen(false)} />
      ) : null}
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
