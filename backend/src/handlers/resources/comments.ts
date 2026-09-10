import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ulid } from "ulid";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { GameComment } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAdmin, requireAuth } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";
import { shouldAnonymizeFor } from "../../lib/settings.js";
import { nicknameFor } from "../../lib/nicknames.js";

export async function listComments(
  event: APIGatewayProxyEventV2
) {
  const pollId = event.pathParameters?.pollId;
  if (!pollId) throw new HttpError(400, "Missing pollId");

  const anonymize = await shouldAnonymizeFor(event);
  const result = await ddb.send(
    new QueryCommand({
      TableName: Tables.gameComments(),
      KeyConditionExpression: "pollId = :pollId",
      ExpressionAttributeValues: { ":pollId": pollId },
      ScanIndexForward: true,
    })
  );
  const comments = (result.Items ?? []) as GameComment[];
  return json(200, {
    comments: anonymize
      ? comments.map((c) => ({ ...c, displayName: nicknameFor(c.userId) }))
      : comments,
  });
}

export async function postComment(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const pollId = event.pathParameters?.pollId;
  if (!pollId) throw new HttpError(400, "Missing pollId");

  const body = JSON.parse(event.body ?? "{}") as { text?: string };
  const text = body.text?.trim();
  if (!text) throw new HttpError(400, "text is required");
  if (text.length > 2000) throw new HttpError(400, "Comment too long");

  const comment: GameComment = {
    commentId: ulid(),
    pollId,
    userId: auth.userId,
    displayName: auth.displayName,
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
  const pollId = event.pathParameters?.pollId;
  const commentId = event.pathParameters?.commentId;
  if (!pollId || !commentId) throw new HttpError(400, "Missing pollId or commentId");

  await ddb.send(
    new DeleteCommand({
      TableName: Tables.gameComments(),
      Key: { pollId, commentId },
    })
  );
  return json(204, {});
}
