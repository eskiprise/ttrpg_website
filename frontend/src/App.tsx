import { Route, Routes, useLocation } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { SiteFooter } from "./components/SiteFooter";
import { RequireAdmin, RequireAuth } from "./components/RequireAuth";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { GameMasters } from "./pages/GameMasters";
import { GameMasterDetail } from "./pages/GameMasterDetail";
import { GameSystems } from "./pages/GameSystems";
import { GameLog } from "./pages/GameLog";
import { GameDetail } from "./pages/GameDetail";
import { Statistics } from "./pages/Statistics";
import { Signup } from "./pages/Signup";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { TelegramMiniAppRoot } from "./pages/telegram/TelegramMiniAppRoot";
import { TelegramStatsHome } from "./pages/telegram/TelegramStatsHome";
import { TelegramGamesList } from "./pages/telegram/TelegramGamesList";
import { TelegramGameDetail } from "./pages/telegram/TelegramGameDetail";
import { TelegramFeedbackForm } from "./pages/telegram/TelegramFeedbackForm";
import { TelegramLeaderboard } from "./pages/telegram/TelegramLeaderboard";
import { TelegramAchievements } from "./pages/telegram/TelegramAchievements";

function App() {
  const location = useLocation();
  // The Telegram Mini App renders inside Telegram's own narrow WebView chrome —
  // the normal site nav doesn't belong there.
  const isTelegramApp = location.pathname.startsWith("/telegram");

  return (
    <>
      {!isTelegramApp && <NavBar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/game-masters" element={<GameMasters />} />
        <Route path="/game-masters/:userId" element={<GameMasterDetail />} />
        <Route path="/game-systems" element={<GameSystems />} />
        <Route path="/game-log" element={<GameLog />} />
        <Route path="/game-log/:pollId" element={<GameDetail />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        {/* Public: the club's activity is the pitch to a stranger, and every figure
            here already shows per-session on the Game Log. */}
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/telegram" element={<TelegramMiniAppRoot />}>
          <Route index element={<TelegramStatsHome />} />
          <Route path="feedback/:pollId" element={<TelegramFeedbackForm />} />
          <Route path="games/played" element={<TelegramGamesList kind="played" />} />
          <Route path="games/conducted" element={<TelegramGamesList kind="conducted" />} />
          <Route path="games/all" element={<TelegramGamesList kind="all" />} />
          <Route path="game/:pollId" element={<TelegramGameDetail />} />
          <Route path="leaderboard" element={<TelegramLeaderboard />} />
          <Route path="achievements" element={<TelegramAchievements />} />
        </Route>
      </Routes>
      {!isTelegramApp && <SiteFooter />}
    </>
  );
}

export default App;
