import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { MediaItem, MediaListResponse } from "@ttrpg-club/shared";
import { ddb, scanAll, Tables } from "../../lib/dynamo.js";
import { HttpError, json } from "../../lib/response.js";
import { requireAdmin } from "../../lib/auth.js";
import { presignMediaUpload } from "../../lib/uploads.js";

const MAX_CAPTION_LENGTH = 200;

export async function listMedia() {
  const items = await scanAll<MediaItem>(Tables.clubMedia());
  items.sort((a, b) => a.displayIndex - b.displayIndex || a.createdAt.localeCompare(b.createdAt));
  const response: MediaListResponse = { items };
  return json(200, response);
}

export async function getMediaUploadUrl(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as { contentType?: string };
  return json(200, await presignMediaUpload(body.contentType ?? "image/jpeg"));
}

interface MediaInput {
  kind?: "photo" | "video";
  url?: string;
  posterUrl?: unknown;
  caption?: unknown;
  displayIndex?: number;
}

/** An https URL pointing at our own avatars/media CDN, or undefined to clear it. */
function sanitizeUrl(value: unknown, required: false): string | undefined;
function sanitizeUrl(value: unknown, required: true): string;
function sanitizeUrl(value: unknown, required: boolean): string | undefined {
  if (value === "" || value === null || value === undefined) {
    if (required) throw new HttpError(400, "url is required");
    return undefined;
  }
  if (typeof value !== "string" || !/^https:\/\/\S+$/.test(value)) {
    throw new HttpError(400, "url must be an https URL");
  }
  return value;
}

function sanitizeCaption(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, "caption must be a string");
  const caption = value.trim().slice(0, MAX_CAPTION_LENGTH);
  return caption || undefined;
}

/**
 * The browser has already PUT the file(s) to S3 (via getMediaUploadUrl) by the time
 * this runs — this just records the resulting URLs as one gallery item. displayIndex
 * defaults to the end of the list, so a new upload doesn't reshuffle everything already
 * on the page.
 */
export async function createMediaItem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const body = JSON.parse(event.body ?? "{}") as MediaInput;

  const kind = body.kind;
  if (kind !== "photo" && kind !== "video") throw new HttpError(400, 'kind must be "photo" or "video"');
  const url = sanitizeUrl(body.url, true);
  if (kind === "photo" && body.posterUrl) {
    throw new HttpError(400, "posterUrl only applies to a video");
  }

  const displayIndex =
    body.displayIndex ?? Math.max(0, ...(await scanAll<MediaItem>(Tables.clubMedia())).map((m) => m.displayIndex + 1));

  const item: MediaItem = {
    mediaId: randomUUID(),
    kind,
    url,
    ...(kind === "video" && { posterUrl: sanitizeUrl(body.posterUrl, false) }),
    ...(sanitizeCaption(body.caption) && { caption: sanitizeCaption(body.caption) }),
    displayIndex,
    createdAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: Tables.clubMedia(), Item: item }));
  return json(201, { item });
}

export async function updateMediaItem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const mediaId = event.pathParameters?.mediaId;
  if (!mediaId) throw new HttpError(400, "Missing mediaId");
  const body = JSON.parse(event.body ?? "{}") as MediaInput;

  const existing = (
    await ddb.send(new GetCommand({ TableName: Tables.clubMedia(), Key: { mediaId } }))
  ).Item as MediaItem | undefined;
  if (!existing) throw new HttpError(404, "Media item not found");

  const item: MediaItem = {
    ...existing,
    ...(body.caption !== undefined && { caption: sanitizeCaption(body.caption) }),
    ...(body.displayIndex !== undefined && { displayIndex: body.displayIndex }),
    ...(body.posterUrl !== undefined && { posterUrl: sanitizeUrl(body.posterUrl, false) }),
  };
  await ddb.send(new PutCommand({ TableName: Tables.clubMedia(), Item: item }));
  return json(200, { item });
}

export async function deleteMediaItem(event: APIGatewayProxyEventV2) {
  await requireAdmin(event);
  const mediaId = event.pathParameters?.mediaId;
  if (!mediaId) throw new HttpError(400, "Missing mediaId");
  await ddb.send(new DeleteCommand({ TableName: Tables.clubMedia(), Key: { mediaId } }));
  return json(204, {});
}
