import { createHmac, timingSafeEqual } from "node:crypto";
import { getBotToken } from "./telegramAuth.js";

/**
 * Session tokens are signed with a key *derived from* the Telegram bot token rather
 * than a separate secret. The bot token is already the root of trust for identity
 * here — anyone holding it can forge a Login Widget payload and authenticate as any
 * user — so a second secret would add key management without adding security.
 * Deriving rather than signing with the token directly keeps the two uses
 * cryptographically separate.
 */
const KEY_LABEL = "ttrpg-club-session-v1";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days, matching the old Cognito refresh token

let cachedKey: Buffer | undefined;

async function getSigningKey(): Promise<Buffer> {
  cachedKey ??= createHmac("sha256", await getBotToken()).update(KEY_LABEL).digest();
  return cachedKey;
}

export interface SessionPayload {
  /** Telegram user id, as a string — this is the `users` table partition key. */
  sub: string;
  /** Display name captured at login, so routine requests need no extra lookup. */
  name: string;
  iat: number;
  exp: number;
}

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
  "base64url"
);

function sign(data: string, key: Buffer): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export async function signSession(sub: string, name: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub, name, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${HEADER}.${body}`;
  return `${data}.${sign(data, await getSigningKey())}`;
}

/**
 * Returns the payload only for a token we signed ourselves that hasn't expired.
 * The token's own header is never consulted to pick the algorithm — HS256 is the only
 * scheme accepted, which forecloses the classic "alg" substitution attack.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = Buffer.from(sign(`${header}.${body}`, await getSigningKey()));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as SessionPayload;
    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
