import { CalendarIcon, CrosshairIcon, GearIcon, SignalIcon } from "./icons";

interface Props {
  pingCount: number;
  myCount: number;
  coMode: boolean;
  showPast: boolean;
  showFuture: boolean;
  onTogglePingInbox: () => void;
  onToggleSettings: () => void;
  onToggleMyConferences: () => void;
  onToggleCoMode: () => void;
  onTogglePast: () => void;
  onToggleFuture: () => void;
}

export function Toolbar({
  pingCount,
  myCount,
  coMode,
  showPast,
  showFuture,
  onTogglePingInbox,
  onToggleSettings,
  onToggleMyConferences,
  onToggleCoMode,
  onTogglePast,
  onToggleFuture,
}: Props) {
  return (
    <div className="toolbar glass" role="toolbar" aria-label="App controls">
      <div className="toolbar-row">
        <button
          className="toolbar-btn icon-only"
          onClick={onTogglePingInbox}
          aria-label={`Signals (${pingCount} new)`}
          style={{ position: "relative" }}
        >
          <SignalIcon />
          {pingCount > 0 && (
            <span
              className="toolbar-badge"
              style={{ position: "absolute", top: -6, right: -6 }}
            >
              {pingCount > 99 ? "99+" : pingCount}
            </span>
          )}
        </button>
        <button
          className="toolbar-btn icon-only"
          onClick={onToggleSettings}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </div>

      <button className="toolbar-btn" onClick={onToggleMyConferences}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <CalendarIcon />
          My conferences
        </span>
        {myCount > 0 && <span className="toolbar-badge">{myCount}</span>}
      </button>

      <button
        className="toolbar-btn"
        onClick={onToggleCoMode}
        aria-pressed={coMode}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <CrosshairIcon />
          Co-attendance
        </span>
        <span
          style={{
            fontSize: "0.64rem",
            color: coMode ? "var(--signal)" : "var(--text-muted)",
          }}
        >
          {coMode ? "ON" : "OFF"}
        </span>
      </button>

      <div className="toolbar-divider" />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <button
          className="filter-checkbox"
          onClick={onTogglePast}
          aria-pressed={showPast}
        >
          <span className="glyph" aria-hidden="true">
            {showPast ? "☑" : "☐"}
          </span>
          Past
        </button>
        <button
          className="filter-checkbox"
          onClick={onToggleFuture}
          aria-pressed={showFuture}
        >
          <span className="glyph" aria-hidden="true">
            {showFuture ? "☑" : "☐"}
          </span>
          Future
        </button>
      </div>
    </div>
  );
}
