import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  createSystemMatcher,
  formatGameTitle,
  normalizeForMatch,
  titlePrefix,
  type GameSystem,
  type GameSystemDetail,
  type GameSystemListResponse,
  type GameSystemWithCount,
  type UnmatchedGame,
} from "@ttrpg-club/shared";
import { ddb, scanAll, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import { optionalAuth, requireAdmin } from "../../lib/auth.js";
import { presignImageUpload } from "../../lib/uploads.js";
import { fetchVotesForPoll, summarize, type PollRecord } from "./telegramGames.js";

const MAX_ALIASES = 20;
const MAX_ALIAS_LENGTH = 60;

/**
 * Every system alongside the polls that belong to it. Polls have no system id, so
 * membership is decided by title (see createSystemMatcher) — which needs the whole
 * systems list at once, since the longest matching name/alias wins across systems.
 * A full polls scan is ~10 read units at the club's current size.
 */
async function loadSystemsWithPolls() {
  const [systems, polls] = await Promise.all([
    scanAll<GameSystem>(Tables.gameSystems()),
    scanAll<PollRecord>(Tables.telegramRatingPolls()),
  ]);
  const matchSystem = createSystemMatcher(systems);
  const pollsBySystem = new Map<string, PollRecord[]>();
  const unmatched: PollRecord[] = [];
  for (const poll of polls) {
    const systemId = matchSystem(poll.questionText);
    if (systemId) pollsBySystem.set(systemId, [...(pollsBySystem.get(systemId) ?? []), poll]);
    else unmatched.push(poll);
  }
  return { systems, pollsBySystem, unmatched };
}

function withCount(system: GameSystem, polls: PollRecord[] | undefined): GameSystemWithCount {
  return { ...system, sessionCount: polls?.length ?? 0 };
}

function mostPlayedFirst(a: GameSystemWithCount, b: GameSystemWithCount): number {
  return (
    b.sessionCount - a.sessionCount ||
    (a.displayIndex ?? 0) - (b.displayIndex ?? 0) ||
    a.name.localeCompare(b.name)
  );
}

/** Groups unclaimed polls by title prefix — what an admin would add as an alias. */
function groupUnmatched(polls: PollRecord[]): UnmatchedGame[] {
  const groups = new Map<string, UnmatchedGame>();
  for (const poll of polls) {
    const prefix = titlePrefix(poll.questionText);
    const key = normalizeForMatch(prefix);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { prefix, count: 1, exampleTitle: formatGameTitle(poll.questionText) });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));
}

export async function listGameSystems(event: APIGatewayProxyEventV2) {
  const [auth, { systems, pollsBySystem, unmatched }] = await Promise.all([
    optionalAuth(event),
    loadSystemsWithPolls(),
  ]);
  const response: GameSystemListResponse = {
    systems: systems.map((s) => withCount(s, pollsBySystem.get(s.systemId))).sort(mostPlayedFirst),
  };
  // Poll titles aren't secret (they're all on the public Game Log), but this list is
  // only useful to whoever maintains the aliases.
  if (auth?.isAdmin) response.unmatched = groupUnmatched(unmatched);
  return json(200, response);
}

export async function getGameSystemDetail(event: APIGatewayProxyEventV2) {
  const systemId = event.pathParameters?.systemId;
  if (!systemId) throw new HttpError(400, "Missing systemId");

  const { systems, pollsBySystem } = await loadSystemsWithPolls();
  const system = systems.find((s) => s.systemId === systemId);
  if (!system) throw new HttpError(404, "Game system not found");

  const polls = (pollsBySystem.get(systemId) ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Votes only for this system's sessions — cost scales with its session count, not
  // with the whole votes table.
  const games = await Promise.all(
    polls.map(async (poll) => summarize(poll, await fetchVotesForPoll(poll.pollId), null))
  );

  const scores = games.flatMap((g) => (g.averageScore === null ? [] : [g.averageScore]));
  const gmCounts = new Map<string, number>();
  for (const game of games) {
    if (game.gmDisplayName !== "—") gmCounts.set(game.gmDisplayName, (gmCounts.get(game.gmDisplayName) ?? 0) + 1);
  }

  const detail: GameSystemDetail = {
    system: withCount(system, polls),
    averageScore: scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null,
    gameMasters: [...gmCounts]
      .map(([displayName, count]) => ({ displayName, count }))
      .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName)),
    games,
  };
  return json(200, detail);
}

/** Trimmed, non-empty, de-duplicated (as the matcher sees them), and bounded. */
function sanitizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) throw new HttpError(400, "aliases must be an array of strings");
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") throw new HttpError(400, "aliases must be an array of strings");
    const alias = raw.trim().slice(0, MAX_ALIAS_LENGTH);
    const key = normalizeForMatch(alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases.slice(0, MAX_ALIASES);
}

/** An https URL, or "" to remove the cover. */
function sanitizeImageUrl(value: unknown): string | undefined {
  if (value === "" || value === null) return undefined;
  if (typeof value !== "string" || !/^https:\/\/\S+$/.test(value)) {
    throw new HttpError(400, "imageUrl must be an https URL");
  }
  return value;
}

interface GameSystemInput {
  name?: string;
  description?: string;
  displayIndex?: number;
  aliases?: unknown;
  imageUrl?: unknown;
}

export async function createGameSystem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as GameSystemInput;
  const name = body.name?.trim();
  if (!name) throw new HttpError(400, "name is required");

  const system: GameSystem = {
    systemId: randomUUID(),
    name,
    description: body.description ?? "",
    displayIndex: body.displayIndex ?? 0,
    aliases: body.aliases === undefined ? [] : sanitizeAliases(body.aliases),
    imageUrl: body.imageUrl === undefined ? undefined : sanitizeImageUrl(body.imageUrl),
  };
  await ddb.send(new PutCommand({ TableName: Tables.gameSystems(), Item: system }));
  return json(201, { system });
}

/**
 * Partial update: only the fields present in the body change. (It used to rebuild the
 * whole item from the body, so saving just the aliases would have blanked the name.)
 */
export async function updateGameSystem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const systemId = event.pathParameters?.systemId;
  if (!systemId) throw new HttpError(400, "Missing systemId");
  const body = JSON.parse(event.body ?? "{}") as GameSystemInput;

  const existing = (
    await ddb.send(new GetCommand({ TableName: Tables.gameSystems(), Key: { systemId } }))
  ).Item as GameSystem | undefined;
  if (!existing) throw new HttpError(404, "Game system not found");

  const name = body.name === undefined ? existing.name : body.name.trim();
  if (!name) throw new HttpError(400, "name cannot be empty");

  const system: GameSystem = {
    ...existing,
    name,
    ...(body.description !== undefined && { description: body.description }),
    ...(body.displayIndex !== undefined && { displayIndex: body.displayIndex }),
    ...(body.aliases !== undefined && { aliases: sanitizeAliases(body.aliases) }),
    ...(body.imageUrl !== undefined && { imageUrl: sanitizeImageUrl(body.imageUrl) }),
  };
  await ddb.send(new PutCommand({ TableName: Tables.gameSystems(), Item: system }));
  return json(200, { system });
}

export async function deleteGameSystem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const systemId = event.pathParameters?.systemId;
  if (!systemId) throw new HttpError(400, "Missing systemId");
  await ddb.send(
    new DeleteCommand({ TableName: Tables.gameSystems(), Key: { systemId } })
  );
  return json(204, {});
}

export async function getGameSystemImageUploadUrl(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as { contentType?: string };
  return json(200, await presignImageUpload("systems", body.contentType));
}
