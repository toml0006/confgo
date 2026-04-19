import { useMemo } from "react";
import { formatDateRange } from "../lib/dates";
import type { Conference } from "../lib/types";
import { CloseIcon } from "./icons";

interface Props {
  conferences: Conference[];
  myAttendances: Map<string, "been" | "going">;
  onPickConference: (c: Conference) => void;
  onClose: () => void;
}

export function MyConferencesPanel({
  conferences,
  myAttendances,
  onPickConference,
  onClose,
}: Props) {
  const { going, been } = useMemo(() => {
    const now = Date.now();
    const mine = conferences.filter((c) => myAttendances.has(c.id));
    const going = mine
      .filter((c) => Date.parse(c.endDate) >= now)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const been = mine
      .filter((c) => Date.parse(c.endDate) < now)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    return { going, been };
  }, [conferences, myAttendances]);

  return (
    <section className="sheet right glass" role="region" aria-label="My conferences">
      <header className="sheet-header">
        <div>
          <h2 className="sheet-title">My conferences</h2>
          <p className="sheet-subtitle">
            {going.length} upcoming · {been.length} attended
          </p>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

      <div className="sheet-body">
        <Section title="Going" accent="var(--signal)">
          {going.length === 0 && (
            <p className="sheet-subtitle">Nothing upcoming. Mark a conference to see it here.</p>
          )}
          {going.map((c) => (
            <button key={c.id} className="list-item" onClick={() => onPickConference(c)}>
              <div className="meta">
                <span className="title">{c.name}</span>
                <span className="sub">
                  {c.locationName} · {formatDateRange(c.startDate, c.endDate)}
                </span>
              </div>
            </button>
          ))}
        </Section>

        <div className="sheet-divider" />

        <Section title="Been" accent="var(--past-ember)">
          {been.length === 0 && (
            <p className="sheet-subtitle">Nothing in the rearview yet.</p>
          )}
          {been.map((c) => (
            <button
              key={c.id}
              className="list-item past"
              onClick={() => onPickConference(c)}
            >
              <div className="meta">
                <span className="title">{c.name}</span>
                <span className="sub">
                  {c.locationName} · {formatDateRange(c.startDate, c.endDate)}
                </span>
              </div>
            </button>
          ))}
        </Section>
      </div>
    </section>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.64rem",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: accent,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
