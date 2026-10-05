import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramUserStats } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";
import { useRefetchOnVisible } from "./useRefetchOnVisible";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; stats: TelegramUserStats };

export function TelegramStatsHome() {
  const { t } = useTranslation();
  const { initData } = useTelegramApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const hasLoadedOnce = useRef(false);

  useRefetchOnVisible(() => {
    // Only show the loading state on the very first fetch — a background refetch on
    // reopen shouldn't flash the whole screen back to a spinner while it runs.
    if (!hasLoadedOnce.current) setState({ status: "loading" });
    apiFetch<{ stats: TelegramUserStats }>("/telegram/stats", { method: "POST", body: { initData } })
      .then((data) => {
        hasLoadedOnce.current = true;
        setState({ status: "ready", stats: data.stats });
      })
      .catch((err) =>
        setState({ status: "error", message: err instanceof Error ? err.message : t("common.somethingWrong") })
      );
  }, []);

  if (state.status === "loading") return <p className="text-ink-muted">{t("common.loading")}</p>;
  if (state.status === "error") return <p className="text-accent">{state.message}</p>;

  const { stats } = state;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/telegram/achievements"
        className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-2"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{stats.levelEmoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {t("telegramApp.levelLabel", { level: stats.level })} · {stats.levelTitle}
            </p>
            {stats.xpForNextLevel !== null ? (
              <>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.min(100, (stats.currentXp / stats.xpForNextLevel) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {stats.currentXp} / {stats.xpForNextLevel} XP
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">{t("telegramApp.maxLevel")}</p>
            )}
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("telegramApp.totalRatings")}</p>
          <p className="mt-auto pt-1 font-numeric text-2xl font-extrabold tracking-[-0.04em] tabular-nums">
            {stats.totalRatingsGiven}
          </p>
        </div>
        <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("telegramApp.averageRating")}</p>
          {/* The "/ 10" is set small, as on the site's Statistics tiles — Unbounded is wide
              enough that the whole thing at full size wouldn't fit a half-width card. */}
          <p className="mt-auto pt-1 font-numeric text-2xl font-extrabold tracking-[-0.04em] tabular-nums">
            {stats.averageRatingGiven !== null ? stats.averageRatingGiven.toFixed(1) : "—"}
            {stats.averageRatingGiven !== null && (
              <span className="text-[0.42em] tracking-normal text-ink-muted"> / 10</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          to="/telegram/create-poll"
          className="rounded-lg border border-accent bg-surface p-4 font-semibold text-accent hover:bg-surface-2"
        >
          📊 {t("telegramApp.createPoll")} →
        </Link>
        <Link
          to="/telegram/games/played"
          className="rounded-lg border border-border bg-surface p-4 font-semibold hover:bg-surface-2"
        >
          {t("telegramApp.myGamesPlayed")} →
        </Link>
        <Link
          to="/telegram/games/conducted"
          className="rounded-lg border border-border bg-surface p-4 font-semibold hover:bg-surface-2"
        >
          {t("telegramApp.myGamesConducted")} →
        </Link>
        {stats.gamesConducted > 0 && (
          <Link
            to="/telegram/feedback/mine"
            className="rounded-lg border border-border bg-surface p-4 font-semibold hover:bg-surface-2"
          >
            {t("telegramApp.myFeedback")} →
          </Link>
        )}
        <Link
          to="/telegram/games/all"
          className="rounded-lg border border-border bg-surface p-4 font-semibold hover:bg-surface-2"
        >
          {t("telegramApp.allGames")} →
        </Link>
        <Link
          to="/telegram/leaderboard"
          className="rounded-lg border border-border bg-surface p-4 font-semibold hover:bg-surface-2"
        >
          🏆 {t("telegramApp.leaderboard")} →
        </Link>
      </div>

      {stats.totalRatingsGiven === 0 && <p className="text-ink-muted">{t("telegramApp.noRatingsYet")}</p>}
    </div>
  );
}
