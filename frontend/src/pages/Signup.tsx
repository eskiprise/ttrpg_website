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
      <div className="page">
        <h1>{t("signup.submittedTitle")}</h1>
        <p>{t("signup.submittedBody")}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t("signup.title")}</h1>
      <p className="muted">{t("signup.intro")}</p>
      <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "420px" }}>
        <label>
          {t("signup.firstName")}
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label>
          {t("signup.lastName")}
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label>
          {t("signup.email")}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t("signup.contact")}
          <input required value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button disabled={busy} type="submit">{t("signup.submit")}</button>
      </form>
    </div>
  );
}
