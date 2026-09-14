import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";
import { CLUB_TELEGRAM_URL } from "../lib/club";

/** Visual-only — screen readers already announce the input's `required` attribute. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="font-semibold text-accent">
      *
    </span>
  );
}

export function Signup() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
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
        body: { firstName, lastName, telegramOrViberContact: contact, phone },
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
          <p className="text-xs text-ink-muted">
            <RequiredMark /> {t("signup.requiredHint")}
          </p>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            <span>
              {t("signup.firstName")} <RequiredMark />
            </span>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            {t("signup.lastName")}
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          {/* Either one is enough, so each is `required` only while the other is empty —
              the browser then blocks submit until at least one is filled. */}
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="p-0 text-sm font-semibold text-ink">
              {t("signup.reachGroup")} <RequiredMark />
            </legend>
            <p className="-mt-1 text-xs text-ink-muted">{t("signup.reachGroupHint")}</p>
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              {t("signup.contact")}
              <input
                required={!phone.trim()}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              {t("signup.phone")}
              <input
                required={!contact.trim()}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+380 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </fieldset>
          {error && <p className="text-accent">{error}</p>}
          <button disabled={busy} type="submit" className="mt-1">
            {t("signup.submit")}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
