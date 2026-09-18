/**
 * Client-side checks and helpers for a gallery video clip. The site never transcodes
 * video server-side (no ffmpeg Lambda) — a short, already-compressed clip is the
 * admin's own responsibility, so this validates *before* upload rather than after, and
 * explains what to fix rather than just rejecting.
 */

/** A well-compressed 20–30s 1080p clip is usually 10–20MB; this leaves headroom. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Soft guidance vs. a hard stop — a minute-long clip still uploads, just with a nudge. */
const RECOMMENDED_MAX_SECONDS = 30;
const MAX_SECONDS = 90;

/** A moment past the very first frame, which is often solid black in a phone recording. */
const POSTER_SEEK_SECONDS = 0.3;

export class VideoTooLargeError extends Error {
  sizeMB: number;
  constructor(sizeMB: number) {
    super(`Video is ${sizeMB.toFixed(1)}MB — please compress it before uploading.`);
    this.sizeMB = sizeMB;
  }
}

export class VideoTooLongError extends Error {
  seconds: number;
  constructor(seconds: number) {
    super(`Video is ${Math.round(seconds)}s long — please trim it before uploading.`);
    this.seconds = seconds;
  }
}

export interface VideoCheckResult {
  /** Duration in seconds, read from the file's own metadata. */
  duration: number;
  /** True when the clip is valid but longer than ideal for an autoplay carousel. */
  longerThanRecommended: boolean;
}

function loadVideoElement(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Could not read this video file"));
  });
}

/**
 * Throws with a message fit to show the admin directly if the file is too big or too
 * long to upload at all; otherwise resolves with the duration, flagging anything past
 * the recommended length so the caller can show a softer warning instead of blocking.
 */
export async function checkVideoFile(file: File): Promise<VideoCheckResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new VideoTooLargeError(file.size / (1024 * 1024));
  }

  const video = await loadVideoElement(file);
  try {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not read this video's duration");
    }
    if (duration > MAX_SECONDS) {
      throw new VideoTooLongError(duration);
    }
    return { duration, longerThanRecommended: duration > RECOMMENDED_MAX_SECONDS };
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

/** A still frame from just after the start, as a JPEG — the <video poster> before playback. */
export async function capturePosterFrame(file: File): Promise<Blob> {
  const video = await loadVideoElement(file);
  try {
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video's frames"));
      video.currentTime = Math.min(POSTER_SEEK_SECONDS, video.duration / 2);
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not supported");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode poster frame"))),
        "image/jpeg",
        0.85
      )
    );
  } finally {
    URL.revokeObjectURL(video.src);
  }
}
