import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSystem } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";

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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("gameSystems.title")}</h1>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!systems && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      <div className="mt-8 flex flex-col gap-4">
        {systems?.map((system) => (
          <div key={system.systemId} className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-xl font-bold">{system.name}</h2>
            <p className="mt-2 text-ink-muted">{system.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
