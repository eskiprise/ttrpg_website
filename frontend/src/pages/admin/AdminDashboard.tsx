import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SignupRequest, User } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";

function useReload() {
  const [tick, setTick] = useState(0);
  return { tick, reload: () => setTick((t) => t + 1) };
}

function SignupRequests({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const { tick, reload } = useReload();
  const [requests, setRequests] = useState<SignupRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ requests: SignupRequest[] }>("/admin/signup-requests", { token })
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(err.message));
  }, [token, tick]);

  async function act(requestId: string, action: "approve" | "reject") {
    setError(null);
    try {
      await apiFetch(`/admin/signup-requests/${requestId}/${action}`, {
        method: "POST",
        token,
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  return (
    <div className="card">
      <h2>{t("admin.signupRequestsTitle")}</h2>
      {error && <p className="error-text">{error}</p>}
      {requests?.length === 0 && <p className="muted">{t("admin.noPendingRequests")}</p>}
      {requests?.map((r) => (
        <div key={r.requestId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
          <div>
            <strong>{r.firstName} {r.lastName}</strong> — {r.email} — {r.telegramOrViberContact}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => act(r.requestId, "approve")}>{t("admin.approve")}</button>
            <button className="secondary" onClick={() => act(r.requestId, "reject")}>{t("admin.reject")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnonymizeToggle({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !checked;
    setError(null);
    try {
      await apiFetch("/admin/settings/anonymize-toggle", {
        method: "PATCH",
        token,
        body: { anonymizeLoggedOutView: next },
      });
      setChecked(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  return (
    <div className="card">
      <h2>{t("admin.anonymizeTitle")}</h2>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" checked={checked} onChange={toggle} />
        {t("admin.anonymizeLabel")}
      </label>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function Members({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const { tick, reload } = useReload();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ users: User[] }>("/admin/users", { token })
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message));
  }, [token, tick]);

  async function toggleDm(user: User) {
    const nextRoles = user.roles.includes("dm")
      ? user.roles.filter((r) => r !== "dm")
      : [...user.roles, "dm" as const];
    setError(null);
    try {
      await apiFetch(`/admin/users/${user.userId}/roles`, {
        method: "PATCH",
        token,
        body: { roles: nextRoles },
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  return (
    <div className="card">
      <h2>{t("admin.membersTitle")}</h2>
      {error && <p className="error-text">{error}</p>}
      {users?.map((u) => (
        <div key={u.userId} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
          <span>{u.firstName} {u.lastName} — {u.email}</span>
          <label>
            <input type="checkbox" checked={u.roles.includes("dm")} onChange={() => toggleDm(u)} /> {t("admin.gameMasterCheckbox")}
          </label>
        </div>
      ))}
    </div>
  );
}

function AddGameSystem({ token, onAdded }: { token: string | null; onAdded: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setError(null);
    try {
      await apiFetch("/admin/game-systems", {
        method: "POST",
        token,
        body: { name, description },
      });
      setName("");
      setDescription("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  return (
    <div className="card">
      <h2>{t("admin.addSystemTitle")}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "420px" }}>
        <input placeholder={t("admin.systemNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder={t("admin.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
        {error && <p className="error-text">{error}</p>}
        <button onClick={submit}>{t("admin.addSystem")}</button>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const { reload } = useReload();

  return (
    <div className="page">
      <h1>{t("admin.title")}</h1>
      <SignupRequests token={idToken} />
      <AnonymizeToggle token={idToken} />
      <Members token={idToken} />
      <AddGameSystem token={idToken} onAdded={reload} />
      <div className="card">
        <h2>{t("admin.logGameTitle")}</h2>
        <p className="muted">{t("admin.logGameMoved")}</p>
        <Link to="/games/log"><button>{t("admin.goToLogGame")}</button></Link>
      </div>
    </div>
  );
}
