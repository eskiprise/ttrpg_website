import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DeleteCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { GameSystem } from "@ttrpg-club/shared";
import { ddb, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import { requireAdmin } from "../../lib/auth.js";

export async function listGameSystems() {
  const result = await ddb.send(
    new ScanCommand({ TableName: Tables.gameSystems() })
  );
  const systems = ((result.Items ?? []) as GameSystem[]).sort(
    (a, b) => a.displayIndex - b.displayIndex
  );
  return json(200, { systems });
}

export async function createGameSystem(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as Partial<GameSystem>;
  if (!body.name) throw new HttpError(400, "name is required");

  const system: GameSystem = {
    systemId: randomUUID(),
    name: body.name,
    description: body.description ?? "",
    displayIndex: body.displayIndex ?? 0,
  };
  await ddb.send(new PutCommand({ TableName: Tables.gameSystems(), Item: system }));
  return json(201, { system });
}

export async function updateGameSystem(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const systemId = event.pathParameters?.systemId;
  if (!systemId) throw new HttpError(400, "Missing systemId");
  const body = JSON.parse(event.body ?? "{}") as Partial<GameSystem>;

  const system: GameSystem = {
    systemId,
    name: body.name ?? "",
    description: body.description ?? "",
    displayIndex: body.displayIndex ?? 0,
  };
  await ddb.send(new PutCommand({ TableName: Tables.gameSystems(), Item: system }));
  return json(200, { system });
}

export async function deleteGameSystem(
  event: APIGatewayProxyEventV2
) {
  await requireAdmin(event);
  const systemId = event.pathParameters?.systemId;
  if (!systemId) throw new HttpError(400, "Missing systemId");
  await ddb.send(
    new DeleteCommand({ TableName: Tables.gameSystems(), Key: { systemId } })
  );
  return json(204, {});
}
