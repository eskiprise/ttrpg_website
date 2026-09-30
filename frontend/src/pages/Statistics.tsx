import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type {
  ClubStatistics,
  GameSystemListResponse,
  GameSystemWithCount,
  LeaderboardEntry,
  PublicGameMaster,
} from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { formatGameTitle } from "../lib/gameTitle";
import { Band } from "../components/Band";
import { StatTile } from "../components/StatTile";
import { GamesPerMonthChart } from "../components/GamesPerMonthChart";

function Leaderboard({
  title,
  entries,
  emptyLabel,
  suffix,
}: {
  title: string;
  entries: LeaderboardEntry[];
  emptyLabel: string;
  suffix: (count: number) => string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-ink-muted">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {entries.map((entry, i) => (
            <li
              key={entry.telegramUserId}
              className="flex items-baseline gap-3 border-b border-border py-2.5 last:border-b-0 last:pb-0"
            >
              <span className="w-5 font-numeric text-sm font-bold text-accent tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.displayName}</span>
              <span className="flex-shrink-0 text-sm text-ink-muted">{suffix(entry.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface StatFilters {
  from: string;
  to: string;
  gmUserId: string;
  systemId: string;
  minScore: string;
  maxScore: string;
}

const EMPTY_FILTERS: StatFilters = { from: "", to: "", gmUserId: "", systemId: "", minScore: "", maxScore: "" };

export function Statistics() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<StatFilters>(EMPTY_FILTERS);
  const [stats, setStats] = useState<ClubStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gameMasters, setGameMasters] = useState<PublicGameMaster[]>([]);
  const [systems, setSystems] = useState<GameSystemWithCount[]>([]);

  // The GM/system picklists don't depend on the current filters, so they're fetched
  // once — reusing the same public endpoints the "Майстри гри"/"Ігри" pages already use.
  useEffect(() => {
    apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters")
      .then((data) => setGameMasters(data.gameMasters))
      .catch(() => setGameMasters([]));
    apiFetch<GameSystemListResponse>("/game-systems")
      .then((data) => setSystems(data.systems))
      .catch(() => setSystems([]));
  }, []);

  async function load(filters: StatFilters) {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.gmUserId) params.set("gmUserId", filters.gmUserId);
      if (filters.systemId) params.set("systemId", filters.systemId);
      if (filters.minScore) params.set("minScore", filters.minScore);
      if (filters.maxScore) params.set("maxScore", filters.maxScore);
      const query = params.toString();
      const data = await apiFetch<{ statistics: ClubStatistics }>(
        `/statistics${query ? `?${query}` : ""}`
      );
      setStats(data.statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setDraft(EMPTY_FILTERS);
    void load(EMPTY_FILTERS);
  }

  // Bars scale to the tallest bucket, not to totalVotes — otherwise a spread-out
  // distribution renders as ten barely-visible slivers.
  const maxRatingCount = stats ? Math.max(1, ...stats.ratingDistribution.counts) : 1;
  const hasGames = stats != null && stats.totalGames > 0;

  return (
    <div>
      <Band tone="page" width="wide">
        <span className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
          {t("statistics.eyebrow")}
        </span>
        <h1 className="mt-4 text-[clamp(2rem,1.4rem+2.6vw,3.2rem)] leading-[1.06] font-bold tracking-[-0.025em]">
          {t("statistics.title")}
        </h1>
        <p className="mt-4 max-w-[54ch] text-lg text-ink-muted">{t("statistics.intro")}</p>

        <div className="mt-8 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface p-5">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.from")}
            <input
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.to")}
            <input
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.filterGm")}
            <select
              value={draft.gmUserId}
              onChange={(e) => setDraft((d) => ({ ...d, gmUserId: e.target.value }))}
            >
              <option value="">{t("statistics.filterGmAll")}</option>
              {gameMasters.map((gm) => (
                <option key={gm.userId} value={gm.userId}>
                  {gm.firstName} {gm.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.filterSystem")}
            <select
              value={draft.systemId}
              onChange={(e) => setDraft((d) => ({ ...d, systemId: e.target.value }))}
            >
              <option value="">{t("statistics.filterSystemAll")}</option>
              {systems.map((system) => (
                <option key={system.systemId} value={system.systemId}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.filterMinScore")}
            <input
              type="number"
              min={1}
              max={10}
              step={0.1}
              className="w-20"
              value={draft.minScore}
              onChange={(e) => setDraft((d) => ({ ...d, minScore: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.filterMaxScore")}
            <input
              type="number"
              min={1}
              max={10}
              step={0.1}
              className="w-20"
              value={draft.maxScore}
              onChange={(e) => setDraft((d) => ({ ...d, maxScore: e.target.value }))}
            />
          </label>
          <button type="button" disabled={busy} onClick={() => load(draft)}>
            {t("statistics.apply")}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={reset}>
            {t("statistics.reset")}
          </button>
        </div>

        {error && <p className="mt-4 text-accent">{error}</p>}
        {!stats && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      </Band>

      {stats && (
        <Band tone="dark" width="wide">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            <StatTile tone="band" value={stats.totalGames} label={t("home.statSessions")} />
            <StatTile
              tone="band"
              value={stats.averageScore !== null ? stats.averageScore.toFixed(1) : "—"}
              unit={stats.averageScore !== null ? "/10" : undefined}
              label={t("home.statAverage")}
            />
            <StatTile tone="band" value={stats.totalSeats ?? "—"} label={t("home.statSeats")} />
            <StatTile
              tone="band"
              value={stats.totalPlayers ?? "—"}
              label={t("statistics.totalPlayers")}
            />
          </div>

          {/* Optional-chained on purpose: frontend and backend ship independently, so
              during a deploy window this page can be talking to a backend that predates
              gamesPerMonth/totalSeats. Missing fields hide their tile instead of
              throwing on `.length` and taking the whole page down. */}
          {(stats.gamesPerMonth?.length ?? 0) > 1 && (
            <div className="mt-10">
              <GamesPerMonthChart
                data={stats.gamesPerMonth}
                maxMonths={24}
                tone="band"
                title={t("home.growthTitle")}
              />
            </div>
          )}
        </Band>
      )}

      {stats && !hasGames && (
        <Band tone="page" width="wide">
          <p className="text-ink-muted">{t("statistics.noGamesInPeriod")}</p>
        </Band>
      )}

      {hasGames && stats && (
        <Band tone="page" width="wide">
          {stats.ratingDistribution.totalVotes > 0 && (
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-xl font-bold">{t("statistics.ratingDistribution")}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t("statistics.votes", { count: stats.ratingDistribution.totalVotes })}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {stats.ratingDistribution.counts.map((count, i) => {
                  const pct = Math.round((count / maxRatingCount) * 100);
                  // Low scores sit at the clay end of the palette, high scores at
                  // brass — so the shape of the distribution reads before the numbers do.
                  const mix = Math.round((i / (stats.ratingDistribution.counts.length - 1)) * 100);
                  return (
                    <div className="flex items-center gap-3" key={i}>
                      <span className="w-6 text-right font-numeric text-xs font-bold text-ink-muted tabular-nums">
                        {i + 1}
                      </span>
                      <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: `color-mix(in oklab, var(--accent-2) ${mix}%, var(--accent))`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm text-ink-muted tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Leaderboard
              title={t("statistics.topGameMasters")}
              entries={stats.topGameMasters}
              emptyLabel={t("statistics.noData")}
              suffix={(count) => t("statistics.gamesSuffix", { count })}
            />
            <Leaderboard
              title={t("statistics.topPlayers")}
              entries={stats.topPlayers}
              emptyLabel={t("statistics.noData")}
              suffix={(count) => t("statistics.gamesSuffix", { count })}
            />
          </div>

          {/* Only the best game — a "worst rated" card would pin a GM's name to it. */}
          {stats.highestRatedGame && (
            <Link
              to={`/game-log/${stats.highestRatedGame.pollId}`}
              className="mt-6 flex max-w-md flex-col gap-2 rounded-xl border border-border bg-surface p-6 text-ink transition-colors hover:border-accent hover:no-underline"
            >
              <span className="text-xs font-semibold tracking-[0.1em] text-accent uppercase">
                {t("statistics.highestRated")}
              </span>
              <h2 className="text-lg leading-snug font-bold">
                {formatGameTitle(stats.highestRatedGame.questionText)}
              </h2>
              <span className="font-numeric text-2xl font-extrabold tracking-[-0.03em] tabular-nums">
                {stats.highestRatedGame.averageScore.toFixed(1)}
                <span className="text-sm text-ink-muted"> / 10</span>
              </span>
            </Link>
          )}
        </Band>
      )}
    </div>
  );
}
