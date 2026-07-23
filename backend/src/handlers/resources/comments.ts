import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ulid } from "ulid";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { GameComment } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAdmin, requireAuth } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";
import { getUser, displayName } from "../../lib/users.js";

export async function listComments(
  event: APIGatewayProxyEventV2
) {
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const result = await ddb.send(
    new QueryCommand({
      TableName: Tables.gameComments(),
      KeyConditionExpression: "gameId = :gameId",
      ExpressionAttributeValues: { ":gameId": gameId },
      ScanIndexForward: true,
    })
  );
  return json(200, { comments: (result.Items ?? []) as GameComment[] });
}

export async function postComment(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const body = JSON.parse(event.body ?? "{}") as { text?: string };
  const text = body.text?.trim();
  if (!text) throw new HttpError(400, "text is required");
  if (text.length > 2000) throw new HttpError(400, "Comment too long");

  const user = await getUser(auth.userId);
  const comment: GameComment = {
    commentId: ulid(),
    gameId,
    userId: auth.userId,
    displayName: displayName(user),
    text,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: Tables.gameComments(), Item: comment }));
  return json(201, { comment });
}

export async function deleteComment(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const gameId = event.pathParameters?.gameId;
  const commentId = event.pathParameters?.commentId;
  if (!gameId || !commentId) throw new HttpError(400, "Missing gameId or commentId");

  await ddb.send(
    new DeleteCommand({
      TableName: Tables.gameComments(),
      Key: { gameId, commentId },
    })
  );
  return json(204, {});
}
