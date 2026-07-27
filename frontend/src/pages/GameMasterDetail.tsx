import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

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

  if (error) return <div className="mx-auto max-w-3xl px-6 py-16"><p className="text-accent">{error}</p></div>;
  if (!gm) return <div className="mx-auto max-w-3xl px-6 py-16"><p className="text-ink-muted">{t("common.loading")}</p></div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center gap-6">
        {gm.profilePictureUrl ? (
          <img
            src={gm.profilePictureUrl}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-2xl font-bold text-accent">
            {initials(gm.firstName, gm.lastName)}
          </div>
        )}
        <h1 className="text-3xl font-bold">{gm.firstName} {gm.lastName}</h1>
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface p-6 whitespace-pre-wrap">
        {gm.bio || <span className="text-ink-muted">{t("gameMasterDetail.noBio")}</span>}
      </div>
    </div>
  );
}
