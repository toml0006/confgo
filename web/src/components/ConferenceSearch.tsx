import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, type Conference } from "../api";

const DEBOUNCE_MS = 260;

type Props = {
  onPick: (conf: Conference) => void;
};

export function ConferenceSearch({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await apiFetch<{ conferences: Conference[] }>(
          `/conferences?q=${encodeURIComponent(q.trim())}`,
        );
        setResults(data.conferences);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
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

  const show = open && (loading || results.length > 0 || q.trim().length > 0);

  const grouped = useMemo(() => results.slice(0, 40), [results]);

  return (
    <div className="conf-search" ref={wrapRef}>
      <input
        className="glass-panel conf-search-input"
        placeholder="Search conferences…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {show ? (
        <div className="glass-panel conf-search-results">
          {loading ? <div className="muted row">Searching…</div> : null}
          {!loading && grouped.length === 0 && q.trim() ? (
            <div className="muted row">No matches</div>
          ) : null}
          {grouped.map((c) => (
            <button
              key={c.id}
              className="conf-search-result"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
            >
              <span className="name">{c.name}</span>
              <span className="meta">
                {c.locationName} · {new Date(c.startDate).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <style>{`
        .conf-search {
          position: fixed;
          top: 18px;
          left: 18px;
          width: min(500px, calc(100vw - 260px));
          z-index: 30;
        }
        .conf-search-input {
          width: 100%;
          padding: 0.7rem 1rem;
          border-radius: 18px;
          font-size: 0.85rem;
        }
        .conf-search-results {
          margin-top: 8px;
          max-height: 380px;
          overflow-y: auto;
          padding: 6px;
          z-index: 50;
        }
        .conf-search-results .row {
          padding: 0.65rem 0.85rem;
          font-size: 0.78rem;
        }
        .conf-search-result {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 0.55rem 0.75rem;
          width: 100%;
          text-align: left;
          border-radius: 12px;
          border: 1px solid transparent;
        }
        .conf-search-result:hover {
          border-color: var(--mist);
          background: rgba(232, 240, 255, 0.04);
        }
        .conf-search-result .name {
          font-size: 0.85rem;
        }
        .conf-search-result .meta {
          font-size: 0.68rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
      `}</style>
    </div>
  );
}
