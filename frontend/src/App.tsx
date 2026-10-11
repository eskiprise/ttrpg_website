import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { SiteFooter } from "./components/SiteFooter";
import { RequireAdmin, RequireAuth } from "./components/RequireAuth";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { GameMasters } from "./pages/GameMasters";
import { GameMasterDetail } from "./pages/GameMasterDetail";
import { GameSystems } from "./pages/GameSystems";
import { GameSystemDetail } from "./pages/GameSystemDetail";
import { GameLog } from "./pages/GameLog";
import { GameDetail } from "./pages/GameDetail";
import { Statistics } from "./pages/Statistics";
import { Signup } from "./pages/Signup";
import { NotFound } from "./pages/NotFound";

// Pages a visitor from search never needs are split into their own chunks, so the
// public pages don't download the admin dashboard and the whole Mini App up front.
// The public pages stay in the main bundle: they're the ones prerendered, and their
// static HTML is swapped for the live page only once it has rendered (see main.tsx).
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const AdminDashboard = lazy(() =>
  import("./pages/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
const TelegramRoutes = lazy(() => import("./pages/telegram/TelegramRoutes"));

function App() {
  const location = useLocation();
  // The Telegram Mini App renders inside Telegram's own narrow WebView chrome —
  // the normal site nav doesn't belong there.
  const isTelegramApp = location.pathname.startsWith("/telegram");

  // Column that's at least one viewport tall, with <main> absorbing the slack, so on a
  // short page the footer sits at the bottom of the screen instead of mid-page.
  return (
    <div className="flex min-h-dvh flex-col">
      {!isTelegramApp && <NavBar />}
      <main className="flex-1">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/game-masters" element={<GameMasters />} />
            <Route path="/game-masters/:userId" element={<GameMasterDetail />} />
            <Route path="/game-systems" element={<GameSystems />} />
            <Route path="/game-systems/:systemId" element={<GameSystemDetail />} />
            <Route path="/game-log" element={<GameLog />} />
            <Route path="/game-log/:pollId" element={<GameDetail />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            {/* Public: the club's activity is the pitch to a stranger, and every figure
                here already shows per-session on the Game Log. */}
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/telegram/*" element={<TelegramRoutes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isTelegramApp && <SiteFooter />}
    </div>
  );
}

export default App;
