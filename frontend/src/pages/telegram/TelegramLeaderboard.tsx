import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramLeaderboardEntry, TelegramLeaderboards } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";

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

export function TelegramLeaderboard() {
  const { t } = useTranslation();
  const { initData } = useTelegramApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    apiFetch<{ leaderboards: TelegramLeaderboards }>("/telegram/leaderboard", {
      method: "POST",
      body: { initData },
    })
      .then((data) => setState({ status: "ready", leaderboards: data.leaderboards }))
      .catch((err) =>
        setState({
          status: "error",
          message: err instanceof Error ? err.message : t("common.somethingWrong"),
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/telegram" className="text-sm text-ink-muted hover:text-accent">
        ← {t("telegramApp.back")}
      </Link>
      <h1 className="text-xl font-bold">{t("telegramApp.leaderboard")}</h1>

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
