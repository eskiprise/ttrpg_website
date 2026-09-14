import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type {
  ClubStatistics,
  GameLogMonthlyCount,
  GameSystem,
  PublicGameMaster,
  TelegramGameSummary,
} from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatGameTitle } from "../lib/gameTitle";
import { truncate } from "../lib/text";
import { Band } from "../components/Band";
import { StatTile } from "../components/StatTile";
import { GamesPerMonthChart } from "../components/GamesPerMonthChart";
import { CLUB_TELEGRAM_URL } from "../lib/club";

const RECENT_SESSIONS_COUNT = 3;
const GM_PREVIEW_COUNT = 3;
const SYSTEM_TAG_LIMIT = 18;

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function Eyebrow({ children, onBand = false }: { children: React.ReactNode; onBand?: boolean }) {
  return (
    <span
      className={`text-xs font-semibold tracking-[0.16em] uppercase ${
        onBand ? "text-band-accent" : "text-accent"
      }`}
    >
      {children}
    </span>
  );
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { idToken } = useAuth();
  const [systems, setSystems] = useState<GameSystem[]>([]);
  const [gms, setGms] = useState<PublicGameMaster[]>([]);
  const [recentSessions, setRecentSessions] = useState<TelegramGameSummary[]>([]);
  const [gamesPerMonth, setGamesPerMonth] = useState<GameLogMonthlyCount[]>([]);
  const [stats, setStats] = useState<ClubStatistics | null>(null);

  useEffect(() => {
    apiFetch<{ systems: GameSystem[] }>("/game-systems").then((d) => setSystems(d.systems));
    apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters").then((d) => setGms(d.gameMasters));
    // Public since the redesign — the headline figures are the pitch to a stranger.
    // Tolerates failure: the two tiles it feeds simply don't render, rather than the
    // hero dying with them (and it 401s until the backend change is deployed).
    apiFetch<{ statistics: ClubStatistics }>("/statistics")
      .then((d) => setStats(d.statistics))
      .catch(() => setStats(null));
  }, []);

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

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <Band tone="page">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <Eyebrow>{t("home.eyebrow")}</Eyebrow>
            <h1 className="mt-4 text-[clamp(2.25rem,1.3rem+4vw,4rem)] leading-[1.04] font-bold tracking-[-0.025em]">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-5 max-w-[38ch] text-lg text-ink-muted">{t("home.intro")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={CLUB_TELEGRAM_URL} target="_blank" rel="noreferrer">
                <button type="button">{t("home.ctaPrimary")}</button>
              </a>
              <Link to="/game-log">
                <button type="button" className="secondary">
                  {t("home.ctaSecondary")}
                </button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-muted">{t("home.reassure")}</p>
          </div>

          {recentSessions.length > 0 && (
            <aside className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
              <div className="flex items-baseline justify-between gap-4">
                <Eyebrow>{t("home.justPlayed")}</Eyebrow>
                <Link to="/game-log" className="text-sm font-semibold hover:underline">
                  {t("home.seeAllGameLog")} →
                </Link>
              </div>
              <div className="mt-4 flex flex-col">
                {recentSessions.map((game) => (
                  <Link
                    key={game.pollId}
                    to={`/game-log/${game.pollId}`}
                    className="flex items-center gap-3 border-t border-border py-3 text-ink first:border-t-0 first:pt-0 hover:no-underline"
                  >
                    {game.averageScore !== null && (
                      <span className="flex-shrink-0 rounded-md bg-band px-1.5 py-1 font-numeric text-xs font-bold tracking-[-0.02em] text-band-accent tabular-nums">
                        {game.averageScore.toFixed(1)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {formatGameTitle(game.questionText)}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {t("gameLog.dm")} {game.gmDisplayName} ·{" "}
                        {new Date(game.createdAt).toLocaleDateString(i18n.language, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </aside>
          )}
        </div>
      </Band>

      {/* ── Evidence ───────────────────────────────────────────── */}
      {totalSessions > 0 && (
        <Band tone="dark">
          <Eyebrow onBand>{t("home.evidenceEyebrow")}</Eyebrow>
          <h2 className="mt-4 max-w-[20ch] text-[clamp(1.75rem,1.2rem+2.2vw,2.7rem)] leading-[1.1] font-bold tracking-[-0.02em] text-band-ink">
            {t("home.evidenceTitle", { count: totalSessions })}
          </h2>
          <p className="mt-4 max-w-[52ch] text-band-ink-muted">{t("home.evidenceSub")}</p>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            <StatTile tone="band" value={totalSessions} label={t("home.statSessions")} />
            {stats?.averageScore != null && (
              <StatTile
                tone="band"
                value={stats.averageScore.toFixed(1)}
                unit="/10"
                label={t("home.statAverage")}
              />
            )}
            {/* `> 0` also covers the field being absent entirely, which it is when a
                newer frontend is live against a backend that predates totalSeats. */}
            {(stats?.totalSeats ?? 0) > 0 && (
              <StatTile tone="band" value={stats!.totalSeats} label={t("home.statSeats")} />
            )}
            {systems.length > 0 && (
              <StatTile tone="band" value={systems.length} label={t("home.statSystems")} />
            )}
          </div>

          <div className="mt-10">
            <GamesPerMonthChart
              data={gamesPerMonth}
              maxMonths={18}
              tone="band"
              title={t("home.growthTitle")}
              legend={t("home.growthLegend", {
                from: gamesPerMonth[0]?.count ?? 0,
                peak: Math.max(...gamesPerMonth.map((m) => m.count)),
              })}
            />
          </div>
        </Band>
      )}

      {/* ── Newcomer objections ────────────────────────────────── */}
      <Band tone="page">
        <Eyebrow>{t("home.fearsEyebrow")}</Eyebrow>
        <h2 className="mt-4 max-w-[24ch] text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
          {t("home.fearsTitle")}
        </h2>
        <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="border-t-2 border-ink pt-4">
              <h3 className="text-lg font-bold">{t(`home.fear${n}Title`)}</h3>
              <p className="mt-2 text-ink-muted">{t(`home.fear${n}Body`)}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* ── Recent sessions ────────────────────────────────────── */}
      <Band tone="raised">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>{t("home.recentEyebrow")}</Eyebrow>
            <h2 className="mt-3 text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
              {t("home.recentTitle")}
            </h2>
          </div>
          <Link to="/game-log" className="text-sm font-semibold hover:underline">
            {t("home.seeAllGameLog")} →
          </Link>
        </div>
        <p className="mt-4 max-w-[52ch] text-ink-muted">{t("home.recentSub")}</p>

        {recentSessions.length === 0 ? (
          <p className="mt-8 text-ink-muted">{t("home.noSessionsYet")}</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((game) => (
              <Link
                key={game.pollId}
                to={`/game-log/${game.pollId}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-5 text-ink transition-colors hover:border-accent hover:no-underline"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold tracking-[0.08em] text-accent uppercase">
                    {new Date(game.createdAt).toLocaleDateString(i18n.language, {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  {game.averageScore !== null && (
                    <span className="rounded-md bg-band px-1.5 py-1 font-numeric text-xs font-bold tracking-[-0.02em] text-band-accent tabular-nums">
                      {game.averageScore.toFixed(1)}
                    </span>
                  )}
                </div>
                <h3 className="text-lg leading-snug font-bold">
                  {formatGameTitle(game.questionText)}
                </h3>
                <p className="mt-auto text-sm text-ink-muted">
                  {t("gameLog.dm")} {game.gmDisplayName} ·{" "}
                  {t("gameLog.playerCount", { count: game.playerCount })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Band>

      {/* ── Systems ────────────────────────────────────────────── */}
      {systems.length > 0 && (
        <Band tone="page">
          <Eyebrow>{t("home.systemsEyebrow", { count: systems.length })}</Eyebrow>
          <h2 className="mt-4 max-w-[24ch] text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
            {t("home.systemsTitle")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-ink-muted">{t("home.systemsSub")}</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {systems.slice(0, SYSTEM_TAG_LIMIT).map((s) => (
              <Link
                key={s.systemId}
                to="/game-systems"
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:no-underline"
              >
                {s.name}
              </Link>
            ))}
            {systems.length > SYSTEM_TAG_LIMIT && (
              <Link
                to="/game-systems"
                className="rounded-full border border-transparent px-3.5 py-2 text-sm font-semibold"
              >
                {t("home.systemsMore", { count: systems.length - SYSTEM_TAG_LIMIT })} →
              </Link>
            )}
          </div>
        </Band>
      )}

      {/* ── Game masters ───────────────────────────────────────── */}
      {gms.length > 0 && (
        <Band tone="raised">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>{t("home.gmsEyebrow")}</Eyebrow>
              <h2 className="mt-3 text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
                {t("gameMasters.title")}
              </h2>
            </div>
            <Link to="/game-masters" className="text-sm font-semibold hover:underline">
              {t("home.seeAllGameMasters")} →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gms.slice(0, GM_PREVIEW_COUNT).map((gm) => (
              <Link
                key={gm.userId}
                to={`/game-masters/${gm.userId}`}
                className="flex gap-4 rounded-xl border border-border bg-bg p-5 text-ink transition-colors hover:border-accent hover:no-underline"
              >
                {gm.profilePictureUrl ? (
                  <img
                    src={gm.profilePictureUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-band font-display font-bold text-band-accent">
                    {initials(gm.firstName, gm.lastName)}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold">
                    {gm.firstName} {gm.lastName}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {gm.bio ? truncate(gm.bio, 90) : t("gameMasters.noBio")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Band>
      )}

      {/* ── Upcoming ───────────────────────────────────────────── */}
      <Band tone="page" width="wide">
        <Eyebrow>{t("home.upcomingEyebrow")}</Eyebrow>
        <h2 className="mt-4 text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
          {t("home.upcomingSessions")}
        </h2>
        <p className="mt-4 max-w-[52ch] text-ink-muted">{t("home.upcomingSub")}</p>
        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface p-2">
          {/* Agenda mode renders a single vertical list instead of a month grid — the
              grid's narrow day cells truncate event titles mid-word at every width,
              agenda mode just doesn't have that failure mode. The iframe is always
              light-themed regardless of the site's own theme; replacing it needs the
              Calendar API, which is separate work. */}
          <iframe
            src="https://calendar.google.com/calendar/embed?src=a06e3c9e0ef67ca9738ad9bb2143afbd4403677de38d1fda8ff7a658b9886734%40group.calendar.google.com&ctz=Europe%2FKiev&mode=AGENDA"
            title={t("home.upcomingSessions")}
            width="100%"
            height={420}
            style={{ border: 0 }}
            frameBorder="0"
            scrolling="no"
          />
        </div>
      </Band>

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <Band tone="dark">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <div>
            <Eyebrow onBand>{t("home.joinEyebrow")}</Eyebrow>
            <h2 className="mt-4 max-w-[20ch] text-[clamp(1.75rem,1.2rem+2.2vw,2.7rem)] leading-[1.1] font-bold tracking-[-0.02em] text-band-ink">
              {t("home.joinTitle")}
            </h2>
            <p className="mt-4 max-w-[46ch] text-band-ink-muted">{t("home.joinSub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={CLUB_TELEGRAM_URL} target="_blank" rel="noreferrer">
                <button type="button" className="bg-band-accent text-band hover:bg-band-ink">
                  {t("home.joinTelegram")}
                </button>
              </a>
              <Link to="/signup">
                <button
                  type="button"
                  className="border border-band-edge bg-transparent text-band-ink hover:bg-band-raised hover:text-band-ink"
                >
                  {t("home.joinForm")}
                </button>
              </Link>
            </div>
          </div>

          <dl className="flex flex-col">
            {(["When", "Where", "Price", "Age"] as const).map((k) => (
              <div
                key={k}
                className="flex gap-4 border-b border-band-edge py-3 last:border-b-0 last:pb-0"
              >
                <dt className="w-24 flex-shrink-0 text-xs font-semibold tracking-[0.14em] text-band-accent uppercase">
                  {t(`home.fact${k}`)}
                </dt>
                <dd className="text-sm text-band-ink">{t(`home.fact${k}Value`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Band>
    </div>
  );
}
