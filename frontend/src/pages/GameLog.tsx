import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  GameLogMonthlyCount,
  GameSystemListResponse,
  GameSystemWithCount,
  PublicGameMaster,
  TelegramGameSummary,
} from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { GamesPerMonthChart } from "../components/GamesPerMonthChart";
import { PageShell } from "../components/PageShell";
import { GameRowList } from "../components/GameRow";
import { EMPTY_GAME_FILTERS, GameFilterBar, type GameFilterValues } from "../components/GameFilterBar";
import { useSeo } from "../hooks/useSeo";

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
type SortBy = "date" | "gm" | "system" | "score";

export function GameLog() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  useSeo({ title: t("seo.gameLog.title"), description: t("gameLog.intro"), path: "/game-log" });
  const [games, setGames] = useState<TelegramGameSummary[]>([]);
  const [gamesPerMonth, setGamesPerMonth] = useState<GameLogMonthlyCount[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [draft, setDraft] = useState<GameFilterValues>(EMPTY_GAME_FILTERS);
  const [filters, setFilters] = useState<GameFilterValues>(EMPTY_GAME_FILTERS);
  const [gameMasters, setGameMasters] = useState<PublicGameMaster[]>([]);
  const [systems, setSystems] = useState<GameSystemWithCount[]>([]);

  useEffect(() => {
    apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters")
      .then((data) => setGameMasters(data.gameMasters))
      .catch(() => setGameMasters([]));
    apiFetch<GameSystemListResponse>("/game-systems")
      .then((data) => setSystems(data.systems))
      .catch(() => setSystems([]));
  }, []);

  const load = useCallback(
    (offset: number, pageSize: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        sortBy,
        sortDir,
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.gmUserId) params.set("gmUserId", filters.gmUserId);
      if (filters.systemId) params.set("systemId", filters.systemId);
      if (filters.minScore) params.set("minScore", filters.minScore);
      if (filters.maxScore) params.set("maxScore", filters.maxScore);
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
    [idToken, t, sortBy, sortDir, filters]
  );

  // Page size / sort / filter changes all reset to a fresh first page rather than
  // mixing pages fetched under different query params.
  useEffect(() => {
    load(0, limit, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, idToken, sortBy, sortDir, filters]);

  function applyFilters() {
    setFilters(draft);
  }
  function resetFilters() {
    setDraft(EMPTY_GAME_FILTERS);
    setFilters(EMPTY_GAME_FILTERS);
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
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
      </div>

      <div className="mt-4">
        <GameFilterBar
          value={draft}
          onChange={setDraft}
          onApply={applyFilters}
          onReset={resetFilters}
          busy={loading}
          gameMasters={gameMasters}
          systems={systems}
          showSearch
        />
      </div>

      {error && <p className="mt-6 text-accent">{error}</p>}

      {gamesPerMonth.length > 0 && (
        <div className="mt-8">
          <GamesPerMonthChart data={gamesPerMonth} />
        </div>
      )}

      {!loading && games.length === 0 && !error && (
        <p className="mt-6 text-ink-muted">
          {Object.values(filters).some(Boolean) ? t("gameLog.noMatches") : t("gameLog.none")}
        </p>
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
