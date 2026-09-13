import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { SignupRequest } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAdmin } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";

export async function listSignupRequests(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const result = await ddb.send(
    new QueryCommand({
      TableName: Tables.signupRequests(),
      IndexName: "status-index",
      KeyConditionExpression: "#status = :pending",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":pending": "PENDING" },
    })
  );
  return json(200, { requests: (result.Items ?? []) as SignupRequest[] });
}

/**
 * There's no account to provision any more — anyone logging in with Telegram gets a
 * `users` row automatically. A signup request is just someone asking to be contacted,
 * so the only admin action is marking it handled, which drops it off the pending list.
 */
export async function acknowledgeSignupRequest(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAdmin(event);
  const requestId = event.pathParameters?.requestId;
  if (!requestId) throw new HttpError(400, "Missing requestId");

  const alreadyHandled = new HttpError(409, "Signup request not found or already handled");

  // Get + conditional Put rather than UpdateItem: the Lambda's IAM policy only grants
  // Get/Put/Delete/Query/Scan, and this keeps it that way.
  const result = await ddb.send(
    new GetCommand({ TableName: Tables.signupRequests(), Key: { requestId } })
  );
  const request = result.Item as SignupRequest | undefined;
  if (!request || request.status !== "PENDING") throw alreadyHandled;

  const updated: SignupRequest = {
    ...request,
    status: "ACKNOWLEDGED",
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: auth.displayName,
  };
  try {
    await ddb.send(
      new PutCommand({
        TableName: Tables.signupRequests(),
        Item: updated,
        // Two admins clicking at once can't both "win" and overwrite each other's name.
        ConditionExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":pending": "PENDING" },
      })
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw alreadyHandled;
    throw err;
  }
  return json(200, { request: updated });
}
