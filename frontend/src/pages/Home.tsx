import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type {
  GameLogMonthlyCount,
  GameSystem,
  PublicGameMaster,
  TelegramGameSummary,
} from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatGameTitle } from "../lib/gameTitle";

const RECENT_SESSIONS_COUNT = 3;

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { idToken } = useAuth();
  const [systems, setSystems] = useState<GameSystem[]>([]);
  const [gms, setGms] = useState<PublicGameMaster[]>([]);
  const [recentSessions, setRecentSessions] = useState<TelegramGameSummary[]>([]);
  const [gamesPerMonth, setGamesPerMonth] = useState<GameLogMonthlyCount[]>([]);

  useEffect(() => {
    apiFetch<{ systems: GameSystem[] }>("/game-systems").then((d) => setSystems(d.systems));
    apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters").then((d) => setGms(d.gameMasters));
  }, []);

  // Real session history lives in the Telegram-sourced tables — the 3 most recent,
  // reusing the endpoint built for the Game Log page. gamesPerMonth covers every
  // session ever logged (not just this page), so summing it gives the total count
  // for free, with no extra request.
  useEffect(() => {
    apiFetch<{ games: TelegramGameSummary[]; gamesPerMonth: GameLogMonthlyCount[] }>(
      `/game-log?limit=${RECENT_SESSIONS_COUNT}&offset=0`,
      { token: idToken }
    ).then((d) => {
      setRecentSessions(d.games);
      setGamesPerMonth(d.gamesPerMonth);
    });
  }, [idToken]);

  const totalSessions = gamesPerMonth.reduce((sum, m) => sum + m.count, 0);
  const latestGame = recentSessions[0];

  return (
    <div>
      {systems.length > 0 && (
        <div className="border-b border-border bg-surface-2">
          <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-6 py-3">
            {systems.map((s) => (
              <Link key={s.systemId} to="/game-systems" className="text-sm font-semibold whitespace-nowrap text-ink-muted hover:text-accent">
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {totalSessions > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-bold text-accent">
                <span className="font-mono tabular-nums">{totalSessions}</span>
                {t("home.eyebrow", { count: totalSessions })}
              </span>
            )}
            <h1 className="mt-4 max-w-[20ch] text-4xl leading-tight font-bold text-balance sm:text-5xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-4 max-w-[46ch] text-lg text-ink-muted">{t("home.intro")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/game-log">
                <button type="button">{t("home.exploreGameLog")}</button>
              </Link>
              <Link to="/game-masters">
                <button type="button" className="secondary">{t("home.exploreGameMasters")}</button>
              </Link>
            </div>
          </div>

          {latestGame && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">{t("home.latestSession")}</p>
              <h3 className="mt-1 font-display text-xl font-bold">{formatGameTitle(latestGame.questionText)}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {new Date(latestGame.createdAt).toLocaleDateString(i18n.language)} · {t("gameLog.dm")} {latestGame.gmDisplayName}
              </p>
            </div>
          )}
        </div>
      </section>

      {(totalSessions > 0 || gms.length > 0 || systems.length > 0) && (
        <div className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="font-mono text-3xl font-bold tabular-nums">{totalSessions}</div>
              <div className="mt-1 text-sm text-ink-muted">{t("home.statSessions")}</div>
            </div>
            <div className="border-l border-border text-center">
              <div className="font-mono text-3xl font-bold tabular-nums">{gms.length}</div>
              <div className="mt-1 text-sm text-ink-muted">{t("home.statGameMasters")}</div>
            </div>
            <div className="col-span-2 border-t border-border pt-4 text-center sm:col-span-1 sm:border-t-0 sm:border-l sm:pt-0">
              <div className="font-mono text-3xl font-bold tabular-nums">{systems.length}</div>
              <div className="mt-1 text-sm text-ink-muted">{t("home.statSystems")}</div>
            </div>
          </div>
        </div>
      )}

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">{t("gameMasters.title")}</h2>
            <Link to="/game-masters" className="text-sm font-semibold text-accent hover:underline">
              {t("home.seeAllGameMasters")} →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {gms.slice(0, 3).map((gm) => (
              <Link
                key={gm.userId}
                to={`/game-masters/${gm.userId}`}
                className="block rounded-lg border border-border bg-surface p-6"
              >
                {gm.profilePictureUrl ? (
                  <img
                    src={gm.profilePictureUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="mb-3 h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 font-display font-bold text-accent">
                    {initials(gm.firstName, gm.lastName)}
                  </div>
                )}
                <h3 className="font-semibold">{gm.firstName} {gm.lastName}</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  {gm.bio ? gm.bio.slice(0, 100) : t("gameMasters.noBio")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pt-0 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">{t("home.upcomingSessions")}</h2>
          </div>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-surface p-2">
            <iframe
              src="https://calendar.google.com/calendar/embed?src=a06e3c9e0ef67ca9738ad9bb2143afbd4403677de38d1fda8ff7a658b9886734%40group.calendar.google.com&ctz=Europe%2FKiev"
              title={t("home.upcomingSessions")}
              width="100%"
              height={600}
              style={{ border: 0 }}
              frameBorder="0"
              scrolling="no"
            />
          </div>
        </div>
      </section>

      <section className="px-6 pt-0 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">{t("home.recentSessions")}</h2>
            <Link to="/game-log" className="text-sm font-semibold text-accent hover:underline">
              {t("home.seeAllGameLog")} →
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <p className="text-ink-muted">{t("home.noSessionsYet")}</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              {recentSessions.map((game) => (
                <Link
                  key={game.pollId}
                  to={`/game-log/${game.pollId}`}
                  className="block rounded-lg border border-border bg-surface p-6 hover:bg-surface-2"
                >
                  <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">
                    {new Date(game.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                  </p>
                  <h3 className="mt-2 font-semibold">{formatGameTitle(game.questionText)}</h3>
                  <p className="mt-2 text-sm text-ink-muted">
                    {t("gameLog.dm")} {game.gmDisplayName}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("gameLog.playerCount", { count: game.playerCount })}
                    {game.averageScore !== null && ` · ${t("gameLog.average")} ${game.averageScore.toFixed(1)} / 10`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
