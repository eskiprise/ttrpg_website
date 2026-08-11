import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramLeaderboardEntry, TelegramLeaderboards } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";
import { useRunOnVisible } from "./useRefetchOnVisible";

const TOP_COUNT = 10;

/** Medals for the top three places, plain numbers below that. */
const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function PlaceBadge({ place }: { place: number }) {
  const medal = MEDALS[place];
  if (medal) {
    // aria-hidden + the visible place number in the label keeps this readable for
    // screen readers, which would otherwise announce the raw emoji name.
    return (
      <span className="w-8 shrink-0 text-center text-xl" aria-hidden="true">
        {medal}
      </span>
    );
  }
  return (
    <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums text-ink-muted">
      {place}
    </span>
  );
}

function LeaderboardList({
  entries,
  gamesLabel,
}: {
  entries: TelegramLeaderboardEntry[];
  gamesLabel: (count: number) => string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return <p className="text-ink-muted">{t("telegramApp.leaderboardEmpty")}</p>;
  }

  const visible = expanded ? entries : entries.slice(0, TOP_COUNT);
  const hiddenCount = entries.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1">
        {visible.map((entry) => (
          <li
            key={entry.telegramUserId}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <PlaceBadge place={entry.place} />
            <span className="min-w-0 flex-1 truncate">
              <span className="sr-only">{t("telegramApp.placeLabel", { place: entry.place })} </span>
              {entry.displayName}
            </span>
            <span className="shrink-0 font-mono text-sm tabular-nums text-ink-muted">
              {gamesLabel(entry.gamesCount)}
            </span>
          </li>
        ))}
      </ol>

      {/* `secondary` is the app's existing outline-button style — it also supplies the
          text color, which the default filled <button> rule sets to var(--bg) and would
          otherwise render invisibly against a light surface. */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="secondary rounded-lg p-2 text-sm font-semibold"
        >
          {t("telegramApp.leaderboardShowAll", { count: hiddenCount })}
        </button>
      )}
      {expanded && entries.length > TOP_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="secondary rounded-lg p-2 text-sm font-semibold"
        >
          {t("telegramApp.leaderboardShowLess")}
        </button>
      )}
    </div>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; leaderboards: TelegramLeaderboards };

type Period = "thisMonth" | "lastMonth" | "allTime" | "custom";

/** Local-time YYYY-MM-DD — the same shape the API's inclusive from/to bounds expect. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Full calendar month, `offset` months back from today (0 = current). Day 0 of the
 * following month is the last day of this one, which keeps month lengths and leap
 * years correct without any special-casing.
 */
function monthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: toIsoDate(first), to: toIsoDate(last) };
}

function monthLabel(offset: number, locale: string): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function TelegramLeaderboard() {
  const { t, i18n } = useTranslation();
  const { initData } = useTelegramApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Last range actually applied — reopening the app should refresh whatever the user
  // was looking at (including a custom range), not silently jump back to this month.
  const appliedRange = useRef<{ from?: string; to?: string }>(monthRange(0));
  const hasLoadedOnce = useRef(false);

  async function load(range: { from?: string; to?: string }) {
    appliedRange.current = range;
    // Only show the loading state on the very first fetch — a background refetch on
    // reopen shouldn't flash the lists away while it runs.
    if (!hasLoadedOnce.current) setState({ status: "loading" });
    try {
      const data = await apiFetch<{ leaderboards: TelegramLeaderboards }>("/telegram/leaderboard", {
        method: "POST",
        body: { initData, from: range.from, to: range.to },
      });
      hasLoadedOnce.current = true;
      setState({ status: "ready", leaderboards: data.leaderboards });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : t("common.somethingWrong"),
      });
    }
  }

  function selectPeriod(next: Period) {
    setPeriod(next);
    if (next === "thisMonth") void load(monthRange(0));
    else if (next === "lastMonth") void load(monthRange(-1));
    else if (next === "allTime") void load({});
    // "custom" waits for the user to pick dates and press Apply.
  }

  useEffect(() => {
    void load(monthRange(0)); // default view: the current month
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRunOnVisible(() => {
    void load(appliedRange.current);
  }, []);

  const TABS: { key: Period; label: string }[] = [
    { key: "thisMonth", label: monthLabel(0, i18n.language) },
    { key: "lastMonth", label: monthLabel(-1, i18n.language) },
    { key: "allTime", label: t("telegramApp.leaderboardAllTime") },
    { key: "custom", label: t("telegramApp.leaderboardCustomRange") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link to="/telegram" className="text-sm text-ink-muted hover:text-accent">
        ← {t("telegramApp.back")}
      </Link>
      <h1 className="text-xl font-bold">{t("telegramApp.leaderboard")}</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={period === tab.key}
            onClick={() => selectPeriod(tab.key)}
            // first-letter (not `capitalize`) because Intl returns month names
            // lowercased in Ukrainian — `capitalize` would also uppercase the "р."
            // year marker and every word of the translated labels.
            className={
              period === tab.key
                ? "rounded-lg px-3 py-1.5 text-sm font-semibold first-letter:uppercase"
                : "secondary rounded-lg px-3 py-1.5 text-sm font-semibold first-letter:uppercase"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm">
            {t("statistics.from")}
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("statistics.to")}
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
          <button
            type="button"
            onClick={() => void load({ from: customFrom || undefined, to: customTo || undefined })}
          >
            {t("statistics.apply")}
          </button>
        </div>
      )}

      {state.status === "loading" && <p className="text-ink-muted">{t("common.loading")}</p>}
      {state.status === "error" && <p className="text-accent">{state.message}</p>}

      {state.status === "ready" && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("telegramApp.leaderboardPlayers")}</h2>
            <LeaderboardList
              entries={state.leaderboards.players}
              gamesLabel={(count) => t("telegramApp.gamesPlayedCount", { count })}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("telegramApp.leaderboardGameMasters")}</h2>
            <LeaderboardList
              entries={state.leaderboards.gameMasters}
              gamesLabel={(count) => t("telegramApp.gamesConductedCount", { count })}
            />
          </section>
        </>
      )}
    </div>
  );
}
