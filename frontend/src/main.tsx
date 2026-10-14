import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./i18n";
import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { PRERENDER_SWAPPED_EVENT, whenPageSettled } from "./lib/settle";

declare global {
  interface Window {
    /** Set once the first page has its data — what scripts/prerender.mjs waits for. */
    __APP_SETTLED__?: boolean;
  }
}

const app = (
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

const root = document.getElementById("root")!;

if (root.hasAttribute("data-prerendered")) {
  // The page arrived as prerendered HTML (scripts/prerender.mjs) and is already on screen,
  // complete. Rendering the app straight into it would blank it to its loading state
  // first, so the live app renders off-screen instead and takes its place only once its
  // own data has arrived — the swap shows the same page, just with fresh data.
  const live = document.createElement("div");
  live.setAttribute("aria-hidden", "true");
  live.style.cssText = "position:fixed;inset:0;overflow:hidden;visibility:hidden;pointer-events:none";
  root.after(live);
  createRoot(live).render(app);
  void whenPageSettled().then(() => {
    // A FAQ answer or the mobile menu opened while the app loaded stays open.
    const before = root.querySelectorAll("details");
    const after = live.querySelectorAll("details");
    if (before.length === after.length) before.forEach((d, i) => (after[i].open = d.open));
    root.remove();
    live.removeAttribute("aria-hidden");
    live.removeAttribute("style");
    live.id = "root";
    window.__APP_SETTLED__ = true;
    window.dispatchEvent(new Event(PRERENDER_SWAPPED_EVENT));
  });
} else {
  createRoot(root).render(app);
  void whenPageSettled().then(() => {
    window.__APP_SETTLED__ = true;
  });
}
