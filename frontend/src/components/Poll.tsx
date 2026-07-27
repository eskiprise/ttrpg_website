import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PollResults, PollVoterEntry } from "@ttrpg-club/shared";
import { POLL_RATING_MAX, POLL_RATING_MIN } from "@ttrpg-club/shared";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const RATINGS = Array.from(
  { length: POLL_RATING_MAX - POLL_RATING_MIN + 1 },
  (_, i) => POLL_RATING_MIN + i
);

export function Poll({ gameId }: { gameId: string }) {
  const { t, i18n } = useTranslation();
  const { idToken } = useAuth();
  const [results, setResults] = useState<PollResults | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [voters, setVoters] = useState<PollVoterEntry[] | null>(null);
  const [votersBusy, setVotersBusy] = useState(false);
  const [notVotedYet, setNotVotedYet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchResults(showNotVotedPrompt: boolean) {
    setBusy(true);
    setError(null);
    if (showNotVotedPrompt) setNotVotedYet(false);
    try {
      const data = await apiFetch<{ results: PollResults }>(
        `/games/${gameId}/poll-results`,
        { token: idToken }
      );
      setResults(data.results);
      setHasVoted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setHasVoted(false);
        if (showNotVotedPrompt) setNotVotedYet(true);
      } else {
        setError(err instanceof Error ? err.message : t("common.somethingWrong"));
      }
    } finally {
      setBusy(false);
    }
  }

  // Silently check on load whether this member has already voted, so a page
  // reload shows the results straight away instead of asking to vote again.
  useEffect(() => {
    if (idToken) void fetchResults(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, idToken]);

  async function vote(rating: number) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/games/${gameId}/poll-vote`, {
        method: "POST",
        token: idToken,
        body: { rating },
      });
      setEditing(false);
      setVoters(null);
      await fetchResults(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function loadVoters() {
    setVotersBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ voters: PollVoterEntry[] }>(
        `/games/${gameId}/poll-voters`,
        { token: idToken }
      );
      setVoters(data.voters);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setVotersBusy(false);
    }
  }

  if (!idToken) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        <h2 className="text-xl font-bold">{t("poll.title")}</h2>
        <p className="mt-2 text-ink-muted">{t("poll.loginPrompt")}</p>
      </div>
    );
  }

  const showVotingButtons = hasVoted !== true || editing;

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("poll.title")}</h2>

      {showVotingButtons && (
        <div className="mt-4 flex flex-wrap gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              className={`min-w-10 ${results?.yourRating === rating ? "" : "secondary"}`}
              disabled={busy}
              onClick={() => vote(rating)}
            >
              {rating}
            </button>
          ))}
          <button type="button" className="secondary" disabled={busy} onClick={() => fetchResults(true)}>
            {t("poll.viewResults")}
          </button>
          {editing && (
            <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(false)}>
              {t("poll.cancel")}
            </button>
          )}
        </div>
      )}

      {notVotedYet && <p className="mt-3 text-ink-muted">{t("poll.voteToSeeResults")}</p>}
      {error && <p className="mt-3 text-accent">{error}</p>}

      {results && hasVoted && !editing && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-ink-muted">{t("poll.votes", { count: results.totalVotes })}</p>
            <div className="flex gap-2">
              <button type="button" className="secondary" onClick={() => setEditing(true)}>{t("poll.edit")}</button>
              <button
                type="button"
                className="secondary"
                disabled={votersBusy}
                onClick={() => (voters ? setVoters(null) : loadVoters())}
              >
                {voters ? t("poll.hideVoters") : t("poll.whoVoted")}
              </button>
            </div>
          </div>
          {RATINGS.map((rating) => {
            const count = results.counts[rating - POLL_RATING_MIN];
            const pct = results.totalVotes ? Math.round((count / results.totalVotes) * 100) : 0;
            return (
              <div className="flex items-center gap-2" key={rating}>
                <span className="w-6 text-right text-ink-muted">{rating}</span>
                <div className="h-[0.9rem] flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full ${rating === results.yourRating ? "bg-accent" : "bg-accent/45"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-ink-muted">{pct}%</span>
              </div>
            );
          })}

          {voters && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
              {voters.map((v) => (
                <div key={v.userId} className="flex justify-between gap-3 text-sm">
                  <span>{v.displayName}</span>
                  <span className="font-bold text-accent">{v.rating}/10</span>
                  <span className="text-ink-muted">{new Date(v.votedAt).toLocaleString(i18n.language)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
