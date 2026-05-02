import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { ComingSoonPage } from "./components/ComingSoonPage";
import { TopicsDemo } from "./components/TopicsDemo";
import "./styles/app.css";
import { ThemeProvider } from "./lib/theme";
import "mapbox-gl/dist/mapbox-gl.css";

// Pre-launch marketing gate. While true, every route serves the
// ComingSoonPage. Flip to false + push to main when the real app
// should come online — the deploy workflow on main rebuilds and
// publishes automatically.
const COMING_SOON_ONLY = false;
console.log('COMING_SOON_ONLY', COMING_SOON_ONLY);

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
    // Skip in dev — /version.json is the same buildNumber as the bundle by
    // definition (no prebuild bump), and HMR already handles refresh on
    // change. Polling here just causes spurious reloads when an HMR cycle
    // races with the fetch.
    if (import.meta.env.DEV) return;
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
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Always-on demo route — works regardless of the coming-soon gate
              so it can be projected on a side screen during the talk.
              Wrapped in AuthProvider so anonymous sign-in fires and the
              live like-voting can attribute votes to a UID. */}
          <Route
            path="/demo/topics"
            element={
              <AuthProvider>
                <TopicsDemo />
              </AuthProvider>
            }
          />
          {COMING_SOON_ONLY ? (
            <Route path="*" element={<ComingSoonPage />} />
          ) : (
            <>
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
            </>
          )}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
