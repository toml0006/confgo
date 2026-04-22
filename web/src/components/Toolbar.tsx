type Props = {
  myCount: number;
  showPast: boolean;
  showFuture: boolean;
  onTogglePast: (next: boolean) => void;
  onToggleFuture: (next: boolean) => void;
  onOpenSettings: () => void;
  onOpenMyConferences: () => void;
};

export function Toolbar({
  myCount,
  showPast,
  showFuture,
  onTogglePast,
  onToggleFuture,
  onOpenSettings,
  onOpenMyConferences,
}: Props) {
  return (
    <div className="toolbar glass-panel">
      <div className="toolbar-row">
        {/* TODO: Signals (ping) icon slot — wired when pings are built. */}
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
      <div className="filter-row" role="group" aria-label="Time range filter">
        <button
          type="button"
          className={`chip-toggle chip-toggle--past ${showPast ? "is-on" : ""}`}
          aria-pressed={showPast}
          onClick={() => onTogglePast(!showPast)}
        >
          Past
        </button>
        <button
          type="button"
          className={`chip-toggle chip-toggle--future ${showFuture ? "is-on" : ""}`}
          aria-pressed={showFuture}
          onClick={() => onToggleFuture(!showFuture)}
        >
          Future
        </button>
      </div>
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
        .toolbar-divider {
          height: 1px;
          background: var(--mist);
          margin: 4px 0;
        }
        .filter-row {
          display: flex;
          gap: 8px;
          justify-content: stretch;
        }
        .chip-toggle {
          flex: 1;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 0.5rem 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--mist);
          color: var(--text-muted);
          background: transparent;
          cursor: pointer;
          transition: border-color 180ms ease, background 180ms ease, color 180ms ease;
        }
        .chip-toggle:hover {
          border-color: var(--mist-strong);
          color: var(--text);
        }
        .chip-toggle:focus-visible {
          outline: 2px solid var(--signal-dim);
          outline-offset: 2px;
        }
        .chip-toggle--past.is-on {
          border-color: rgba(232, 121, 177, 0.65);
          border-color: color(display-p3 0.91 0.475 0.694 / 0.65);
          background: rgba(232, 121, 177, 0.14);
          background: color(display-p3 0.91 0.475 0.694 / 0.14);
          color: var(--past-ember);
        }
        .chip-toggle--future.is-on {
          border-color: rgba(255, 181, 71, 0.65);
          border-color: color(display-p3 1 0.71 0.278 / 0.65);
          background: rgba(255, 181, 71, 0.14);
          background: color(display-p3 1 0.71 0.278 / 0.14);
          color: var(--ember);
        }
      `}</style>
    </div>
  );
}
