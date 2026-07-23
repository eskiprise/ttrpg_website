import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Game } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function GameLog() {
  const { t } = useTranslation();
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
      <h1>{t("gameLog.title")}</h1>
      {error && <p className="error-text">{error}</p>}
      {!games && !error && <p className="muted">{t("common.loading")}</p>}
      {games?.length === 0 && <p className="muted">{t("gameLog.none")}</p>}
      {games?.map((game) => (
        <Link key={game.gameId} to={`/game-log/${game.gameId}`} className="card">
          <h2 style={{ margin: 0 }}>{game.title}</h2>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {game.date} · {game.systemName} · {t("gameLog.dm")} {game.dmDisplayName}
          </p>
        </Link>
      ))}
    </div>
  );
}
