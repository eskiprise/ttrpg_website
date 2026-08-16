import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AchievementTier, TelegramAchievementStatus } from "@ttrpg-club/shared";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";
import { useRefetchOnVisible } from "./useRefetchOnVisible";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; achievements: TelegramAchievementStatus[] };

/**
 * Placeholder square icons — tier-colored background with the achievement's own emoji
 * centered on top. Swap for real `<img>` artwork later by replacing just this map.
 */
const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: "#b08d57",
  silver: "#b8bcc2",
  gold: "#d9b23c",
  platinum: "#7c6fdb",
};

function AchievementIcon({ tier, emoji, unlocked }: { tier: AchievementTier; emoji: string; unlocked: boolean }) {
  return (
    <div
      className="flex aspect-square w-14 shrink-0 items-center justify-center rounded-lg text-2xl"
      style={{ backgroundColor: TIER_COLORS[tier], opacity: unlocked ? 1 : 0.35 }}
    >
      {emoji}
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: TelegramAchievementStatus }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <AchievementIcon tier={achievement.tier} emoji={achievement.emoji} unlocked={achievement.unlocked} />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${achievement.unlocked ? "" : "text-ink-muted"}`}>{achievement.title}</p>
        <p className="text-xs text-ink-muted">{achievement.description}</p>
        {achievement.unlocked ? (
          <p className="text-xs text-ink-muted">
            {t("telegramApp.achievementUnlockedAt", {
              date: achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : "",
            })}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">
            {t("telegramApp.achievementProgress", { progress: achievement.progress, threshold: achievement.threshold })}
          </p>
        )}
      </div>
    </div>
  );
}

export function TelegramAchievements() {
  const { t } = useTranslation();
  const { initData } = useTelegramApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const hasLoadedOnce = useRef(false);

  useRefetchOnVisible(() => {
    if (!hasLoadedOnce.current) setState({ status: "loading" });
    apiFetch<{ achievements: TelegramAchievementStatus[] }>("/telegram/achievements", {
      method: "POST",
      body: { initData },
    })
      .then((data) => {
        hasLoadedOnce.current = true;
        setState({ status: "ready", achievements: data.achievements });
      })
      .catch((err) =>
        setState({ status: "error", message: err instanceof Error ? err.message : t("common.somethingWrong") })
      );
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/telegram" className="text-sm text-ink-muted hover:text-accent">
        ← {t("telegramApp.back")}
      </Link>
      <h1 className="text-xl font-bold">{t("telegramApp.achievements")}</h1>

      {state.status === "loading" && <p className="text-ink-muted">{t("common.loading")}</p>}
      {state.status === "error" && <p className="text-accent">{state.message}</p>}
      {state.status === "ready" && (
        <div className="flex flex-col gap-2">
          {state.achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  );
}
