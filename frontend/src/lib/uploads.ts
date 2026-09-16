import type { ImageUploadUrlResponse } from "@ttrpg-club/shared";
import { apiFetch } from "./api";
import { resizeImage } from "./resizeImage";

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
