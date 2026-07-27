import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TelegramUserStats } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";

type LoadState =
  | { status: "not-in-telegram" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; stats: TelegramUserStats };

export function TelegramMiniApp() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;

    if (!webApp || !initData) {
      setState({ status: "not-in-telegram" });
      return;
    }

    webApp.ready();
    webApp.expand();

    apiFetch<{ stats: TelegramUserStats }>("/telegram/stats", {
      method: "POST",
      body: { initData },
    })
      .then((data) => setState({ status: "ready", stats: data.stats }))
      .catch((err) =>
        setState({
          status: "error",
          message: err instanceof Error ? err.message : t("common.somethingWrong"),
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6">
      {state.status === "not-in-telegram" && (
        <p className="text-ink-muted">{t("telegramApp.openFromBot")}</p>
      )}
      {state.status === "loading" && <p className="text-ink-muted">{t("common.loading")}</p>}
      {state.status === "error" && <p className="text-accent">{state.message}</p>}

      {state.status === "ready" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t("telegramApp.title", { name: state.stats.displayName })}</h1>

          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-ink-muted">{t("telegramApp.totalRatings")}</p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{state.stats.totalRatingsGiven}</p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-ink-muted">{t("telegramApp.averageRating")}</p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
              {state.stats.averageRatingGiven !== null
                ? `${state.stats.averageRatingGiven.toFixed(1)} / 10`
                : "—"}
            </p>
          </div>

          {state.stats.recentRatings.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-bold">{t("telegramApp.recentRatings")}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {state.stats.recentRatings.map((r) => (
                  <div key={r.pollId + r.answeredAt} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{r.questionText}</span>
                    <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-accent-ink">
                      {r.rating}/10
                    </span>
                    <span className="text-xs whitespace-nowrap text-ink-muted">
                      {new Date(r.answeredAt).toLocaleDateString(i18n.language)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.stats.totalRatingsGiven === 0 && (
            <p className="text-ink-muted">{t("telegramApp.noRatingsYet")}</p>
          )}
        </div>
      )}
    </div>
  );
}
