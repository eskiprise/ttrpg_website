import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ClubStatistics } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PieChart } from "../components/PieChart";
import "./Statistics.css";

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
    <div className="page">
      <h1>{t("statistics.title")}</h1>

      <div className="card stats-filters">
        <label>
          {t("statistics.from")}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          {t("statistics.to")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button disabled={busy} onClick={() => load(from, to)}>{t("statistics.apply")}</button>
        <button className="secondary" disabled={busy} onClick={reset}>{t("statistics.reset")}</button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!stats && !error && <p className="muted">{t("common.loading")}</p>}

      {stats && (
        <>
          <div className="stats-tiles">
            <div className="card stats-tile">
              <p className="muted" style={{ margin: 0 }}>{t("statistics.totalGames")}</p>
              <p className="stats-tile-value">{stats.totalGames}</p>
            </div>
            <div className="card stats-tile">
              <p className="muted" style={{ margin: 0 }}>{t("statistics.averageScore")}</p>
              <p className="stats-tile-value">
                {stats.averageScore !== null ? `${stats.averageScore.toFixed(1)} / 10` : "—"}
              </p>
            </div>
          </div>

          {stats.totalGames === 0 ? (
            <p className="muted">{t("statistics.noGamesInPeriod")}</p>
          ) : (
            <>
              <div className="card">
                <h2>{t("statistics.systemsPlayed")}</h2>
                <PieChart
                  slices={stats.systemStats.map((s) => ({
                    key: s.systemId,
                    label: s.systemName,
                    value: s.gamesPlayed,
                  }))}
                />
              </div>

              <div className="card">
                <h2>{t("statistics.systemBreakdown")}</h2>
                {stats.systemStats.map((s) => (
                  <div key={s.systemId} className="stats-system-row">
                    <span>{s.systemName}</span>
                    <span className="muted">
                      {t("statistics.gamesSuffix", { count: s.gamesPlayed })}
                      {s.averageScore !== null ? ` · ${s.averageScore.toFixed(1)} / 10` : ""}
                    </span>
                  </div>
                ))}
              </div>

              {stats.ratingDistribution.totalVotes > 0 && (
                <div className="card">
                  <h2>{t("statistics.ratingDistribution")}</h2>
                  <p className="muted">{t("poll.votes", { count: stats.ratingDistribution.totalVotes })}</p>
                  {stats.ratingDistribution.counts.map((count, i) => {
                    const pct = Math.round((count / maxRatingCount) * 100);
                    return (
                      <div className="stats-bar-row" key={i}>
                        <span className="stats-bar-label">{i + 1}</span>
                        <div className="stats-bar-track">
                          <div className="stats-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="stats-bar-count muted">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="stats-columns">
                <div className="card">
                  <h2>{t("statistics.topGameMasters")}</h2>
                  {stats.topGameMasters.length === 0 && <p className="muted">{t("statistics.noData")}</p>}
                  {stats.topGameMasters.map((entry, i) => (
                    <div key={entry.userId} className="stats-leaderboard-row">
                      <span className="muted">{i + 1}.</span>
                      <span style={{ flex: 1 }}>{entry.displayName}</span>
                      <span className="muted">{t("statistics.gamesSuffix", { count: entry.count })}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h2>{t("statistics.topPlayers")}</h2>
                  {stats.topPlayers.length === 0 && <p className="muted">{t("statistics.noData")}</p>}
                  {stats.topPlayers.map((entry, i) => (
                    <div key={entry.userId} className="stats-leaderboard-row">
                      <span className="muted">{i + 1}.</span>
                      <span style={{ flex: 1 }}>{entry.displayName}</span>
                      <span className="muted">{t("statistics.gamesSuffix", { count: entry.count })}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(stats.highestRatedGame || stats.lowestRatedGame) && (
                <div className="stats-columns">
                  {stats.highestRatedGame && (
                    <Link to={`/game-log/${stats.highestRatedGame.gameId}`} className="card">
                      <h2>{t("statistics.highestRated")}</h2>
                      <p style={{ margin: 0 }}>{stats.highestRatedGame.title}</p>
                      <p className="muted" style={{ margin: 0 }}>{stats.highestRatedGame.averageScore.toFixed(1)} / 10</p>
                    </Link>
                  )}
                  {stats.lowestRatedGame && (
                    <Link to={`/game-log/${stats.lowestRatedGame.gameId}`} className="card">
                      <h2>{t("statistics.lowestRated")}</h2>
                      <p style={{ margin: 0 }}>{stats.lowestRatedGame.title}</p>
                      <p className="muted" style={{ margin: 0 }}>{stats.lowestRatedGame.averageScore.toFixed(1)} / 10</p>
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
