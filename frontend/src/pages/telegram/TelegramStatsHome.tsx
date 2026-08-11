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
      <h1 className="text-2xl font-bold">{t("telegramApp.title", { name: stats.displayName })}</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("telegramApp.totalRatings")}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{stats.totalRatingsGiven}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("telegramApp.averageRating")}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
            {stats.averageRatingGiven !== null ? `${stats.averageRatingGiven.toFixed(1)} / 10` : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
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
