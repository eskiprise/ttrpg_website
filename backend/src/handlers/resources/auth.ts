import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { User } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import {
  formatTelegramDisplayName,
  verifyTelegramLoginWidget,
  type TelegramLoginWidgetUser,
} from "../../lib/telegramAuth.js";
import { signSession } from "../../lib/session.js";
import { isAdminId } from "../../lib/auth.js";

/**
 * Only sets firstName/lastName/profilePictureUrl on first login (record creation) —
 * a later login must never clobber a bio the user wrote or an avatar they uploaded,
 * even if their Telegram name/photo changed since.
 */
async function loginOrCreateUser(telegramUser: TelegramLoginWidgetUser) {
  const userId = String(telegramUser.id);
  const existing = await ddb.send(
    new GetCommand({ TableName: Tables.users(), Key: { userId } })
  );

  let user = existing.Item as User | undefined;
  if (!user) {
    user = {
      userId,
      firstName: telegramUser.firstName,
      lastName: telegramUser.lastName ?? "",
      telegramOrViberContact: telegramUser.username ? `@${telegramUser.username}` : "",
      roles: ["player"],
      profilePictureUrl: telegramUser.photoUrl,
      createdAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({ TableName: Tables.users(), Item: user }));
  }

  const displayName = formatTelegramDisplayName({
    firstName: user.firstName,
    lastName: user.lastName || undefined,
    username: telegramUser.username,
  });
  const token = await signSession(userId, displayName);
  return { token, user };
}

export async function loginWithTelegram(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body ?? "{}") as Record<string, unknown>;
  const telegramUser = await verifyTelegramLoginWidget(body);
  if (!telegramUser) throw new HttpError(401, "Invalid Telegram login payload");

  const { token, user } = await loginOrCreateUser(telegramUser);
  return json(200, { token, user, isAdmin: isAdminId(user.userId) });
}

/**
 * Dev-only escape hatch: the Telegram Login Widget only works on its registered
 * domain, so it can never authenticate `npm run dev:frontend` on localhost. Gated on
 * DEV_LOGIN_SECRET being set — api.ts only registers this route when that env var is
 * present, and it's deliberately left unset in prod so the route doesn't exist there
 * at all (not just rejected — genuinely absent).
 */
export async function devLogin(event: APIGatewayProxyEventV2) {
  const configuredSecret = process.env.DEV_LOGIN_SECRET;
  if (!configuredSecret) throw new HttpError(404, "Not found");

  const body = JSON.parse(event.body ?? "{}") as {
    secret?: string;
    id?: number;
    firstName?: string;
    lastName?: string;
    username?: string;
  };

  const providedSecret = body.secret ?? "";
  const expected = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  const secretMatches =
    expected.length === provided.length && timingSafeEqual(expected, provided);
  if (!secretMatches) throw new HttpError(401, "Invalid dev login secret");

  if (!body.id || !body.firstName) {
    throw new HttpError(400, "id and firstName are required");
  }

  const { token, user } = await loginOrCreateUser({
    id: body.id,
    firstName: body.firstName,
    lastName: body.lastName,
    username: body.username,
  });
  return json(200, { token, user, isAdmin: isAdminId(user.userId) });
}
