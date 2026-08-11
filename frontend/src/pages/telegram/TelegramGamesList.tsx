import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramGameSummary } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";
import { useRunOnVisible } from "./useRefetchOnVisible";

const ENDPOINTS = {
  played: "/telegram/games/played",
  conducted: "/telegram/games/conducted",
  all: "/telegram/games/all",
} as const;

const TITLE_KEYS = {
  played: "telegramApp.myGamesPlayed",
  conducted: "telegramApp.myGamesConducted",
  all: "telegramApp.allGames",
} as const;

export function TelegramGamesList({ kind }: { kind: keyof typeof ENDPOINTS }) {
  const { t, i18n } = useTranslation();
  const { initData } = useTelegramApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [games, setGames] = useState<TelegramGameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Tracks the last range actually applied (as opposed to whatever's currently typed
  // into the date inputs but not yet submitted), so reopening the app can silently
  // refresh the same view instead of resetting the user's filter.
  const appliedRange = useRef({ from: "", to: "" });

  async function load(fromValue: string, toValue: string) {
    appliedRange.current = { from: fromValue, to: toValue };
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ games: TelegramGameSummary[] }>(ENDPOINTS[kind], {
        method: "POST",
        body: { initData, from: fromValue || undefined, to: toValue || undefined },
      });
      setGames(data.games);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setFrom("");
    setTo("");
    setGames(null);
    void load("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useRunOnVisible(() => {
    void load(appliedRange.current.from, appliedRange.current.to);
  }, [kind]);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/telegram" className="text-sm text-ink-muted hover:text-accent">
        ← {t("telegramApp.back")}
      </Link>
      <h1 className="text-xl font-bold">{t(TITLE_KEYS[kind])}</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("statistics.from")}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("statistics.to")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" disabled={busy} onClick={() => load(from, to)}>{t("statistics.apply")}</button>
      </div>

      {error && <p className="text-accent">{error}</p>}
      {!games && !error && <p className="text-ink-muted">{t("common.loading")}</p>}
      {games?.length === 0 && <p className="text-ink-muted">{t("telegramApp.noGamesInRange")}</p>}

      <div className="flex flex-col gap-2">
        {games?.map((game) => (
          <Link
            key={game.pollId}
            to={`/telegram/game/${game.pollId}`}
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-2"
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="text-ink">{game.questionText}</strong>
              <span className="font-mono text-sm tabular-nums text-ink-muted">
                {new Date(game.createdAt).toLocaleDateString(i18n.language)}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{t("telegramApp.gmLabel")} {game.gmDisplayName}</p>
            <div className="mt-2 flex gap-4 text-sm">
              <span>
                {t("telegramApp.myVote")}{" "}
                <strong className="font-mono tabular-nums text-ink">{game.myRating ?? "—"}</strong>
              </span>
              <span>
                {t("telegramApp.average")}{" "}
                <strong className="font-mono tabular-nums text-ink">
                  {game.averageScore !== null ? game.averageScore.toFixed(1) : "—"}
                </strong>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
