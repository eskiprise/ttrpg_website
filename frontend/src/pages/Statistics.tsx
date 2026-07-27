import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ClubStatistics } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PieChart } from "../components/PieChart";

export function Statistics() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState<ClubStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(fromValue: string, toValue: string) {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromValue) params.set("from", fromValue);
      if (toValue) params.set("to", toValue);
      const query = params.toString();
      const data = await apiFetch<{ statistics: ClubStatistics }>(
        `/statistics${query ? `?${query}` : ""}`,
        { token: idToken }
      );
      setStats(data.statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  function reset() {
    setFrom("");
    setTo("");
    void load("", "");
  }

  const maxRatingCount = stats ? Math.max(1, ...stats.ratingDistribution.counts) : 1;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("statistics.title")}</h1>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-6">
        <label className="flex flex-col gap-1">
          {t("statistics.from")}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t("statistics.to")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" disabled={busy} onClick={() => load(from, to)}>{t("statistics.apply")}</button>
        <button type="button" className="secondary" disabled={busy} onClick={reset}>{t("statistics.reset")}</button>
      </div>

      {error && <p className="mt-4 text-accent">{error}</p>}
      {!stats && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}

      {stats && (
        <>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface p-6">
              <p className="text-ink-muted">{t("statistics.totalGames")}</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{stats.totalGames}</p>
            </div>
            <div className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface p-6">
              <p className="text-ink-muted">{t("statistics.averageScore")}</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
                {stats.averageScore !== null ? `${stats.averageScore.toFixed(1)} / 10` : "—"}
              </p>
            </div>
          </div>

          {stats.totalGames === 0 ? (
            <p className="mt-6 text-ink-muted">{t("statistics.noGamesInPeriod")}</p>
          ) : (
            <>
              <div className="mt-6 rounded-lg border border-border bg-surface p-6">
                <h2 className="text-xl font-bold">{t("statistics.systemsPlayed")}</h2>
                <div className="mt-4">
                  <PieChart
                    slices={stats.systemStats.map((s) => ({
                      key: s.systemId,
                      label: s.systemName,
                      value: s.gamesPlayed,
                    }))}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-border bg-surface p-6">
                <h2 className="text-xl font-bold">{t("statistics.systemBreakdown")}</h2>
                <div className="mt-3 flex flex-col">
                  {stats.systemStats.map((s) => (
                    <div key={s.systemId} className="flex justify-between border-b border-border py-2 last:border-b-0">
                      <span>{s.systemName}</span>
                      <span className="text-ink-muted">
                        {t("statistics.gamesSuffix", { count: s.gamesPlayed })}
                        {s.averageScore !== null ? ` · ${s.averageScore.toFixed(1)} / 10` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {stats.ratingDistribution.totalVotes > 0 && (
                <div className="mt-6 rounded-lg border border-border bg-surface p-6">
                  <h2 className="text-xl font-bold">{t("statistics.ratingDistribution")}</h2>
                  <p className="mt-1 text-ink-muted">{t("poll.votes", { count: stats.ratingDistribution.totalVotes })}</p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {stats.ratingDistribution.counts.map((count, i) => {
                      const pct = Math.round((count / maxRatingCount) * 100);
                      return (
                        <div className="flex items-center gap-2" key={i}>
                          <span className="w-6 text-right text-ink-muted">{i + 1}</span>
                          <div className="h-[0.9rem] flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full bg-[var(--series-1)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-ink-muted">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-4">
                <div className="min-w-[240px] flex-1 rounded-lg border border-border bg-surface p-6">
                  <h2 className="text-xl font-bold">{t("statistics.topGameMasters")}</h2>
                  <div className="mt-3 flex flex-col gap-1">
                    {stats.topGameMasters.length === 0 && <p className="text-ink-muted">{t("statistics.noData")}</p>}
                    {stats.topGameMasters.map((entry, i) => (
                      <div key={entry.userId} className="flex items-center gap-2">
                        <span className="text-ink-muted">{i + 1}.</span>
                        <span className="flex-1">{entry.displayName}</span>
                        <span className="text-ink-muted">{t("statistics.gamesSuffix", { count: entry.count })}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-w-[240px] flex-1 rounded-lg border border-border bg-surface p-6">
                  <h2 className="text-xl font-bold">{t("statistics.topPlayers")}</h2>
                  <div className="mt-3 flex flex-col gap-1">
                    {stats.topPlayers.length === 0 && <p className="text-ink-muted">{t("statistics.noData")}</p>}
                    {stats.topPlayers.map((entry, i) => (
                      <div key={entry.userId} className="flex items-center gap-2">
                        <span className="text-ink-muted">{i + 1}.</span>
                        <span className="flex-1">{entry.displayName}</span>
                        <span className="text-ink-muted">{t("statistics.gamesSuffix", { count: entry.count })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(stats.highestRatedGame || stats.lowestRatedGame) && (
                <div className="mt-6 flex flex-wrap gap-4">
                  {stats.highestRatedGame && (
                    <Link
                      to={`/game-log/${stats.highestRatedGame.gameId}`}
                      className="min-w-[240px] flex-1 rounded-lg border border-border bg-surface p-6 hover:bg-surface-2"
                    >
                      <h2 className="text-xl font-bold">{t("statistics.highestRated")}</h2>
                      <p className="mt-2">{stats.highestRatedGame.title}</p>
                      <p className="text-ink-muted">{stats.highestRatedGame.averageScore.toFixed(1)} / 10</p>
                    </Link>
                  )}
                  {stats.lowestRatedGame && (
                    <Link
                      to={`/game-log/${stats.lowestRatedGame.gameId}`}
                      className="min-w-[240px] flex-1 rounded-lg border border-border bg-surface p-6 hover:bg-surface-2"
                    >
                      <h2 className="text-xl font-bold">{t("statistics.lowestRated")}</h2>
                      <p className="mt-2">{stats.lowestRatedGame.title}</p>
                      <p className="text-ink-muted">{stats.lowestRatedGame.averageScore.toFixed(1)} / 10</p>
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
