import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";

export function GameMasterDetail() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const [gm, setGm] = useState<PublicGameMaster | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    apiFetch<{ gameMaster: PublicGameMaster }>(`/game-masters/${userId}`)
      .then((data) => setGm(data.gameMaster))
      .catch((err) => setError(err.message));
  }, [userId]);

  if (error) return <div className="page"><p className="error-text">{error}</p></div>;
  if (!gm) return <div className="page"><p className="muted">{t("common.loading")}</p></div>;

  return (
    <div className="page">
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        <img
          src={gm.profilePictureUrl ?? "/default-avatar.svg"}
          alt=""
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <h1 style={{ margin: 0 }}>{gm.firstName} {gm.lastName}</h1>
      </div>
      <div className="card" style={{ marginTop: "1.5rem", whiteSpace: "pre-wrap" }}>
        {gm.bio || <span className="muted">{t("gameMasterDetail.noBio")}</span>}
      </div>
    </div>
  );
}
