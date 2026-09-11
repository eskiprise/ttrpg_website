import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameDetail } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatGameTitle } from "../lib/gameTitle";
import { Comments } from "../components/Comments";
import { PageShell } from "../components/PageShell";

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

  return (
    <PageShell>
      <Link to="/game-log" className="eyebrow text-ink-muted hover:text-accent">
        ← {t("gameLog.title")}
      </Link>

      {error && <p className="mt-6 text-accent">{error}</p>}
      {!game && !error && <p className="mt-6 text-ink-muted">{t("common.loading")}</p>}

      {game && (
        <>
          <h1 className="page-title mt-6">{formatGameTitle(game.questionText)}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-ink-muted">
            <span>{new Date(game.createdAt).toLocaleDateString(i18n.language, { dateStyle: "long" })}</span>
            <span>
              {t("gameDetail.dm")} <span className="font-medium text-ink">{game.gmDisplayName}</span>
            </span>
            {game.averageScore !== null && (
              <span className="inline-flex items-center gap-2">
                {t("gameDetail.average")}
                <span className="rounded-md bg-band px-2 py-1 font-numeric text-sm font-bold tracking-[-0.02em] text-band-accent tabular-nums">
                  {game.averageScore.toFixed(1)}
                </span>
              </span>
            )}
          </div>

          <h2 className="mt-10 text-xl font-bold">{t("gameDetail.voters")}</h2>
          {game.voters.length === 0 ? (
            <p className="mt-3 text-ink-muted">{t("gameDetail.noVotes")}</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
              {game.voters.map((voter, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-b-0"
                >
                  <span className="min-w-0 truncate">{voter.displayName}</span>
                  <span className="flex-shrink-0 font-numeric text-sm font-bold tabular-nums">
                    {voter.rating}
                    <span className="font-body font-normal text-ink-muted"> / 10</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {pollId && <Comments pollId={pollId} />}
        </>
      )}
    </PageShell>
  );
}
