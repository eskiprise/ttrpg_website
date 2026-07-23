export type Role = "player" | "dm" | "admin";

export interface User {
  userId: string; // Cognito sub
  firstName: string;
  lastName: string;
  email: string;
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

export interface GameParticipantRef {
  userId: string;
  displayName: string;
}

export interface Game {
  gameId: string;
  title: string;
  date: string; // ISO date
  systemId: string;
  systemName: string;
  dmUserId: string;
  dmDisplayName: string;
  participants: GameParticipantRef[];
}

/** Same shape as Game, but names may be replaced with generated nicknames for logged-out viewers. */
export type PublicGame = Game;

export interface GameComment {
  commentId: string;
  gameId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export const POLL_RATING_MIN = 1;
export const POLL_RATING_MAX = 10;

export interface PollVoteRequest {
  rating: number; // 1-10
}

export interface PollResults {
  gameId: string;
  totalVotes: number;
  /** counts[i] = number of votes for rating i+1 (index 0 -> rating 1) */
  counts: number[];
  yourRating: number;
}

export interface PersonalStats {
  userId: string;
  gamesDmd: Game[];
  gamesPlayed: Game[];
}

export interface SiteSettings {
  anonymizeLoggedOutView: boolean;
}

export interface AvatarUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}
