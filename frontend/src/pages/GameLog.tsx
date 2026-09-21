import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameLogMonthlyCount, TelegramGameSummary } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { GamesPerMonthChart } from "../components/GamesPerMonthChart";
import { PageShell } from "../components/PageShell";
import { GameRowList } from "../components/GameRow";

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
type SortBy = "date" | "gm" | "system" | "score";

export function GameLog() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [games, setGames] = useState<TelegramGameSummary[]>([]);
  const [gamesPerMonth, setGamesPerMonth] = useState<GameLogMonthlyCount[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [minScoreInput, setMinScoreInput] = useState("");
  const [maxScoreInput, setMaxScoreInput] = useState("");
  const [scoreFilter, setScoreFilter] = useState<{ min: string; max: string }>({ min: "", max: "" });

  const load = useCallback(
    (offset: number, pageSize: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        sortBy,
        sortDir,
      });
      if (scoreFilter.min) params.set("minScore", scoreFilter.min);
      if (scoreFilter.max) params.set("maxScore", scoreFilter.max);
      apiFetch<{ games: TelegramGameSummary[]; hasMore: boolean; gamesPerMonth: GameLogMonthlyCount[] }>(
        `/game-log?${params}`,
        { token: idToken }
      )
        .then((data) => {
          setGames((prev) => (replace ? data.games : [...prev, ...data.games]));
          setHasMore(data.hasMore);
          setGamesPerMonth(data.gamesPerMonth);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")))
        .finally(() => setLoading(false));
    },
    [idToken, t, sortBy, sortDir, scoreFilter]
  );

  // Page size / sort / score-filter changes all reset to a fresh first page rather
  // than mixing pages fetched under different query params.
  useEffect(() => {
    load(0, limit, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, idToken, sortBy, sortDir, scoreFilter]);

  function applyScoreFilter() {
    setScoreFilter({ min: minScoreInput.trim(), max: maxScoreInput.trim() });
  }
  function resetScoreFilter() {
    setMinScoreInput("");
    setMaxScoreInput("");
    setScoreFilter({ min: "", max: "" });
  }

  return (
    <PageShell width="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("gameLog.title")}</h1>
          <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">{t("gameLog.intro")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          {t("gameLog.pageSizeLabel")}
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface p-5">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("gameLog.sortByLabel")}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="date">{t("gameLog.sortDate")}</option>
            <option value="gm">{t("gameLog.sortGm")}</option>
            <option value="system">{t("gameLog.sortSystem")}</option>
            <option value="score">{t("gameLog.sortScore")}</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? t("gameLog.sortAsc") : t("gameLog.sortDesc")}
        </button>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("gameLog.minScore")}
          <input
            type="number"
            min={1}
            max={10}
            step={0.1}
            value={minScoreInput}
            onChange={(e) => setMinScoreInput(e.target.value)}
            className="w-20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("gameLog.maxScore")}
          <input
            type="number"
            min={1}
            max={10}
            step={0.1}
            value={maxScoreInput}
            onChange={(e) => setMaxScoreInput(e.target.value)}
            className="w-20"
          />
        </label>
        <button type="button" onClick={applyScoreFilter}>
          {t("statistics.apply")}
        </button>
        <button type="button" className="secondary" onClick={resetScoreFilter}>
          {t("statistics.reset")}
        </button>
      </div>

      {error && <p className="mt-6 text-accent">{error}</p>}

      {gamesPerMonth.length > 0 && (
        <div className="mt-8">
          <GamesPerMonthChart data={gamesPerMonth} />
        </div>
      )}

      {!loading && games.length === 0 && !error && (
        <p className="mt-6 text-ink-muted">{t("gameLog.none")}</p>
      )}

      {games.length > 0 && (
        <div className="mt-8">
          <GameRowList games={games} />
        </div>
      )}

      {loading && <p className="mt-6 text-ink-muted">{t("common.loading")}</p>}

      {hasMore && !loading && (
        <button type="button" className="secondary mt-6" onClick={() => load(games.length, limit, false)}>
          {t("gameLog.loadMore")}
        </button>
      )}
    </PageShell>
  );
}
