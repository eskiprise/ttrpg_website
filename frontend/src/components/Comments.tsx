import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameComment } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function Comments({ pollId }: { pollId: string }) {
  const { t, i18n } = useTranslation();
  const { idToken } = useAuth();
  const [comments, setComments] = useState<GameComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  function load() {
    apiFetch<{ comments: GameComment[] }>(`/game-log/${pollId}/comments`)
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message));
  }

  useEffect(load, [pollId]);

  async function submit() {
    if (!draft.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await apiFetch(`/game-log/${pollId}/comments`, {
        method: "POST",
        token: idToken,
        body: { text: draft.trim() },
      });
      setDraft("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="text-xl font-bold">{t("comments.title")}</h2>
      {error && <p className="mt-3 text-accent">{error}</p>}
      {!comments && <p className="mt-3 text-ink-muted">{t("common.loading")}</p>}
      {comments?.length === 0 && <p className="mt-3 text-ink-muted">{t("comments.none")}</p>}

      {comments && comments.length > 0 && (
        <div className="mt-5 flex flex-col gap-5">
          {comments.map((comment) => (
            <article key={comment.commentId} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <strong className="font-semibold">{comment.displayName}</strong>
                <span className="text-xs text-ink-muted">
                  {new Date(comment.createdAt).toLocaleString(i18n.language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{comment.text}</p>
            </article>
          ))}
        </div>
      )}

      {idToken ? (
        <div className="mt-6">
          <textarea
            rows={3}
            className="w-full"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("comments.placeholder")}
          />
          <div className="mt-3">
            <button type="button" disabled={posting || !draft.trim()} onClick={submit}>
              {t("comments.post")}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-border p-5 text-ink-muted">
          <Link to="/login" className="font-semibold">
            {t("comments.loginLink")}
          </Link>{" "}
          {t("comments.loginPrompt")}
        </p>
      )}
    </section>
  );
}
