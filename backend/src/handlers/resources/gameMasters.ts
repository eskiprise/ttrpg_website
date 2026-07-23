import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { User } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import { getUser } from "../../lib/users.js";

function toPublicGm(user: User) {
  return {
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio ?? "",
    profilePictureUrl: user.profilePictureUrl ?? null,
  };
}

export async function listGameMasters() {
  const result = await ddb.send(new ScanCommand({ TableName: Tables.users() }));
  const gms = ((result.Items ?? []) as User[]).filter((u) =>
    u.roles?.includes("dm")
  );
  return json(200, { gameMasters: gms.map(toPublicGm) });
}

export async function getGameMasterDetail(
  event: APIGatewayProxyEventV2
) {
  const userId = event.pathParameters?.userId;
  if (!userId) throw new HttpError(400, "Missing userId");
  const user = await getUser(userId);
  if (!user.roles?.includes("dm")) {
    throw new HttpError(404, "Game master not found");
  }
  return json(200, { gameMaster: toPublicGm(user) });
}
