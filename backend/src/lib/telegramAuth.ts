import { createHmac, timingSafeEqual } from "node:crypto";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
let cachedBotToken: string | undefined;

async function getBotToken(): Promise<string> {
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
