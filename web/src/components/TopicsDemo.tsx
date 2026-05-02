// Public route at /demo/topics. Loads design/Summary/flashcards.md
// (parsed at build time into /topics.json) and floats up to 10 cards on
// screen at a time. Each card runs a 5s fade-in / 30+s hold / 5s fade-out
// lifecycle. Click a card → modal with title + body + a like button.
//
// Live voting: every visitor (signed in anonymously) can like/unlike any
// topic. Likes are stored in Firestore under /topic_likes/{topicId} and
// per-user state in /user_topic_likes/{uid}. Active likes:
//   • Bias the spawn picker — weight = 1 + likeCount.
//   • Extend on-screen lifetime — 40s base + 2.5s per like up to +60s.
// Likes are real-time across all viewers via onSnapshot.
//
// Layout: 4×3 cell grid, 10 active slots, so two cells are always free
// — keeps cards from overlapping while still feeling random.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type Topic = {
  id: string;
  section: string | null;
  title: string;
  body: string;
};

type Slot = {
  spawnId: number;
  topic: Topic;
  cellKey: string;
  top: number;
  left: number;
  rotation: number;
  lifetimeMs: number;
};

const SLOT_COUNT = 10;
const COLS = 4;
const ROWS = 3;
// Keyframe is 12.5% / 87.5% breakpoints, so fades scale with lifetime.
// 20s base → ~2.5s fade in, ~15s hold, ~2.5s fade out. Hot topic at the
// cap (~50s) → ~6s fade in, ~38s hold, ~6s fade out — still slow enough
// to feel premium but cycles fast enough to keep the wall moving.
const BASE_LIFETIME_MS = 20_000;
const LIFETIME_PER_LIKE_MS = 1_500;
const MAX_EXTRA_LIFETIME_MS = 30_000;
const STAGGER_MS = 1_000;

function lifetimeFor(likeCount: number) {
  return (
    BASE_LIFETIME_MS +
    Math.min(Math.max(0, likeCount) * LIFETIME_PER_LIKE_MS, MAX_EXTRA_LIFETIME_MS)
  );
}

function cellKey(col: number, row: number) {
  return `${col},${row}`;
}

function cellCenter(col: number, row: number) {
  // Center of cell within the central 80%×76% of the viewport (10% / 12%
  // outer padding). Jitter ±30% of cell size keeps cards inside their
  // own cells, so 4×3 grid → no overlap between active slots.
  const colWidth = 80 / COLS;
  const rowHeight = 76 / ROWS;
  const left = 10 + (col + 0.5) * colWidth + (Math.random() - 0.5) * (colWidth * 0.3);
  const top = 12 + (row + 0.5) * rowHeight + (Math.random() - 0.5) * (rowHeight * 0.3);
  return { top, left };
}

