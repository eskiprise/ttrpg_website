import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  createSystemMatcher,
  formatGameTitle,
  normalizeForMatch,
  slugify,
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
const MAX_SLUG_LENGTH = 60;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A slug can't look like a system id, or the detail lookup couldn't tell them apart. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

/**
 * Every system's effective URL slug: its stored one, else one derived from its name
 * (suffixed with a bit of its id in the rare case that's already taken). Systems are
 * walked in id order, so the same data always yields the same slugs.
 */
function assignSlugs(systems: GameSystem[]): Map<string, string> {
  const slugs = new Map<string, string>();
  const taken = new Set<string>();
  for (const system of systems) {
    if (system.slug) {
      slugs.set(system.systemId, system.slug);
      taken.add(system.slug);
    }
  }
  for (const system of [...systems].sort((a, b) => a.systemId.localeCompare(b.systemId))) {
    if (slugs.has(system.systemId)) continue;
    let slug = slugify(system.name) || system.systemId;
    if (taken.has(slug)) slug = `${slug}-${system.systemId.slice(0, 4)}`;
    slugs.set(system.systemId, slug);
    taken.add(slug);
  }
  return slugs;
}

function withCount(system: GameSystem, polls: PollRecord[] | undefined, slug: string): GameSystemWithCount {
  return { ...system, slug, sessionCount: polls?.length ?? 0 };
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
  const slugs = assignSlugs(systems);
  const response: GameSystemListResponse = {
    systems: systems
      .map((s) => withCount(s, pollsBySystem.get(s.systemId), slugs.get(s.systemId)!))
      .sort(mostPlayedFirst),
  };
  // Poll titles aren't secret (they're all on the public Game Log), but this list is
  // only useful to whoever maintains the aliases.
  if (auth?.isAdmin) response.unmatched = groupUnmatched(unmatched);
  return json(200, response);
}

/**
 * The route param is "{systemId}" for API Gateway's sake, but it takes a slug too — the
 * site's URLs use slugs; ids are what the older URLs (and the admin) use. A former slug
 * still finds the system; the page then moves the address bar to the current one.
 */
export async function getGameSystemDetail(event: APIGatewayProxyEventV2) {
  const param = event.pathParameters?.systemId;
  if (!param) throw new HttpError(400, "Missing systemId");

  const { systems, pollsBySystem } = await loadSystemsWithPolls();
  const slugs = assignSlugs(systems);
  const system =
    systems.find((s) => s.systemId === param) ??
    systems.find((s) => slugs.get(s.systemId) === param) ??
    systems.find((s) => s.previousSlugs?.includes(param));
  if (!system) throw new HttpError(404, "Game system not found");
  const systemId = system.systemId;

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
    system: withCount(system, polls, slugs.get(systemId)!),
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

/**
 * An admin-typed slug, checked: the right shape, not id-like, and not the current or a
 * former slug of another system. "" means "derive it from the name again".
 */
function sanitizeSlug(value: unknown, name: string, systemId: string, others: GameSystem[], otherSlugs: Map<string, string>): string {
  if (typeof value !== "string") throw new HttpError(400, "slug must be a string");
  const slug = value.trim().toLowerCase() || slugify(name);
  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug) || UUID_PATTERN.test(slug)) {
    throw new HttpError(400, "slug: лише латинські літери, цифри й дефіси (до 60 символів)");
  }
  const clash = others.find(
    (o) => o.systemId !== systemId && (otherSlugs.get(o.systemId) === slug || o.previousSlugs?.includes(slug))
  );
  if (clash) throw new HttpError(409, `slug «${slug}» вже використовує система «${clash.name}»`);
  return slug;
}

interface GameSystemInput {
  name?: string;
  description?: string;
  displayIndex?: number;
  aliases?: unknown;
  imageUrl?: unknown;
  slug?: unknown;
}

export async function createGameSystem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as GameSystemInput;
  const name = body.name?.trim();
  if (!name) throw new HttpError(400, "name is required");

  const systemId = randomUUID();
  const others = await scanAll<GameSystem>(Tables.gameSystems());
  const otherSlugs = assignSlugs(others);
  // Fixed from the start, so the page's address never follows a later rename.
  let slug: string;
  if (body.slug !== undefined) {
    slug = sanitizeSlug(body.slug, name, systemId, others, otherSlugs);
  } else {
    slug = slugify(name) || systemId;
    const taken = new Set([...otherSlugs.values(), ...others.flatMap((o) => o.previousSlugs ?? [])]);
    if (taken.has(slug)) slug = `${slug}-${systemId.slice(0, 4)}`;
  }

  const system: GameSystem = {
    systemId,
    slug,
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

  // The first save fixes the slug the page has had so far (derived from the old name),
  // so renaming the system doesn't move its page. Changing the slug itself keeps the old
  // one in previousSlugs, so links already out there still land on the page.
  const all = await scanAll<GameSystem>(Tables.gameSystems());
  const slugs = assignSlugs(all);
  const currentSlug = slugs.get(systemId) ?? existing.slug ?? slugify(existing.name);
  const slug =
    body.slug === undefined ? currentSlug : sanitizeSlug(body.slug, name, systemId, all, slugs);
  const previousSlugs =
    slug === currentSlug
      ? existing.previousSlugs
      : [...new Set([...(existing.previousSlugs ?? []), currentSlug])].filter((s) => s !== slug);

  const system: GameSystem = {
    ...existing,
    name,
    slug,
    // undefined drops the attribute (removeUndefinedValues) once nothing is left in it.
    previousSlugs: previousSlugs?.length ? previousSlugs : undefined,
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
