import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PersonalStats } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

function GameRow({ gameId, title, date, systemName }: { gameId: string; title: string; date: string; systemName: string }) {
  return (
    <Link
      to={`/game-log/${gameId}`}
      className="block rounded-lg border border-border bg-surface p-4 hover:bg-surface-2"
    >
      <strong className="text-ink">{title}</strong>
      <p className="mt-1 text-sm text-ink-muted">{date} · {systemName}</p>
    </Link>
  );
}

export function Stats() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ stats: PersonalStats }>("/me/stats", { token: idToken })
      .then((data) => setStats(data.stats))
      .catch((err) => setError(err.message));
  }, [idToken]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("stats.title")}</h1>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!stats && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      {stats && (
        <>
          <p className="mt-2 text-ink-muted">
            {t("stats.gamesDmdCount", { count: stats.gamesDmd.length })} ·{" "}
            {t("stats.gamesPlayedCount", { count: stats.gamesPlayed.length })}
          </p>

          <h2 className="mt-8 text-xl font-bold">{t("stats.gamesDmd")}</h2>
          <div className="mt-4 flex flex-col gap-3">
            {stats.gamesDmd.length === 0 && <p className="text-ink-muted">{t("stats.noneYet")}</p>}
            {stats.gamesDmd.map((g) => (
              <GameRow key={g.gameId} gameId={g.gameId} title={g.title} date={g.date} systemName={g.systemName} />
            ))}
          </div>

          <h2 className="mt-8 text-xl font-bold">{t("stats.gamesPlayed")}</h2>
          <div className="mt-4 flex flex-col gap-3">
            {stats.gamesPlayed.length === 0 && <p className="text-ink-muted">{t("stats.noneYet")}</p>}
            {stats.gamesPlayed.map((g) => (
              <GameRow key={g.gameId} gameId={g.gameId} title={g.title} date={g.date} systemName={g.systemName} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
