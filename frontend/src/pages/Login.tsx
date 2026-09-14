import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { Band } from "../components/Band";
import { CLUB_TELEGRAM_URL } from "../lib/club";

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

  // Latest-ref pattern. loginWithTelegram gets a new identity on every auth state
  // change, so keeping it in the injection effect's deps re-ran that effect and
  // appended a second widget script each time (and StrictMode doubled it again).
  // The script is injected exactly once; this ref keeps its callback current.
  const onAuthRef = useRef<(user: Record<string, unknown>) => void>(() => {});
  useEffect(() => {
    onAuthRef.current = (user) => {
      loginWithTelegram(user)
        .then(() => navigate("/"))
        .catch((err) => setError(err instanceof Error ? err.message : t("login.loginFailed")));
    };
  });

  useEffect(() => {
    if (!BOT_USERNAME) return;
    const container = widgetContainerRef.current;
    if (!container) return;

    window.onTelegramAuth = (user) => onAuthRef.current(user);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      // The widget renders an iframe next to the script tag; clearing the container
      // removes both, so a remount can't leave two login buttons stacked up.
      container.replaceChildren();
    };
  }, []);

  return (
    <div>
      <Band tone="page" width="wide">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
          <div>
            <span className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
              {t("login.eyebrow")}
            </span>
            <h1 className="mt-4 text-[clamp(2rem,1.4rem+2.6vw,3.2rem)] leading-[1.06] font-bold tracking-[-0.025em]">
              {t("login.title")}
            </h1>
            <p className="mt-4 max-w-[46ch] text-lg text-ink-muted">{t("login.intro")}</p>

            <ul className="mt-8 flex flex-col gap-5">
              {[1, 2, 3].map((n) => (
                <li key={n} className="border-t border-border pt-4">
                  <h2 className="text-base font-bold">{t(`login.benefit${n}Title`)}</h2>
                  <p className="mt-1 text-ink-muted">{t(`login.benefit${n}Body`)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 lg:self-start">
            <h2 className="text-lg font-bold">{t("login.widgetTitle")}</h2>
            <p className="text-sm text-ink-muted">{t("login.widgetHint")}</p>

            {/* Must stay mounted and unconditional — the injected script appends its
                iframe here, so a container that comes and goes would strand it. */}
            <div ref={widgetContainerRef} className="min-h-[3rem]" />

            {!BOT_USERNAME && <p className="text-accent">{t("login.notConfigured")}</p>}
            {error && <p className="text-accent">{error}</p>}

            <p className="mt-2 border-t border-border pt-4 text-sm text-ink-muted">
              {t("login.notMemberYet")}{" "}
              <a href={CLUB_TELEGRAM_URL} target="_blank" rel="noreferrer" className="font-semibold">
                {t("login.writeToUs")}
              </a>
            </p>
          </div>
        </div>

        {import.meta.env.DEV && <DevLoginForm onError={setError} loginDev={loginDev} />}
      </Band>
    </div>
  );
}

/**
 * Local-dev-only fallback: the Telegram Login Widget only authorizes on the domain
 * registered with BotFather, so it can never work against localhost. Only rendered
 * in a Vite dev build (import.meta.env.DEV) — the endpoint it calls doesn't exist in
 * the deployed prod API at all.
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
      className="mt-12 flex max-w-[360px] flex-col gap-3 rounded-xl border border-dashed border-border p-6"
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
