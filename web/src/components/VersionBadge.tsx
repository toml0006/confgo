// Subtle build identifier in the lower-right. Low-contrast, click-through,
// non-interactive. Values are baked at build time by vite's `define`.
export function VersionBadge() {
  const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  const build = typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : 0;
  return (
    <div className="version-badge" aria-hidden="true">
      v{version} ({build})
      <style>{`
        .version-badge {
          position: fixed;
          right: 8px;
          bottom: 6px;
          z-index: 30;
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.28);
          color: color(display-p3 1 1 1 / 0.28);
          pointer-events: none;
          user-select: none;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </div>
  );
}
