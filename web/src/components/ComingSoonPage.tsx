// Public marketing page at /coming-soon. Auth not required. Reuses the
// site's design tokens (--void, --signal, --ember, .glass-panel) so it
// feels like the rest of confgo, with one bright callout card pointing
// curious visitors at the upcoming MinneBar talk.

const MINNEBAR_URL = "https://sessions.minnestar.org/sessions/1903";

export function ComingSoonPage() {
  return (
    <div className="coming-soon">
      <main className="coming-soon-inner">
        <div className="coming-soon-brand">Venn•bar</div>

        <h1 className="coming-soon-title">Coming soon</h1>
        <p className="coming-soon-tag">
          A map of the conferences worth showing up to —
          <br />
          and the people you'll see there.
        </p>

        <a
          className="minnebar-callout"
          href={MINNEBAR_URL}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="/minnebar.svg"
            alt="MinneBar"
            className="minnebar-logo"
          />
          <div className="minnebar-body">
            <div className="minnebar-eyebrow">Want to learn more?</div>
            <div className="minnebar-headline">
              Catch the talk at MinneBar 20
            </div>
            <div className="minnebar-meta">sessions.minnestar.org →</div>
          </div>
        </a>

        <div className="coming-soon-foot">
          We'll be live shortly.
        </div>
      </main>

      <style>{`
        .coming-soon {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          background:
            radial-gradient(
              ellipse at 50% 0%,
              color(display-p3 0.369 0.906 0.851 / 0.06) 0%,
              transparent 55%
            ),
            radial-gradient(
              ellipse at 50% 100%,
              color(display-p3 1 0.71 0.278 / 0.05) 0%,
              transparent 55%
            ),
            var(--void);
        }
        .coming-soon-inner {
          width: 100%;
          max-width: 520px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.4rem;
        }
        .coming-soon-brand {
          font-size: clamp(1.8rem, 5.5vw, 2.8rem);
          font-weight: 300;
          letter-spacing: 0.1em;
          color: var(--signal);
          margin-bottom: 0.6rem;
        }
        .coming-soon-title {
          font-size: clamp(2.4rem, 7vw, 3.6rem);
          font-weight: 200;
          letter-spacing: 0.05em;
          margin: 0;
          color: var(--text);
        }
        .coming-soon-tag {
          font-size: 0.85rem;
          line-height: 1.7;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 0 0 0.4rem;
          max-width: 28em;
        }

        .minnebar-callout {
          display: flex;
          align-items: center;
          gap: 1.1rem;
          width: 100%;
          padding: 1.1rem 1.25rem;
          border-radius: 16px;
          background: rgba(248, 250, 255, 0.94);
          background: color(display-p3 0.972 0.98 1 / 0.94);
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: #1a1d33;
          color: color(display-p3 0.102 0.114 0.2);
          text-decoration: none;
          letter-spacing: 0.04em;
          box-shadow:
            0 6px 20px -8px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(94, 231, 217, 0.06) inset;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .minnebar-callout:hover {
          transform: translateY(-1px);
          box-shadow:
            0 10px 28px -10px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(94, 231, 217, 0.18) inset;
        }
        .minnebar-logo {
          width: 96px;
          height: auto;
          flex-shrink: 0;
        }
        .minnebar-body {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          text-align: left;
          min-width: 0;
        }
        .minnebar-eyebrow {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: #5f66af; /* matches the purple in the MinneBar mark */
        }
        .minnebar-headline {
          font-size: 0.95rem;
          font-weight: 400;
          letter-spacing: 0.03em;
        }
        .minnebar-meta {
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          color: #5f66af;
          margin-top: 0.2rem;
        }

        .coming-soon-foot {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.32em;
          color: var(--text-muted);
          margin-top: 0.4rem;
        }

        @media (max-width: 420px) {
          .minnebar-callout {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }
          .minnebar-body {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
