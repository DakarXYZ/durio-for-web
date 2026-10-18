// Encrypted attachments out (dur.io, plan WEB-06, C8, C9): the file is encrypted in the
// crypto worker and uploaded as an opaque `file.bin` with `?encrypted=true`; images and
// videos get a 320 px JPEG thumbnail, encrypted with its own key and uploaded as a blob
// of its own. Real name, type, size, dimensions and the keys go into the payload only.
import type { Client, E2eePayloadAttachment } from "stoat.js";

const THUMBNAIL_SIZE = 320;

interface Prepared {
  metadata: Record<string, unknown>;
  thumbnail?: { blob: Blob; width: number; height: number };
}

/**
 * Encrypt and upload one file
 * @param client Client (its E2EE must be ready)
 * @param mediaUrl autumn URL
 * @param file File
 * @param options Spoiler flag, progress (encryption 0–30 %, upload 30–100 %)
 * @returns Payload attachment (holds the keys: memory only)
 */
export async function uploadEncryptedFile(
  client: Client,
  mediaUrl: string,
  file: File,
  options: { spoiler?: boolean; onProgress?: (progress: number) => void } = {},
): Promise<E2eePayloadAttachment> {
  const progress = options.onProgress ?? (() => {});
  progress(0);

  const prepared = await prepare(file);
  const encrypted = await client.e2ee.encryptFile(file);
  progress(0.3);

  const id = await upload(client, mediaUrl, encrypted.blob, (p) =>
    progress(0.3 + p * 0.7),
  );

  let thumbnail: E2eePayloadAttachment["thumbnail"];
  if (prepared.thumbnail) {
    const small = await client.e2ee.encryptThumbnail(
      new Uint8Array(await prepared.thumbnail.blob.arrayBuffer()),
    );
    thumbnail = {
      id: await upload(
        client,
        mediaUrl,
        new Blob([new Uint8Array(small.ciphertext)]),
      ),
      width: prepared.thumbnail.width,
      height: prepared.thumbnail.height,
      file: JSON.parse(small.fileJson),
    };
  }

  progress(1);
  return {
    id,
    name: file.name,
    content_type: file.type || "application/octet-stream",
    size: file.size,
    metadata: prepared.metadata,
    spoiler: !!options.spoiler,
    file: JSON.parse(encrypted.fileJson),
    ...(thumbnail ? { thumbnail } : {}),
  };
}

/**
 * Upload a ciphertext blob (XHR for upload progress)
 * @returns autumn id
 */
function upload(
  client: Client,
  mediaUrl: string,
  blob: Blob,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const body = new FormData();
  body.set("file", blob, "file.bin");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });

    xhr.addEventListener("loadend", () => {
      if (xhr.readyState === 4 && xhr.status === 200 && xhr.response?.id) {
        resolve(xhr.response.id);
      } else {
        reject(new Error(`upload failed: ${xhr.status}`));
      }
    });

    xhr.open("POST", `${mediaUrl}/attachments?encrypted=true`, true);
    const [authHeader, authHeaderValue] = client.authenticationHeader;
    xhr.setRequestHeader(authHeader, authHeaderValue);
    xhr.responseType = "json";
    xhr.send(body);
  });
}

/**
 * Metadata autumn would have computed, and a thumbnail (made here: the server cannot
 * see encrypted files)
 * @param file File
 */
async function prepare(file: File): Promise<Prepared> {
  try {
    if (file.type.startsWith("image/")) {
      const bitmap = await createImageBitmap(file);
      try {
        return {
          metadata: {
            type: "Image",
            width: bitmap.width,
            height: bitmap.height,
          },
          thumbnail: await thumbnailOf(bitmap, bitmap.width, bitmap.height),
        };
      } finally {
        bitmap.close();
      }
    }

    if (file.type.startsWith("video/")) return await prepareVideo(file);
    if (file.type.startsWith("audio/")) return { metadata: { type: "Audio" } };
    if (file.type.startsWith("text/")) return { metadata: { type: "Text" } };
  } catch {
    // not decodable here: sent as a plain file
  }

  return { metadata: { type: "File" } };
}

/**
 * Dimensions and a frame about 1 s in
 * @param file Video
 */
async function prepareVideo(file: File): Promise<Prepared> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("video"));
      video.src = url;
    });

    const metadata = {
      type: "Video",
      width: video.videoWidth,
      height: video.videoHeight,
    };

    try {
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("video"));
        video.currentTime = Math.min(1, (video.duration || 0) / 2);
      });

      return {
        metadata,
        thumbnail: await thumbnailOf(
          video,
          video.videoWidth,
          video.videoHeight,
        ),
      };
    } catch {
      return { metadata };
    }
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale to at most 320 px, JPEG
 * @param source Image or video frame
 * @param width Source width
 * @param height Source height
 */
async function thumbnailOf(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Prepared["thumbnail"]> {
  if (!width || !height) return;
  const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  return { blob, width: w, height: h };
}
