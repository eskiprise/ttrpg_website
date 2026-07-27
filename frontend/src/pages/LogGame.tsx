import { useEffect, useState, type FormEvent } from "react";
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

  async function submit(e: FormEvent) {
    e.preventDefault();
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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("logGame.title")}</h1>
      <form
        onSubmit={submit}
        className="mt-6 flex max-w-[480px] flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <label className="flex flex-col gap-1">
          {t("logGame.titleField")}
          <input
            placeholder={t("logGame.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t("logGame.date")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t("logGame.system")}
          <select value={systemId} onChange={(e) => setSystemId(e.target.value)}>
            <option value="">{t("logGame.selectSystem")}</option>
            {systems.map((s) => (
              <option key={s.systemId} value={s.systemId}>{s.name}</option>
            ))}
          </select>
        </label>

        {isAdmin ? (
          <label className="flex flex-col gap-1">
            {t("logGame.dm")}
            <select value={dmUserId} onChange={(e) => setDmUserId(e.target.value)}>
              <option value="">{t("logGame.selectDm")}</option>
              {dms.map((m) => (
                <option key={m.userId} value={m.userId}>{m.firstName} {m.lastName}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-ink-muted">{t("logGame.youAreDm", { email })}</p>
        )}

        <div>
          <p className="mb-1 text-ink-muted">{t("logGame.participants")}</p>
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <label key={m.userId} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={participantIds.includes(m.userId)}
                  onChange={() => toggleParticipant(m.userId)}
                />
                {m.firstName} {m.lastName}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-accent">{error}</p>}
        {status && <p className="text-ink-muted">{status}</p>}
        <button disabled={busy} type="submit">{t("logGame.submit")}</button>
      </form>
    </div>
  );
}
