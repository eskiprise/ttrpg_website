import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAuth } from "../../lib/auth.js";
import { json } from "../../lib/response.js";
import { getUser } from "../../lib/users.js";
import { presignImageUpload } from "../../lib/uploads.js";

export async function getMyProfile(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const user = await getUser(auth.userId);
  return json(200, { user, isAdmin: auth.isAdmin });
}

export async function updateMyProfile(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const body = JSON.parse(event.body ?? "{}") as {
    bio?: string;
    telegramOrViberContact?: string;
    profilePictureUrl?: string;
  };

  const user = await getUser(auth.userId);
  const updated = {
    ...user,
    bio: body.bio ?? user.bio,
    telegramOrViberContact: body.telegramOrViberContact ?? user.telegramOrViberContact,
    profilePictureUrl: body.profilePictureUrl ?? user.profilePictureUrl,
  };

  await ddb.send(new PutCommand({ TableName: Tables.users(), Item: updated }));
  return json(200, { user: updated });
}

export async function getAvatarUploadUrl(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const body = JSON.parse(event.body ?? "{}") as { contentType?: string };
  return json(200, await presignImageUpload(`avatars/${auth.userId}`, body.contentType));
}
