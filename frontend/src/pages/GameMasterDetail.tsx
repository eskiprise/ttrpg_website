import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PublicGameMaster } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";

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

  // One shell for all three states, rather than three copies of the container.
  return (
    <PageShell>
      <Link to="/game-masters" className="eyebrow text-ink-muted hover:text-accent">
        ← {t("gameMasters.title")}
      </Link>

      {error && <p className="mt-6 text-accent">{error}</p>}
      {!gm && !error && <p className="mt-6 text-ink-muted">{t("common.loading")}</p>}

      {gm && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            {gm.profilePictureUrl ? (
              <img
                src={gm.profilePictureUrl}
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-band font-display text-2xl font-bold text-band-accent">
                {initials(gm.firstName, gm.lastName)}
              </div>
            )}
            <h1 className="page-title">
              {gm.firstName} {gm.lastName}
            </h1>
          </div>
          <div className="mt-8 max-w-[62ch] text-lg leading-relaxed whitespace-pre-wrap">
            {gm.bio || <span className="text-ink-muted">{t("gameMasterDetail.noBio")}</span>}
          </div>
        </>
      )}
    </PageShell>
  );
}
