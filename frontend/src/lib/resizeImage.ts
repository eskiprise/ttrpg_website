/**
 * Longest edge after downscaling. Covers render at most ~15rem wide on the system page
 * (≈ 500px on a 2× screen), so 1200 leaves headroom without shipping a 5 MB phone photo
 * to every visitor of the systems grid.
 */
const MAX_EDGE = 1200;

/** Downscales an image in the browser and re-encodes it as JPEG, before upload. */
export async function resizeImage(file: File, maxEdge = MAX_EDGE, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");
  // JPEG has no alpha channel — paint transparent areas (PNG art) white, not black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      quality
    )
  );
}
