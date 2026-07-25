import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TelegramUserStats } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import "./TelegramMiniApp.css";

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
    <div className="telegram-app">
      {state.status === "not-in-telegram" && (
        <p className="muted">{t("telegramApp.openFromBot")}</p>
      )}
      {state.status === "loading" && <p className="muted">{t("common.loading")}</p>}
      {state.status === "error" && <p className="error-text">{state.message}</p>}

      {state.status === "ready" && (
        <>
          <h1>{t("telegramApp.title", { name: state.stats.displayName })}</h1>

          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              {t("telegramApp.totalRatings")}
            </p>
            <p className="telegram-stat-value">{state.stats.totalRatingsGiven}</p>
          </div>

          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              {t("telegramApp.averageRating")}
            </p>
            <p className="telegram-stat-value">
              {state.stats.averageRatingGiven !== null
                ? `${state.stats.averageRatingGiven.toFixed(1)} / 10`
                : "—"}
            </p>
          </div>

          {state.stats.recentRatings.length > 0 && (
            <div className="card">
              <h2>{t("telegramApp.recentRatings")}</h2>
              {state.stats.recentRatings.map((r) => (
                <div key={r.pollId + r.answeredAt} className="telegram-rating-row">
                  <span>{r.questionText}</span>
                  <span className="telegram-rating-badge">{r.rating}/10</span>
                  <span className="muted">
                    {new Date(r.answeredAt).toLocaleDateString(i18n.language)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {state.stats.totalRatingsGiven === 0 && (
            <p className="muted">{t("telegramApp.noRatingsYet")}</p>
          )}
        </>
      )}
    </div>
  );
}
