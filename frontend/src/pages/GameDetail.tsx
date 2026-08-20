import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameDetail } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatGameTitle } from "../lib/gameTitle";

export function GameDetail() {
  const { t, i18n } = useTranslation();
  const { pollId } = useParams<{ pollId: string }>();
  const { idToken } = useAuth();
  const [game, setGame] = useState<PublicGameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;
    apiFetch<{ game: PublicGameDetail }>(`/game-log/${pollId}`, { token: idToken })
      .then((data) => setGame(data.game))
      .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")));
  }, [pollId, idToken, t]);

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-accent">{error}</p>
      </div>
    );
  if (!game)
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-ink-muted">{t("common.loading")}</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{formatGameTitle(game.questionText)}</h1>
      <p className="mt-1 text-ink-muted">{new Date(game.createdAt).toLocaleDateString(i18n.language)}</p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        <p>
          <strong>{t("gameDetail.dm")}</strong> {game.gmDisplayName}
        </p>
        <p className="mt-2">
          <strong>{t("gameDetail.average")}</strong>{" "}
          {game.averageScore !== null ? `${game.averageScore.toFixed(1)} / 10` : "—"}
        </p>
      </div>

      <h2 className="mt-8 text-xl font-bold">{t("gameDetail.voters")}</h2>
      {game.voters.length === 0 ? (
        <p className="mt-2 text-ink-muted">{t("gameDetail.noVotes")}</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
          {game.voters.map((voter, index) => (
            <div
              key={index}
              className="flex items-center justify-between border-b border-border px-6 py-3 last:border-b-0"
            >
              <span>{voter.displayName}</span>
              <span className="font-mono tabular-nums text-ink-muted">{voter.rating} / 10</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
