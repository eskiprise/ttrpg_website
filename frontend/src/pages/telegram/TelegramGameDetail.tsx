import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramGameDetail as TelegramGameDetailType } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";

export function TelegramGameDetail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pollId } = useParams<{ pollId: string }>();
  const { initData } = useTelegramApp();
  const [game, setGame] = useState<TelegramGameDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;
    apiFetch<{ game: TelegramGameDetailType }>(`/telegram/games/${pollId}/voters`, {
      method: "POST",
      body: { initData },
    })
      .then((data) => setGame(data.game))
      .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId]);

  if (error) return <p className="text-accent">{error}</p>;
  if (!game) return <p className="text-ink-muted">{t("common.loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="secondary self-start" onClick={() => navigate(-1)}>
        ← {t("telegramApp.back")}
      </button>

      <div>
        <h1 className="text-xl font-bold">{game.questionText}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {new Date(game.createdAt).toLocaleDateString(i18n.language)} · {t("telegramApp.gmLabel")} {game.gmDisplayName}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("telegramApp.average")}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
            {game.averageScore !== null ? game.averageScore.toFixed(1) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">{t("telegramApp.myVote")}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{game.myRating ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-bold">{t("telegramApp.whoVoted")}</h2>
        <div className="mt-3 flex flex-col gap-2">
          {game.voters.length === 0 && <p className="text-ink-muted">{t("telegramApp.noVotersYet")}</p>}
          {game.voters.map((voter) => (
            <div key={voter.telegramUserId} className="flex items-center justify-between gap-3 text-sm">
              <span>{voter.displayName}</span>
              <span className="font-mono font-bold tabular-nums text-accent">{voter.rating}/10</span>
              <span className="text-ink-muted">{new Date(voter.answeredAt).toLocaleDateString(i18n.language)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
