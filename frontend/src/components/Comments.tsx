import { useEffect, useState } from "react";
import type { GameComment } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function Comments({ gameId }: { gameId: string }) {
  const { idToken } = useAuth();
  const [comments, setComments] = useState<GameComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  function load() {
    apiFetch<{ comments: GameComment[] }>(`/games/${gameId}/comments`)
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message));
  }

  useEffect(load, [gameId]);

  async function submit() {
    if (!draft.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await apiFetch(`/games/${gameId}/comments`, {
        method: "POST",
        token: idToken,
        body: { text: draft.trim() },
      });
      setDraft("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="card">
      <h2>Comments</h2>
      {error && <p className="error-text">{error}</p>}
      {!comments && <p className="muted">Loading…</p>}
      {comments?.length === 0 && <p className="muted">No comments yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {comments?.map((comment) => (
          <div key={comment.commentId}>
            <strong>{comment.displayName}</strong>{" "}
            <span className="muted">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
            <p style={{ margin: "0.25rem 0 0" }}>{comment.text}</p>
          </div>
        ))}
      </div>

      {idToken ? (
        <div style={{ marginTop: "1rem" }}>
          <textarea
            rows={3}
            style={{ width: "100%" }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share your thoughts on this session…"
          />
          <div>
            <button disabled={posting || !draft.trim()} onClick={submit}>
              Post Comment
            </button>
          </div>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Log in as a club member to post a comment.
        </p>
      )}
    </div>
  );
}
