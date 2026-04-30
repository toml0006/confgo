import { useEffect, useMemo, useState } from "react";
import { apiFetch, type Conference } from "../api";

type Props = {
  tags: string[];
  onClose: () => void;
};

// Fullscreen Venn-diagram easter egg. Triggered by 3x Escape when 2+ tags are
// selected in GlobalSearch. Renders a 2- or 3-circle Venn (uses the first 3
// selected tags if more are picked) and labels each conference inside the
// region matching the exact subset of tags it carries.
export function VennEgg({ tags, onClose }: Props) {
  const [confs, setConfs] = useState<Conference[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Show only first 3 tags in the diagram itself; legend mentions extras.
  const usedTags = useMemo(() => tags.slice(0, 3), [tags]);
  const overflow = tags.length - usedTags.length;

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ conferences: Conference[] }>(
      `/conferences?tagsAny=${encodeURIComponent(usedTags.join(","))}`,
    )
      .then((r) => {
        if (!cancelled) setConfs(r.conferences);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [usedTags]);

  // Esc closes; bind on mount.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bucket conferences by the *exact* subset of usedTags they carry.
  // Key = sorted bitmask of tag indices (e.g. "0,1" = both first two).
  const buckets = useMemo(() => {
    const out = new Map<string, Conference[]>();
    if (!confs) return out;
    for (const c of confs) {
      const tagsOnConf = new Set(c.tags ?? []);
      const has = usedTags
        .map((t, i) => (tagsOnConf.has(t) ? i : -1))
        .filter((i) => i >= 0);
      if (has.length === 0) continue;
      const key = has.join(",");
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(c);
    }
    return out;
  }, [confs, usedTags]);

  return (
    <div className="venn-egg" onClick={onClose}>
      <div className="venn-egg-stage" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="venn-egg-error">Failed to load: {error}</div>
        ) : !confs ? (
          <div className="venn-egg-loading">Spinning up Venn…</div>
        ) : (
          <VennSvg tags={usedTags} buckets={buckets} />
        )}
        <div className="venn-egg-footer">
          <span>Easter egg · esc to close</span>
          {overflow > 0 ? <span>+{overflow} extra tag{overflow === 1 ? "" : "s"} not shown</span> : null}
          <button className="venn-egg-close" onClick={onClose}>
            close
          </button>
        </div>
      </div>
      <style>{`
        .venn-egg {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(8, 10, 18, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .venn-egg-stage {
          position: relative;
          width: min(1200px, calc(100vw - 48px));
          height: min(820px, calc(100vh - 48px));
          display: flex;
          flex-direction: column;
        }
        .venn-egg-loading,
        .venn-egg-error {
          margin: auto;
          color: var(--text-muted);
          font-size: 0.95rem;
        }
        .venn-egg-error { color: #ff7e7e; }
        .venn-egg-footer {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 16px;
          color: var(--text-muted);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }
        .venn-egg-close {
          margin-left: auto;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid var(--mist);
          background: transparent;
          color: var(--text);
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .venn-egg-close:hover {
          background: rgba(232, 240, 255, 0.06);
          background: color(display-p3 0.91 0.941 1 / 0.06);
        }
      `}</style>
    </div>
  );
}

// Region centers chosen so labels sit visually inside the lens / petal.
// All coordinates in the SVG's 1000x720 viewBox. Tweaked by eye, not math.
type Region = { x: number; y: number; width: number };

const COLORS = ["#7dd3fc", "#fbbf24", "#f472b6"];

function VennSvg({
  tags,
  buckets,
}: {
  tags: string[];
  buckets: Map<string, Conference[]>;
}) {
  if (tags.length < 2) {
    return (
      <div className="venn-egg-error">
        Need at least 2 tags for a Venn — pick another in the search bar.
      </div>
    );
  }
  if (tags.length === 2) {
    return <Venn2 tags={tags} buckets={buckets} />;
  }
  return <Venn3 tags={tags} buckets={buckets} />;
}

