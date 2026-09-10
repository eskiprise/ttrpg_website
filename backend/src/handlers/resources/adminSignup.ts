import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

async function getRequestOrThrow(requestId: string): Promise<SignupRequest> {
  const result = await ddb.send(
    new GetCommand({ TableName: Tables.signupRequests(), Key: { requestId } })
  );
  if (!result.Item) throw new HttpError(404, "Signup request not found");
  return result.Item as SignupRequest;
}

/**
 * A user account is no longer provisioned here — anyone logging in with Telegram
 * gets a `users` row automatically on first login, independent of this form. Approval
 * is now just an acknowledgement that the club has seen and accepted the request.
 */
export async function approveSignupRequest(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const requestId = event.pathParameters?.requestId;
  if (!requestId) throw new HttpError(400, "Missing requestId");

  const request = await getRequestOrThrow(requestId);
  if (request.status !== "PENDING") {
    throw new HttpError(409, `Request already ${request.status.toLowerCase()}`);
  }

  const updated: SignupRequest = { ...request, status: "APPROVED" };
  await ddb.send(new PutCommand({ TableName: Tables.signupRequests(), Item: updated }));

  return json(200, { request: updated });
}

export async function rejectSignupRequest(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const requestId = event.pathParameters?.requestId;
  if (!requestId) throw new HttpError(400, "Missing requestId");

  const request = await getRequestOrThrow(requestId);
  await ddb.send(
    new PutCommand({
      TableName: Tables.signupRequests(),
      Item: { ...request, status: "REJECTED" },
    })
  );
  return json(200, { requestId, status: "REJECTED" });
}
