import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";
import { CLUB_TELEGRAM_URL } from "../lib/club";

export function Signup() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/signup", {
        method: "POST",
        body: { firstName, lastName, email, telegramOrViberContact: contact },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <h1 className="page-title">{t("signup.submittedTitle")}</h1>
        <p className="mt-5 max-w-[54ch] text-lg text-ink-muted">{t("signup.submittedBody")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
        <div>
          <h1 className="page-title">{t("signup.title")}</h1>
          <p className="mt-5 max-w-[46ch] text-lg text-ink-muted">{t("signup.intro")}</p>
          {/* The form is the slow path; most people would rather just message us. */}
          <p className="mt-6 text-ink-muted">
            {t("signup.preferTelegram")}{" "}
            <a href={CLUB_TELEGRAM_URL} target="_blank" rel="noreferrer" className="font-semibold">
              {t("signup.telegramLink")}
            </a>
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 lg:self-start"
        >
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("signup.firstName")}
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("signup.lastName")}
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("signup.email")}
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("signup.contact")}
            <input required value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
          {error && <p className="text-accent">{error}</p>}
          <button disabled={busy} type="submit" className="mt-1">
            {t("signup.submit")}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