export function TopicsDemo() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<(Slot | null)[]>(
    () => Array<Slot | null>(SLOT_COUNT).fill(null),
  );
  const [popup, setPopup] = useState<Topic | null>(null);
  const [query, setQuery] = useState("");
  const { user } = useAuth();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !topics) return [];
    return topics
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, topics]);

  const likesRef = useRef(likes);
  likesRef.current = likes;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // Load topic catalog (built from flashcards.md at build time).
  useEffect(() => {
    let cancelled = false;
    fetch("/topics.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { topics: Topic[] }) => {
        if (!cancelled) setTopics(body.topics);
      })
      .catch((err) => console.error("topics fetch failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to global like counts.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "topic_likes"),
      (snap) => {
        const next: Record<string, number> = {};
        for (const d of snap.docs) {
          const c = (d.data() as { count?: number }).count;
          next[d.id] = typeof c === "number" ? c : 0;
        }
        setLikes(next);
      },
      (err) => console.error("likes subscription error", err),
    );
    return unsub;
  }, []);

  // Subscribe to *this* viewer's liked-set (toggle state).
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, "user_topic_likes", user.uid),
      (snap) => {
        const arr = snap.exists()
          ? ((snap.data() as { liked?: string[] }).liked ?? [])
          : [];
        setMyLikes(new Set(arr));
      },
      (err) => console.error("user-likes subscription error", err),
    );
    return unsub;
  }, [user?.uid]);

  // Spawn loop. Re-runs only when the topic catalog first loads; the
  // spawn closures read the latest likes/slots via refs so live vote
  // updates bias future picks without restarting the loop.
  useEffect(() => {
    if (!topics || topics.length === 0) return;
    let cancelled = false;
    const timeouts: number[] = [];
    let counter = 0;

    function pickTopic(slotIndex: number): Topic {
      const all = topics!;
      const active = new Set<string>();
      for (let i = 0; i < SLOT_COUNT; i += 1) {
        if (i === slotIndex) continue;
        const s = slotsRef.current[i];
        if (s) active.add(s.topic.id);
      }
      const candidates = all.filter((t) => !active.has(t.id));
      const pool = candidates.length > 0 ? candidates : all;
      const total = pool.reduce(
        (sum, t) => sum + 1 + (likesRef.current[t.id] ?? 0),
        0,
      );
      let r = Math.random() * total;
      for (const t of pool) {
        r -= 1 + (likesRef.current[t.id] ?? 0);
        if (r <= 0) return t;
      }
      return pool[pool.length - 1];
    }

    function pickCell(slotIndex: number) {
      const used = new Set<string>();
      for (let i = 0; i < SLOT_COUNT; i += 1) {
        if (i === slotIndex) continue;
        const s = slotsRef.current[i];
        if (s) used.add(s.cellKey);
      }
      const all: { col: number; row: number; key: string }[] = [];
      for (let c = 0; c < COLS; c += 1) {
        for (let r = 0; r < ROWS; r += 1) {
          all.push({ col: c, row: r, key: cellKey(c, r) });
        }
      }
      const free = all.filter((cell) => !used.has(cell.key));
      const choices = free.length > 0 ? free : all;
      return choices[Math.floor(Math.random() * choices.length)];
    }

    function spawn(slotIndex: number) {
      if (cancelled) return;
      const cell = pickCell(slotIndex);
      const { top, left } = cellCenter(cell.col, cell.row);
      const topic = pickTopic(slotIndex);
      const lifetime = lifetimeFor(likesRef.current[topic.id] ?? 0);
      const slot: Slot = {
        spawnId: ++counter,
        topic,
        cellKey: cellKey(cell.col, cell.row),
        top,
        left,
        rotation: (Math.random() - 0.5) * 4,
        lifetimeMs: lifetime,
      };
      setSlots((prev) => {
        const next = prev.slice();
        next[slotIndex] = slot;
        return next;
      });
      timeouts.push(window.setTimeout(() => spawn(slotIndex), lifetime));
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      timeouts.push(window.setTimeout(() => spawn(i), i * STAGGER_MS));
    }

    return () => {
      cancelled = true;
      for (const t of timeouts) window.clearTimeout(t);
    };
  }, [topics]);

  async function toggleLike(topic: Topic) {
    if (!user?.uid) return;
    const isLiked = myLikes.has(topic.id);

    // Optimistic update — UI snaps immediately; the Firestore round-trip
    // is invisible unless it fails (then we roll back below).
    setMyLikes((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(topic.id);
      else next.add(topic.id);
      return next;
    });
    setLikes((prev) => ({
      ...prev,
      [topic.id]: Math.max(0, (prev[topic.id] ?? 0) + (isLiked ? -1 : 1)),
    }));

    try {
      const userRef = doc(db, "user_topic_likes", user.uid);
      const topicRef = doc(db, "topic_likes", topic.id);
      const batch = writeBatch(db);
      batch.set(
        userRef,
        { liked: isLiked ? arrayRemove(topic.id) : arrayUnion(topic.id) },
        { merge: true },
      );
      batch.set(
        topicRef,
        { count: increment(isLiked ? -1 : 1) },
        { merge: true },
      );
      await batch.commit();
    } catch (err) {
      console.error("like toggle failed", err);
      setMyLikes((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(topic.id);
        else next.delete(topic.id);
        return next;
      });
      setLikes((prev) => ({
        ...prev,
        [topic.id]: Math.max(0, (prev[topic.id] ?? 0) + (isLiked ? 1 : -1)),
      }));
    }
  }

  function openTopic(topic: Topic) {
    setPopup(topic);
    setQuery("");
  }

  return (
    <div className="topics-demo">
      <div className="topics-bg" aria-hidden />
      {!topics ? <div className="topics-loading">Loading topics…</div> : null}
      {slots.map((slot) =>
        slot ? (
          <Card
            key={slot.spawnId}
            slot={slot}
            likeCount={likes[slot.topic.id] ?? 0}
            iLike={myLikes.has(slot.topic.id)}
            onClick={() => setPopup(slot.topic)}
          />
        ) : null,
      )}
      <SearchBar
        query={query}
        onQuery={setQuery}
        matches={matches}
        likes={likes}
        myLikes={myLikes}
        onPick={openTopic}
      />

      {popup ? (
        <Popup
          topic={popup}
          likeCount={likes[popup.id] ?? 0}
          iLike={myLikes.has(popup.id)}
          onLike={() => toggleLike(popup)}
          onClose={() => setPopup(null)}
        />
      ) : null}
      <style>{`
        .topics-demo {
          position: fixed;
          inset: 0;
          background: var(--void);
          color: var(--text);
          overflow: hidden;
          font-family: "Lexend Exa", "SF Pro", system-ui, sans-serif;
        }
        .topics-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(
              ellipse at 30% 20%,
              color(display-p3 0.369 0.906 0.851 / 0.06) 0%,
              transparent 55%
            ),
            radial-gradient(
              ellipse at 70% 80%,
              color(display-p3 0.718 0.58 0.965 / 0.05) 0%,
              transparent 55%
            );
        }
        .topics-loading {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: var(--text-muted);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }
        .topics-search {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: min(380px, calc(100vw - 32px));
          z-index: 50;
          font-family: inherit;
        }
        .topics-search-input-wrap {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.55rem 0.9rem;
          border-radius: 999px;
          border: 1px solid var(--mist);
          background: var(--panel-gradient);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          color: var(--text);
          cursor: text;
          box-shadow: 0 8px 28px -16px rgba(0, 0, 0, 0.8);
          box-shadow: 0 8px 28px -16px color(display-p3 0 0 0 / 0.8);
        }
        .topics-search-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .topics-search-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          color: inherit;
          font: inherit;
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          padding: 0;
        }
        .topics-search-input::placeholder {
          color: var(--text-muted);
        }
        .topics-search-results {
          margin-top: 8px;
          padding: 6px;
          border-radius: 14px;
          border: 1px solid var(--mist);
          background: var(--panel-gradient);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 16px 48px -20px rgba(0, 0, 0, 0.85);
          box-shadow: 0 16px 48px -20px color(display-p3 0 0 0 / 0.85);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .topics-search-empty {
          padding: 0.65rem 0.85rem;
          font-size: 0.72rem;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .topics-search-result {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.55rem 0.75rem;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: border-color 200ms ease, background 200ms ease;
        }
        .topics-search-result:hover {
          border-color: var(--mist);
          background: rgba(232, 240, 255, 0.04);
          background: color(display-p3 0.91 0.941 1 / 0.04);
        }
        .topics-search-title {
          font-size: 0.82rem;
          line-height: 1.3;
          letter-spacing: 0.02em;
        }
        .topics-search-meta {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: var(--text-muted);
        }
        .topics-search-section {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .topics-search-likes {
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.05em;
        }
        .topics-search-likes.liked { color: var(--ember); }
        .topic-card {
          position: absolute;
          width: min(280px, calc(100vw - 48px));
          padding: 16px 18px;
          border-radius: 14px;
          border: 1px solid var(--mist);
          background: var(--panel-gradient);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          color: var(--text);
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          box-shadow: 0 10px 40px -15px rgba(0, 0, 0, 0.9);
          box-shadow: 0 10px 40px -15px color(display-p3 0 0 0 / 0.9);
          transform-origin: center center;
          opacity: 0;
          animation-name: topic-life;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          transition: border-color 200ms ease;
          font-family: inherit;
        }
        .topic-card:hover {
          border-color: var(--signal-dim);
        }
        .topic-section {
          font-size: 0.58rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--text-muted);
        }
        .topic-title {
          font-size: 0.92rem;
          line-height: 1.35;
          font-weight: 400;
          letter-spacing: 0.02em;
          padding-right: 1.6rem;
        }
        .topic-like-badge {
          position: absolute;
          top: 10px;
          right: 12px;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .topic-like-badge.liked { color: var(--ember); }
        .topic-like-badge .heart { margin-right: 0.2rem; }
        @keyframes topic-life {
          0%    { opacity: 0; }
          /* Fade-in finishes 5s in; lifetime varies, so this percentage
             only matches when lifetime≈40s. With longer lifetimes the
             fade-in stretches proportionally, which is fine — feels
             slower-and-grander for hot topics. */
          12.5% { opacity: 1; }
          87.5% { opacity: 1; }
          100%  { opacity: 0; }
        }
        .popup-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(3, 4, 10, 0.7);
          background: color(display-p3 0.012 0.016 0.039 / 0.7);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          z-index: 100;
          padding: 20px;
          animation: popup-in 200ms ease forwards;
        }
        @keyframes popup-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .popup {
          position: relative;
          width: min(560px, calc(100vw - 40px));
          padding: 28px 26px 24px;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          background: var(--panel-gradient);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid var(--mist);
          border-radius: 18px;
          color: var(--text);
          box-shadow: 0 16px 60px -20px rgba(0, 0, 0, 0.9);
          box-shadow: 0 16px 60px -20px color(display-p3 0 0 0 / 0.9);
        }
        .popup .close-x {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid var(--mist);
          background: transparent;
          color: var(--text-muted);
          font-size: 1.1rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 180ms ease, border-color 180ms ease;
        }
        .popup .close-x:hover {
          color: var(--text);
          border-color: var(--mist-strong);
        }
        .popup-section {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: var(--text-muted);
        }
        .popup-title {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 400;
          line-height: 1.3;
          letter-spacing: 0.02em;
          padding-right: 2rem;
        }
        .popup-body {
          margin: 0;
          font-family: "Newsreader", Georgia, serif;
          font-size: 1rem;
          line-height: 1.55;
          color: var(--text);
          letter-spacing: 0.01em;
        }
        .popup-actions {
          display: flex;
          gap: 0.55rem;
          margin-top: 0.4rem;
        }
        .like-button {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.55rem 1rem;
          border-radius: 999px;
          border: 1px solid var(--mist);
          background: transparent;
          color: var(--text);
          font-family: inherit;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          cursor: pointer;
          transition:
            border-color 200ms ease,
            color 200ms ease,
            background 200ms ease;
        }
        .like-button .heart {
          font-size: 1.05rem;
          color: var(--text-muted);
          transition: color 200ms ease, transform 200ms ease;
        }
        .like-button .like-count {
          font-variant-numeric: tabular-nums;
          color: var(--text-muted);
          font-size: 0.78rem;
          letter-spacing: 0.04em;
        }
        .like-button:hover {
          border-color: var(--ember);
          background: color(display-p3 1 0.71 0.278 / 0.04);
        }
        .like-button:hover .heart {
          color: var(--ember);
        }
        .like-button.liked {
          border-color: var(--ember);
          color: var(--ember);
        }
        .like-button.liked .heart {
          color: var(--ember);
          transform: scale(1.15);
        }
        .like-button.liked .like-count {
          color: var(--ember);
        }
      `}</style>
    </div>
  );
}

