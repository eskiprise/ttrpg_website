import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem, MediaListResponse } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { PageShell } from "../components/PageShell";
import { Band } from "../components/Band";
import { MediaCarousel } from "../components/MediaCarousel";

export function About() {
  const { t } = useTranslation();
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    apiFetch<MediaListResponse>("/media")
      .then((data) => setMedia(data.items))
      .catch(() => setMedia([])); // the page still works fine with just the text
  }, []);

  return (
    <div>
      <PageShell>
        <h1 className="page-title">{t("about.title")}</h1>
        <p className="mt-6 max-w-[60ch] text-lg text-ink-muted">{t("about.body")}</p>
      </PageShell>

      {media.length > 0 && (
        <Band tone="dark">
          <span className="eyebrow text-band-accent">{t("about.galleryEyebrow")}</span>
          <h2 className="mt-3 max-w-[24ch] text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)] leading-[1.12] font-bold tracking-[-0.02em] text-band-ink">
            {t("about.galleryTitle")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-band-ink-muted">{t("about.gallerySub")}</p>
          <div className="mt-8">
            <MediaCarousel items={media} />
          </div>
        </Band>
      )}
    </div>
  );
}
