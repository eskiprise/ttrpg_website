import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type {
  ClubStatistics,
  GameLogMonthlyCount,
  GameSystemListResponse,
  GameSystemWithCount,
  PublicGameMaster,
  TelegramGameSummary,
} from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatGameTitle } from "../lib/gameTitle";
import { truncate } from "../lib/text";
import { roundedThreshold } from "../lib/approx";
import { Band } from "../components/Band";
import { StatTile } from "../components/StatTile";
import { GamesPerMonthChart } from "../components/GamesPerMonthChart";
import { PageLoader } from "../components/PageLoader";
import { CLUB_MAPS_URL, CLUB_MAP_EMBED_URL, CLUB_TELEGRAM_URL } from "../lib/club";
import { useSeo } from "../hooks/useSeo";

const RECENT_SESSIONS_COUNT = 3;
const GM_PREVIEW_COUNT = 3;
/** The most-played systems get the dark chip — the concept's "lead" row. */
const LEAD_SYSTEMS = 5;

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

interface HomeData {
  systems: GameSystemWithCount[];
  gms: PublicGameMaster[];
  recentSessions: TelegramGameSummary[];
  gamesPerMonth: GameLogMonthlyCount[];
  stats: ClubStatistics | null;
}

const EMPTY_HOME_DATA: HomeData = { systems: [], gms: [], recentSessions: [], gamesPerMonth: [], stats: null };

/**
 * The longest the loading screen can stay up. Past this the page shows whatever has
 * arrived rather than hanging on a slow or failing API.
 */
const LOADER_MAX_MS = 6000;

/**
 * The last successful load. Coming back to Home within the same visit shows it at once
 * (and refreshes it quietly) instead of putting the loading screen up every time.
 */
let cachedHomeData: HomeData | null = null;

