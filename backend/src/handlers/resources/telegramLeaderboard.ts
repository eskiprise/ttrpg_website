import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { TelegramLeaderboardEntry, TelegramLeaderboards } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { formatTelegramDisplayName, verifyTelegramInitData } from "../../lib/telegramAuth.js";
import { HttpError, json } from "../../lib/response.js";

interface PollRecord {
  pollId: string;
  createdAt: string;
  creatorUserId?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
  creatorUsername?: string;
}

interface VoteRecord {
  pollId: string;
  telegramUserId: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  answeredAt?: string;
}

/**
 * A DynamoDB Scan returns at most 1MB per call, so a single ScanCommand silently
 * truncates once these tables outgrow that — which would quietly under-count the
 * leaderboard rather than fail. Page through until LastEvaluatedKey is exhausted.
 */
async function scanAll<T>(tableName: string): Promise<T[]> {
  const items: T[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey })
    );
    items.push(...((result.Items ?? []) as T[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

interface Tally {
  telegramUserId: number;
  gamesCount: number;
  /** Newest record seen for this person, so the name shown is their current one. */
  latestAt: string;
  displayName: string;
}

/**
 * Sorts by games desc, then assigns standard competition ranking so ties share a
 * place. Name ties are broken alphabetically purely so the order is stable between
 * requests — it has no effect on the place numbers themselves.
 */
function rank(tallies: Tally[]): TelegramLeaderboardEntry[] {
  const sorted = tallies.slice().sort((a, b) => {
    if (b.gamesCount !== a.gamesCount) return b.gamesCount - a.gamesCount;
    return a.displayName.localeCompare(b.displayName);
  });

  let previousCount: number | null = null;
  let previousPlace = 0;

  return sorted.map((tally, index) => {
    const place = tally.gamesCount === previousCount ? previousPlace : index + 1;
    previousCount = tally.gamesCount;
    previousPlace = place;
    return {
      telegramUserId: tally.telegramUserId,
      displayName: tally.displayName,
      gamesCount: tally.gamesCount,
      place,
    };
  });
}

function upsert(
  byUser: Map<number, Tally>,
  userId: number,
  at: string,
  displayName: string
): void {
  const existing = byUser.get(userId);
  if (!existing) {
    byUser.set(userId, { telegramUserId: userId, gamesCount: 1, latestAt: at, displayName });
    return;
  }
  existing.gamesCount += 1;
  // People rename themselves and add/remove usernames over time — prefer whatever
  // the most recent record calls them instead of whichever row happened to arrive first.
  if (at > existing.latestAt) {
    existing.latestAt = at;
    existing.displayName = displayName;
  }
}

export async function getTelegramLeaderboard(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as { initData?: string };
  if (!body.initData) throw new HttpError(400, "initData is required");
  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const [votes, polls] = await Promise.all([
    scanAll<VoteRecord>(Tables.telegramRatingVotes()),
    scanAll<PollRecord>(Tables.telegramRatingPolls()),
  ]);

  // Players: one vote row per (pollId, telegramUserId) by table key, so a plain row
  // count IS the number of distinct sessions they rated — no dedupe needed. Rows only
  // exist for real ratings; "see results" and retracted votes are deleted by the bot.
  const playersByUser = new Map<number, Tally>();
  for (const vote of votes) {
    if (typeof vote.telegramUserId !== "number") continue;
    upsert(
      playersByUser,
      vote.telegramUserId,
      vote.answeredAt ?? "",
      formatTelegramDisplayName({
        firstName: vote.firstName ?? "",
        lastName: vote.lastName,
        username: vote.username,
      })
    );
  }

  // GMs: polls created before creator tracking shipped have no creatorUserId — skip
  // them rather than lumping every legacy session under one phantom "unknown" GM.
  const gmsByUser = new Map<number, Tally>();
  for (const poll of polls) {
    if (typeof poll.creatorUserId !== "number") continue;
    upsert(
      gmsByUser,
      poll.creatorUserId,
      poll.createdAt ?? "",
      formatTelegramDisplayName({
        firstName: poll.creatorFirstName ?? "",
        lastName: poll.creatorLastName,
        username: poll.creatorUsername,
      })
    );
  }

  const leaderboards: TelegramLeaderboards = {
    players: rank([...playersByUser.values()]),
    gameMasters: rank([...gmsByUser.values()]),
  };

  return json(200, { leaderboards });
}
