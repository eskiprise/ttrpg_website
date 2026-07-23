import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AvatarUploadUrlResponse, PersonalStats } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { requireAuth } from "../../lib/auth.js";
import { HttpError, json } from "../../lib/response.js";
import { getUser } from "../../lib/users.js";
import { listGamesForUser } from "./games.js";

const s3 = new S3Client({});
const UPLOAD_EXPIRY_SECONDS = 300;

export async function getMyProfile(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const user = await getUser(auth.userId);
  return json(200, { user });
}

export async function getMyStats(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const { gamesDmd, gamesPlayed } = await listGamesForUser(auth.userId);
  const stats: PersonalStats = { userId: auth.userId, gamesDmd, gamesPlayed };
  return json(200, { stats });
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

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function getAvatarUploadUrl(
  event: APIGatewayProxyEventV2
) {
  const auth = await requireAuth(event);
  const bucket = process.env.AVATAR_BUCKET;
  if (!bucket) throw new Error("Missing AVATAR_BUCKET env var");

  const body = JSON.parse(event.body ?? "{}") as { contentType?: string };
  const contentType = body.contentType ?? "image/jpeg";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpError(400, "contentType must be image/jpeg, image/png or image/webp");
  }

  const objectKey = `avatars/${auth.userId}/${randomUUID()}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_EXPIRY_SECONDS,
  });

  const response: AvatarUploadUrlResponse = {
    uploadUrl,
    objectKey,
    expiresInSeconds: UPLOAD_EXPIRY_SECONDS,
  };
  return json(200, response);
}
