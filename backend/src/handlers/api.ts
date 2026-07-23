import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { errorResponse, json } from "../lib/response.js";
import { createSignupRequest } from "./resources/signup.js";
import {
  listGameSystems,
  createGameSystem,
  updateGameSystem,
  deleteGameSystem,
} from "./resources/gameSystems.js";
import { listGameMasters, getGameMasterDetail } from "./resources/gameMasters.js";
import {
  listGames,
  getGameDetail,
  createGame,
  updateGame,
  deleteGame,
} from "./resources/games.js";
import { castVote, getPollResults, getPollVoters } from "./resources/poll.js";
import { listComments, postComment, deleteComment } from "./resources/comments.js";
import {
  getMyProfile,
  getMyStats,
  updateMyProfile,
  getAvatarUploadUrl,
} from "./resources/profile.js";
import {
  listSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
} from "./resources/adminSignup.js";
import { updateAnonymizeToggle } from "./resources/settings.js";
import { listUsers, updateUserRoles } from "./resources/adminUsers.js";
import { listMembers } from "./resources/members.js";
import { getClubStatistics } from "./resources/statistics.js";

type RouteHandler = (
  event: APIGatewayProxyEventV2
) => Promise<APIGatewayProxyStructuredResultV2>;

const routes: Record<string, RouteHandler> = {
  "GET /health": async () => json(200, { ok: true }),

  "POST /signup": createSignupRequest,

  "GET /game-systems": async () => listGameSystems(),
  "POST /admin/game-systems": createGameSystem,
  "PATCH /admin/game-systems/{systemId}": updateGameSystem,
  "DELETE /admin/game-systems/{systemId}": deleteGameSystem,

  "GET /game-masters": async () => listGameMasters(),
  "GET /game-masters/{userId}": getGameMasterDetail,

  "GET /games": listGames,
  "GET /games/{gameId}": getGameDetail,
  "POST /admin/games": createGame,
  "PATCH /admin/games/{gameId}": updateGame,
  "DELETE /admin/games/{gameId}": deleteGame,

  "POST /games/{gameId}/poll-vote": castVote,
  "GET /games/{gameId}/poll-results": getPollResults,
  "GET /games/{gameId}/poll-voters": getPollVoters,

  "GET /games/{gameId}/comments": listComments,
  "POST /games/{gameId}/comments": postComment,
  "DELETE /admin/games/{gameId}/comments/{commentId}": deleteComment,

  "GET /members": listMembers,
  "GET /statistics": getClubStatistics,

  "GET /me": getMyProfile,
  "GET /me/stats": getMyStats,
  "PATCH /me/profile": updateMyProfile,
  "POST /me/avatar-upload-url": getAvatarUploadUrl,

  "GET /admin/signup-requests": listSignupRequests,
  "POST /admin/signup-requests/{requestId}/approve": approveSignupRequest,
  "POST /admin/signup-requests/{requestId}/reject": rejectSignupRequest,

  "PATCH /admin/settings/anonymize-toggle": updateAnonymizeToggle,

  "GET /admin/users": listUsers,
  "PATCH /admin/users/{userId}/roles": updateUserRoles,
};

export const handler: APIGatewayProxyHandlerV2 = async (
  event
) => {
  try {
    const route = routes[event.routeKey];
    if (!route) {
      return json(404, { error: `No route for ${event.routeKey}` });
    }
    return await route(event);
  } catch (err) {
    return errorResponse(err);
  }
};
