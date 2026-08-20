import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramGameSummary } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

export function GameLog() {
  const { t, i18n } = useTranslation();
  const { idToken } = useAuth();
  const [games, setGames] = useState<TelegramGameSummary[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (offset: number, pageSize: number, replace: boolean) => {
      setLoading(true);
      apiFetch<{ games: TelegramGameSummary[]; hasMore: boolean }>(
        `/game-log?limit=${pageSize}&offset=${offset}`,
        { token: idToken }
      )
        .then((data) => {
          setGames((prev) => (replace ? data.games : [...prev, ...data.games]));
          setHasMore(data.hasMore);
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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t("gameLog.title")}</h1>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          {t("gameLog.pageSizeLabel")}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded border border-border bg-surface px-2 py-1"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-4 text-accent">{error}</p>}
      {!loading && games.length === 0 && !error && <p className="mt-4 text-ink-muted">{t("gameLog.none")}</p>}

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        {games.map((game) => (
          <Link
            key={game.pollId}
            to={`/game-log/${game.pollId}`}
            className="block border-b border-border px-6 py-4 last:border-b-0 hover:bg-surface-2"
          >
            <h2 className="text-lg font-bold">{game.questionText}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {new Date(game.createdAt).toLocaleDateString(i18n.language)} · {t("gameLog.dm")} {game.gmDisplayName}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {t("gameLog.playerCount", { count: game.playerCount })}
              {game.averageScore !== null && ` · ${t("gameLog.average")} ${game.averageScore.toFixed(1)} / 10`}
            </p>
          </Link>
        ))}
      </div>

      {loading && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}

      {hasMore && !loading && (
        <button type="button" className="mt-6" onClick={() => load(games.length, limit, false)}>
          {t("gameLog.loadMore")}
        </button>
      )}
    </div>
  );
}
