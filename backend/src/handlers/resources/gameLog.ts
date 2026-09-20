import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  createSystemMatcher,
  type GameLogMonthlyCount,
  type GameSystem,
  type PublicGameDetail,
  type PublicGameVoter,
  type TelegramGameSummary,
} from "@ttrpg-club/shared";
import { ddb, Tables, scanAll } from "../../lib/dynamo.js";
import { shouldAnonymizeFor } from "../../lib/settings.js";
import { nicknameFor } from "../../lib/nicknames.js";
import { formatTelegramDisplayName } from "../../lib/telegramAuth.js";
import { fetchVotesForPoll, summarize, type PollRecord } from "./telegramGames.js";
import { getUser } from "../../lib/users.js";
import { requireAdmin } from "../../lib/auth.js";
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

type SortBy = "date" | "gm" | "system" | "score";

function parseSortBy(raw: string | undefined): SortBy {
  return raw === "gm" || raw === "system" || raw === "score" ? raw : "date";
}
function parseSortDir(raw: string | undefined): 1 | -1 {
  return raw === "asc" ? 1 : -1;
}
function parseScoreBound(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
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

/** Value used to order by `sortBy`, plus whether the game even has one — a game with
 * no GM or no matched system sinks to the bottom regardless of sort direction, since
 * there's nothing meaningful to alphabetize an absence against. */
function sortValue(
  game: TelegramGameSummary,
  sortBy: SortBy,
  matchSystem: ((questionText: string) => string | null) | null,
  systemNameById: Map<string, string>
): { key: string | number; missing: boolean } {
  switch (sortBy) {
    case "gm":
      return { key: game.gmDisplayName, missing: game.gmDisplayName === "—" };
    case "system": {
      const systemId = matchSystem?.(game.questionText) ?? null;
      const name = systemId ? (systemNameById.get(systemId) ?? "") : "";
      return { key: name, missing: systemId === null };
    }
    case "score":
      return { key: game.averageScore ?? 0, missing: game.averageScore === null };
    default:
      return { key: game.createdAt, missing: false };
  }
}

export async function listGameLog(event: APIGatewayProxyEventV2) {
  const limit = parseLimit(event.queryStringParameters?.limit);
  const offset = parseOffset(event.queryStringParameters?.offset);
  const sortBy = parseSortBy(event.queryStringParameters?.sortBy);
  const dir = parseSortDir(event.queryStringParameters?.sortDir);
  const minScore = parseScoreBound(event.queryStringParameters?.minScore);
  const maxScore = parseScoreBound(event.queryStringParameters?.maxScore);
  const hasGm = event.queryStringParameters?.hasGm;

  // No index sorts telegram_rating_polls by createdAt, so this Scan is unavoidable —
  // same tradeoff getTelegramGamesAll already accepts at this club's scale (small
  // items, no votes attached).
  const [polls, systems] = await Promise.all([
    scanAll<PollRecord>(Tables.telegramRatingPolls()),
    sortBy === "system" ? scanAll<GameSystem>(Tables.gameSystems()) : Promise.resolve<GameSystem[]>([]),
  ]);
  const matchSystem = sortBy === "system" ? createSystemMatcher(systems) : null;
  const systemNameById = new Map(systems.map((s) => [s.systemId, s.name]));

  // Sorting/filtering by a computed field (score, GM, system) needs every game's
  // summary before a page can be sliced off, not just the requested page's votes.
  const allGames = await Promise.all(
    polls.map(async (poll) => summarize(poll, await fetchVotesForPoll(poll.pollId), null))
  );

  let filtered = allGames;
  if (minScore !== undefined) filtered = filtered.filter((g) => g.averageScore !== null && g.averageScore >= minScore);
  if (maxScore !== undefined) filtered = filtered.filter((g) => g.averageScore !== null && g.averageScore <= maxScore);
  if (hasGm === "false") filtered = filtered.filter((g) => g.gmDisplayName === "—");
  else if (hasGm === "true") filtered = filtered.filter((g) => g.gmDisplayName !== "—");

  const sorted = filtered.slice().sort((a, b) => {
    const av = sortValue(a, sortBy, matchSystem, systemNameById);
    const bv = sortValue(b, sortBy, matchSystem, systemNameById);
    if (av.missing !== bv.missing) return av.missing ? 1 : -1;
    if (typeof av.key === "number" && typeof bv.key === "number") return (av.key - bv.key) * dir;
    return String(av.key).localeCompare(String(bv.key)) * dir;
  });
  const page = sorted.slice(offset, offset + limit);

  return json(200, {
    games: page,
    hasMore: offset + limit < sorted.length,
    gamesPerMonth: gamesPerMonth(polls),
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

const MAX_TITLE_LENGTH = 200;

interface UpdateGameInput {
  questionText?: string;
  /** A `users` table userId to set as GM, or `null` to clear the GM entirely. */
  gmUserId?: string | null;
}

/**
 * Admin-only fix-up for two things the bot can't get right on its own: a title with a
 * typo, and a poll with no GM at all — historical polls backfilled from Telegram chat
 * history before a matching `/rate` command could be found (see
 * ttrpg_poll_bot/scripts/backfill_historical_polls.py) simply have no creator fields.
 * There's no `creatorUserId` foreign key to keep consistent — the poll just carries a
 * copy of the GM's name, exactly as bot/Mini-App poll creation already does.
 */
export async function updateGame(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const pollId = event.pathParameters?.pollId;
  if (!pollId) throw new HttpError(400, "Missing pollId");
  const body = JSON.parse(event.body ?? "{}") as UpdateGameInput;

  const existing = (
    await ddb.send(new GetCommand({ TableName: Tables.telegramRatingPolls(), Key: { pollId } }))
  ).Item as PollRecord | undefined;
  if (!existing) throw new HttpError(404, "Game not found");

  const poll: PollRecord = { ...existing };

  if (body.questionText !== undefined) {
    const title = body.questionText.trim().slice(0, MAX_TITLE_LENGTH);
    if (!title) throw new HttpError(400, "questionText cannot be empty");
    poll.questionText = title;
  }

  if (body.gmUserId !== undefined) {
    if (body.gmUserId === null) {
      delete poll.creatorUserId;
      delete poll.creatorFirstName;
      delete poll.creatorLastName;
      delete poll.creatorUsername;
    } else {
      const gm = await getUser(body.gmUserId);
      poll.creatorUserId = Number(gm.userId);
      poll.creatorFirstName = gm.firstName;
      poll.creatorLastName = gm.lastName;
      delete poll.creatorUsername;
    }
  }

  await ddb.send(new PutCommand({ TableName: Tables.telegramRatingPolls(), Item: poll }));
  const votes = await fetchVotesForPoll(pollId);
  return json(200, { game: summarize(poll, votes, null) });
}
