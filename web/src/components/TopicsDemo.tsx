// Public route at /demo/topics. Loads design/Summary/flashcards.md
// (parsed at build time into /topics.json) and floats up to 10 cards on
// screen at a time. Each card runs a 5s fade-in / 30+s hold / 5s fade-out
// lifecycle. Click a card → modal with title + body + a like button.
//
// Live voting: every visitor (signed in anonymously) can like/unlike any
// topic. Likes are stored in Firestore under /topic_likes/{topicId} and
// per-user state in /user_topic_likes/{uid}. Active likes:
//   • Bias the spawn picker — weight = 1 + likeCount.
//   • Extend on-screen lifetime — 20s base + 1.5s per like up to +30s.
// Likes are real-time across all viewers via onSnapshot.
//
// Layout: 4×3 cell grid, 10 active slots, so two cells are always free
// — keeps cards from overlapping while still feeling random.
//
// Easter egg: 3× Esc within 1.5s pops the live leaderboard of all topics
// ranked by total likes.

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
import { Heart, Search, X } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Kicker } from "./ui/kicker";
import { Wordmark } from "./ui/wordmark";
import { cn } from "../lib/utils";

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
  // Center of cell within central 80%×76% of viewport. Jitter ±30% of
  // cell size keeps cards inside their own cells, so 4×3 grid → no
  // overlap between active slots.
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
  const [leaderboard, setLeaderboard] = useState(false);
  const { user } = useAuth();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !topics) return [];
    return topics
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, topics]);

  const ranked = useMemo(() => {
    if (!topics) return [] as { topic: Topic; count: number }[];
    return topics
      .map((t) => ({ topic: t, count: likes[t.id] ?? 0 }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.topic.title.localeCompare(b.topic.title);
      });
  }, [topics, likes]);

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

  // Subscribe to *this* viewer's liked-set.
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

  // Spawn loop. Re-runs only when the catalog first loads; closures read
  // the latest likes/slots via refs so live vote updates bias future
  // picks without restarting the loop.
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

  // Easter egg: 3× Esc within 1.5s opens the live leaderboard. Skipped
  // when popup/leaderboard already open, or when typing in an input.
  useEffect(() => {
    const taps: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popup || leaderboard) return;
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const now = Date.now();
      while (taps.length > 0 && now - taps[0] > 1500) taps.shift();
      taps.push(now);
      if (taps.length >= 3) {
        taps.length = 0;
        setLeaderboard(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup, leaderboard]);

  async function toggleLike(topic: Topic) {
    if (!user?.uid) return;
    const isLiked = myLikes.has(topic.id);

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
    <div className="fixed inset-0 overflow-hidden bg-bg text-ink font-ui">
      {/* Subtle paper texture — two soft tonal washes diagonally placed
          to give the background depth without competing with the cards. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 18%, color(display-p3 0.761 0.255 0.047 / 0.05) 0%, transparent 55%),
            radial-gradient(ellipse at 78% 82%, color(display-p3 0.718 0.580 0.965 / 0.05) 0%, transparent 55%)
          `,
        }}
      />

      <header className="absolute top-5 left-5 z-40 flex items-center gap-3">
        <Wordmark size={18} dim />
        <Kicker className="text-ink3 hidden sm:block">Topics · live</Kicker>
      </header>

      <SearchBar
        query={query}
        onQuery={setQuery}
        matches={matches}
        likes={likes}
        myLikes={myLikes}
        onPick={openTopic}
      />

      <p
        aria-hidden
        className="absolute bottom-4 right-5 z-30 select-none font-mono text-[10px] tracking-[0.18em] uppercase text-ink3/70"
      >
        esc · esc · esc
      </p>

      {!topics ? (
        <div className="absolute inset-0 grid place-items-center">
          <Kicker className="text-ink3">Loading topics…</Kicker>
        </div>
      ) : null}

      {slots.map((slot) =>
        slot ? (
          <FloatingCard
            key={slot.spawnId}
            slot={slot}
            likeCount={likes[slot.topic.id] ?? 0}
            iLike={myLikes.has(slot.topic.id)}
            onClick={() => setPopup(slot.topic)}
          />
        ) : null,
      )}

      {popup ? (
        <TopicModal
          topic={popup}
          likeCount={likes[popup.id] ?? 0}
          iLike={myLikes.has(popup.id)}
          onLike={() => toggleLike(popup)}
          onClose={() => setPopup(null)}
        />
      ) : null}

      {leaderboard ? (
        <Leaderboard
          ranked={ranked}
          myLikes={myLikes}
          onPick={(t) => {
            setLeaderboard(false);
            openTopic(t);
          }}
          onClose={() => setLeaderboard(false)}
        />
      ) : null}

      {/* The single keyframe Tailwind doesn't already give us. The card's
          opacity-0 / opacity-1 / opacity-1 / opacity-0 timeline scales
          with `animation-duration` set inline per card. */}
      <style>{`
        @keyframes topic-life {
          0%    { opacity: 0; }
          12.5% { opacity: 1; }
          87.5% { opacity: 1; }
          100%  { opacity: 0; }
        }
        .topic-life {
          opacity: 0;
          animation-name: topic-life;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}

function FloatingCard({
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
      onClick={onClick}
      style={{
        top: `${slot.top}%`,
        left: `${slot.left}%`,
        transform: `translate(-50%, -50%) rotate(${slot.rotation}deg)`,
        animationDuration: `${slot.lifetimeMs}ms`,
      }}
      className={cn(
        "topic-life absolute z-10 w-[min(300px,calc(100vw-48px))]",
        "flex flex-col gap-2 rounded-card border border-hair bg-paper px-5 py-4 text-left",
        "shadow-card transition-[border-color,transform] duration-200",
        "hover:border-ink/40 hover:[transform:translate(-50%,-50%)_rotate(0deg)_scale(1.02)]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
      )}
    >
      {slot.topic.section ? (
        <Kicker className="text-ink3">{slot.topic.section}</Kicker>
      ) : null}
      <span className="font-display text-[1.05rem] leading-snug tracking-tight-1 text-ink pr-6">
        {slot.topic.title}
      </span>
      {likeCount > 0 ? (
        <span
          aria-label={`${likeCount} likes`}
          className={cn(
            "absolute top-3 right-3 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums",
            iLike ? "text-brand" : "text-ink3",
          )}
        >
          <Heart className={cn("size-3", iLike && "fill-brand")} aria-hidden />
          {likeCount}
        </span>
      ) : null}
    </button>
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
    <div className="fixed top-5 left-1/2 z-40 w-[min(420px,calc(100vw-32px))] -translate-x-1/2">
      <label className="relative flex items-center gap-2 rounded-pill border border-hair bg-paper px-4 py-2 shadow-card">
        <Search className="size-4 text-ink3 shrink-0" aria-hidden />
        <Input
          type="search"
          value={query}
          placeholder="Search topics…"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQuery("");
            if (e.key === "Enter" && matches.length > 0) onPick(matches[0]);
          }}
          className="border-none bg-transparent p-0 text-[0.85rem] tracking-[0.02em] focus-visible:border-none focus-visible:ring-0 shadow-none"
        />
      </label>

      {query.trim() && matches.length > 0 ? (
        <div className="mt-2 flex flex-col gap-px overflow-hidden rounded-card border border-hair bg-paper p-1.5 shadow-modal">
          {matches.map((t) => {
            const c = likes[t.id] ?? 0;
            const liked = myLikes.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t)}
                className="group flex flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-hair-soft"
              >
                <span className="font-display text-[0.9rem] leading-snug tracking-tight-1 text-ink">
                  {t.title}
                </span>
                <span className="flex items-center justify-between gap-2">
                  {t.section ? (
                    <Kicker className="truncate text-ink3">{t.section}</Kicker>
                  ) : (
                    <span />
                  )}
                  {c > 0 ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono text-[10px] tabular-nums",
                        liked ? "text-brand" : "text-ink3",
                      )}
                    >
                      <Heart
                        className={cn("size-3", liked && "fill-brand")}
                        aria-hidden
                      />
                      {c}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {query.trim() && matches.length === 0 ? (
        <div className="mt-2 rounded-card border border-hair bg-paper px-4 py-3 shadow-modal">
          <Kicker className="text-ink3">No topics match.</Kicker>
        </div>
      ) : null}
    </div>
  );
}

function ModalShell({
  className,
  zIndex,
  onClose,
  children,
}: {
  className?: string;
  zIndex: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{ zIndex }}
      className="fixed inset-0 grid place-items-center bg-ink/40 p-5 backdrop-blur-sm animate-sheet-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex flex-col gap-4 rounded-card border border-hair bg-paper p-7 text-ink shadow-modal",
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-full border border-hair text-ink2 transition-colors hover:border-ink hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}

function TopicModal({
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
    <ModalShell
      zIndex={100}
      onClose={onClose}
      className="w-[min(560px,calc(100vw-40px))]"
    >
      {topic.section ? <Kicker>{topic.section}</Kicker> : null}
      <h2 className="font-display text-2xl leading-tight tracking-tight-1 text-ink pr-8">
        {topic.title}
      </h2>
      <p className="font-display text-[1rem] leading-relaxed text-ink2">
        {topic.body}
      </p>
      <div className="flex items-center pt-1">
        <Button
          type="button"
          variant={iLike ? "atlas-primary" : "atlas"}
          size="atlas"
          onClick={onLike}
          aria-pressed={iLike}
          className="gap-2"
        >
          <Heart
            className={cn("size-4", iLike && "fill-bg")}
            aria-hidden
          />
          {iLike ? "Liked" : "Like"}
          <span className="font-mono text-[12px] tabular-nums opacity-70">
            {likeCount}
          </span>
        </Button>
      </div>
    </ModalShell>
  );
}

function Leaderboard({
  ranked,
  myLikes,
  onPick,
  onClose,
}: {
  ranked: { topic: Topic; count: number }[];
  myLikes: Set<string>;
  onPick: (t: Topic) => void;
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
    <ModalShell
      zIndex={110}
      onClose={onClose}
      className="w-[min(640px,calc(100vw-40px))] max-h-[calc(100vh-60px)]"
    >
      <div className="flex flex-col gap-1 pr-10">
        <Kicker accent>Live leaderboard</Kicker>
        <h2 className="font-display text-[1.7rem] leading-tight tracking-tight-1 text-ink">
          Most-liked topics
        </h2>
        <Kicker className="text-ink3">
          Real-time · Esc / click to dismiss
        </Kicker>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto pr-1 -mr-1">
        {ranked.map((row, i) => {
          const liked = myLikes.has(row.topic.id);
          return (
            <button
              key={row.topic.id}
              type="button"
              onClick={() => onPick(row.topic)}
              className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-hair hover:bg-hair-soft"
            >
              <span className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-ink3">
                {(i + 1).toString().padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-display text-[0.95rem] leading-snug tracking-tight-1 text-ink">
                  {row.topic.title}
                </span>
                {row.topic.section ? (
                  <Kicker className="truncate text-ink3">
                    {row.topic.section}
                  </Kicker>
                ) : null}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-[13px] tabular-nums",
                  liked
                    ? "text-brand"
                    : row.count > 0
                      ? "text-ink2"
                      : "text-ink3/40",
                )}
              >
                <Heart
                  className={cn("size-3.5", liked && "fill-brand")}
                  aria-hidden
                />
                {row.count}
              </span>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
