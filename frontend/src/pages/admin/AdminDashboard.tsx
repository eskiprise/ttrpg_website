import { useEffect, useState } from "react";
import type { GameSystem, SignupRequest, User } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";

function useReload() {
  const [tick, setTick] = useState(0);
  return { tick, reload: () => setTick((t) => t + 1) };
}

function SignupRequests({ token }: { token: string | null }) {
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="card">
      <h2>Pending Signup Requests</h2>
      {error && <p className="error-text">{error}</p>}
      {requests?.length === 0 && <p className="muted">No pending requests.</p>}
      {requests?.map((r) => (
        <div key={r.requestId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
          <div>
            <strong>{r.firstName} {r.lastName}</strong> — {r.email} — {r.telegramOrViberContact}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => act(r.requestId, "approve")}>Approve</button>
            <button className="secondary" onClick={() => act(r.requestId, "reject")}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnonymizeToggle({ token }: { token: string | null }) {
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="card">
      <h2>Anonymize Public Game Log</h2>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" checked={checked} onChange={toggle} />
        Replace player names with nicknames for logged-out visitors
      </label>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function Members({ token }: { token: string | null }) {
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="card">
      <h2>Members</h2>
      {error && <p className="error-text">{error}</p>}
      {users?.map((u) => (
        <div key={u.userId} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
          <span>{u.firstName} {u.lastName} — {u.email}</span>
          <label>
            <input type="checkbox" checked={u.roles.includes("dm")} onChange={() => toggleDm(u)} /> Game Master
          </label>
        </div>
      ))}
    </div>
  );
}

function AddGameSystem({ token, onAdded }: { token: string | null; onAdded: () => void }) {
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="card">
      <h2>Add Game System</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "420px" }}>
        <input placeholder="Name (e.g. D&D 5e)" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        {error && <p className="error-text">{error}</p>}
        <button onClick={submit}>Add System</button>
      </div>
    </div>
  );
}

function AddGame({ token, systems, users }: { token: string | null; systems: GameSystem[]; users: User[] }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [systemId, setSystemId] = useState("");
  const [dmUserId, setDmUserId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const dms = users.filter((u) => u.roles.includes("dm"));

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function submit() {
    setError(null);
    setStatus(null);
    if (!title || !date || !systemId || !dmUserId) {
      setError("Title, date, system and DM are required");
      return;
    }
    try {
      await apiFetch("/admin/games", {
        method: "POST",
        token,
        body: { title, date, systemId, dmUserId, participantUserIds: participantIds },
      });
      setStatus("Game added to the log.");
      setTitle("");
      setDate("");
      setParticipantIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="card">
      <h2>Log a Game</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "480px" }}>
        <input placeholder="Title (e.g. Game #1 - The Beginning)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
          <option value="">Select system…</option>
          {systems.map((s) => <option key={s.systemId} value={s.systemId}>{s.name}</option>)}
        </select>
        <select value={dmUserId} onChange={(e) => setDmUserId(e.target.value)}>
          <option value="">Select DM…</option>
          {dms.map((u) => <option key={u.userId} value={u.userId}>{u.firstName} {u.lastName}</option>)}
        </select>
        <div>
          <p className="muted" style={{ margin: "0 0 0.25rem" }}>Participants:</p>
          {users.map((u) => (
            <label key={u.userId} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={participantIds.includes(u.userId)}
                onChange={() => toggleParticipant(u.userId)}
              />{" "}
              {u.firstName} {u.lastName}
            </label>
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        {status && <p className="muted">{status}</p>}
        <button onClick={submit}>Add Game</button>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { idToken } = useAuth();
  const { tick, reload } = useReload();
  const [systems, setSystems] = useState<GameSystem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    apiFetch<{ systems: GameSystem[] }>("/game-systems").then((d) => setSystems(d.systems));
    apiFetch<{ users: User[] }>("/admin/users", { token: idToken }).then((d) => setUsers(d.users));
  }, [idToken, tick]);

  return (
    <div className="page">
      <h1>Admin</h1>
      <SignupRequests token={idToken} />
      <AnonymizeToggle token={idToken} />
      <Members token={idToken} />
      <AddGameSystem token={idToken} onAdded={reload} />
      <AddGame token={idToken} systems={systems} users={users} />
    </div>
  );
}
