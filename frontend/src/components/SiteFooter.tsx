import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CLUB_TELEGRAM_URL } from "../lib/club";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="max-w-[38ch]">
          <p className="font-display text-lg font-bold">{t("nav.brand")}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("footer.blurb")}</p>
          <a
            href={CLUB_TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block font-semibold"
          >
            {t("footer.telegram")} →
          </a>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/game-log" className="text-ink-muted hover:text-accent">{t("nav.gameLog")}</Link>
          <Link to="/game-masters" className="text-ink-muted hover:text-accent">{t("nav.gameMasters")}</Link>
          <Link to="/game-systems" className="text-ink-muted hover:text-accent">{t("nav.games")}</Link>
          <Link to="/statistics" className="text-ink-muted hover:text-accent">{t("nav.statistics")}</Link>
          <Link to="/about" className="text-ink-muted hover:text-accent">{t("nav.about")}</Link>
          <Link to="/signup" className="text-ink-muted hover:text-accent">{t("signup.title")}</Link>
        </nav>
      </div>
    </footer>
  );
}
