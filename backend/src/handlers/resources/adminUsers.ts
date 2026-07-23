import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Role, User } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAdmin } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";
import { getUser } from "../../lib/users.js";

const VALID_ROLES: Role[] = ["player", "dm", "admin"];

export async function listUsers(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const result = await ddb.send(new ScanCommand({ TableName: Tables.users() }));
  return json(200, { users: (result.Items ?? []) as User[] });
}

export async function updateUserRoles(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const userId = event.pathParameters?.userId;
  if (!userId) throw new HttpError(400, "Missing userId");

  const body = JSON.parse(event.body ?? "{}") as { roles?: string[] };
  if (!Array.isArray(body.roles) || body.roles.some((r) => !VALID_ROLES.includes(r as Role))) {
    throw new HttpError(400, `roles must be a subset of ${VALID_ROLES.join(", ")}`);
  }

  const user = await getUser(userId);
  const updated: User = { ...user, roles: body.roles as Role[] };
  await ddb.send(new PutCommand({ TableName: Tables.users(), Item: updated }));
  return json(200, { user: updated });
}
