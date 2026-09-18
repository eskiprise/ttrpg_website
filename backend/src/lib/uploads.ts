import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ImageUploadUrlResponse } from "@ttrpg-club/shared";
import { HttpError } from "./response.js";

const s3 = new S3Client({});
const UPLOAD_EXPIRY_SECONDS = 300;

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Short, muted, self-hosted clips only — see media.ts's own size/duration checks. */
const VIDEO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

async function presignUpload(
  bucket: string,
  keyPrefix: string,
  extension: string,
  contentType: string
): Promise<ImageUploadUrlResponse> {
  const objectKey = `${keyPrefix}/${randomUUID()}.${extension}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }),
    { expiresIn: UPLOAD_EXPIRY_SECONDS }
  );
  return { uploadUrl, objectKey, expiresInSeconds: UPLOAD_EXPIRY_SECONDS };
}

/**
 * A presigned PUT so the browser uploads an image straight to the avatars bucket
 * (served publicly by its CloudFront distribution), instead of streaming it through
 * the Lambda. Profile pictures and game-system covers share the bucket, separated by
 * key prefix — the Lambda's IAM policy grants s3:PutObject on the whole bucket.
 */
export async function presignImageUpload(
  keyPrefix: string,
  contentType: string = "image/jpeg"
): Promise<ImageUploadUrlResponse> {
  const bucket = process.env.AVATAR_BUCKET;
  if (!bucket) throw new Error("Missing AVATAR_BUCKET env var");

  const extension = IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) {
    throw new HttpError(400, "contentType must be image/jpeg, image/png or image/webp");
  }
  return presignUpload(bucket, keyPrefix, extension, contentType);
}

/**
 * Same idea, for the "About Us" gallery — photo or short muted video, in the same
 * bucket under media/. A separate function (rather than widening presignImageUpload's
 * allowed types) keeps avatar/cover uploads image-only by construction.
 */
export async function presignMediaUpload(contentType: string): Promise<ImageUploadUrlResponse> {
  const bucket = process.env.AVATAR_BUCKET;
  if (!bucket) throw new Error("Missing AVATAR_BUCKET env var");

  const extension =
    IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType] ?? VIDEO_EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) {
    throw new HttpError(
      400,
      "contentType must be image/jpeg, image/png, image/webp, video/mp4 or video/webm"
    );
  }
  return presignUpload(bucket, "media", extension, contentType);
}
