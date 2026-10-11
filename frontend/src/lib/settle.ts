import { pendingRequests } from "./api";

/** How long the API has to stay quiet before the page counts as settled. */
const QUIET_MS = 150;
const POLL_MS = 50;

let appMounted = false;

/** Fired on window once main.tsx has swapped a prerendered page for the live app. */
export const PRERENDER_SWAPPED_EVENT = "app:prerender-swapped";

/** True while the prerendered copy of the page is still the one on screen. */
export function prerenderedPageShowing(): boolean {
  return document.querySelector("[data-prerendered]") !== null;
}

/** Called once the app's first render has committed (App's mount effect). */
export function markAppMounted() {
  appMounted = true;
}

/**
 * Resolves once the app has rendered and no API request has been in flight for a short
 * while — i.e. the current page has the data it fetches on mount (including requests
 * that start only after an earlier one returns, like Home waiting for the stored login).
 * Gives up after `maxMs` rather than wait forever on a hung request. Timers, not
 * requestAnimationFrame: rAF doesn't fire in a background tab.
 */
export function whenPageSettled(maxMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    let quietSince: number | null = null;
    const check = () => {
      const now = Date.now();
      if (appMounted && pendingRequests() === 0) quietSince ??= now;
      else quietSince = null;
      if ((quietSince !== null && now - quietSince >= QUIET_MS) || now - started >= maxMs) resolve();
      else window.setTimeout(check, POLL_MS);
    };
    check();
  });
}
