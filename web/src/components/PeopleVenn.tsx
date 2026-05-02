import { useEffect, useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import {
  apiFetch,
  type AttendanceIntent,
  type Conference,
  type PublicUser,
} from "../api";
import type { ContactEntry } from "../lib/contacts";
import { UserAvatar } from "./UserAvatar";
import { PingComposer } from "./PingComposer";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/kicker";

// Personal Venn — circles are people (1–3), regions are the conferences each
// exact subset of those people attended. Mirrors the tag-based VennEgg shape
// but indexed by user instead of tag. Used from a profile button to visualize
// "who I overlap with at conferences".

type AttendanceRow = { conferenceId: string; intent: AttendanceIntent };

type Props = {
  // The people whose attendance forms the circles. 1–3 entries; first entry
  // is rendered in the leftmost circle, etc. Order matters for layout.
  people: PublicUser[];
  // Conferences universe — used to resolve names from IDs in attendance rows.
  // Caller passes the same list it already has (e.g. from App state).
  conferences: Conference[];
  // Pre-resolved attendance map, keyed by userId. Each value is the list of
  // conference IDs that person has marked. If omitted, the component fetches.
  attendancesByUser?: Map<string, string[]>;
};

// Match PersonToken's hue formula so circle colors line up with the avatars
// shown in the legend below.
function colorFor(person: PublicUser): string {
  const id = person.avatarId ?? 0;
  return `hsl(${(id * 47) % 360} 60% 48%)`;
}

// Pure render — given resolved data, draw the Venn. Useful to embed inline
// (e.g. inside another panel) without the fullscreen overlay chrome.
export function PeopleVenn({ people, conferences, attendancesByUser }: Props) {
  const [resolved, setResolved] = useState<Map<string, string[]> | null>(
    attendancesByUser ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // Cap to 3 people (Venn-3 limit). Extras can be surfaced by callers in legend.
  const used = useMemo(() => people.slice(0, 3), [people]);

  useEffect(() => {
    if (attendancesByUser) {
      setResolved(attendancesByUser);
      return;
    }
    let cancelled = false;
    // allSettled — if a peer's profile is hidden / deleted (the endpoint
    // 404s) we still want to render the Venn for everyone else rather
    // than block the whole overlay on one missing user.
    Promise.allSettled(
      used.map((p) =>
        apiFetch<{ attendances: AttendanceRow[] }>(
          `/users/${p.id}/attendances`,
        ).then((r) => [p.id, r.attendances.map((a) => a.conferenceId)] as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      const entries: Array<readonly [string, string[]]> = [];
      for (const r of results) {
        if (r.status === "fulfilled") entries.push(r.value);
        else console.warn("[venn] attendances failed:", r.reason);
      }
      setResolved(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [used, attendancesByUser]);

  // Bucket conferences by exact subset of `used` people that attended them.
  // Key = sorted bitmask of indices, e.g. "0,2" = first and third user only.
  const buckets = useMemo(() => {
    const out = new Map<string, Conference[]>();
    if (!resolved) return out;
    const sets = used.map((p) => new Set(resolved.get(p.id) ?? []));
    for (const c of conferences) {
      const has = sets
        .map((s, i) => (s.has(c.id) ? i : -1))
        .filter((i) => i >= 0);
      if (has.length === 0) continue;
      const key = has.join(",");
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(c);
    }
    // Sort each bucket newest-first so labels are stable and readable.
    for (const list of out.values()) {
      list.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
    return out;
  }, [resolved, used, conferences]);

  if (error) {
    return (
      <div className="m-auto font-display italic text-[15px] text-brand">
        Failed to load: {error}
      </div>
    );
  }
  if (!resolved) {
    return (
      <div className="m-auto font-display italic text-[15px] text-ink2">
        Spinning up Venn…
      </div>
    );
  }
  if (used.length === 0) {
    return (
      <div className="m-auto font-display italic text-[15px] text-brand">
        No people to compare.
      </div>
    );
  }
  if (used.length === 1) {
    return <Venn1 people={used} buckets={buckets} />;
  }
  if (used.length === 2) {
    return <Venn2 people={used} buckets={buckets} />;
  }
  return <Venn3 people={used} buckets={buckets} />;
}

// Fullscreen overlay wrapper — handles dismissal, loading state, and styling.
// Reusable from any trigger; just pass the people you want to compare.
export function PeopleVennOverlay({
  people,
  conferences,
  attendancesByUser,
  onClose,
  title,
  meId,
  canPing = true,
}: Props & {
  onClose: () => void;
  title?: string;
  // Person id of the viewer — peers other than this id get a Ping button.
  // Omit to hide ping affordances entirely (e.g. anon viewers).
  meId?: string | null;
  // Override to suppress Ping buttons even when meId is set (e.g. anon).
  canPing?: boolean;
}) {
  const [composerFor, setComposerFor] = useState<PublicUser | null>(null);
  const [pinged, setPinged] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const used = people.slice(0, 3);
  const counts = useMemo(() => {
    return used.map((p) => attendancesByUser?.get(p.id)?.length ?? null);
  }, [used, attendancesByUser]);

  async function handlePingSubmit(contacts: ContactEntry[]) {
    if (!composerFor) return;
    await apiFetch(`/users/${composerFor.id}/ping`, {
      method: "POST",
      body: JSON.stringify({ contacts }),
    });
    setPinged((s) => new Set([...s, composerFor.id]));
    setComposerFor(null);
  }

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
          {title ? <Kicker>{title}</Kicker> : <span />}
          <Button variant="atlas-ghost" size="atlas-sm" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        <div className="flex-1 min-h-0 flex">
          <PeopleVenn
            people={people}
            conferences={conferences}
            attendancesByUser={attendancesByUser}
          />
        </div>
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          {used.map((p, i) => {
            const isMe = meId != null && p.id === meId;
            const showPing = canPing && !isMe && meId != null;
            const alreadyPinged = pinged.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: colorFor(p) }}
                  aria-hidden="true"
                />
                <UserAvatar
                  avatarId={p.avatarId}
                  photoURL={p.photoURL}
                  displayName={p.displayName}
                  size="sm"
                />
                <span className="font-display text-[14px] text-ink">
                  {p.displayName ?? "Unnamed"}
                </span>
                {counts[i] !== null ? (
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink3">
                    {counts[i]}
                  </span>
                ) : null}
                {showPing ? (
                  <Button
                    type="button"
                    variant="atlas"
                    size="atlas-sm"
                    disabled={alreadyPinged}
                    onClick={() => setComposerFor(p)}
                  >
                    {alreadyPinged ? "Pinged" : "Ping"}
                  </Button>
                ) : null}
              </div>
            );
          })}
          <Kicker className="ml-auto">esc to close</Kicker>
        </div>
      </div>

      <PingComposer
        open={composerFor !== null}
        title={
          composerFor ? `Ping ${composerFor.displayName ?? "Unnamed"}` : ""
        }
        peerDisplayName={composerFor?.displayName ?? "them"}
        onSubmit={handlePingSubmit}
        onCancel={() => setComposerFor(null)}
      />
    </div>
  );
}

type Region = { x: number; y: number; width: number };

function Venn1({
  people,
  buckets,
}: {
  people: PublicUser[];
  buckets: Map<string, Conference[]>;
}) {
  const r = 280;
  const cx = 500;
  const cy = 360;
  const region: Region = { x: cx, y: cy, width: 320 };
  const color = colorFor(people[0]);
  return (
    <svg viewBox="0 0 1000 720" className="w-full h-full block">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        fillOpacity="0.12"
        stroke={color}
        strokeOpacity="0.85"
        strokeWidth="2"
      />
      <PersonLabel person={people[0]} color={color} x={cx} y={cy - r - 18} anchor="middle" />
      {buckets.has("0") ? (
        <RegionLabels confs={buckets.get("0")!} region={region} />
      ) : null}
    </svg>
  );
}

function Venn2({
  people,
  buckets,
}: {
  people: PublicUser[];
  buckets: Map<string, Conference[]>;
}) {
  const r = 270;
  const cx1 = 370;
  const cx2 = 630;
  const cy = 360;
  const regions: Record<string, Region> = {
    "0": { x: cx1 - 130, y: cy, width: 200 },
    "1": { x: cx2 + 130, y: cy, width: 200 },
    "0,1": { x: (cx1 + cx2) / 2, y: cy, width: 160 },
  };
  const c0 = colorFor(people[0]);
  const c1 = colorFor(people[1]);
  return (
    <svg viewBox="0 0 1000 720" className="w-full h-full block">
      <circle
        cx={cx1}
        cy={cy}
        r={r}
        fill={c0}
        fillOpacity="0.12"
        stroke={c0}
        strokeOpacity="0.85"
        strokeWidth="2"
      />
      <circle
        cx={cx2}
        cy={cy}
        r={r}
        fill={c1}
        fillOpacity="0.12"
        stroke={c1}
        strokeOpacity="0.85"
        strokeWidth="2"
      />
      <PersonLabel person={people[0]} color={c0} x={cx1 - 200} y={cy - r - 18} anchor="start" />
      <PersonLabel person={people[1]} color={c1} x={cx2 + 200} y={cy - r - 18} anchor="end" />
      {(["0", "1", "0,1"] as const).map((key) =>
        buckets.has(key) ? (
          <RegionLabels key={key} confs={buckets.get(key)!} region={regions[key]} />
        ) : null,
      )}
    </svg>
  );
}

function Venn3({
  people,
  buckets,
}: {
  people: PublicUser[];
  buckets: Map<string, Conference[]>;
}) {
  const r = 200;
  const cx = 500;
  const cy = 360;
  const dy = 110;
  const dx = 115;
  const c0 = { x: cx - dx, y: cy - dy };
  const c1 = { x: cx + dx, y: cy - dy };
  const c2 = { x: cx, y: cy + dy };
  const regions: Record<string, Region> = {
    "0": { x: c0.x - 110, y: c0.y - 30, width: 200 },
    "1": { x: c1.x + 110, y: c1.y - 30, width: 200 },
    "2": { x: c2.x, y: c2.y + 90, width: 200 },
    "0,1": { x: (c0.x + c1.x) / 2, y: c0.y + 30, width: 160 },
    "0,2": { x: (c0.x + c2.x) / 2 - 30, y: (c0.y + c2.y) / 2 + 50, width: 140 },
    "1,2": { x: (c1.x + c2.x) / 2 + 30, y: (c1.y + c2.y) / 2 + 50, width: 140 },
    "0,1,2": { x: cx, y: cy + 30, width: 130 },
  };
  const colors = people.map(colorFor);
  return (
    <svg viewBox="0 0 1000 720" className="w-full h-full block">
      {[c0, c1, c2].map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={r}
          fill={colors[i]}
          fillOpacity="0.12"
          stroke={colors[i]}
          strokeOpacity="0.85"
          strokeWidth="2"
        />
      ))}
      <PersonLabel person={people[0]} color={colors[0]} x={c0.x - r + 30} y={c0.y - r - 16} anchor="start" />
      <PersonLabel person={people[1]} color={colors[1]} x={c1.x + r - 30} y={c1.y - r - 16} anchor="end" />
      <PersonLabel person={people[2]} color={colors[2]} x={c2.x} y={c2.y + r + 32} anchor="middle" />
      {Object.keys(regions).map((key) =>
        buckets.has(key) ? (
          <RegionLabels key={key} confs={buckets.get(key)!} region={regions[key]} />
        ) : null,
      )}
    </svg>
  );
}

function PersonLabel({
  person,
  color,
  x,
  y,
  anchor,
}: {
  person: PublicUser;
  color: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}) {
  const name = person.displayName ?? "Unnamed";
  // Avatar rendered as a foreignObject so we can reuse <UserAvatar>.
  // Place avatar above text for "middle" anchor (top labels), inline for sides.
  const avatarSize = 32;
  const offset = anchor === "middle" ? 0 : anchor === "start" ? avatarSize / 2 : -avatarSize / 2;
  return (
    <g>
      <foreignObject
        x={x + offset - avatarSize / 2}
        y={y - avatarSize - 4}
        width={avatarSize}
        height={avatarSize}
      >
        <UserAvatar
          avatarId={person.avatarId}
          photoURL={person.photoURL}
          displayName={person.displayName}
          size="sm"
        />
      </foreignObject>
      <text
        x={x}
        y={y + 18}
        fill={color}
        fontSize="20"
        fontWeight="500"
        textAnchor={anchor}
        className="font-display"
      >
        {name}
      </text>
    </g>
  );
}

function RegionLabels({
  confs,
  region,
}: {
  confs: Conference[];
  region: Region;
}) {
  const MAX = 8;
  const shown = confs.slice(0, MAX);
  const more = confs.length - shown.length;
  const lineHeight = 14;
  const totalHeight = (shown.length + (more > 0 ? 1 : 0)) * lineHeight;
  const top = region.y - totalHeight / 2;
  return (
    <g transform={`translate(${region.x}, ${top})`}>
      {shown.map((c, i) => {
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
