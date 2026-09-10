import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
let cachedBotToken: string | undefined;

export async function getBotToken(): Promise<string> {
  if (cachedBotToken) return cachedBotToken;
  const paramName = process.env.TELEGRAM_BOT_TOKEN_PARAM ?? "/telegram/poll_bot/token";
  const result = await ssm.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true })
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${paramName} has no value`);
  cachedBotToken = value;
  return value;
}

export interface TelegramInitDataUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export function formatTelegramDisplayName(user: {
  firstName: string;
  lastName?: string;
  username?: string;
}): string {
  if (user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.username) return `${user.firstName} (@${user.username})`;
  return user.firstName;
}

const MAX_INIT_DATA_AGE_SECONDS = 3600; // 1 hour — initData is freshly signed every app open

/**
 * Verifies that `initData` was genuinely issued by Telegram for our bot, per the
 * documented algorithm (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * HMAC-SHA256 of the sorted "key=value" fields, keyed by HMAC-SHA256("WebAppData", botToken).
 * This signature is the ONLY proof of identity here — there is no separate login step,
 * so this check must not be skipped or weakened.
 */
export async function verifyTelegramInitData(
  initData: string
): Promise<TelegramInitDataUser | null> {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const botToken = await getBotToken();
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const receivedBuf = Buffer.from(receivedHash, "hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  if (receivedBuf.length !== computedBuf.length || !timingSafeEqual(receivedBuf, computedBuf)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    return null;
  }

  const userJson = params.get("user");
  if (!userJson) return null;

  try {
    const user = JSON.parse(userJson) as {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
    };
  } catch {
    return null;
  }
}

export interface TelegramLoginWidgetUser extends TelegramInitDataUser {
  photoUrl?: string;
}

/**
 * Verifies a payload from the website's Telegram Login Widget
 * (https://core.telegram.org/widgets/login#checking-authorization).
 *
 * Deliberately a sibling of verifyTelegramInitData rather than a shared helper: the
 * two schemes derive the HMAC key differently — the Mini App uses
 * HMAC-SHA256("WebAppData", botToken), the Login Widget uses plain SHA256(botToken) —
 * and collapsing them into one parameterized function would make it far too easy to
 * later "simplify" one into the other and silently accept forged logins.
 */
export async function verifyTelegramLoginWidget(
  payload: Record<string, unknown>
): Promise<TelegramLoginWidgetUser | null> {
  const receivedHash = payload.hash;
  if (typeof receivedHash !== "string") return null;

  // Telegram signs the string forms of the values it sent, so numbers (id, auth_date)
  // must be rendered back exactly as they arrived rather than re-formatted.
  const dataCheckString = Object.keys(payload)
    .filter((key) => key !== "hash" && payload[key] !== undefined && payload[key] !== null)
    .sort()
    .map((key) => `${key}=${String(payload[key])}`)
    .join("\n");

  const secretKey = createHash("sha256").update(await getBotToken()).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const receivedBuf = Buffer.from(receivedHash, "hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  if (receivedBuf.length !== computedBuf.length || !timingSafeEqual(receivedBuf, computedBuf)) {
    return null;
  }

  const authDate = Number(payload.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    return null;
  }

  const id = Number(payload.id);
  const firstName = payload.first_name;
  if (!id || typeof firstName !== "string") return null;

  return {
    id,
    firstName,
    lastName: typeof payload.last_name === "string" ? payload.last_name : undefined,
    username: typeof payload.username === "string" ? payload.username : undefined,
    photoUrl: typeof payload.photo_url === "string" ? payload.photo_url : undefined,
  };
}
