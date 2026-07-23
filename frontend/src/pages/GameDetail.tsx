import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Game } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { Poll } from "../components/Poll";
import { Comments } from "../components/Comments";

export function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const { idToken } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    apiFetch<{ game: Game }>(`/games/${gameId}`, { token: idToken })
      .then((data) => setGame(data.game))
      .catch((err) => setError(err.message));
  }, [gameId, idToken]);

  if (error) return <div className="page"><p className="error-text">{error}</p></div>;
  if (!game) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1>{game.title}</h1>
      <p className="muted">{game.date} · {game.systemName}</p>

      <div className="card">
        <p><strong>Dungeon Master:</strong> {game.dmDisplayName}</p>
        <p><strong>Players:</strong>{" "}
          {game.participants
            .filter((p) => p.userId !== game.dmUserId)
            .map((p) => p.displayName)
            .join(", ") || "None recorded"}
        </p>
      </div>

      <Poll gameId={game.gameId} />
      <Comments gameId={game.gameId} />
    </div>
  );
}
