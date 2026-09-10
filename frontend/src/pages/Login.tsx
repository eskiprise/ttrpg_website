import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

export function Login() {
  const { t } = useTranslation();
  const { loginWithTelegram, loginDev } = useAuth();
  const navigate = useNavigate();
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BOT_USERNAME) return;

    window.onTelegramAuth = (user) => {
      loginWithTelegram(user)
        .then(() => navigate("/"))
        .catch((err) => setError(err instanceof Error ? err.message : t("login.loginFailed")));
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    widgetContainerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [loginWithTelegram, navigate, t]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("login.title")}</h1>
      <p className="mt-2 text-ink-muted">{t("login.intro")}</p>
      <div className="mt-6" ref={widgetContainerRef} />
      {!BOT_USERNAME && <p className="mt-4 text-accent">{t("login.notConfigured")}</p>}
      {error && <p className="mt-4 text-accent">{error}</p>}
      {import.meta.env.DEV && <DevLoginForm onError={setError} loginDev={loginDev} />}
    </div>
  );
}

/**
 * Local-dev-only fallback: the Telegram Login Widget only authorizes on the domain
 * registered with BotFather, so it can never work against localhost. Only rendered
 * in a Vite dev build (import.meta.env.DEV) — the endpoint it calls doesn't even
 * exist in the deployed prod API.
 */
function DevLoginForm({
  onError,
  loginDev,
}: {
  onError: (message: string | null) => void;
  loginDev: ReturnType<typeof useAuth>["loginDev"];
}) {
  const navigate = useNavigate();
  const [secret, setSecret] = useState("");
  const [id, setId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await loginDev({ secret, id: Number(id), firstName });
      navigate("/");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Dev login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 flex max-w-[360px] flex-col gap-3 rounded-lg border border-dashed border-border bg-surface p-6"
    >
      <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Dev login</p>
      <input
        required
        placeholder="DEV_LOGIN_SECRET"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
      />
      <input
        required
        type="number"
        placeholder="Telegram id"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <input
        required
        placeholder="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <button disabled={busy} type="submit" className="secondary">
        Log in (dev)
      </button>
    </form>
  );
}
