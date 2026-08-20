import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { PublicGameDetail, PublicGameVoter, TelegramGameSummary } from "@ttrpg-club/shared";
import { ddb, Tables, scanAll } from "../../lib/dynamo.js";
import { shouldAnonymizeFor } from "../../lib/settings.js";
import { nicknameFor } from "../../lib/nicknames.js";
import { formatTelegramDisplayName } from "../../lib/telegramAuth.js";
import { fetchVotesForPoll, summarize, type PollRecord } from "./telegramGames.js";
import { HttpError, json } from "../../lib/response.js";

/**
 * The public site's Game Log — every session from every player, unlike the Telegram
 * Mini App's per-user "My Games" screens. No auth required; the site's anonymize
 * toggle (same one games.ts already respects) hides real names from logged-out
 * viewers here too, since this now shows real Telegram names to the public internet.
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

function anonymizeGameSummary(summary: TelegramGameSummary, poll: PollRecord): TelegramGameSummary {
  if (!poll.creatorUserId) return summary;
  return { ...summary, gmDisplayName: nicknameFor(String(poll.creatorUserId)) };
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

  const anonymize = await shouldAnonymizeFor(event);

  const games = await Promise.all(
    page.map(async (poll) => {
      const votes = await fetchVotesForPoll(poll.pollId);
      const summary = summarize(poll, votes, null);
      return anonymize ? anonymizeGameSummary(summary, poll) : summary;
    })
  );

  return json(200, { games, hasMore: offset + limit < sorted.length });
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

  const game: PublicGameDetail = {
    ...(anonymize ? anonymizeGameSummary(summary, poll) : summary),
    voters,
  };
  return json(200, { game });
}
