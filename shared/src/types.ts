import type { AchievementCategory, AchievementTier } from "./gamification";

export type Role = "player" | "dm" | "admin";

export const POLL_RATING_MIN = 1;
export const POLL_RATING_MAX = 10;

export interface User {
  userId: string; // Telegram user id, as a string
  firstName: string;
  lastName: string;
  /** Not collected via Telegram login — only ever set for a record created via the old signup flow. */
  email?: string;
  telegramOrViberContact: string;
  roles: Role[];
  bio?: string;
  profilePictureUrl?: string;
  createdAt: string;
}

export type PublicUserSummary = Pick<
  User,
  "userId" | "firstName" | "lastName" | "profilePictureUrl" | "roles"
>;

export interface PublicGameMaster {
  userId: string;
  firstName: string;
  lastName: string;
  bio: string;
  profilePictureUrl: string | null;
}

export type SignupRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SignupRequest {
  requestId: string;
  firstName: string;
  lastName: string;
  email: string;
  telegramOrViberContact: string;
  status: SignupRequestStatus;
  createdAt: string;
}

export interface GameSystem {
  systemId: string;
  name: string;
  description: string;
  displayIndex: number;
}

/** A comment on a Telegram-sourced game session (see TelegramGameSummary). */
export interface GameComment {
  commentId: string;
  pollId: string;
  userId: string; // Telegram user id, as a string
  displayName: string;
  text: string;
  createdAt: string;
}

export interface SiteSettings {
  anonymizeLoggedOutView: boolean;
}

export interface AvatarUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface TelegramRecentRating {
  pollId: string;
  questionText: string;
  rating: number;
  answeredAt: string;
}

export interface TelegramUserStats {
  telegramUserId: number;
  displayName: string;
  totalRatingsGiven: number;
  averageRatingGiven: number | null;
  recentRatings: TelegramRecentRating[];
  level: number;
  levelTitle: string;
  levelEmoji: string;
  currentXp: number;
  /** XP needed to reach the next level, or null if already at the max level. */
  xpForNextLevel: number | null;
}

/** One achievement, merged with the caller's own unlock status — see gamification.ts's ACHIEVEMENTS catalog. */
export interface TelegramAchievementStatus {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  tier: AchievementTier;
  threshold: number;
  unlocked: boolean;
  unlockedAt: string | null;
  /** The caller's current count toward `threshold` for this achievement's category. */
  progress: number;
}

/** One row in the "My Games Played" / "My Games Conducted" / "All Games" lists. */
export interface TelegramGameSummary {
  pollId: string;
  questionText: string;
  createdAt: string;
  gmDisplayName: string;
  playerCount: number;
  averageScore: number | null;
  /** The caller's own vote on this poll, or null if they didn't vote (or voted "see results"). */
  myRating: number | null;
}

export interface TelegramGameVoter {
  telegramUserId: number;
  displayName: string;
  rating: number;
  answeredAt: string;
}

/** The per-game drill-down: who voted what for a single session. */
export interface TelegramGameDetail extends TelegramGameSummary {
  voters: TelegramGameVoter[];
}

/** Same shape as TelegramGameVoter, but for the public (unauthenticated) game log — no reason to expose a raw Telegram user ID there. */
export interface PublicGameVoter {
  displayName: string;
  rating: number;
  answeredAt: string;
}

/** The public site's Game Log detail view — reuses TelegramGameSummary (myRating always null: an anonymous viewer has no rating of their own). */
export interface PublicGameDetail extends TelegramGameSummary {
  voters: PublicGameVoter[];
}

/** One month's session count, for the Game Log page's bar chart. `month` is "YYYY-MM". */
export interface GameLogMonthlyCount {
  month: string;
  count: number;
}

/** One row in a leaderboard list. */
export interface TelegramLeaderboardEntry {
  telegramUserId: number;
  displayName: string;
  gamesCount: number;
  /**
   * Standard competition ranking ("1224"): everyone on the same gamesCount shares a
   * place, and the next distinct score skips ahead by however many tied above it —
   * so two people tied for 1st are both 1st and the next is 3rd, never 2nd.
   */
  place: number;
}

/**
 * Both leaderboards, returned in full (not paginated) — at club scale these are tens
 * of rows, so the Mini App just shows the top 10 and expands the rest client-side
 * rather than making a second round trip.
 */
export interface TelegramLeaderboards {
  /** Most sessions played, by vote count. */
  players: TelegramLeaderboardEntry[];
  /** Most sessions run, by polls created. */
  gameMasters: TelegramLeaderboardEntry[];
}

export interface TelegramFeedbackSubmission {
  initData: string;
  pollId: string;
  adventureRating: number;
  tableRating: number;
  gmRating: number;
  selfRating: number;
  feedbackText?: string;
  revealIdentity: boolean;
}

export interface TelegramFeedbackEligibilityRequest {
  initData: string;
  pollId: string;
}

/**
 * Whether the caller may leave extended feedback on this poll: they must have a recorded
 * rating vote (`eligible`), and not have already submitted feedback for it (`alreadySubmitted`).
 */
export interface TelegramFeedbackEligibility {
  eligible: boolean;
  alreadySubmitted: boolean;
}

export interface LeaderboardEntry {
  telegramUserId: number;
  displayName: string;
  count: number;
}

export interface GameSpotlight {
  pollId: string;
  questionText: string;
  averageScore: number;
}

export interface RatingDistribution {
  /** counts[i] = number of individual votes with rating i+1, across every game in range */
  counts: number[];
  totalVotes: number;
}

/**
 * No system breakdown: Telegram polls carry a free-text questionText, not a
 * game-system id, so there's no source to build one from.
 */
export interface ClubStatistics {
  from: string | null;
  to: string | null;
  totalGames: number;
  /** Total seats filled across every session in range — one per rating cast. */
  totalSeats: number;
  /** Distinct people who sat at a table in range (unlike totalSeats, counts each once). */
  totalPlayers: number;
  /** Sessions per month across the selected range, oldest first. */
  gamesPerMonth: GameLogMonthlyCount[];
  /** Mean of each game's own average rating (games with no votes are excluded, not counted as 0) */
  averageScore: number | null;
  ratingDistribution: RatingDistribution;
  topGameMasters: LeaderboardEntry[];
  topPlayers: LeaderboardEntry[];
  highestRatedGame: GameSpotlight | null;
  lowestRatedGame: GameSpotlight | null;
}
