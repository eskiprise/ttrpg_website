import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PersonalStats } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

function GameRow({ gameId, title, date, systemName }: { gameId: string; title: string; date: string; systemName: string }) {
  return (
    <Link to={`/game-log/${gameId}`} className="card">
      <strong>{title}</strong>
      <p className="muted" style={{ margin: "0.25rem 0 0" }}>{date} · {systemName}</p>
    </Link>
  );
}

export function Stats() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ stats: PersonalStats }>("/me/stats", { token: idToken })
      .then((data) => setStats(data.stats))
      .catch((err) => setError(err.message));
  }, [idToken]);

  return (
    <div className="page">
      <h1>{t("stats.title")}</h1>
      {error && <p className="error-text">{error}</p>}
      {!stats && !error && <p className="muted">{t("common.loading")}</p>}
      {stats && (
        <>
          <p className="muted">
            {t("stats.gamesDmdCount", { count: stats.gamesDmd.length })} ·{" "}
            {t("stats.gamesPlayedCount", { count: stats.gamesPlayed.length })}
          </p>

          <h2>{t("stats.gamesDmd")}</h2>
          {stats.gamesDmd.length === 0 && <p className="muted">{t("stats.noneYet")}</p>}
          {stats.gamesDmd.map((g) => (
            <GameRow key={g.gameId} gameId={g.gameId} title={g.title} date={g.date} systemName={g.systemName} />
          ))}

          <h2>{t("stats.gamesPlayed")}</h2>
          {stats.gamesPlayed.length === 0 && <p className="muted">{t("stats.noneYet")}</p>}
          {stats.gamesPlayed.map((g) => (
            <GameRow key={g.gameId} gameId={g.gameId} title={g.title} date={g.date} systemName={g.systemName} />
          ))}
        </>
      )}
    </div>
  );
}
