import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameLogMonthlyCount, TelegramGameSummary } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { GamesPerMonthChart } from "../components/GamesPerMonthChart";
import { PageShell } from "../components/PageShell";
import { GameRowList } from "../components/GameRow";

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

export function GameLog() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [games, setGames] = useState<TelegramGameSummary[]>([]);
  const [gamesPerMonth, setGamesPerMonth] = useState<GameLogMonthlyCount[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (offset: number, pageSize: number, replace: boolean) => {
      setLoading(true);
      apiFetch<{ games: TelegramGameSummary[]; hasMore: boolean; gamesPerMonth: GameLogMonthlyCount[] }>(
        `/game-log?limit=${pageSize}&offset=${offset}`,
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
    [idToken, t]
  );

  // Page size change resets to a fresh first page rather than mixing batch sizes.
  useEffect(() => {
    load(0, limit, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, idToken]);

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
