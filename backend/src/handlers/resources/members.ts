import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { PublicUserSummary, User } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAuth } from "../../lib/auth.js";
import { json } from "../../lib/response.js";

/** Lightweight member list for authenticated members (e.g. picking DM/participants
 * when logging a game) — unlike /admin/users, this never exposes email or contact info. */
export async function listMembers(event: APIGatewayProxyEventV2) {
  await requireAuth(event);
  const result = await ddb.send(new ScanCommand({ TableName: Tables.users() }));
  const members: PublicUserSummary[] = ((result.Items ?? []) as User[]).map((u) => ({
    userId: u.userId,
    firstName: u.firstName,
    lastName: u.lastName,
    profilePictureUrl: u.profilePictureUrl,
    roles: u.roles,
  }));
  return json(200, { members });
}
