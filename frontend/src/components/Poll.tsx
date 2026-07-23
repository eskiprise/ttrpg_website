import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PollResults } from "@ttrpg-club/shared";
import { POLL_RATING_MAX, POLL_RATING_MIN } from "@ttrpg-club/shared";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import "./Poll.css";

const RATINGS = Array.from(
  { length: POLL_RATING_MAX - POLL_RATING_MIN + 1 },
  (_, i) => POLL_RATING_MIN + i
);

export function Poll({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [results, setResults] = useState<PollResults | null>(null);
  const [notVotedYet, setNotVotedYet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchResults() {
    setBusy(true);
    setError(null);
    setNotVotedYet(false);
    try {
      const data = await apiFetch<{ results: PollResults }>(
        `/games/${gameId}/poll-results`,
        { token: idToken }
      );
      setResults(data.results);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNotVotedYet(true);
      } else {
        setError(err instanceof Error ? err.message : t("common.somethingWrong"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function vote(rating: number) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/games/${gameId}/poll-vote`, {
        method: "POST",
        token: idToken,
        body: { rating },
      });
      await fetchResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  if (!idToken) {
    return (
      <div className="card">
        <h2>{t("poll.title")}</h2>
        <p className="muted">{t("poll.loginPrompt")}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>{t("poll.title")}</h2>
      <div className="poll-options">
        {RATINGS.map((rating) => (
          <button
            key={rating}
            className={results?.yourRating === rating ? "" : "secondary"}
            disabled={busy}
            onClick={() => vote(rating)}
          >
            {rating}
          </button>
        ))}
        <button className="secondary" disabled={busy} onClick={fetchResults}>
          {t("poll.viewResults")}
        </button>
      </div>

      {notVotedYet && (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          {t("poll.voteToSeeResults")}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {results && (
        <div className="poll-results">
          <p className="muted">{t("poll.votes", { count: results.totalVotes })}</p>
          {RATINGS.map((rating) => {
            const count = results.counts[rating - POLL_RATING_MIN];
            const pct = results.totalVotes ? Math.round((count / results.totalVotes) * 100) : 0;
            return (
              <div className="poll-bar-row" key={rating}>
                <span className="poll-bar-label">{rating}</span>
                <div className="poll-bar-track">
                  <div
                    className={rating === results.yourRating ? "poll-bar-fill mine" : "poll-bar-fill"}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="poll-bar-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
