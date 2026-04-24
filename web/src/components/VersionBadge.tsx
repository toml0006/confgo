// Lower-right build identifier. Values are baked in at build time by Vite's
// `define` from vite.config.ts — version from web/package.json, build number
// from `git rev-list --count HEAD` (or BUILD_NUMBER / GITHUB_RUN_NUMBER env
// override for shallow CI clones), short SHA (+ "-dirty" when the working
// tree has uncommitted changes).
export function VersionBadge() {
  const title = [
    `version ${__APP_VERSION__}`,
    `build #${__BUILD_NUMBER__}`,
    `sha ${__BUILD_SHA__}`,
    `built ${__BUILD_TIME__}`,
  ].join("\n");

  return (
    <div className="version-badge" title={title} aria-hidden="true">
      v{__APP_VERSION__} · #{__BUILD_NUMBER__}
      <style>{`
        .version-badge {
          position: fixed;
          right: 10px;
          bottom: 8px;
          font-size: 0.58rem;
          letter-spacing: 0.12em;
          color: var(--text-muted, rgba(232, 240, 255, 0.4));
          opacity: 0.55;
          pointer-events: auto;
          user-select: none;
          padding: 2px 6px;
          z-index: 10;
          transition: opacity 180ms ease;
          font-variant-numeric: tabular-nums;
        }
        .version-badge:hover { opacity: 0.95; }
      `}</style>
    </div>
  );
}
