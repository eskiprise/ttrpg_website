import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { TelegramGameDetail, TelegramGameSummary, TelegramGameVoter } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { formatTelegramDisplayName, verifyTelegramInitData } from "../../lib/telegramAuth.js";
import { HttpError, json } from "../../lib/response.js";

interface PollRecord {
  pollId: string;
  questionText: string;
  createdAt: string;
  creatorUserId?: number;
  creatorFirstName?: string;
  creatorLastName?: string;
  creatorUsername?: string;
}

interface VoteRecord {
  pollId: string;
  telegramUserId: number;
  rating: number;
  firstName: string;
  lastName: string;
  username: string;
  answeredAt: string;
}

async function fetchVotesForPoll(pollId: string): Promise<VoteRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Tables.telegramRatingVotes(),
      KeyConditionExpression: "pollId = :pollId",
      ExpressionAttributeValues: { ":pollId": pollId },
    })
  );
  return (result.Items ?? []) as VoteRecord[];
}

function summarize(poll: PollRecord, votes: VoteRecord[], callerUserId: number): TelegramGameSummary {
  const ratings = votes.map((v) => v.rating);
  const averageScore = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;
  const myVote = votes.find((v) => v.telegramUserId === callerUserId);

  // Polls created before this feature shipped have no creator fields recorded.
  const gmDisplayName = poll.creatorUserId
    ? formatTelegramDisplayName({
        firstName: poll.creatorFirstName ?? "",
        lastName: poll.creatorLastName,
        username: poll.creatorUsername,
      })
    : "—";

  return {
    pollId: poll.pollId,
    questionText: poll.questionText,
    createdAt: poll.createdAt,
    gmDisplayName,
    playerCount: votes.length,
    averageScore,
    myRating: myVote ? myVote.rating : null,
  };
}

function withinRange(createdAt: string, from?: string | null, to?: string | null): boolean {
  const date = createdAt.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function sortNewestFirst(games: TelegramGameSummary[]): TelegramGameSummary[] {
  return games.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

interface GamesRequestBody {
  initData?: string;
  from?: string;
  to?: string;
}

export async function getTelegramGamesPlayed(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as GamesRequestBody;
  if (!body.initData) throw new HttpError(400, "initData is required");
  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const votesResult = await ddb.send(
    new QueryCommand({
      TableName: Tables.telegramRatingVotes(),
      IndexName: "telegramUserId-index",
      KeyConditionExpression: "telegramUserId = :userId",
      ExpressionAttributeValues: { ":userId": user.id },
    })
  );
  const myVotes = (votesResult.Items ?? []) as VoteRecord[];

  const games = await Promise.all(
    myVotes.map(async (vote) => {
      const poll = (
        await ddb.send(new GetCommand({ TableName: Tables.telegramRatingPolls(), Key: { pollId: vote.pollId } }))
      ).Item as PollRecord | undefined;
      if (!poll) return null;
      const votes = await fetchVotesForPoll(vote.pollId);
      return summarize(poll, votes, user.id);
    })
  );

  const filtered = games.filter((g): g is TelegramGameSummary => g !== null && withinRange(g.createdAt, body.from, body.to));
  return json(200, { games: sortNewestFirst(filtered) });
}

export async function getTelegramGamesConducted(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as GamesRequestBody;
  if (!body.initData) throw new HttpError(400, "initData is required");
  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const pollsResult = await ddb.send(
    new QueryCommand({
      TableName: Tables.telegramRatingPolls(),
      IndexName: "creatorUserId-index",
      KeyConditionExpression: "creatorUserId = :userId",
      ExpressionAttributeValues: { ":userId": user.id },
    })
  );
  const polls = (pollsResult.Items ?? []) as PollRecord[];

  const games = await Promise.all(
    polls.map(async (poll) => summarize(poll, await fetchVotesForPoll(poll.pollId), user.id))
  );

  const filtered = games.filter((g) => withinRange(g.createdAt, body.from, body.to));
  return json(200, { games: sortNewestFirst(filtered) });
}

export async function getTelegramGamesAll(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as GamesRequestBody;
  if (!body.initData) throw new HttpError(400, "initData is required");
  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  // A Scan here is fine at hobby-club scale (dozens/hundreds of sessions total),
  // same tradeoff the website's own getClubStatistics makes over its games table.
  const pollsResult = await ddb.send(new ScanCommand({ TableName: Tables.telegramRatingPolls() }));
  const polls = (pollsResult.Items ?? []) as PollRecord[];

  const games = await Promise.all(
    polls.map(async (poll) => summarize(poll, await fetchVotesForPoll(poll.pollId), user.id))
  );

  const filtered = games.filter((g) => withinRange(g.createdAt, body.from, body.to));
  return json(200, { games: sortNewestFirst(filtered) });
}

export async function getTelegramGameVoters(event: APIGatewayProxyEventV2) {
  const pollId = event.pathParameters?.pollId;
  if (!pollId) throw new HttpError(400, "Missing pollId");

  const body = JSON.parse(event.body ?? "{}") as GamesRequestBody;
  if (!body.initData) throw new HttpError(400, "initData is required");
  const user = await verifyTelegramInitData(body.initData);
  if (!user) throw new HttpError(401, "Invalid or expired Telegram session");

  const poll = (
    await ddb.send(new GetCommand({ TableName: Tables.telegramRatingPolls(), Key: { pollId } }))
  ).Item as PollRecord | undefined;
  if (!poll) throw new HttpError(404, "Game not found");

  const votes = await fetchVotesForPoll(pollId);
  const voters: TelegramGameVoter[] = votes
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .map((v) => ({
      telegramUserId: v.telegramUserId,
      displayName: formatTelegramDisplayName({ firstName: v.firstName, lastName: v.lastName, username: v.username }),
      rating: v.rating,
      answeredAt: v.answeredAt,
    }));

  const game: TelegramGameDetail = { ...summarize(poll, votes, user.id), voters };
  return json(200, { game });
}
