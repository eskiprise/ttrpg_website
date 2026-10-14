import { Route, Routes } from "react-router-dom";
import { TelegramMiniAppRoot } from "./TelegramMiniAppRoot";
import { TelegramStatsHome } from "./TelegramStatsHome";
import { TelegramCreatePoll } from "./TelegramCreatePoll";
import { TelegramGamesList } from "./TelegramGamesList";
import { TelegramGameDetail } from "./TelegramGameDetail";
import { TelegramFeedbackForm } from "./TelegramFeedbackForm";
import { TelegramMyFeedback } from "./TelegramMyFeedback";
import { TelegramLeaderboard } from "./TelegramLeaderboard";
import { TelegramAchievements } from "./TelegramAchievements";

/**
 * Everything under /telegram, as one lazily loaded chunk (see App.tsx) — the Mini App is
 * only ever opened from the bot, so site visitors never download it. Paths are relative
 * to /telegram.
 */
export default function TelegramRoutes() {
  return (
    <Routes>
      <Route element={<TelegramMiniAppRoot />}>
        <Route index element={<TelegramStatsHome />} />
        <Route path="create-poll" element={<TelegramCreatePoll />} />
        <Route path="feedback/:pollId" element={<TelegramFeedbackForm />} />
        <Route path="feedback/mine" element={<TelegramMyFeedback />} />
        <Route path="games/played" element={<TelegramGamesList kind="played" />} />
        <Route path="games/conducted" element={<TelegramGamesList kind="conducted" />} />
        <Route path="games/all" element={<TelegramGamesList kind="all" />} />
        <Route path="game/:pollId" element={<TelegramGameDetail />} />
        <Route path="leaderboard" element={<TelegramLeaderboard />} />
        <Route path="achievements" element={<TelegramAchievements />} />
      </Route>
    </Routes>
  );
}
