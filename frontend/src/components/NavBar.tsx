import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 pb-1 text-sm font-medium ${
    isActive
      ? "border-accent text-ink"
      : "border-transparent text-ink-muted hover:text-ink hover:border-accent"
  }`;

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
      {idToken && (
        <NavLink to="/statistics" className={linkClass}>{t("nav.statistics")}</NavLink>
      )}
      {isAdmin && <NavLink to="/admin" className={linkClass}>{t("nav.admin")}</NavLink>}
    </>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-8 px-6">
        <NavLink to="/" className="flex min-w-0 items-center gap-2 font-display text-base font-bold sm:text-xl">
          <span className="relative h-6 w-6 flex-shrink-0 rounded border-[1.5px] border-ink">
            <span className="absolute top-1/2 left-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
          </span>
          <span className="truncate">{t("nav.brand")}</span>
        </NavLink>

        <nav className="hidden flex-1 items-center gap-6 lg:flex">{primaryLinks}</nav>

        <details className="relative ml-auto lg:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            {t("nav.menu", "Menu")}
          </summary>
          <div className="absolute right-0 mt-2 flex w-56 flex-col rounded-lg border border-border bg-surface p-2 shadow-lg">
            {primaryLinks}
            {idToken ? (
              <NavLink to="/profile" className={linkClass}>{t("nav.profile")}</NavLink>
            ) : (
              <NavLink to="/login" className={linkClass}>{t("nav.logIn")}</NavLink>
            )}
          </div>
        </details>

        <div className="hidden flex-shrink-0 items-center gap-4 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          {idToken ? (
            <>
              <NavLink to="/profile" className={linkClass}>{t("nav.profile")}</NavLink>
              <button type="button" className="secondary" onClick={logout}>{t("nav.logOut")}</button>
            </>
          ) : (
            <NavLink to="/login" className={linkClass}>{t("nav.logIn")}</NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
