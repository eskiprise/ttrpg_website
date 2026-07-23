import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  POLL_RATING_MAX,
  POLL_RATING_MIN,
  type PollResults,
  type PollVoteRequest,
  type PollVoterEntry,
} from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAuth, type AuthContext } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";
import { getUser, displayName } from "../../lib/users.js";

export async function castVote(event: APIGatewayProxyEventV2) {
  const auth = await requireAuth(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const body = JSON.parse(event.body ?? "{}") as PollVoteRequest;
  if (
    typeof body.rating !== "number" ||
    body.rating < POLL_RATING_MIN ||
    body.rating > POLL_RATING_MAX
  ) {
    throw new HttpError(400, `rating must be between ${POLL_RATING_MIN} and ${POLL_RATING_MAX}`);
  }

  await ddb.send(
    new PutCommand({
      TableName: Tables.gamePollVotes(),
      Item: {
        gameId,
        userId: auth.userId,
        rating: body.rating,
        votedAt: new Date().toISOString(),
      },
    })
  );

  return json(200, { rating: body.rating });
}

/** Only members who've cast their own vote can see anyone else's — same gate for results and voter list. */
async function requireHasVoted(gameId: string, auth: AuthContext) {
  const myVote = await ddb.send(
    new GetCommand({
      TableName: Tables.gamePollVotes(),
      Key: { gameId, userId: auth.userId },
    })
  );
  if (!myVote.Item) {
    throw new HttpError(403, "Vote before viewing results");
  }
  return myVote.Item as { rating: number };
}

export async function getPollResults(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const myVote = await requireHasVoted(gameId, auth);

  const all = await ddb.send(
    new QueryCommand({
      TableName: Tables.gamePollVotes(),
      KeyConditionExpression: "gameId = :gameId",
      ExpressionAttributeValues: { ":gameId": gameId },
    })
  );

  const counts = new Array(POLL_RATING_MAX - POLL_RATING_MIN + 1).fill(0);
  for (const item of all.Items ?? []) {
    const rating = item.rating as number;
    counts[rating - POLL_RATING_MIN] += 1;
  }

  const results: PollResults = {
    gameId,
    totalVotes: all.Items?.length ?? 0,
    counts,
    yourRating: myVote.rating,
  };
  return json(200, { results });
}

export async function getPollVoters(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  await requireHasVoted(gameId, auth);

  const all = await ddb.send(
    new QueryCommand({
      TableName: Tables.gamePollVotes(),
      KeyConditionExpression: "gameId = :gameId",
      ExpressionAttributeValues: { ":gameId": gameId },
    })
  );

  const rawVotes = (all.Items ?? []) as { userId: string; rating: number; votedAt: string }[];
  const voters: PollVoterEntry[] = await Promise.all(
    rawVotes.map(async (v) => {
      const user = await getUser(v.userId);
      return {
        userId: v.userId,
        displayName: displayName(user),
        rating: v.rating,
        votedAt: v.votedAt,
      };
    })
  );
  voters.sort((a, b) => b.votedAt.localeCompare(a.votedAt));

  return json(200, { voters });
}
