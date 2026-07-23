import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { t } = useTranslation();
  const { login, completeNewPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challenge, setChallenge] = useState<Parameters<typeof completeNewPassword>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.ok) {
        navigate("/");
      } else {
        setChallenge(result.challenge);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onCompleteChallenge(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await completeNewPassword(challenge, newPassword);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.passwordSetFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <div className="page">
        <h1>{t("login.newPasswordTitle")}</h1>
        <p className="muted">{t("login.newPasswordIntro")}</p>
        <form className="card" onSubmit={onCompleteChallenge} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "360px" }}>
          <label>
            {t("login.newPassword")}
            <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button disabled={busy} type="submit">{t("login.newPasswordSubmit")}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t("login.title")}</h1>
      <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "360px" }}>
        <label>
          {t("login.email")}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t("login.password")}
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button disabled={busy} type="submit">{t("login.submit")}</button>
      </form>
    </div>
  );
}
