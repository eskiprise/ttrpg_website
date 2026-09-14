import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSystem } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";
import { Card } from "../components/Card";

export function GameSystems() {
  const { t } = useTranslation();
  const [systems, setSystems] = useState<GameSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ systems: GameSystem[] }>("/game-systems")
      .then((data) => setSystems(data.systems))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <PageShell width="wide">
      <h1 className="page-title">{t("gameSystems.title")}</h1>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!systems && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      {systems?.length === 0 && <p className="mt-4 text-ink-muted">{t("gameSystems.none")}</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {systems?.map((system) => (
          <Card key={system.systemId}>
            <h2 className="text-xl font-bold">{system.name}</h2>
            {system.description && <p className="mt-2 text-ink-muted">{system.description}</p>}
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
