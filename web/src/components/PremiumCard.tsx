import type { Conference } from "../api";

type Props = {
  conference: Conference;
};

export function PremiumCard({ conference }: Props) {
  const header = conference.premiumHeader || conference.name;
  const subtitle = conference.premiumSubtitle || defaultSubtitle(conference);
  const body = conference.premiumBody;
  const image = conference.premiumImage;

  return (
    <div className="premium-card">
      {image ? (
        <div
          className="premium-card-image"
          style={{ backgroundImage: `url(${image})` }}
        >
          <span className="premium-chip premium-card-image-chip">Premium</span>
        </div>
      ) : null}
      <div className="premium-card-body">
        {!image ? <span className="premium-chip">Premium</span> : null}
        <h2 className="premium-card-header">{header}</h2>
        <div className="muted premium-card-subtitle">{subtitle}</div>
        {body ? <p className="premium-card-text">{body}</p> : null}
      </div>
      <style>{`
        .premium-card {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--aurora-dim);
          background: linear-gradient(180deg, var(--aurora-wash) 0%, transparent 70%);
          box-shadow: 0 6px 28px -16px var(--aurora-dim);
        }
        .premium-card-image {
          position: relative;
          height: 140px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          background-color: var(--aurora-wash);
        }
        .premium-card-image-chip {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(3, 4, 10, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .premium-card-body {
          padding: 14px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .premium-card-body > .premium-chip {
          align-self: flex-start;
          margin-bottom: 0.2rem;
        }
        .premium-card-header {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 400;
          line-height: 1.18;
          color: var(--text);
        }
        .premium-card-subtitle {
          font-size: 0.78rem;
          letter-spacing: 0.04em;
        }
        .premium-card-text {
          margin: 0.5rem 0 0;
          font-family: "Newsreader", Georgia, serif;
          font-size: 0.95rem;
          line-height: 1.5;
          color: var(--text);
          letter-spacing: 0.01em;
        }
      `}</style>
    </div>
  );
}

function defaultSubtitle(c: Conference) {
  const start = new Date(c.startDate).toLocaleDateString();
  const end =
    c.endDate && c.endDate !== c.startDate
      ? ` – ${new Date(c.endDate).toLocaleDateString()}`
      : "";
  return `${c.locationName} · ${start}${end}`;
}
