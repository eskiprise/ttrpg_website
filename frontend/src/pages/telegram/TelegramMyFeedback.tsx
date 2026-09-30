import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramFeedbackForGame } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";
import { useRefetchOnVisible } from "./useRefetchOnVisible";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; games: TelegramFeedbackForGame[] };

/** One 1-10 rating with its label, in the same order the GM's own Telegram DM shows them. */
function RatingChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-2 px-2 py-1.5 text-center">
      <p className="text-[11px] leading-tight text-ink-muted">{label}</p>
      <p className="font-mono text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function TelegramMyFeedback() {
  const { t, i18n } = useTranslation();
  const { initData } = useTelegramApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useRefetchOnVisible(() => {
    apiFetch<{ games: TelegramFeedbackForGame[] }>("/telegram/feedback/mine", {
      method: "POST",
      body: { initData },
    })
      .then((data) => setState({ status: "ready", games: data.games }))
      .catch((err) =>
        setState({ status: "error", message: err instanceof Error ? err.message : t("common.somethingWrong") })
      );
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/telegram" className="text-sm text-ink-muted hover:text-accent">
        ← {t("telegramApp.back")}
      </Link>
      <h1 className="text-xl font-bold">{t("telegramApp.myFeedback")}</h1>

      {state.status === "loading" && <p className="text-ink-muted">{t("common.loading")}</p>}
      {state.status === "error" && <p className="text-accent">{state.message}</p>}
      {state.status === "ready" && state.games.length === 0 && (
        <p className="text-ink-muted">{t("telegramApp.noFeedbackYet")}</p>
      )}

      {state.status === "ready" && (
        <div className="flex flex-col gap-5">
          {state.games.map((game) => (
            <div key={game.pollId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <strong className="text-ink">{game.gameTitle}</strong>
                <span className="flex-shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                  {new Date(game.gameCreatedAt).toLocaleDateString(i18n.language)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {game.feedback.map((item) => (
                  <div key={item.feedbackId} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {item.submitterName ?? t("telegramApp.feedbackAnonymous")}
                      </span>
                      <span className="flex-shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                        {new Date(item.submittedAt).toLocaleDateString(i18n.language)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <RatingChip label={t("telegramApp.feedbackAdventureShort")} value={item.adventureRating} />
                      <RatingChip label={t("telegramApp.feedbackTableShort")} value={item.tableRating} />
                      <RatingChip label={t("telegramApp.feedbackGmShort")} value={item.gmRating} />
                      <RatingChip label={t("telegramApp.feedbackSelfShort")} value={item.selfRating} />
                    </div>
                    {item.feedbackText && <p className="mt-2 text-sm whitespace-pre-wrap">{item.feedbackText}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
