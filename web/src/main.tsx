import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";
import { ComingSoonPage } from "./components/ComingSoonPage";
import "./styles/tokens.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </StrictMode>,
);
