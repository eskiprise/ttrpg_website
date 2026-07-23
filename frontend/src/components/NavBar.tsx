import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./NavBar.css";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link active" : "nav-link";

export function NavBar() {
  const { idToken, isAdmin, isDm, logout } = useAuth();

  return (
    <nav className="nav-bar">
      <div className="nav-inner">
        <NavLink to="/" className="nav-brand">
          The Club
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/about" className={linkClass}>About Us</NavLink>
          <NavLink to="/game-masters" className={linkClass}>Game Masters</NavLink>
          <NavLink to="/game-systems" className={linkClass}>Games</NavLink>
          <NavLink to="/game-log" className={linkClass}>Game Log</NavLink>
          {idToken && (
            <NavLink to="/stats" className={linkClass}>My Stats</NavLink>
          )}
          {(isAdmin || isDm) && (
            <NavLink to="/games/log" className={linkClass}>Log a Game</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>Admin</NavLink>
          )}
        </div>
        <div className="nav-auth">
          {idToken ? (
            <>
              <NavLink to="/profile" className={linkClass}>Profile</NavLink>
              <button className="secondary" onClick={logout}>Log Out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>Log In</NavLink>
              <NavLink to="/signup">
                <button>Join the Club</button>
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
