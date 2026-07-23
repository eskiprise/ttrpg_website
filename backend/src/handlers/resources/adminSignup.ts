import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { SignupRequest, User } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAdmin } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";
import { provisionMember } from "../../lib/cognito.js";

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

  const userId = await provisionMember({
    email: request.email,
    firstName: request.firstName,
    lastName: request.lastName,
  });

  const user: User = {
    userId,
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    telegramOrViberContact: request.telegramOrViberContact,
    roles: ["player"],
    createdAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: Tables.users(), Item: user }));

  await ddb.send(
    new PutCommand({
      TableName: Tables.signupRequests(),
      Item: { ...request, status: "APPROVED" },
    })
  );

  return json(200, { user });
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
