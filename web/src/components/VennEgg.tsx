import { useEffect, useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { apiFetch, type Conference } from "../api";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/kicker";

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
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg/85 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(1200px,calc(100vw-48px))] h-[min(820px,calc(100vh-48px))] flex flex-col bg-paper border border-hair rounded-[14px] shadow-[var(--shadow-modal)] p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-col gap-1">
            <Kicker>Tag overlap</Kicker>
            <h2 className="font-display font-normal text-[1.5rem] text-ink m-0">
              {usedTags.join(" · ")}
            </h2>
          </div>
          <Button variant="atlas-ghost" size="atlas-sm" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        {error ? (
          <div className="m-auto font-display italic text-[15px] text-brand">
            Failed to load: {error}
          </div>
        ) : !confs ? (
          <div className="m-auto font-display italic text-[15px] text-ink2">
            Spinning up Venn…
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            <VennSvg tags={usedTags} buckets={buckets} />
          </div>
        )}
        <div className="mt-2 flex items-center gap-4">
          <Kicker>Easter egg · esc to close</Kicker>
          {overflow > 0 ? (
            <Kicker>
              +{overflow} extra tag{overflow === 1 ? "" : "s"} not shown
            </Kicker>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Region centers chosen so labels sit visually inside the lens / petal.
// All coordinates in the SVG's 1000x720 viewBox. Tweaked by eye, not math.
type Region = { x: number; y: number; width: number };

// Map each circle to a CSS variable. Index 0 is ink (primary); rest are
// accent variations so they match whatever theme accent the user chose.
const CIRCLE_VARS = ["var(--ink)", "var(--accent-color)", "var(--accent-deep)"];

function VennSvg({
  tags,
  buckets,
}: {
  tags: string[];
  buckets: Map<string, Conference[]>;
}) {
  if (tags.length < 2) {
    return (
      <div className="m-auto font-display italic text-[15px] text-brand">
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
    <svg viewBox="0 0 1000 720" className="w-full h-full block">
      <circle
        cx={cx1}
        cy={cy}
        r={r}
        fill={CIRCLE_VARS[0]}
        fillOpacity="0.12"
        stroke={CIRCLE_VARS[0]}
        strokeOpacity="0.85"
        strokeWidth="2"
      />
      <circle
        cx={cx2}
        cy={cy}
        r={r}
        fill={CIRCLE_VARS[1]}
        fillOpacity="0.12"
        stroke={CIRCLE_VARS[1]}
        strokeOpacity="0.85"
        strokeWidth="2"
      />
      <text
        x={cx1 - 200}
        y={cy - r - 14}
        fill={CIRCLE_VARS[0]}
        fontSize="22"
        fontWeight="500"
        className="font-display"
      >
        {tags[0]}
      </text>
      <text
        x={cx2 + 200}
        y={cy - r - 14}
        fill={CIRCLE_VARS[1]}
        fontSize="22"
        fontWeight="500"
        textAnchor="end"
        className="font-display"
      >
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
    <svg viewBox="0 0 1000 720" className="w-full h-full block">
      {[c0, c1, c2].map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={r}
          fill={CIRCLE_VARS[i]}
          fillOpacity="0.12"
          stroke={CIRCLE_VARS[i]}
          strokeOpacity="0.85"
          strokeWidth="2"
        />
      ))}
      <text
        x={c0.x - r + 30}
        y={c0.y - r - 12}
        fill={CIRCLE_VARS[0]}
        fontSize="22"
        fontWeight="500"
        className="font-display"
      >
        {tags[0]}
      </text>
      <text
        x={c1.x + r - 30}
        y={c1.y - r - 12}
        fill={CIRCLE_VARS[1]}
        fontSize="22"
        fontWeight="500"
        textAnchor="end"
        className="font-display"
      >
        {tags[1]}
      </text>
      <text
        x={c2.x}
        y={c2.y + r + 30}
        fill={CIRCLE_VARS[2]}
        fontSize="22"
        fontWeight="500"
        textAnchor="middle"
        className="font-display"
      >
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
            fill="var(--ink)"
            fontWeight="500"
            textAnchor="middle"
            className="font-display"
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
          fill="var(--ink2)"
          textAnchor="middle"
          fontStyle="italic"
          className="font-display"
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
