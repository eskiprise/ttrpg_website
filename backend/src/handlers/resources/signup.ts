import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SignupRequest } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";

interface SignupBody {
  firstName?: string;
  lastName?: string;
  telegramOrViberContact?: string;
  phone?: string;
}

export async function createSignupRequest(
  event: APIGatewayProxyEventV2
) {
  const body = JSON.parse(event.body ?? "{}") as SignupBody;
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const telegramOrViberContact = body.telegramOrViberContact?.trim();
  const phone = body.phone?.trim();

  // Only a name and one way to reach the person are mandatory — every extra required
  // field is one more reason for a newcomer to close the tab. Phone is the fallback for
  // people without a Telegram/Viber handle.
  if (!firstName) {
    throw new HttpError(400, "firstName is required");
  }
  if (!telegramOrViberContact && !phone) {
    throw new HttpError(400, "Either telegramOrViberContact or phone is required");
  }
  // Loose on purpose (spaces, dashes, brackets, leading +): only reject what can't be a
  // phone number at all. 7–15 digits covers local formats up to the E.164 maximum.
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!/^\+?[\d\s()-]+$/.test(phone) || digits < 7 || digits > 15) {
      throw new HttpError(400, "Invalid phone number");
    }
  }

  const request: SignupRequest = {
    requestId: randomUUID(),
    firstName,
    ...(lastName && { lastName }),
    ...(telegramOrViberContact && { telegramOrViberContact }),
    ...(phone && { phone }),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({ TableName: Tables.signupRequests(), Item: request })
  );

  return json(201, { message: "Signup request submitted for admin approval" });
}
