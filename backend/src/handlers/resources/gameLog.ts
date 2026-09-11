import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { GameLogMonthlyCount, PublicGameDetail, PublicGameVoter } from "@ttrpg-club/shared";
import { ddb, Tables, scanAll } from "../../lib/dynamo.js";
import { shouldAnonymizeFor } from "../../lib/settings.js";
import { nicknameFor } from "../../lib/nicknames.js";
import { formatTelegramDisplayName } from "../../lib/telegramAuth.js";
import { fetchVotesForPoll, summarize, type PollRecord } from "./telegramGames.js";
import { HttpError, json } from "../../lib/response.js";

/**
 * The public site's Game Log — every session from every player, unlike the Telegram
 * Mini App's per-user "My Games" screens. No auth required.
 *
 * The anonymize toggle applies to *players*, not game masters. A GM runs public
 * sessions on the club's behalf and their name is part of why someone joins, so
 * gmDisplayName always shows; individual voters stay behind generated nicknames for
 * logged-out visitors.
 */

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Tallies every poll (not just the current page) by "YYYY-MM" — reuses the same Scan listGameLog already does for sorting/pagination, so this is free (no extra DB read). Sorted oldest-first for a natural left-to-right chart. */
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

export async function listGameLog(event: APIGatewayProxyEventV2) {
  const limit = parseLimit(event.queryStringParameters?.limit);
  const offset = parseOffset(event.queryStringParameters?.offset);

  // No index sorts telegram_rating_polls by createdAt, so this Scan is unavoidable —
  // same tradeoff getTelegramGamesAll already accepts at this club's scale (small
  // items, no votes attached). The real query-reduction win is below: vote
  // aggregation only runs for this page's slice, not for every poll in history.
  const polls = await scanAll<PollRecord>(Tables.telegramRatingPolls());
  const sorted = polls.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = sorted.slice(offset, offset + limit);

  const games = await Promise.all(
    page.map(async (poll) => summarize(poll, await fetchVotesForPoll(poll.pollId), null))
  );

  return json(200, {
    games,
    hasMore: offset + limit < sorted.length,
    gamesPerMonth: gamesPerMonth(sorted),
  });
}

export async function getGameLogDetail(event: APIGatewayProxyEventV2) {
  const pollId = event.pathParameters?.pollId;
  if (!pollId) throw new HttpError(400, "Missing pollId");

  const pollResult = await ddb.send(
    new GetCommand({ TableName: Tables.telegramRatingPolls(), Key: { pollId } })
  );
  const poll = pollResult.Item as PollRecord | undefined;
  if (!poll) throw new HttpError(404, "Game not found");

  const votes = await fetchVotesForPoll(pollId);
  const anonymize = await shouldAnonymizeFor(event);

  const summary = summarize(poll, votes, null);
  const voters: PublicGameVoter[] = votes
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .map((v) => ({
      displayName: anonymize
        ? nicknameFor(String(v.telegramUserId))
        : formatTelegramDisplayName({ firstName: v.firstName, lastName: v.lastName, username: v.username }),
      rating: v.rating,
      answeredAt: v.answeredAt,
    }));

  const game: PublicGameDetail = { ...summary, voters };
  return json(200, { game });
}
