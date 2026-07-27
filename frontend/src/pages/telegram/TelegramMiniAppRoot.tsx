import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TelegramAppContext } from "./TelegramAppContext";

type GateState = { status: "not-in-telegram" } | { status: "ready"; initData: string };

/**
 * Layout route for everything under /telegram. Verifies the Mini App actually has a
 * Telegram WebApp context (falls back to a plain message otherwise, e.g. someone opening
 * the link in a normal browser), then hands the raw initData down to every child screen
 * via context so each can authenticate its own API calls.
 *
 * Also handles the `startapp=feedback_<pollId>` deep link (see ttrpg_poll_bot's
 * _send_feedback_link): Telegram always opens the Mini App at the same registered base
 * URL, so the feedback flow can't be reached via the initial path — it has to redirect
 * client-side once `start_param` is readable.
 */
export function TelegramMiniAppRoot() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<GateState | null>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;

    if (!webApp || !initData) {
      setState({ status: "not-in-telegram" });
      return;
    }

    webApp.ready();
    webApp.expand();

    const startParam = webApp.initDataUnsafe.start_param;
    const feedbackMatch = startParam?.match(/^feedback_(.+)$/);
    if (feedbackMatch) {
      navigate(`/telegram/feedback/${feedbackMatch[1]}`, { replace: true });
    }

    setState({ status: "ready", initData });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  if (state.status === "not-in-telegram") {
    return (
      <div className="mx-auto max-w-[480px] px-4 py-6">
        <p className="text-ink-muted">{t("telegramApp.openFromBot")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6">
      <TelegramAppContext.Provider value={{ initData: state.initData }}>
        <Outlet />
      </TelegramAppContext.Provider>
    </div>
  );
}
