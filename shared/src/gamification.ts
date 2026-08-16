/**
 * Player leveling + achievements. Mirror of the write-side logic in
 * ttrpg_poll_bot/lambda_handler.py — XP is only ever awarded from there (the poll bot),
 * this file exists for display (Mini App) purposes and, for `applyXp`, future-proofing.
 * Keep LEVEL_THRESHOLDS/LEVEL_TITLES/ACHIEVEMENTS' thresholds in sync with the Python
 * copies (LEVEL_THRESHOLDS, GAMES_PLAYED_ACHIEVEMENT_THRESHOLDS,
 * FEEDBACK_GIVEN_ACHIEVEMENT_THRESHOLDS) if either side changes.
 */

export const LEVEL_UP_BASE_XP = 100;
export const LEVEL_UP_MULTIPLIER = 1.2;
export const MAX_PLAYER_LEVEL = 10;

export const XP_VOTE = 10;
export const XP_WEEKLY_BONUS = 5;
export const XP_FEEDBACK_BONUS = 2;
export const WEEKLY_BONUS_VOTES_REQUIRED = 2;

function computeLevelThresholds(): number[] {
  const thresholds = [LEVEL_UP_BASE_XP];
  while (thresholds.length < MAX_PLAYER_LEVEL - 1) {
    const prev = thresholds[thresholds.length - 1];
    thresholds.push(Math.floor((prev * LEVEL_UP_MULTIPLIER) / 10) * 10);
  }
  return thresholds;
}

/** XP needed for level N -> N+1; index 0 = 1->2 ... index 8 = 9->10. */
export const LEVEL_THRESHOLDS = computeLevelThresholds();

/** Applies gained XP, leveling up (possibly more than once) with overflow carried forward. Uncapped past MAX_PLAYER_LEVEL. */
export function applyXp(level: number, currentXp: number, gainedXp: number): { level: number; currentXp: number } {
  let lvl = level;
  let xp = currentXp + gainedXp;
  while (lvl < MAX_PLAYER_LEVEL) {
    const threshold = LEVEL_THRESHOLDS[lvl - 1];
    if (xp < threshold) break;
    xp -= threshold;
    lvl += 1;
  }
  return { level: lvl, currentXp: xp };
}

export interface LevelTitle {
  title: string;
  emoji: string;
}

/** Index 0 = level 1. Titles are placeholders the club will revise later. */
export const LEVEL_TITLES: LevelTitle[] = [
  { title: "Новорибулий", emoji: "🌱" },
  { title: "Шукач пригод", emoji: "🧭" },
  { title: "Мандрівник світами", emoji: "🗺" },
  { title: "Завсідник столу", emoji: "🎲" },
  { title: "Досвідчений гравець", emoji: "⚔️" },
  { title: "Ветеран пригод", emoji: "🛡" },
  { title: "Знавець історій", emoji: "📜" },
  { title: "Творець легенд", emoji: "✨" },
  { title: "Жива легенда", emoji: "🌟" },
  { title: "Ікона клубу", emoji: "👑" },
];

export type AchievementCategory = "gamesPlayed" | "feedbackGiven" | "level";
export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  threshold: number;
  title: string;
  /** Short explanation of what this counts and how to unlock it — shown alongside the title, since a title alone (e.g. "Вершина шляху") doesn't say what it's for. */
  description: string;
  emoji: string;
  /** Icon color tier — see Icons in the achievements section of the design plan. */
  tier: AchievementTier;
}

/** One-time badges — no XP. Titles/descriptions are placeholders, same as LEVEL_TITLES. */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: "games_played_1", category: "gamesPlayed", threshold: 1, title: "Початок покладено", description: "Зіграй свою першу гру", emoji: "🌱", tier: "bronze" },
  { id: "games_played_10", category: "gamesPlayed", threshold: 10, title: "Поціновувач ігор", description: "Зіграй 10 ігор", emoji: "🎲", tier: "silver" },
  { id: "games_played_50", category: "gamesPlayed", threshold: 50, title: "Хранитель пригод", description: "Зіграй 50 ігор", emoji: "🗺️", tier: "gold" },
  { id: "games_played_100", category: "gamesPlayed", threshold: 100, title: "Легенда за столом", description: "Зіграй 100 ігор", emoji: "👑", tier: "platinum" },
  { id: "feedback_given_1", category: "feedbackGiven", threshold: 1, title: "Перший відгук", description: "Залиш свій перший розгорнутий фідбек", emoji: "✍️", tier: "bronze" },
  { id: "feedback_given_10", category: "feedbackGiven", threshold: 10, title: "Голос спільноти", description: "Залиш 10 розгорнутих фідбеків", emoji: "📣", tier: "silver" },
  { id: "feedback_given_20", category: "feedbackGiven", threshold: 20, title: "Уважний слухач", description: "Залиш 20 розгорнутих фідбеків", emoji: "👂", tier: "gold" },
  { id: "feedback_given_50", category: "feedbackGiven", threshold: 50, title: "Майстер фідбеку", description: "Залиш 50 розгорнутих фідбеків", emoji: "🖋️", tier: "platinum" },
  { id: "max_level", category: "level", threshold: MAX_PLAYER_LEVEL, title: "Вершина шляху", description: "Досягни 10 рівня", emoji: "🏔️", tier: "platinum" },
];
