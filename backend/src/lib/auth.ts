import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { HttpError } from "./response.js";
import { verifySession } from "./session.js";

export interface AuthContext {
  userId: string; // Telegram user id, as a string — the `users` table partition key
  displayName: string;
  isAdmin: boolean;
}

/** Comma-separated Telegram user ids, set by Terraform from an admin allowlist variable. */
const ADMIN_TELEGRAM_IDS = new Set(
  (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

/** Exported so login handlers (which mint a session rather than verify one) can report isAdmin without duplicating the allowlist parsing. */
export function isAdminId(userId: string): boolean {
  return ADMIN_TELEGRAM_IDS.has(userId);
}

function extractBearerToken(event: APIGatewayProxyEventV2): string | null {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/**
 * API Gateway routes are all left unauthenticated (authorization type NONE) so a single
 * Lambda can decide, per-route, whether a caller merely being logged in is required versus
 * needing to distinguish "logged out" from "logged in" for the same public route (e.g. the
 * anonymized Game Log). HTTP API's built-in JWT authorizer can't express that "optional"
 * case, so the Lambda verifies the session token itself instead.
 *
 * isAdmin is evaluated fresh from the allowlist on every call rather than baked into the
 * token at login time, so revoking admin access takes effect immediately instead of
 * waiting out a 30-day session.
 */
export async function requireAuth(
  event: APIGatewayProxyEventV2
): Promise<AuthContext> {
  const token = extractBearerToken(event);
  if (!token) throw new HttpError(401, "Authentication required");

  const payload = await verifySession(token);
  if (!payload) throw new HttpError(401, "Invalid or expired session");

  return {
    userId: payload.sub,
    displayName: payload.name,
    isAdmin: isAdminId(payload.sub),
  };
}

export async function requireAdmin(
  event: APIGatewayProxyEventV2
): Promise<AuthContext> {
  const auth = await requireAuth(event);
  if (!auth.isAdmin) {
    throw new HttpError(403, "Admin access required");
  }
  return auth;
}

/** For public routes that behave differently when a caller happens to be logged in. */
export async function optionalAuth(
  event: APIGatewayProxyEventV2
): Promise<AuthContext | null> {
  try {
    return await requireAuth(event);
  } catch {
    return null;
  }
}
