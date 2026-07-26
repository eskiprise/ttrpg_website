import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Game, GameSystem, PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Home() {
  const { t, i18n } = useTranslation();
  const [systems, setSystems] = useState<GameSystem[]>([]);
  const [gms, setGms] = useState<PublicGameMaster[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    apiFetch<{ systems: GameSystem[] }>("/game-systems").then((d) => setSystems(d.systems));
    apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters").then((d) => setGms(d.gameMasters));
    apiFetch<{ games: Game[] }>("/games").then((d) => setGames(d.games));
  }, []);

  const latestGame = games[0];
  const recentGames = games.slice(0, 4);

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
            {games.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-bold text-accent">
                <span className="font-mono tabular-nums">{games.length}</span>
                {t("home.eyebrow", { count: games.length })}
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
              <p className="mt-2 text-xs font-bold tracking-wide text-accent-2 uppercase">{latestGame.systemName}</p>
              <h3 className="mt-1 font-display text-xl font-bold">{latestGame.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {latestGame.date} · {t("gameLog.dm")} {latestGame.dmDisplayName}
              </p>
            </div>
          )}
        </div>
      </section>

      {(games.length > 0 || gms.length > 0 || systems.length > 0) && (
        <div className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="font-mono text-3xl font-bold tabular-nums">{games.length}</div>
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
            <h2 className="text-2xl font-bold">{t("home.recentSessions")}</h2>
            <Link to="/game-log" className="text-sm font-semibold text-accent hover:underline">
              {t("home.seeAllGameLog")} →
            </Link>
          </div>
          {recentGames.length === 0 ? (
            <p className="text-ink-muted">{t("home.noSessionsYet")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              {recentGames.map((game) => (
                <Link
                  key={game.gameId}
                  to={`/game-log/${game.gameId}`}
                  className="flex flex-col gap-1 border-b border-border px-6 py-4 last:border-b-0 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div>
                    <strong>{game.title}</strong>
                    <p className="text-sm text-ink-muted">
                      {game.date} · {game.systemName} · {t("gameLog.dm")} {game.dmDisplayName}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-ink-muted">
                    {new Date(game.date).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-12">
          <div>
            <h2 className="text-xl font-bold text-bg">{t("home.newHereTitle")}</h2>
            <p className="mt-1 max-w-[40ch] text-sm text-bg/75">
              {t("home.newHereBefore")} {t("home.newHereAfter")}
            </p>
          </div>
          <Link to="/signup">
            <button type="button" className="bg-accent text-accent-ink hover:bg-accent-2">
              {t("home.newHereLink")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
