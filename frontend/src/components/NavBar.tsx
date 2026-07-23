import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import "./NavBar.css";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link active" : "nav-link";

export function NavBar() {
  const { idToken, isAdmin, isDm, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        <NavLink to="/" className="nav-brand">
          {t("nav.brand")}
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={linkClass}>{t("nav.home")}</NavLink>
          <NavLink to="/about" className={linkClass}>{t("nav.about")}</NavLink>
          <NavLink to="/game-masters" className={linkClass}>{t("nav.gameMasters")}</NavLink>
          <NavLink to="/game-systems" className={linkClass}>{t("nav.games")}</NavLink>
          <NavLink to="/game-log" className={linkClass}>{t("nav.gameLog")}</NavLink>
          {idToken && (
            <NavLink to="/stats" className={linkClass}>{t("nav.myStats")}</NavLink>
          )}
          {(isAdmin || isDm) && (
            <NavLink to="/games/log" className={linkClass}>{t("nav.logAGame")}</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>{t("nav.admin")}</NavLink>
          )}
        </div>
        <div className="nav-auth">
          <LanguageSwitcher />
          {idToken ? (
            <>
              <NavLink to="/profile" className={linkClass}>{t("nav.profile")}</NavLink>
              <button className="secondary" onClick={logout}>{t("nav.logOut")}</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>{t("nav.logIn")}</NavLink>
              <NavLink to="/signup">
                <button>{t("nav.joinTheClub")}</button>
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
