import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameSystemListResponse, GameSystemWithCount } from "@ttrpg-club/shared";
import { ApiError, apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";

export function TelegramCreatePoll() {
  const { t } = useTranslation();
  const { initData } = useTelegramApp();
  const [systems, setSystems] = useState<GameSystemWithCount[] | null>(null);
  const [systemId, setSystemId] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);

  useEffect(() => {
    // The same public list the site shows, most-played first.
    apiFetch<GameSystemListResponse>("/game-systems")
      .then((data) => setSystems(data.systems))
      .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")));
  }, [t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { questionText } = await apiFetch<{ pollId: string; questionText: string }>(
        "/telegram/polls",
        { method: "POST", body: { initData, systemId, sessionName } }
      );
      setCreatedTitle(questionText);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? t("telegramApp.createPollNotMember")
          : // Telegram signs the app's session once, at open — an app left open for a
            // day needs reopening rather than an English error nobody can act on.
            err instanceof ApiError && err.status === 401
            ? t("telegramApp.sessionExpired")
            : err instanceof Error
              ? err.message
              : t("common.somethingWrong")
      );
    } finally {
      setBusy(false);
    }
  }

  if (createdTitle) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("telegramApp.createPollDone")}</h1>
        <p className="text-ink-muted">{t("telegramApp.createPollDoneBody")}</p>
        <p className="rounded-lg border border-border bg-surface p-4 font-medium">{createdTitle}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setCreatedTitle(null);
              setSessionName("");
            }}
          >
            {t("telegramApp.createPollAnother")}
          </button>
          <Link to="/telegram" className="rounded-lg border border-border bg-surface p-4 text-center font-semibold hover:bg-surface-2">
            ← {t("telegramApp.back")}
          </Link>
        </div>
      </div>
    );
  }

  const selectedSystem = systems?.find((s) => s.systemId === systemId);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/telegram" className="text-sm text-ink-muted hover:text-accent">
        ← {t("telegramApp.back")}
      </Link>
      <h1 className="text-2xl font-bold">{t("telegramApp.createPollTitle")}</h1>
      <p className="text-ink-muted">{t("telegramApp.createPollIntro")}</p>

      {systems?.length === 0 ? (
        <p className="text-ink-muted">{t("telegramApp.createPollNoSystems")}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t("telegramApp.createPollSession")}</span>
            <input
              required
              maxLength={150}
              value={sessionName}
              placeholder={t("telegramApp.createPollSessionPlaceholder")}
              onChange={(e) => setSessionName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t("telegramApp.createPollSystem")}</span>
            <select required value={systemId} onChange={(e) => setSystemId(e.target.value)} disabled={!systems}>
              <option value="">
                {systems ? t("telegramApp.createPollSystemPlaceholder") : t("common.loading")}
              </option>
              {systems?.map((system) => (
                <option key={system.systemId} value={system.systemId}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>

          {/* Exactly what the chat will see, so nobody has to guess the format. */}
          {selectedSystem && sessionName.trim() && (
            <p className="text-sm text-ink-muted">
              {t("telegramApp.createPollPreview")}{" "}
              <span className="text-ink">
                Оцінка ({selectedSystem.name}: {sessionName.trim()})
              </span>
            </p>
          )}

          {error && <p className="text-accent">{error}</p>}

          <button type="submit" disabled={busy || !systemId || !sessionName.trim()}>
            {busy ? t("common.loading") : t("telegramApp.createPollSubmit")}
          </button>
        </form>
      )}
    </div>
  );
}
