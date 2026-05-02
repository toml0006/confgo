import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { ComingSoonPage } from "./components/ComingSoonPage";
import "./styles/tokens.css";
import "./styles/animations.css";

// Pre-launch marketing gate. While true, every route serves the
// ComingSoonPage. Flip to false + push to main when the real app
// should come online — the deploy workflow on main rebuilds and
// publishes automatically.
const COMING_SOON_ONLY = true;

// Live-refresh: poll /version.json every 3.5s and hard-reload when the
// deployed build number exceeds the one baked into this bundle. Lives
// at the root (not inside ComingSoonPage) so it stays active in either
// gating direction — visitors auto-flip both gated→live and live→gated
// the moment a new deploy lands. Trade: every deploy reloads anyone
// with the tab open. Fine during the demo; consider downgrading to a
// banner-style notice once routine deploys resume post-conference.
const POLL_INTERVAL_MS = 3500;

function VersionPoller() {
  useEffect(() => {
    const baselineBuild =
      typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : 0;
    if (!baselineBuild) return; // dev / unbuilt — don't loop on stale-vs-stale

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { build?: number };
        if (
          !cancelled &&
          typeof body.build === "number" &&
          body.build > baselineBuild
        ) {
          window.location.reload();
        }
      } catch {
        // network blip — try again next tick
      }
    };

    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VersionPoller />
    <BrowserRouter>
      {COMING_SOON_ONLY ? (
        <ComingSoonPage />
      ) : (
        <Routes>
          {/* Public marketing route — no auth, no map. */}
          <Route path="/coming-soon" element={<ComingSoonPage />} />
          {/* Everything else is the authenticated app. */}
          <Route
            path="*"
            element={
              <AuthProvider>
                <App />
              </AuthProvider>
            }
          />
        </Routes>
      )}
    </BrowserRouter>
  </StrictMode>,
);
