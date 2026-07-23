import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  POLL_RATING_MAX,
  POLL_RATING_MIN,
  type PollResults,
  type PollVoteRequest,
} from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAuth } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";

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

export async function getPollResults(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const myVote = await ddb.send(
    new GetCommand({
      TableName: Tables.gamePollVotes(),
      Key: { gameId, userId: auth.userId },
    })
  );
  if (!myVote.Item) {
    throw new HttpError(403, "Vote before viewing results");
  }

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
    yourRating: myVote.Item.rating,
  };
  return json(200, { results });
}