function SearchBar({
  query,
  onQuery,
  matches,
  likes,
  myLikes,
  onPick,
}: {
  query: string;
  onQuery: (q: string) => void;
  matches: Topic[];
  likes: Record<string, number>;
  myLikes: Set<string>;
  onPick: (t: Topic) => void;
}) {
  return (
    <div className="topics-search">
      <label className="topics-search-input-wrap">
        <svg
          className="topics-search-icon"
          viewBox="0 0 24 24"
          width="14"
          height="14"
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
          className="topics-search-input"
          type="search"
          value={query}
          placeholder="Search topics…"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQuery("");
            if (e.key === "Enter" && matches.length > 0) onPick(matches[0]);
          }}
        />
      </label>
      {query.trim() && matches.length > 0 ? (
        <div className="topics-search-results">
          {matches.map((t) => {
            const c = likes[t.id] ?? 0;
            const liked = myLikes.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className="topics-search-result"
                onClick={() => onPick(t)}
              >
                <span className="topics-search-title">{t.title}</span>
                <span className="topics-search-meta">
                  {t.section ? <span className="topics-search-section">{t.section}</span> : null}
                  {c > 0 ? (
                    <span className={`topics-search-likes${liked ? " liked" : ""}`}>
                      ♥ {c}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {query.trim() && matches.length === 0 ? (
        <div className="topics-search-results topics-search-empty">No topics match.</div>
      ) : null}
    </div>
  );
}

function Card({
  slot,
  likeCount,
  iLike,
  onClick,
}: {
  slot: Slot;
  likeCount: number;
  iLike: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="topic-card"
      style={{
        top: `${slot.top}%`,
        left: `${slot.left}%`,
        transform: `translate(-50%, -50%) rotate(${slot.rotation}deg)`,
        animationDuration: `${slot.lifetimeMs}ms`,
      }}
      onClick={onClick}
    >
      {slot.topic.section ? (
        <span className="topic-section">{slot.topic.section}</span>
      ) : null}
      <span className="topic-title">{slot.topic.title}</span>
      {likeCount > 0 ? (
        <span
          className={`topic-like-badge${iLike ? " liked" : ""}`}
          aria-label={`${likeCount} likes`}
        >
          <span className="heart" aria-hidden>♥</span>
          {likeCount}
        </span>
      ) : null}
    </button>
  );
}

function Popup({
  topic,
  likeCount,
  iLike,
  onLike,
  onClose,
}: {
  topic: Topic;
  likeCount: number;
  iLike: boolean;
  onLike: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="close-x"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {topic.section ? (
          <div className="popup-section">{topic.section}</div>
        ) : null}
        <h2 className="popup-title">{topic.title}</h2>
        <p className="popup-body">{topic.body}</p>
        <div className="popup-actions">
          <button
            type="button"
            className={`like-button${iLike ? " liked" : ""}`}
            onClick={onLike}
            aria-pressed={iLike}
          >
            <span className="heart" aria-hidden>♥</span>
            <span>{iLike ? "Liked" : "Like"}</span>
            <span className="like-count">{likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
