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
    <div className="page">
      <h1>{t("gameSystems.title")}</h1>
      {error && <p className="error-text">{error}</p>}
      {!systems && !error && <p className="muted">{t("common.loading")}</p>}
      {systems?.map((system) => (
        <div key={system.systemId} className="card">
          <h2>{system.name}</h2>
          <p className="muted">{system.description}</p>
        </div>
      ))}
    </div>
  );
}
