import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/** Slightly longer than the fade, so the overlay is only unmounted once it's invisible. */
const UNMOUNT_AFTER_MS = 350;

/**
 * Full-screen splash shown while a page gathers its data. The page itself renders
 * underneath, so when `visible` flips to false the overlay fades out onto a finished
 * layout instead of one that's still filling in.
 */
export function PageLoader({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    // A timer rather than onTransitionEnd: under prefers-reduced-motion the global
    // `transition: none` means that event would never fire.
    const id = window.setTimeout(() => setMounted(false), UNMOUNT_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  // Nothing behind the overlay should scroll while it's up.
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* The same mark as the navbar logo, larger. */}
      <span className="relative h-12 w-12 animate-pulse rounded-lg border-2 border-ink">
        <span className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
      </span>
      <div className="text-center">
        <p className="font-display text-xl font-bold">{t("nav.brand")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("common.loading")}</p>
      </div>
    </div>,
    document.body
  );
}
