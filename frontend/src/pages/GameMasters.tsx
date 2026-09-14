import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { truncate } from "../lib/text";
import { PageShell } from "../components/PageShell";

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
    <PageShell width="wide">
      <h1 className="page-title">{t("gameMasters.title")}</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">{t("gameMasters.intro")}</p>

      {error && <p className="mt-6 text-accent">{error}</p>}
      {!gms && !error && <p className="mt-6 text-ink-muted">{t("common.loading")}</p>}
      {gms?.length === 0 && <p className="mt-6 text-ink-muted">{t("gameMasters.noneListed")}</p>}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {gms?.map((gm) => (
          <Link
            key={gm.userId}
            to={`/game-masters/${gm.userId}`}
            className="flex gap-4 rounded-xl border border-border bg-surface p-5 text-ink transition-colors hover:border-accent hover:no-underline"
          >
            {gm.profilePictureUrl ? (
              <img
                src={gm.profilePictureUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-band font-display text-lg font-bold text-band-accent">
                {initials(gm.firstName, gm.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-bold">
                {gm.firstName} {gm.lastName}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {gm.bio ? truncate(gm.bio, 110) : t("gameMasters.noBio")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
