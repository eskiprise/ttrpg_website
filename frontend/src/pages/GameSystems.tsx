import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameSystemListResponse, GameSystemWithCount } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";
import { SystemCover } from "../components/SystemCover";

/**
 * Systems we've genuinely played a lot get a cover card; the one-off and rare ones
 * would make a page of mostly-empty tiles, so they go in a compact list below.
 */
const FEATURED_FROM_GAMES = 11;

export function GameSystems() {
  const { t } = useTranslation();
  const [systems, setSystems] = useState<GameSystemWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<GameSystemListResponse>("/game-systems")
      .then((data) => setSystems(data.systems))
      .catch((err) => setError(err.message));
  }, []);

  /** Exact here, unlike the homepage — this page is the list of what we play. */
  function gamesLabel(count: number): string {
    return count === 0 ? t("gameSystems.notPlayedYet") : t("gameSystems.games", { count });
  }

  // Already sorted most-played first by the API.
  const featured = systems?.filter((s) => (s.sessionCount ?? 0) >= FEATURED_FROM_GAMES) ?? [];
  const rest = systems?.filter((s) => (s.sessionCount ?? 0) < FEATURED_FROM_GAMES) ?? [];

  return (
    <PageShell width="full">
      <h1 className="page-title">{t("gameSystems.title")}</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">{t("gameSystems.intro")}</p>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!systems && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      {systems?.length === 0 && <p className="mt-4 text-ink-muted">{t("gameSystems.none")}</p>}

      {featured.length > 0 && (
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((system) => (
            <Link
              key={system.systemId}
              to={`/game-systems/${system.systemId}`}
              className="group block min-w-0 text-ink hover:no-underline"
            >
              <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface-2 transition-transform duration-200 group-hover:-translate-y-1">
                <SystemCover system={system} />
              </div>
              <p className="mt-3 leading-snug font-bold [overflow-wrap:anywhere] group-hover:text-accent">
                {system.name}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">{gamesLabel(system.sessionCount ?? 0)}</p>
            </Link>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <section className="mt-14">
          <h2 className="section-title">{t("gameSystems.othersTitle")}</h2>
          <div className="mt-4 max-w-2xl overflow-hidden rounded-xl border border-border bg-surface">
            {rest.map((system) => (
              <Link
                key={system.systemId}
                to={`/game-systems/${system.systemId}`}
                className="flex items-center gap-3 border-b border-border px-4 py-3 text-ink transition-colors last:border-b-0 hover:bg-surface-2 hover:no-underline"
              >
                <span className="h-12 w-9 flex-shrink-0 overflow-hidden rounded-md border border-border">
                  <SystemCover system={system} size="thumb" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{system.name}</span>
                <span className="flex-shrink-0 text-sm text-ink-muted">
                  {gamesLabel(system.sessionCount ?? 0)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