export function Home() {
  const { t, i18n } = useTranslation();
  const { idToken, loading: authLoading } = useAuth();
  useSeo({ title: t("seo.home.title"), description: t("seo.home.description"), path: "/" });
  const [data, setData] = useState<HomeData | null>(cachedHomeData);
  const ready = data !== null;
  const { systems, gms, recentSessions, gamesPerMonth, stats } = data ?? EMPTY_HOME_DATA;

  useEffect(() => {
    // Wait for the stored login to be restored, so the game log is fetched once with the
    // right token instead of twice.
    if (authLoading) return;
    let cancelled = false;
    const giveUp = window.setTimeout(() => {
      if (!cancelled) setData((prev) => prev ?? EMPTY_HOME_DATA);
    }, LOADER_MAX_MS);

    // allSettled: one failing endpoint costs its own section, never the whole page.
    Promise.allSettled([
      apiFetch<GameSystemListResponse>("/game-systems"),
      apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters"),
      // Public since the redesign — the headline figures are the pitch to a stranger.
      // The two tiles it feeds simply don't render if it fails (and it 401s until the
      // backend change is deployed), rather than the hero dying with them.
      apiFetch<{ statistics: ClubStatistics }>("/statistics"),
      apiFetch<{ games: TelegramGameSummary[]; gamesPerMonth: GameLogMonthlyCount[] }>(
        `/game-log?limit=${RECENT_SESSIONS_COUNT}&offset=0`,
        { token: idToken }
      ),
      // The webfonts too, so the headline doesn't re-flow when Literata arrives just
      // after the loading screen has faded.
      document.fonts?.ready,
    ]).then(([systemsRes, gmsRes, statsRes, logRes]) => {
      if (cancelled) return;
      window.clearTimeout(giveUp);
      const next: HomeData = {
        systems: systemsRes.status === "fulfilled" ? systemsRes.value.systems : [],
        gms: gmsRes.status === "fulfilled" ? gmsRes.value.gameMasters : [],
        stats: statsRes.status === "fulfilled" ? statsRes.value.statistics : null,
        recentSessions: logRes.status === "fulfilled" ? logRes.value.games : [],
        gamesPerMonth: logRes.status === "fulfilled" ? logRes.value.gamesPerMonth : [],
      };
      cachedHomeData = next;
      setData(next);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
    };
  }, [authLoading, idToken]);

  const totalSessions = gamesPerMonth.reduce((sum, m) => sum + m.count, 0);
  // Rounded here as everywhere outside a system's own page: "200+", not "237".
  const totalApprox = roundedThreshold(totalSessions);
  const seatsApprox = roundedThreshold(stats?.totalSeats ?? 0);

  return (
    // inert while the splash is up: keeps the page out of the tab order and away from
    // screen readers until the splash is gone. The splash portals out to <body>, so it
    // isn't inert itself.
    <div inert={!ready}>
      <PageLoader visible={!ready} />
      {/* ── Hero ───────────────────────────────────────────────── */}
      <Band tone="page">
        {/* grid-cols-1 = minmax(0, 1fr): without it the single mobile column sizes to the
            longest one-line session title in the card and pushes the page sideways. */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
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
          {/* whitespace-pre-line: the translation puts the count and "І це тільки початок."
              on separate lines, with a "\n" between them. */}
          <h2 className="mt-4 max-w-[24ch] text-[clamp(1.75rem,1.2rem+2.2vw,2.7rem)] leading-[1.1] font-bold tracking-[-0.02em] whitespace-pre-line text-band-ink">
            {totalApprox
              ? t("home.evidenceTitleApprox", { count: totalApprox })
              : t("home.evidenceTitle", { count: totalSessions })}
          </h2>
          <p className="mt-4 max-w-[52ch] text-band-ink-muted">{t("home.evidenceSub")}</p>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            <StatTile
              tone="band"
              value={totalApprox ? `${totalApprox}+` : totalSessions}
              label={t("home.statSessions")}
            />
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
              <StatTile
                tone="band"
                value={seatsApprox ? `${seatsApprox}+` : stats!.totalSeats}
                label={t("home.statSeats")}
              />
            )}
            {systems.length > 0 && (
              <StatTile tone="band" value={systems.length} label={t("home.statSystems")} />
            )}
          </div>

          <div className="mt-10">
            <GamesPerMonthChart
              data={gamesPerMonth}
              maxMonths={12}
              tone="band"
              title={t("home.growthTitle")}
            />
          </div>
        </Band>
      )}

      {/* ── Why come ───────────────────────────────────────────── */}
      <Band tone="page">
        <Eyebrow>{t("home.whyEyebrow")}</Eyebrow>
        <h2 className="mt-4 max-w-[24ch] text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
          {t("home.whyTitle")}
        </h2>
        <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="border-t-2 border-ink pt-4">
              <h3 className="text-lg font-bold">{t(`home.why${n}Title`)}</h3>
              <p className="mt-2 text-ink-muted">{t(`home.why${n}Body`)}</p>
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
            {systems.map((s, index) => {
              // sessionCount is missing if the backend predates it — then it's just names.
              const count = s.sessionCount ?? 0;
              const lead = index < LEAD_SYSTEMS && count > 0;
              // "30+" rather than "42" — the exact figure lives on the system's page.
              const approx = roundedThreshold(count);
              return (
                <Link
                  key={s.systemId}
                  to={`/game-systems/${s.systemId}`}
                  className={`inline-flex items-baseline gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors hover:no-underline ${
                    lead
                      ? "border-band bg-band text-band-ink hover:border-band-accent"
                      : "border-border bg-surface text-ink hover:border-accent"
                  }`}
                >
                  {s.name}
                  {count > 0 && (
                    <span
                      className={`font-numeric text-xs font-bold tabular-nums ${
                        lead ? "text-band-accent" : "text-accent"
                      }`}
                    >
                      {approx ? `${approx}+` : count}
                    </span>
                  )}
                </Link>
              );
            })}
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

      {/* ── Location ───────────────────────────────────────────── */}
      <Band tone="raised">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <Eyebrow>{t("home.locationEyebrow")}</Eyebrow>
            <h2 className="mt-4 text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em]">
              {t("home.locationTitle")}
            </h2>
            <p className="mt-4 max-w-[40ch] text-ink-muted">{t("home.locationSub")}</p>
            <a href={CLUB_MAPS_URL} target="_blank" rel="noreferrer" className="mt-6 inline-block hover:no-underline">
              <button type="button" className="secondary">
                {t("home.locationOpenMaps")}
              </button>
            </a>
          </div>
          {/* Always light-themed, like the calendar above — it's Google's own embed. */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
            <iframe
              src={CLUB_MAP_EMBED_URL}
              title={t("home.locationMapTitle")}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="block h-[22rem] w-full border-0 sm:h-[26rem]"
            />
          </div>
        </div>
      </Band>
    </div>
  );
}
