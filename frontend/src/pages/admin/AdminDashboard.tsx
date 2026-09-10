import { useEffect, useState } from "react";
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.signupRequestsTitle")}</h2>
      {error && <p className="mt-3 text-accent">{error}</p>}
      {requests?.length === 0 && <p className="mt-3 text-ink-muted">{t("admin.noPendingRequests")}</p>}
      <div className="mt-3 flex flex-col">
        {requests?.map((r) => (
          <div key={r.requestId} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
            <div>
              <strong>{r.firstName} {r.lastName}</strong> — {r.email} — {r.telegramOrViberContact}
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button type="button" onClick={() => act(r.requestId, "approve")}>{t("admin.approve")}</button>
              <button type="button" className="secondary" onClick={() => act(r.requestId, "reject")}>{t("admin.reject")}</button>
            </div>
          </div>
        ))}
      </div>
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.anonymizeTitle")}</h2>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={toggle} />
        {t("admin.anonymizeLabel")}
      </label>
      {error && <p className="mt-3 text-accent">{error}</p>}
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.membersTitle")}</h2>
      {error && <p className="mt-3 text-accent">{error}</p>}
      <div className="mt-3 flex flex-col">
        {users?.map((u) => (
          <div key={u.userId} className="flex justify-between gap-3 border-b border-border py-2 last:border-b-0">
            <span>{u.firstName} {u.lastName} — {u.telegramOrViberContact}</span>
            <label className="flex flex-shrink-0 items-center gap-2">
              <input type="checkbox" checked={u.roles.includes("dm")} onChange={() => toggleDm(u)} /> {t("admin.gameMasterCheckbox")}
            </label>
          </div>
        ))}
      </div>
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.addSystemTitle")}</h2>
      <div className="mt-3 flex max-w-[420px] flex-col gap-2">
        <input placeholder={t("admin.systemNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder={t("admin.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
        {error && <p className="text-accent">{error}</p>}
        <button type="button" onClick={submit}>{t("admin.addSystem")}</button>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const { reload } = useReload();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
      <SignupRequests token={idToken} />
      <AnonymizeToggle token={idToken} />
      <Members token={idToken} />
      <AddGameSystem token={idToken} onAdded={reload} />
    </div>
  );
}
