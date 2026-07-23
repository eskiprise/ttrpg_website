import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { User } from "@ttrpg-club/shared";
import { ddb, Tables } from "./dynamo.js";
import { HttpError } from "./response.js";

export async function getUser(userId: string): Promise<User> {
  const result = await ddb.send(
    new GetCommand({ TableName: Tables.users(), Key: { userId } })
  );
  if (!result.Item) throw new HttpError(404, `User ${userId} not found`);
  return result.Item as User;
}

export function displayName(user: Pick<User, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`;
}
