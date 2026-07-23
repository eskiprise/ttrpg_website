import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { HttpError } from "./response.js";

export interface AuthContext {
  userId: string; // Cognito sub
  email: string;
  isAdmin: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier() {
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: requireEnv("COGNITO_USER_POOL_ID"),
    tokenUse: "id",
    clientId: requireEnv("COGNITO_CLIENT_ID"),
  });
  return verifier;
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
 * case, so the Lambda verifies the Cognito ID token itself instead.
 */
export async function requireAuth(
  event: APIGatewayProxyEventV2
): Promise<AuthContext> {
  const token = extractBearerToken(event);
  if (!token) throw new HttpError(401, "Authentication required");

  let payload;
  try {
    payload = await getVerifier().verify(token);
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }

  const groupsClaim = payload["cognito:groups"];
  const groups = Array.isArray(groupsClaim) ? groupsClaim : [];

  return {
    userId: payload.sub,
    email: String(payload.email ?? ""),
    isAdmin: groups.includes("admin"),
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
