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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("gameLog.title")}</h1>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!games && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      {games?.length === 0 && <p className="mt-4 text-ink-muted">{t("gameLog.none")}</p>}
      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        {games?.map((game) => (
          <Link
            key={game.gameId}
            to={`/game-log/${game.gameId}`}
            className="block border-b border-border px-6 py-4 last:border-b-0 hover:bg-surface-2"
          >
            <h2 className="text-lg font-bold">{game.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {game.date} · {game.systemName} · {t("gameLog.dm")} {game.dmDisplayName}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
