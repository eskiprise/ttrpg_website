import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameSystemDetail as GameSystemDetailData } from "@ttrpg-club/shared";
import { ApiError, apiFetch } from "../lib/api";
import { CLUB_TELEGRAM_URL } from "../lib/club";
import { PageShell } from "../components/PageShell";
import { StatTile } from "../components/StatTile";
import { SystemCover } from "../components/SystemCover";
import { GameRowList } from "../components/GameRow";

/** Enough to show the system is alive without a wall of rows; the rest is one tap away. */
const INITIAL_GAMES_SHOWN = 10;

export function GameSystemDetail() {
  const { t } = useTranslation();
  const { systemId } = useParams<{ systemId: string }>();
  const [data, setData] = useState<GameSystemDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllGames, setShowAllGames] = useState(false);

  useEffect(() => {
    if (!systemId) return;
    setData(null);
    setError(null);
    setShowAllGames(false);
    apiFetch<GameSystemDetailData>(`/game-systems/${systemId}`)
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError && err.status === 404 ? t("gameSystemDetail.notFound") : err.message)
      );
  }, [systemId, t]);

  const system = data?.system;
  const games = data?.games ?? [];
  const visibleGames = showAllGames ? games : games.slice(0, INITIAL_GAMES_SHOWN);

  return (
    <PageShell width="wide">
      <Link to="/game-systems" className="eyebrow text-ink-muted hover:text-accent">
        ← {t("gameSystemDetail.back")}
      </Link>

      {error && <p className="mt-6 text-accent">{error}</p>}
      {!data && !error && <p className="mt-6 text-ink-muted">{t("common.loading")}</p>}

      {data && system && (
        <>
          <div className="mt-6 grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-12">
            <div className="aspect-[3/4] w-full max-w-[15rem] overflow-hidden rounded-xl border border-border bg-surface-2">
              <SystemCover system={system} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title [overflow-wrap:anywhere]">{system.name}</h1>
              {system.description && (
                <p className="mt-5 max-w-[62ch] text-lg leading-relaxed whitespace-pre-wrap">{system.description}</p>
              )}
              <div className="mt-8 grid max-w-md grid-cols-2 gap-4">
                <StatTile value={system.sessionCount} label={t("gameSystemDetail.sessionsPlayed", { count: system.sessionCount })} />
                <StatTile
                  value={data.averageScore !== null ? data.averageScore.toFixed(1) : "—"}
                  unit={data.averageScore !== null ? "/10" : undefined}
                  label={t("gameSystemDetail.averageRating")}
                />
              </div>
              {data.gameMasters.length > 0 && (
                <div className="mt-8">
                  <h2 className="section-title">{t("gameSystemDetail.gmsTitle")}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.gameMasters.map((gm) => (
                      <span
                        key={gm.displayName}
                        className="inline-flex items-baseline gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium"
                      >
                        {gm.displayName}
                        <span className="font-numeric text-xs font-bold text-accent tabular-nums">{gm.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <section className="mt-14">
            <h2 className="section-title">{t("gameSystemDetail.gamesTitle")}</h2>
            {games.length === 0 ? (
              <p className="mt-3 text-ink-muted">{t("gameSystemDetail.noGames")}</p>
            ) : (
              <div className="mt-4">
                <GameRowList games={visibleGames} />
                {games.length > INITIAL_GAMES_SHOWN && !showAllGames && (
                  <button type="button" className="secondary mt-4" onClick={() => setShowAllGames(true)}>
                    {t("gameSystemDetail.showAll", { count: games.length })}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* The page's job: turn "I like this system" into a message to the club. */}
          <section className="mt-14 rounded-xl bg-band p-8 text-band-ink sm:p-10">
            <h2 className="font-display text-[clamp(1.4rem,1.1rem+1.2vw,2rem)] leading-tight font-bold [overflow-wrap:anywhere]">
              {t("gameSystemDetail.ctaTitle", { name: system.name })}
            </h2>
            <p className="mt-3 max-w-[52ch] text-band-ink-muted">{t("gameSystemDetail.ctaBody")}</p>
            <a href={CLUB_TELEGRAM_URL} target="_blank" rel="noreferrer" className="mt-6 inline-block hover:no-underline">
              <button type="button" className="bg-band-accent text-band hover:bg-band-ink">
                {t("home.ctaPrimary")}
              </button>
            </a>
          </section>
        </>
      )}
    </PageShell>
  );
}
