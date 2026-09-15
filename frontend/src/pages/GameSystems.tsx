import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GameSystemListResponse, GameSystemWithCount } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";
import { SystemCover } from "../components/SystemCover";

export function GameSystems() {
  const { t } = useTranslation();
  const [systems, setSystems] = useState<GameSystemWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<GameSystemListResponse>("/game-systems")
      .then((data) => setSystems(data.systems))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <PageShell width="full">
      <h1 className="page-title">{t("gameSystems.title")}</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">{t("gameSystems.intro")}</p>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!systems && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      {systems?.length === 0 && <p className="mt-4 text-ink-muted">{t("gameSystems.none")}</p>}

      {/* Already sorted most-played first by the API. */}
      <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {systems?.map((system) => (
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
            <p className="mt-0.5 text-sm text-ink-muted">
              {(system.sessionCount ?? 0) > 0
                ? t("gameSystems.sessions", { count: system.sessionCount })
                : t("gameSystems.notPlayedYet")}
            </p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
