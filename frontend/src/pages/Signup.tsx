import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";

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
        body: {
          firstName,
          lastName,
          email,
          telegramOrViberContact: contact,
        },
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
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">{t("signup.submittedTitle")}</h1>
        <p className="mt-4 text-ink-muted">{t("signup.submittedBody")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("signup.title")}</h1>
      <p className="mt-2 text-ink-muted">{t("signup.intro")}</p>
      <form
        onSubmit={onSubmit}
        className="mt-6 flex max-w-[420px] flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <label className="flex flex-col gap-1">
          {t("signup.firstName")}
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t("signup.lastName")}
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t("signup.email")}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t("signup.contact")}
          <input required value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        {error && <p className="text-accent">{error}</p>}
        <button disabled={busy} type="submit">{t("signup.submit")}</button>
      </form>
    </div>
  );
}
