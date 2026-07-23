import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameSystem, PublicUserSummary } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function LogGame() {
  const { t } = useTranslation();
  const { idToken, userId, isAdmin, email } = useAuth();
  const navigate = useNavigate();

  const [systems, setSystems] = useState<GameSystem[]>([]);
  const [members, setMembers] = useState<PublicUserSummary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [systemId, setSystemId] = useState("");
  const [dmUserId, setDmUserId] = useState(isAdmin ? "" : (userId ?? ""));
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ systems: GameSystem[] }>("/game-systems").then((d) => setSystems(d.systems));
    apiFetch<{ members: PublicUserSummary[] }>("/members", { token: idToken }).then((d) =>
      setMembers(d.members)
    );
  }, [idToken]);

  const dms = members.filter((m) => m.roles.includes("dm"));

  function toggleParticipant(memberId: string) {
    setParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  }

  async function submit() {
    setError(null);
    setStatus(null);
    if (!title || !date || !systemId || !dmUserId) {
      setError(t("logGame.missingFields"));
      return;
    }
    setBusy(true);
    try {
      const { game } = await apiFetch<{ game: { gameId: string } }>("/admin/games", {
        method: "POST",
        token: idToken,
        body: { title, date, systemId, dmUserId, participantUserIds: participantIds },
      });
      setStatus(t("logGame.logged"));
      setTimeout(() => navigate(`/game-log/${game.gameId}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>{t("logGame.title")}</h1>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "480px" }}>
        <label>
          {t("logGame.titleField")}
          <input
            placeholder={t("logGame.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {t("logGame.date")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          {t("logGame.system")}
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            <option value="">{t("logGame.selectSystem")}</option>
            {systems.map((s) => (
              <option key={s.systemId} value={s.systemId}>{s.name}</option>
            ))}
          </select>
        </label>

        {isAdmin ? (
          <label>
            {t("logGame.dm")}
            <select value={dmUserId} onChange={(e) => setDmUserId(e.target.value)}>
              <option value="">{t("logGame.selectDm")}</option>
              {dms.map((m) => (
                <option key={m.userId} value={m.userId}>{m.firstName} {m.lastName}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{t("logGame.youAreDm", { email })}</p>
        )}

        <div>
          <p className="muted" style={{ margin: "0 0 0.25rem" }}>{t("logGame.participants")}</p>
          {members.map((m) => (
            <label key={m.userId} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={participantIds.includes(m.userId)}
                onChange={() => toggleParticipant(m.userId)}
              />{" "}
              {m.firstName} {m.lastName}
            </label>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}
        {status && <p className="muted">{status}</p>}
        <button disabled={busy} onClick={submit}>{t("logGame.submit")}</button>
      </div>
    </div>
  );
}
