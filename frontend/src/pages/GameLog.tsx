import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Game } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function GameLog() {
  const { idToken } = useAuth();
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ games: Game[] }>("/games", { token: idToken })
      .then((data) => setGames(data.games))
      .catch((err) => setError(err.message));
  }, [idToken]);

  return (
    <div className="page">
      <h1>Game Log</h1>
      {error && <p className="error-text">{error}</p>}
      {!games && !error && <p className="muted">Loading…</p>}
      {games?.length === 0 && <p className="muted">No games logged yet.</p>}
      {games?.map((game) => (
        <Link key={game.gameId} to={`/game-log/${game.gameId}`} className="card">
          <h2 style={{ margin: 0 }}>{game.title}</h2>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {game.date} · {game.systemName} · DM: {game.dmDisplayName}
          </p>
        </Link>
      ))}
    </div>
  );
}
