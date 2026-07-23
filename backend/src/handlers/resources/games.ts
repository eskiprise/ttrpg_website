import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Game, GameParticipantRef } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import { optionalAuth, requireAdmin } from "../../lib/auth.js";
import { getSettings } from "../../lib/settings.js";
import { nicknameFor } from "../../lib/nicknames.js";
import { getUser, displayName } from "../../lib/users.js";

function anonymize(game: Game): Game {
  return {
    ...game,
    dmDisplayName: nicknameFor(game.dmUserId),
    participants: game.participants.map((p) => ({
      ...p,
      displayName: nicknameFor(p.userId),
    })),
  };
}

async function shouldAnonymizeFor(
  event: APIGatewayProxyEventV2
): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.anonymizeLoggedOutView) return false;
  return (await optionalAuth(event)) === null;
}

export async function listGames(
  event: APIGatewayProxyEventV2
) {
  const result = await ddb.send(new ScanCommand({ TableName: Tables.games() }));
  let games = (result.Items ?? []) as Game[];
  games = games.sort((a, b) => b.date.localeCompare(a.date));

  if (await shouldAnonymizeFor(event)) {
    games = games.map(anonymize);
  }
  return json(200, { games });
}

export async function getGameDetail(
  event: APIGatewayProxyEventV2
) {
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const result = await ddb.send(
    new GetCommand({ TableName: Tables.games(), Key: { gameId } })
  );
  if (!result.Item) throw new HttpError(404, "Game not found");

  let game = result.Item as Game;
  if (await shouldAnonymizeFor(event)) {
    game = anonymize(game);
  }
  return json(200, { game });
}

interface CreateGameBody {
  title: string;
  date: string;
  systemId: string;
  dmUserId: string;
  participantUserIds: string[];
}

export async function createGame(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as CreateGameBody;
  if (!body.title || !body.date || !body.systemId || !body.dmUserId) {
    throw new HttpError(400, "title, date, systemId and dmUserId are required");
  }

  const systemResult = await ddb.send(
    new GetCommand({
      TableName: Tables.gameSystems(),
      Key: { systemId: body.systemId },
    })
  );
  if (!systemResult.Item) throw new HttpError(400, "Unknown systemId");

  const dm = await getUser(body.dmUserId);
  const participantIds = Array.from(
    new Set([...(body.participantUserIds ?? []), body.dmUserId])
  );
  const participants: GameParticipantRef[] = [];
  for (const userId of participantIds) {
    const user = userId === body.dmUserId ? dm : await getUser(userId);
    participants.push({ userId, displayName: displayName(user) });
  }

  const gameId = randomUUID();
  const game: Game = {
    gameId,
    title: body.title,
    date: body.date,
    systemId: body.systemId,
    systemName: systemResult.Item.name,
    dmUserId: body.dmUserId,
    dmDisplayName: displayName(dm),
    participants,
  };

  await ddb.send(new PutCommand({ TableName: Tables.games(), Item: game }));

  await Promise.all(
    participantIds.map((userId) =>
      ddb.send(
        new PutCommand({
          TableName: Tables.gameParticipants(),
          Item: {
            userId,
            gameId,
            role: userId === body.dmUserId ? "dm" : "player",
          },
        })
      )
    )
  );

  return json(201, { game });
}

export async function updateGame(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const existing = await ddb.send(
    new GetCommand({ TableName: Tables.games(), Key: { gameId } })
  );
  if (!existing.Item) throw new HttpError(404, "Game not found");

  const body = JSON.parse(event.body ?? "{}") as Partial<CreateGameBody>;
  const updated: Game = {
    ...(existing.Item as Game),
    title: body.title ?? existing.Item.title,
    date: body.date ?? existing.Item.date,
  };
  await ddb.send(new PutCommand({ TableName: Tables.games(), Item: updated }));
  return json(200, { game: updated });
}

export async function deleteGame(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const gameId = event.pathParameters?.gameId;
  if (!gameId) throw new HttpError(400, "Missing gameId");

  const existing = await ddb.send(
    new GetCommand({ TableName: Tables.games(), Key: { gameId } })
  );
  if (!existing.Item) throw new HttpError(404, "Game not found");
  const game = existing.Item as Game;

  await ddb.send(new DeleteCommand({ TableName: Tables.games(), Key: { gameId } }));
  await Promise.all(
    game.participants.map((p) =>
      ddb.send(
        new DeleteCommand({
          TableName: Tables.gameParticipants(),
          Key: { userId: p.userId, gameId },
        })
      )
    )
  );
  return json(204, {});
}

export async function listGamesForUser(userId: string) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Tables.gameParticipants(),
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  const links = (result.Items ?? []) as { gameId: string; role: "dm" | "player" }[];

  const games = await Promise.all(
    links.map(async (link) => {
      const gameResult = await ddb.send(
        new GetCommand({ TableName: Tables.games(), Key: { gameId: link.gameId } })
      );
      return { game: gameResult.Item as Game, role: link.role };
    })
  );

  return {
    gamesDmd: games.filter((g) => g.role === "dm").map((g) => g.game),
    gamesPlayed: games.filter((g) => g.role === "player").map((g) => g.game),
  };
}
