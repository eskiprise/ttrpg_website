import { useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";

export function Signup() {
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="page">
        <h1>Request Submitted</h1>
        <p>
          Thanks! An admin will review your request and reach out once you're
          approved.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Join the Club</h1>
      <p className="muted">
        Membership is by admin approval. Fill this out and we'll get in touch.
      </p>
      <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "420px" }}>
        <label>
          First name
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label>
          Last name
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label>
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Telegram or Viber contact
          <input required value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button disabled={busy} type="submit">Submit Request</button>
      </form>
    </div>
  );
}
