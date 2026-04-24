type Props = {
  myCount: number;
  signalsCount: number;
  showPast: boolean;
  showFuture: boolean;
  onTogglePast: (next: boolean) => void;
  onToggleFuture: (next: boolean) => void;
  onOpenSettings: () => void;
  onOpenMyConferences: () => void;
  onOpenSignals: () => void;
};

export function Toolbar({
  myCount,
  signalsCount,
  showPast,
  showFuture,
  onTogglePast,
  onToggleFuture,
  onOpenSettings,
  onOpenMyConferences,
  onOpenSignals,
}: Props) {
  return (
    <div className="toolbar glass-panel">
      <div className="toolbar-row">
        <button
          className="soft-button soft-button--quiet signals-button"
          onClick={onOpenSignals}
          aria-label={signalsCount > 0 ? `Signals (${signalsCount} unread)` : "Signals"}
        >
          <span aria-hidden="true">◈</span>
          {signalsCount > 0 ? (
            <span className="count-badge signals-badge">{signalsCount}</span>
          ) : null}
        </button>
        <button
          className="soft-button soft-button--quiet"
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
      <button
        className="soft-button"
        onClick={onOpenMyConferences}
        aria-label="My conferences"
      >
        <span>My conferences</span>
        {myCount > 0 ? <span className="count-badge">{myCount}</span> : null}
      </button>
      {/* TODO: Co-attendance toggle slot — added when feature ships. */}
      <div className="toolbar-divider" />
      <label className="filter-row">
        <input
          type="checkbox"
          checked={showFuture}
          onChange={(e) => onToggleFuture(e.target.checked)}
        />
        <span>{showFuture ? "☑" : "☐"} Future</span>
      </label>
      <label className="filter-row">
        <input
          type="checkbox"
          checked={showPast}
          onChange={(e) => onTogglePast(e.target.checked)}
        />
        <span>{showPast ? "☑" : "☐"} Past</span>
      </label>
      <style>{`
        .toolbar {
          position: fixed;
          top: 18px;
          right: 18px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: stretch;
          min-width: 220px;
          z-index: 20;
        }
        .toolbar-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .toolbar .soft-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }
        .count-badge {
          background: var(--signal-dim);
          color: var(--signal);
          font-size: 0.65rem;
          padding: 0.12rem 0.55rem;
          border-radius: 999px;
          letter-spacing: 0.08em;
        }
        .signals-button {
          position: relative;
        }
        .signals-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          padding: 0.05rem 0.4rem;
          font-size: 0.6rem;
        }
        .toolbar-divider {
          height: 1px;
          background: var(--mist);
          margin: 4px 0;
        }
        .filter-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--text-muted);
          justify-content: center;
          cursor: pointer;
        }
        .filter-row input {
          display: none;
        }
      `}</style>
    </div>
  );
}
