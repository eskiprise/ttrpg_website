import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
      <h1>My Stats</h1>
      {error && <p className="error-text">{error}</p>}
      {!stats && !error && <p className="muted">Loading…</p>}
      {stats && (
        <>
          <p className="muted">
            {stats.gamesDmd.length} game{stats.gamesDmd.length === 1 ? "" : "s"} DM'd ·{" "}
            {stats.gamesPlayed.length} game{stats.gamesPlayed.length === 1 ? "" : "s"} played
          </p>

          <h2>Games I've DM'd</h2>
          {stats.gamesDmd.length === 0 && <p className="muted">None yet.</p>}
          {stats.gamesDmd.map((g) => (
            <GameRow key={g.gameId} gameId={g.gameId} title={g.title} date={g.date} systemName={g.systemName} />
          ))}

          <h2>Games I've Played</h2>
          {stats.gamesPlayed.length === 0 && <p className="muted">None yet.</p>}
          {stats.gamesPlayed.map((g) => (
            <GameRow key={g.gameId} gameId={g.gameId} title={g.title} date={g.date} systemName={g.systemName} />
          ))}
        </>
      )}
    </div>
  );
}
