import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameDetail, User } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatGameTitle } from "../lib/gameTitle";
import { Comments } from "../components/Comments";
import { PageShell } from "../components/PageShell";

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Admin-only inline editor for the game's title and GM — the same PATCH the admin
 * dashboard's own "Ігри" section uses, just reachable from the game's own page too. */
function GameEditForm({
  game,
  token,
  onSaved,
  onCancel,
}: {
  game: PublicGameDetail;
  token: string | null;
  onSaved: (game: PublicGameDetail) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(formatGameTitle(game.questionText));
  const [gmUserId, setGmUserId] = useState(game.gmUserId ?? "");
  const [users, setUsers] = useState<User[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ users: User[] }>("/admin/users", { token })
      .then((data) =>
        setUsers(
          data.users
            .slice()
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
        )
      )
      .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")));
  }, [token, t]);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ game: PublicGameDetail }>(`/admin/game-log/${game.pollId}`, {
        method: "PATCH",
        token,
        body: { questionText: trimmed, gmUserId: gmUserId || null },
      });
      // The admin PATCH response is a TelegramGameSummary, not the full PublicGameDetail
      // (it has no voters) — keep the voters/comments this page already loaded.
      onSaved({ ...game, ...data.game });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        {t("admin.gameTitleLabel")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        {t("admin.gameGmLabel")}
        <select value={gmUserId} onChange={(e) => setGmUserId(e.target.value)} disabled={busy || !users}>
          <option value="">{t("admin.noGm")}</option>
          {users?.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !title.trim()} onClick={save}>
          {t("admin.save")}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export function GameDetail() {
  const { t, i18n } = useTranslation();
  const { pollId } = useParams<{ pollId: string }>();
  const { idToken, isAdmin } = useAuth();
  const [game, setGame] = useState<PublicGameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!pollId) return;
    apiFetch<{ game: PublicGameDetail }>(`/game-log/${pollId}`, { token: idToken })
      .then((data) => setGame(data.game))
      .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")));
  }, [pollId, idToken, t]);

  return (
    <PageShell>
      <Link to="/game-log" className="eyebrow text-ink-muted hover:text-accent">
        ← {t("gameLog.title")}
      </Link>

      {error && <p className="mt-6 text-accent">{error}</p>}
      {!game && !error && <p className="mt-6 text-ink-muted">{t("common.loading")}</p>}

      {game && (
        <>
          <div className="mt-6 flex items-start justify-between gap-4">
            <h1 className="page-title">{formatGameTitle(game.questionText)}</h1>
            {isAdmin && !editing && (
              <button
                type="button"
                aria-label={t("admin.editGame")}
                title={t("admin.editGame")}
                onClick={() => setEditing(true)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border text-ink-muted hover:border-accent hover:text-accent"
              >
                <EditIcon />
              </button>
            )}
          </div>

          {editing ? (
            <GameEditForm
              game={game}
              token={idToken}
              onSaved={(updated) => {
                setGame(updated);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-ink-muted">
              <span>{new Date(game.createdAt).toLocaleDateString(i18n.language, { dateStyle: "long" })}</span>
              <span>
                {t("gameDetail.dm")} <span className="font-medium text-ink">{game.gmDisplayName}</span>
              </span>
              {game.averageScore !== null && (
                <span className="inline-flex items-center gap-2">
                  {t("gameDetail.average")}
                  <span className="rounded-md bg-band px-2 py-1 font-numeric text-sm font-bold tracking-[-0.02em] text-band-accent tabular-nums">
                    {game.averageScore.toFixed(1)}
                  </span>
                </span>
              )}
            </div>
          )}

          <h2 className="mt-10 text-xl font-bold">{t("gameDetail.voters")}</h2>
          {game.voters.length === 0 ? (
            <p className="mt-3 text-ink-muted">{t("gameDetail.noVotes")}</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
              {game.voters.map((voter, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-b-0"
                >
                  <span className="min-w-0 truncate">{voter.displayName}</span>
                  <span className="flex-shrink-0 font-numeric text-sm font-bold tabular-nums">
                    {voter.rating}
                    <span className="font-body font-normal text-ink-muted"> / 10</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {pollId && <Comments pollId={pollId} />}
        </>
      )}
    </PageShell>
  );
}
