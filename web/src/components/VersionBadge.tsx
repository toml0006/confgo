// Subtle build identifier in the lower-right. Low-contrast, click-through,
// non-interactive. Values are baked at build time by vite's `define`.
export function VersionBadge() {
  const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  const build = typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : 0;
  return (
    <div
      aria-hidden="true"
      className="fixed right-2 bottom-1.5 z-30 text-[10px] tabular-nums tracking-[0.04em] text-white/30 pointer-events-none select-none [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
    >
      v{version} ({build})
    </div>
  );
}
