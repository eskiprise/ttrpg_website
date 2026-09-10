import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { errorResponse, json } from "../lib/response.js";
import { createSignupRequest } from "./resources/signup.js";
import { loginWithTelegram, devLogin } from "./resources/auth.js";
import {
  listGameSystems,
  createGameSystem,
  updateGameSystem,
  deleteGameSystem,
} from "./resources/gameSystems.js";
import { listGameMasters, getGameMasterDetail } from "./resources/gameMasters.js";
import { listGameLog, getGameLogDetail } from "./resources/gameLog.js";
import { listComments, postComment, deleteComment } from "./resources/comments.js";
import { getMyProfile, updateMyProfile, getAvatarUploadUrl } from "./resources/profile.js";
import {
  listSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
} from "./resources/adminSignup.js";
import { updateAnonymizeToggle } from "./resources/settings.js";
import { listUsers, updateUserRoles } from "./resources/adminUsers.js";
import { listMembers } from "./resources/members.js";
import { getClubStatistics } from "./resources/statistics.js";
import {
  getTelegramAchievements,
  getTelegramFeedbackEligibility,
  getTelegramStats,
  postTelegramFeedback,
} from "./resources/telegram.js";
import {
  getTelegramGamesAll,
  getTelegramGamesConducted,
  getTelegramGamesPlayed,
  getTelegramGameVoters,
} from "./resources/telegramGames.js";
import { getTelegramLeaderboard } from "./resources/telegramLeaderboard.js";

type RouteHandler = (
  event: APIGatewayProxyEventV2
) => Promise<APIGatewayProxyStructuredResultV2>;

const routes: Record<string, RouteHandler> = {
  "GET /health": async () => json(200, { ok: true }),

  "POST /signup": createSignupRequest,

  "POST /auth/telegram": loginWithTelegram,

  "GET /game-systems": async () => listGameSystems(),
  "POST /admin/game-systems": createGameSystem,
  "PATCH /admin/game-systems/{systemId}": updateGameSystem,
  "DELETE /admin/game-systems/{systemId}": deleteGameSystem,

  "GET /game-masters": async () => listGameMasters(),
  "GET /game-masters/{userId}": getGameMasterDetail,

  "GET /game-log": listGameLog,
  "GET /game-log/{pollId}": getGameLogDetail,

  "GET /game-log/{pollId}/comments": listComments,
  "POST /game-log/{pollId}/comments": postComment,
  "DELETE /admin/game-log/{pollId}/comments/{commentId}": deleteComment,

  "GET /members": listMembers,
  "GET /statistics": getClubStatistics,

  "GET /me": getMyProfile,
  "PATCH /me/profile": updateMyProfile,
  "POST /me/avatar-upload-url": getAvatarUploadUrl,

  "GET /admin/signup-requests": listSignupRequests,
  "POST /admin/signup-requests/{requestId}/approve": approveSignupRequest,
  "POST /admin/signup-requests/{requestId}/reject": rejectSignupRequest,

  "PATCH /admin/settings/anonymize-toggle": updateAnonymizeToggle,

  "GET /admin/users": listUsers,
  "PATCH /admin/users/{userId}/roles": updateUserRoles,

  "POST /telegram/stats": getTelegramStats,
  "POST /telegram/feedback": postTelegramFeedback,
  "POST /telegram/feedback/eligibility": getTelegramFeedbackEligibility,
  "POST /telegram/games/played": getTelegramGamesPlayed,
  "POST /telegram/games/conducted": getTelegramGamesConducted,
  "POST /telegram/games/all": getTelegramGamesAll,
  "POST /telegram/games/{pollId}/voters": getTelegramGameVoters,
  "POST /telegram/leaderboard": getTelegramLeaderboard,
  "POST /telegram/achievements": getTelegramAchievements,

  // Only registered when DEV_LOGIN_SECRET is set — deliberately unset in prod, so
  // this route doesn't exist there at all rather than merely rejecting requests.
  ...(process.env.DEV_LOGIN_SECRET ? { "POST /auth/dev-login": devLogin } : {}),
};

// Comma-separated (Lambda env vars are flat strings, not lists) — set by Terraform
// from cors_allowed_origins. Dev has two real origins (the deployed dev domain and
// localhost:5173 for local development); prod has one.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** Reflects the caller's own Origin back only if it's on the allowlist — the correct pattern for supporting more than one allowed origin, since the header must exactly match the requester's Origin. */
function resolveAllowedOrigin(requestOrigin: string | undefined): string {
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return ALLOWED_ORIGINS[0] ?? "*";
}

export const handler: APIGatewayProxyHandlerV2 = async (
  event
) => {
  let result: APIGatewayProxyStructuredResultV2;
  try {
    const route = routes[event.routeKey];
    result = route ? await route(event) : json(404, { error: `No route for ${event.routeKey}` });
  } catch (err) {
    result = errorResponse(err);
  }
  return {
    ...result,
    headers: {
      ...result.headers,
      "Access-Control-Allow-Origin": resolveAllowedOrigin(event.headers?.origin),
    },
  };
};
