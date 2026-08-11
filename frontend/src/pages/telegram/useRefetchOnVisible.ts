import { useEffect } from "react";

/**
 * Telegram frequently keeps a Mini App's WebView alive in the background when the user
 * closes it, then just brings that same instance back to the foreground on reopen —
 * so a plain "fetch once on mount" effect can go stale indefinitely across chat
 * activity that happened while the app was closed (e.g. retracting or changing a poll
 * vote). Runs `callback` every time the page becomes visible again — does NOT call it
 * on mount, so pair this with your own mount-time fetch.
 *
 * Use this (rather than `useRefetchOnVisible` below) whenever "what to fetch on mount"
 * and "what to fetch on reopen" differ — e.g. a screen with an adjustable date range
 * should reopen showing the range the user last applied, not silently reset to the
 * default range every time they background and foreground the app.
 */
export function useRunOnVisible(callback: () => void, deps: React.DependencyList): void {
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") callback();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Convenience wrapper for the common case: `load` doesn't depend on any not-yet-applied
 * UI state, so running the exact same call on mount and on every return-to-foreground is
 * correct. `deps` works like a normal effect dependency array (e.g. [pollId]).
 */
export function useRefetchOnVisible(load: () => void, deps: React.DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, deps);
  useRunOnVisible(load, deps);
}
