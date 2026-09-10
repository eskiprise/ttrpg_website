import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { truncate } from "../lib/text";

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{t("gameMasters.title")}</h1>
      {error && <p className="mt-4 text-accent">{error}</p>}
      {!gms && !error && <p className="mt-4 text-ink-muted">{t("common.loading")}</p>}
      {gms?.length === 0 && <p className="mt-4 text-ink-muted">{t("gameMasters.noneListed")}</p>}
      <div className="mt-8 flex flex-col gap-4">
        {gms?.map((gm) => (
          <Link
            key={gm.userId}
            to={`/game-masters/${gm.userId}`}
            className="flex items-center gap-4 rounded-lg border border-border bg-surface p-6 hover:bg-surface-2"
          >
            {gm.profilePictureUrl ? (
              <img
                src={gm.profilePictureUrl}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-display font-bold text-accent">
                {initials(gm.firstName, gm.lastName)}
              </div>
            )}
            <div>
              <strong className="text-ink">{gm.firstName} {gm.lastName}</strong>
              <p className="mt-1 text-sm text-ink-muted">
                {gm.bio ? truncate(gm.bio, 100) : t("gameMasters.noBio")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
