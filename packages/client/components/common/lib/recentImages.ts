// dur.io: the latest pictures for the attach panel of the composer. In the desktop
// app they are the newest files of "Pictures" and its "Screenshots" folder (the
// bridge lists and reads them); a browser cannot look into the device, so there they
// are the last pictures attached in this browser, kept in IndexedDB.
import localforage from "localforage";

import { durioNative } from "./desktop";

/** How many pictures the panel shows */
export const RECENT_IMAGES = 5;

/** Larger pictures are not kept in the browser */
const MAX_KEPT_BYTES = 15 * 1024 * 1024;

export interface RecentImage {
  id: string;
  name: string;
  /** Image URL for the tile */
  thumbnail: string;
  /** The picture as a file to attach */
  file(): Promise<File>;
}

interface Kept {
  id: string;
  name: string;
  type: string;
  time: number;
  blob: Blob;
}

const store = localforage.createInstance({ storeName: "durio-recent-images" });
const KEY = "images";

async function kept(): Promise<Kept[]> {
  try {
    return ((await store.getItem<Kept[]>(KEY)) ?? []).filter(
      (image) => image && image.blob instanceof Blob,
    );
  } catch {
    return [];
  }
}

/**
 * The latest pictures, newest first; thumbnails of the browser store are object URLs:
 * call the returned `release` once they are no longer shown
 */
export async function listRecentImages(): Promise<{
  images: RecentImage[];
  release(): void;
}> {
  const bridge = durioNative()?.recentImages;
  if (bridge) {
    try {
      const images = await bridge.list();
      return {
        images: images.map((image) => ({
          ...image,
          async file() {
            const { name, type, data } = await bridge.read(image.id);
            return new File([data as BlobPart], name, { type });
          },
        })),
        release() {},
      };
    } catch {
      // an older desktop app: the browser store below
    }
  }

  const urls: string[] = [];
  const images = (await kept()).map((image) => {
    const url = URL.createObjectURL(image.blob);
    urls.push(url);
    return {
      id: image.id,
      name: image.name,
      thumbnail: url,
      file: async () =>
        new File([image.blob], image.name, {
          type: image.type,
          lastModified: image.time,
        }),
    };
  });

  return {
    images,
    release: () => urls.forEach((url) => URL.revokeObjectURL(url)),
  };
}

/**
 * Remember pictures the user attached (browser only; the desktop app reads its folders)
 * @param files Attached files
 */
export async function rememberAttachedImages(files: File[]) {
  if (durioNative()?.recentImages) return;

  const pictures = files.filter(
    (file) => file.type.startsWith("image/") && file.size <= MAX_KEPT_BYTES,
  );
  if (!pictures.length) return;

  const fresh: Kept[] = pictures.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    time: Date.now(),
    blob: file,
  }));

  const same = (a: Kept, b: Kept) =>
    a.name === b.name && a.blob.size === b.blob.size;
  const list = [
    ...fresh.reverse(),
    ...(await kept()).filter((old) => !fresh.some((image) => same(image, old))),
  ].slice(0, RECENT_IMAGES);

  try {
    await store.setItem(KEY, list);
  } catch {
    // storage full or blocked: the panel just shows fewer pictures
  }
}