function Venn2({
  tags,
  buckets,
}: {
  tags: string[];
  buckets: Map<string, Conference[]>;
}) {
  // Two circles, radius 270, centered at (370, 360) and (630, 360) — overlap ≈ 1/3 of each diameter.
  const r = 270;
  const cx1 = 370;
  const cx2 = 630;
  const cy = 360;

  const regions: Record<string, Region> = {
    "0": { x: cx1 - 130, y: cy, width: 200 },        // left only
    "1": { x: cx2 + 130, y: cy, width: 200 },        // right only
    "0,1": { x: (cx1 + cx2) / 2, y: cy, width: 160 }, // intersection
  };

  return (
    <svg viewBox="0 0 1000 720" className="venn-svg">
      <defs>
        <radialGradient id="g0" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS[0]} stopOpacity="0.32" />
          <stop offset="100%" stopColor={COLORS[0]} stopOpacity="0.08" />
        </radialGradient>
        <radialGradient id="g1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS[1]} stopOpacity="0.32" />
          <stop offset="100%" stopColor={COLORS[1]} stopOpacity="0.08" />
        </radialGradient>
      </defs>
      <circle cx={cx1} cy={cy} r={r} fill="url(#g0)" stroke={COLORS[0]} strokeWidth="2" />
      <circle cx={cx2} cy={cy} r={r} fill="url(#g1)" stroke={COLORS[1]} strokeWidth="2" />
      <text x={cx1 - 200} y={cy - r - 14} fill={COLORS[0]} fontSize="22" fontWeight="600">
        {tags[0]}
      </text>
      <text x={cx2 + 200} y={cy - r - 14} fill={COLORS[1]} fontSize="22" fontWeight="600" textAnchor="end">
        {tags[1]}
      </text>
      {(["0", "1", "0,1"] as const).map((key) =>
        buckets.has(key) ? (
          <RegionLabels
            key={key}
            confs={buckets.get(key)!}
            region={regions[key]}
          />
        ) : null,
      )}
      <style>{`.venn-svg { width: 100%; height: 100%; display: block; }`}</style>
    </svg>
  );
}

function Venn3({
  tags,
  buckets,
}: {
  tags: string[];
  buckets: Map<string, Conference[]>;
}) {
  // Three circles in equilateral triangle. Radius 240 keeps lens regions readable.
  const r = 200;
  const cx = 500;
  const cy = 360;
  const dy = 110;
  const dx = 115;
  const c0 = { x: cx - dx, y: cy - dy };       // top-left
  const c1 = { x: cx + dx, y: cy - dy };       // top-right
  const c2 = { x: cx, y: cy + dy };            // bottom

  // Region centers — picked by eye to land inside each petal.
  const regions: Record<string, Region> = {
    "0": { x: c0.x - 110, y: c0.y - 30, width: 200 },
    "1": { x: c1.x + 110, y: c1.y - 30, width: 200 },
    "2": { x: c2.x, y: c2.y + 90, width: 200 },
    "0,1": { x: (c0.x + c1.x) / 2, y: c0.y + 30, width: 160 },
    "0,2": { x: (c0.x + c2.x) / 2 - 30, y: (c0.y + c2.y) / 2 + 50, width: 140 },
    "1,2": { x: (c1.x + c2.x) / 2 + 30, y: (c1.y + c2.y) / 2 + 50, width: 140 },
    "0,1,2": { x: cx, y: cy + 30, width: 130 },
  };

  return (
    <svg viewBox="0 0 1000 720" className="venn-svg">
      <defs>
        {COLORS.slice(0, 3).map((col, i) => (
          <radialGradient key={i} id={`g3-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={col} stopOpacity="0.28" />
            <stop offset="100%" stopColor={col} stopOpacity="0.06" />
          </radialGradient>
        ))}
      </defs>
      {[c0, c1, c2].map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={r}
          fill={`url(#g3-${i})`}
          stroke={COLORS[i]}
          strokeWidth="2"
        />
      ))}
      <text x={c0.x - r + 30} y={c0.y - r - 12} fill={COLORS[0]} fontSize="22" fontWeight="600">
        {tags[0]}
      </text>
      <text x={c1.x + r - 30} y={c1.y - r - 12} fill={COLORS[1]} fontSize="22" fontWeight="600" textAnchor="end">
        {tags[1]}
      </text>
      <text x={c2.x} y={c2.y + r + 30} fill={COLORS[2]} fontSize="22" fontWeight="600" textAnchor="middle">
        {tags[2]}
      </text>
      {Object.keys(regions).map((key) =>
        buckets.has(key) ? (
          <RegionLabels
            key={key}
            confs={buckets.get(key)!}
            region={regions[key]}
          />
        ) : null,
      )}
      <style>{`.venn-svg { width: 100%; height: 100%; display: block; }`}</style>
    </svg>
  );
}

function RegionLabels({
  confs,
  region,
}: {
  confs: Conference[];
  region: Region;
}) {
  // Cap labels per region to keep the diagram legible; surface a "+N more"
  // indicator so the count isn't lost.
  const MAX = 8;
  const shown = confs.slice(0, MAX);
  const more = confs.length - shown.length;
  const lineHeight = 14;
  const totalHeight = (shown.length + (more > 0 ? 1 : 0)) * lineHeight;
  const top = region.y - totalHeight / 2;

  return (
    <g transform={`translate(${region.x}, ${top})`}>
      {shown.map((c, i) => {
        // Truncate long names so they fit the region width.
        const label = truncate(c.name, region.width / 6);
        return (
          <text
            key={c.id}
            x={0}
            y={i * lineHeight}
            fontSize="10"
            fill="rgba(232,240,255,0.92)"
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
      {more > 0 ? (
        <text
          x={0}
          y={shown.length * lineHeight}
          fontSize="10"
          fill="rgba(232,240,255,0.55)"
          textAnchor="middle"
          fontStyle="italic"
        >
          +{more} more
        </text>
      ) : null}
    </g>
  );
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, Math.floor(maxChars) - 1)) + "…";
}
