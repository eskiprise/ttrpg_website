import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { CLUB_TELEGRAM_URL } from "../lib/club";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 pb-1 text-sm font-medium whitespace-nowrap ${
    isActive
      ? "border-accent text-ink"
      : "border-transparent text-ink-muted hover:text-ink hover:border-accent"
  }`;

/**
 * Profile, Admin and Log out behind one button. Spread across the bar they didn't fit
 * next to the full wordmark and the join CTA, and squeezed the page links onto two lines.
 */
function AccountMenu({ isAdmin, logout }: { isAdmin: boolean; logout: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const ref = useRef<HTMLDetailsElement>(null);

  // A <details> stays open on its own, so close it after navigating and on an outside click.
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const menu = ref.current;
      if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold whitespace-nowrap [&::-webkit-details-marker]:hidden">
        {t("nav.account")}
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-44 flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
        <NavLink to="/profile" className={linkClass}>{t("nav.profile")}</NavLink>
        {isAdmin && <NavLink to="/admin" className={linkClass}>{t("nav.admin")}</NavLink>}
        <button type="button" className="secondary mt-1 text-sm" onClick={logout}>{t("nav.logOut")}</button>
      </div>
    </details>
  );
}

export function NavBar() {
  const { idToken, isAdmin, logout } = useAuth();
  const { t } = useTranslation();

  const primaryLinks = (
    <>
      <NavLink to="/" end className={linkClass}>{t("nav.home")}</NavLink>
      <NavLink to="/about" className={linkClass}>{t("nav.about")}</NavLink>
      <NavLink to="/game-masters" className={linkClass}>{t("nav.gameMasters")}</NavLink>
      <NavLink to="/game-systems" className={linkClass}>{t("nav.games")}</NavLink>
      <NavLink to="/game-log" className={linkClass}>{t("nav.gameLog")}</NavLink>
      <NavLink to="/statistics" className={linkClass}>{t("nav.statistics")}</NavLink>
    </>
  );

  return (
    // will-change-transform forces this sticky header onto its own compositing layer —
    // works around an iOS Safari bug where the toolbar's collapse/expand animation
    // otherwise leaves a stale rendered frame briefly showing above the header.
    <header className="sticky top-0 z-10 border-b border-border bg-surface will-change-transform">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-4 px-6 lg:gap-6">
        <NavLink to="/" className="flex flex-shrink-0 items-center gap-2 font-display text-base font-bold text-ink hover:no-underline">
          {/* data-brand-mark: where PageLoader's die lands, and is hidden until it does. */}
          <span
            data-brand-mark
            className="relative h-6 w-6 flex-shrink-0 rounded border-[1.5px] border-ink transition-opacity duration-150"
          >
            <span className="absolute top-1/2 left-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
          </span>
          {/* The full wordmark only fits once the nav links, controls and join CTA
              have room — below 2xl it would push the bar past its container. */}
          <span className="hidden 2xl:inline">{t("nav.brand")}</span>
          <span className="2xl:hidden">{t("nav.brandShort")}</span>
        </NavLink>

        <nav className="hidden flex-1 items-center gap-6 lg:flex">{primaryLinks}</nav>

        {/* The join CTA stays visible at every width — it's the page's whole purpose,
            so it must never be buried inside the mobile dropdown. */}
        <a
          href={CLUB_TELEGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex-shrink-0 hover:no-underline lg:order-last lg:ml-0"
        >
          <button type="button" className="text-sm whitespace-nowrap">
            {t("nav.joinCta")}
          </button>
        </a>

        <details className="relative flex-shrink-0 lg:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-border px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            {t("nav.menu", "Menu")}
          </summary>
          <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-border bg-surface p-3 shadow-lg">
            {primaryLinks}
            {isAdmin && <NavLink to="/admin" className={linkClass}>{t("nav.admin")}</NavLink>}
            {idToken ? (
              <NavLink to="/profile" className={linkClass}>{t("nav.profile")}</NavLink>
            ) : (
              <NavLink to="/login" className={linkClass}>{t("nav.logIn")}</NavLink>
            )}
            {/* Below lg, this dropdown is the only nav surface — without this row,
                the theme control (desktop-only further down) would be completely
                unreachable on mobile and tablet. */}
            <div className="mt-2 flex items-center gap-3 border-t border-border pt-3">
              <ThemeToggle />
            </div>
          </div>
        </details>

        {/* The language switcher is deliberately not rendered: the club's audience is
            Ukrainian, so the site shows Ukrainian only for now. Everything behind it —
            LanguageSwitcher.tsx, en.json, the i18n setup — is untouched, so bringing the
            button back is a one-line change. */}
        <div className="hidden flex-shrink-0 items-center gap-4 lg:flex">
          <ThemeToggle />
          {idToken ? (
            <AccountMenu isAdmin={isAdmin} logout={logout} />
          ) : (
            <NavLink to="/login" className={linkClass}>{t("nav.logIn")}</NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
