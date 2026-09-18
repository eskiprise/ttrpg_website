import type { ImageUploadUrlResponse } from "@ttrpg-club/shared";
import { apiFetch } from "./api";
import { resizeImage } from "./resizeImage";
import { capturePosterFrame, checkVideoFile } from "./videoMedia";

/** Gallery photos fill more of the screen than a game-system cover, so allow a bit more detail. */
const GALLERY_PHOTO_MAX_EDGE = 1600;

/** Public CDN in front of the avatars bucket — profile pictures and system covers. */
export const IMAGE_CDN_BASE_URL = import.meta.env.VITE_AVATAR_CDN_BASE_URL ?? "";

/** Downscales, uploads straight to S3 via a presigned URL, and returns the public URL to save. */
export async function uploadGameSystemCover(file: File, token: string | null): Promise<string> {
  const image = await resizeImage(file);
  const { uploadUrl, objectKey } = await apiFetch<ImageUploadUrlResponse>(
    "/admin/game-systems/image-upload-url",
    { method: "POST", token, body: { contentType: image.type } }
  );
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": image.type },
    body: image,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return `${IMAGE_CDN_BASE_URL}/${objectKey}`;
}

/**
 * Uploads one gallery photo or video and returns what createMediaItem needs to save.
 * A photo is downscaled the same way covers are; a video is checked (size/duration)
 * and uploaded as-is (the site never transcodes), alongside a poster frame captured
 * from it — that's a second presigned upload, since the poster is its own JPEG object.
 */
export async function uploadMediaFile(
  file: File,
  token: string | null
): Promise<
  | { kind: "photo"; url: string }
  | { kind: "video"; url: string; posterUrl: string; longerThanRecommended: boolean }
> {
  async function upload(blob: Blob | File): Promise<string> {
    const { uploadUrl, objectKey } = await apiFetch<ImageUploadUrlResponse>(
      "/admin/media/upload-url",
      { method: "POST", token, body: { contentType: blob.type } }
    );
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    return `${IMAGE_CDN_BASE_URL}/${objectKey}`;
  }

  if (file.type.startsWith("video/")) {
    const { longerThanRecommended } = await checkVideoFile(file);
    const poster = await capturePosterFrame(file);
    const [url, posterUrl] = await Promise.all([upload(file), upload(poster)]);
    return { kind: "video", url, posterUrl, longerThanRecommended };
  }

  const photo = await resizeImage(file, GALLERY_PHOTO_MAX_EDGE);
  return { kind: "photo", url: await upload(photo) };
}
