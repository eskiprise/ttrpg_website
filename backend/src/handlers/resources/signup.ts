import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SignupRequest } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";

interface SignupBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  telegramOrViberContact?: string;
}

export async function createSignupRequest(
  event: APIGatewayProxyEventV2
) {
  const body = JSON.parse(event.body ?? "{}") as SignupBody;
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const email = body.email?.trim();
  const telegramOrViberContact = body.telegramOrViberContact?.trim();

  // Only what an admin needs to reach the person is mandatory — every extra required
  // field is one more reason for a newcomer to close the tab.
  if (!firstName || !telegramOrViberContact) {
    throw new HttpError(400, "firstName and telegramOrViberContact are required");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Invalid email address");
  }

  const request: SignupRequest = {
    requestId: randomUUID(),
    firstName,
    ...(lastName && { lastName }),
    ...(email && { email }),
    telegramOrViberContact,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({ TableName: Tables.signupRequests(), Item: request })
  );

  return json(201, { message: "Signup request submitted for admin approval" });
}
