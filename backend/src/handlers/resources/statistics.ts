import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { POLL_RATING_MAX, POLL_RATING_MIN } from "@ttrpg-club/shared";
import type {
  ClubStatistics,
  GameLogMonthlyCount,
  GameSpotlight,
  LeaderboardEntry,
} from "@ttrpg-club/shared";
import { Tables, scanAll } from "../../lib/dynamo.js";
import { json } from "../../lib/response.js";
import { formatTelegramDisplayName } from "../../lib/telegramAuth.js";
import { shouldAnonymizeFor } from "../../lib/settings.js";
import { nicknameFor } from "../../lib/nicknames.js";
import type { PollRecord, VoteRecord } from "./telegramGames.js";

const LEADERBOARD_SIZE = 5;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function withinRange(createdAt: string, from: string | null, to: string | null): boolean {
  const date = createdAt.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

interface Tally {
  telegramUserId: number;
  count: number;
  /** Newest record seen for this person, so the name shown is their current one. */
  latestAt: string;
  displayName: string;
}

function upsert(byUser: Map<number, Tally>, userId: number, at: string, displayName: string): void {
  const existing = byUser.get(userId);
  if (!existing) {
    byUser.set(userId, { telegramUserId: userId, count: 1, latestAt: at, displayName });
    return;
  }
  existing.count += 1;
  // People rename themselves and add/remove usernames over time — prefer whatever the
  // most recent record calls them instead of whichever row happened to arrive first.
  if (at > existing.latestAt) {
    existing.latestAt = at;
    existing.displayName = displayName;
  }
}

/** Tally by "YYYY-MM", oldest first — the same shape the Game Log chart consumes,
 *  but over the selected range rather than all of history. */
function gamesPerMonth(polls: PollRecord[]): GameLogMonthlyCount[] {
  const counts = new Map<string, number>();
  for (const poll of polls) {
    const month = poll.createdAt.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function topEntries(byUser: Map<number, Tally>): LeaderboardEntry[] {
  return Array.from(byUser.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, LEADERBOARD_SIZE)
    .map(({ telegramUserId, displayName, count }) => ({ telegramUserId, displayName, count }));
}

/**
 * Rebuilt on the Telegram-sourced poll/vote tables — the site's own games table is
 * gone. There's no system breakdown here (see ClubStatistics): a Telegram poll's
 * questionText is free text, not a game-system id, so there's nothing to group by.
 *
 * Public, deliberately: every figure here is already visible per-session on the Game
 * Log, and the homepage leans on these numbers to show a stranger that the club is
 * active. Player names are the one thing held back — see the topPlayers handling below.
 */
export async function getClubStatistics(event: APIGatewayProxyEventV2) {
  const from = event.queryStringParameters?.from || null;
  const to = event.queryStringParameters?.to || null;

  const [allPolls, allVotes] = await Promise.all([
    scanAll<PollRecord>(Tables.telegramRatingPolls()),
    scanAll<VoteRecord>(Tables.telegramRatingVotes()),
  ]);

  const polls = allPolls.filter((p) => withinRange(p.createdAt, from, to));
  const pollIds = new Set(polls.map((p) => p.pollId));
  const votesByPoll = new Map<string, VoteRecord[]>();
  for (const vote of allVotes) {
    if (!pollIds.has(vote.pollId)) continue;
    const forPoll = votesByPoll.get(vote.pollId) ?? [];
    forPoll.push(vote);
    votesByPoll.set(vote.pollId, forPoll);
  }

  const ratingCounts = new Array(POLL_RATING_MAX - POLL_RATING_MIN + 1).fill(0);
  let totalVotes = 0;
  const pollAverages = new Map<string, number>();

  for (const poll of polls) {
    const votes = votesByPoll.get(poll.pollId) ?? [];
    if (votes.length === 0) continue;
    const avg = average(votes.map((v) => v.rating))!;
    pollAverages.set(poll.pollId, avg);
    for (const vote of votes) {
      ratingCounts[vote.rating - POLL_RATING_MIN] += 1;
      totalVotes += 1;
    }
  }

  const averageScore = average(Array.from(pollAverages.values()));

  const gmsByUser = new Map<number, Tally>();
  for (const poll of polls) {
    if (typeof poll.creatorUserId !== "number") continue;
    upsert(
      gmsByUser,
      poll.creatorUserId,
      poll.createdAt,
      formatTelegramDisplayName({
        firstName: poll.creatorFirstName ?? "",
        lastName: poll.creatorLastName,
        username: poll.creatorUsername,
      })
    );
  }

  const playersByUser = new Map<number, Tally>();
  for (const poll of polls) {
    for (const vote of votesByPoll.get(poll.pollId) ?? []) {
      // Running a session isn't playing it — exclude a GM's own vote on their poll,
      // matching the same convention the Telegram leaderboard uses.
      if (poll.creatorUserId === vote.telegramUserId) continue;
      upsert(
        playersByUser,
        vote.telegramUserId,
        vote.answeredAt,
        formatTelegramDisplayName({
          firstName: vote.firstName,
          lastName: vote.lastName,
          username: vote.username,
        })
      );
    }
  }

  let highestRatedGame: GameSpotlight | null = null;
  let lowestRatedGame: GameSpotlight | null = null;
  for (const poll of polls) {
    const avg = pollAverages.get(poll.pollId);
    if (avg === undefined) continue;
    if (!highestRatedGame || avg > highestRatedGame.averageScore) {
      highestRatedGame = { pollId: poll.pollId, questionText: poll.questionText, averageScore: avg };
    }
    if (!lowestRatedGame || avg < lowestRatedGame.averageScore) {
      lowestRatedGame = { pollId: poll.pollId, questionText: poll.questionText, averageScore: avg };
    }
  }

  // Game masters are public-facing club staff, so their names always show. Players
  // are not — a logged-out visitor sees the same generated nicknames the Game Log
  // uses, while a logged-in member sees real names.
  const anonymize = await shouldAnonymizeFor(event);
  const topPlayers = topEntries(playersByUser).map((entry) =>
    anonymize ? { ...entry, displayName: nicknameFor(String(entry.telegramUserId)) } : entry
  );

  const statistics: ClubStatistics = {
    from,
    to,
    totalGames: polls.length,
    totalSeats: polls.reduce((sum, poll) => sum + (votesByPoll.get(poll.pollId)?.length ?? 0), 0),
    // Distinct humans, not attendances — deliberately a different figure from
    // totalSeats, which counts every seat taken across every session.
    totalPlayers: new Set(
      polls.flatMap((poll) =>
        (votesByPoll.get(poll.pollId) ?? []).map((vote) => vote.telegramUserId)
      )
    ).size,
    gamesPerMonth: gamesPerMonth(polls),
    averageScore,
    ratingDistribution: { counts: ratingCounts, totalVotes },
    topGameMasters: topEntries(gmsByUser),
    topPlayers,
    highestRatedGame,
    lowestRatedGame,
  };

  return json(200, { statistics });
}
