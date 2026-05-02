import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { ComingSoonPage } from "./components/ComingSoonPage";
import { ThemeProvider } from "./lib/theme";
import "mapbox-gl/dist/mapbox-gl.css";
import "./styles/app.css";

// Pre-launch marketing gate. While true, every route serves the
// ComingSoonPage. Flip to false + push to main when the real app
// should come online — the deploy workflow on main rebuilds and
// publishes automatically.
const COMING_SOON_ONLY = false;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
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
    </ThemeProvider>
  </StrictMode>,
);
