import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";

export function GameMasters() {
  const { t } = useTranslation();
  const [gms, setGms] = useState<PublicGameMaster[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ gameMasters: PublicGameMaster[] }>("/game-masters")
      .then((data) => setGms(data.gameMasters))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <h1>{t("gameMasters.title")}</h1>
      {error && <p className="error-text">{error}</p>}
      {!gms && !error && <p className="muted">{t("common.loading")}</p>}
      {gms?.length === 0 && <p className="muted">{t("gameMasters.noneListed")}</p>}
      {gms?.map((gm) => (
        <Link key={gm.userId} to={`/game-masters/${gm.userId}`} className="card"
          style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <img
            src={gm.profilePictureUrl ?? "/default-avatar.svg"}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
          <div>
            <strong>{gm.firstName} {gm.lastName}</strong>
            <p className="muted" style={{ margin: 0 }}>
              {gm.bio ? gm.bio.slice(0, 100) : t("gameMasters.noBio")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
