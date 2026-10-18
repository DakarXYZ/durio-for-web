// Encrypted attachments on screen (dur.io, plan WEB-06): fetch the blob, check its hash
// and decrypt in the worker, show it through an object URL. Plaintext stays in memory
// (no Cache API, no IndexedDB); URLs are counted per use and revoked when nobody shows
// them anymore, with a small LRU of unused ones (≈ 200 MB) for scrolling back.
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";

import type { Client, File } from "stoat.js";

import { e2eeWarn } from "./log";

type Variant = "preview" | "original";

interface Entry {
  url?: string;
  size: number;
  refs: number;
  promise: Promise<string | undefined>;
}

const MAX_UNUSED_BYTES = 200 * 1024 * 1024;

const entries = new Map<string, Entry>();
// unused entries, oldest first
const unused = new Set<string>();
let unusedBytes = 0;
let live = 0;

/** Object URLs alive right now (a leak check in DEV) */
export const liveFileUrls = () => live;

if (import.meta.env.DEV) {
  (globalThis as { __durioLiveFileUrls?: () => number }).__durioLiveFileUrls =
    liveFileUrls;
}

function revoke(key: string) {
  const entry = entries.get(key);
  entries.delete(key);
  if (unused.delete(key)) unusedBytes -= entry?.size ?? 0;
  if (entry?.url) {
    URL.revokeObjectURL(entry.url);
    live--;
  }
}

function acquire(
  client: Client,
  file: File,
  variant: Variant,
): [string, Entry] {
  const thumbnail = variant === "preview" && client.e2ee.hasThumbnail(file);
  const key = `${file.id}:${thumbnail ? "thumbnail" : "original"}`;

  const entry = entries.get(key);
  if (entry) {
    if (unused.delete(key)) unusedBytes -= entry.size;
    entry.refs++;
    return [key, entry];
  }

  const created: Entry = {
    size: 0,
    refs: 1,
    promise: client.e2ee
      .decryptFile(file, thumbnail)
      .then((blob) => {
        if (entries.get(key) !== created) return;
        created.size = blob.size;
        created.url = URL.createObjectURL(blob);
        live++;
        return created.url;
      })
      .catch((e) => {
        // AttachmentHashMismatch: the server swapped the blob, show nothing
        e2eeWarn("attachment not decrypted", (e as { code?: string })?.code);
        entries.delete(key);
        return undefined;
      }),
  };

  entries.set(key, created);
  return [key, created];
}

function release(key: string, entry: Entry) {
  entry.refs--;
  if (entry.refs > 0 || entries.get(key) !== entry) return;
  if (!entry.url) return revoke(key);

  unused.add(key);
  unusedBytes += entry.size;
  for (const oldest of unused) {
    if (unusedBytes <= MAX_UNUSED_BYTES) break;
    revoke(oldest);
  }
}

/**
 * URL to show a file: as is for plain files; for an encrypted one an object URL of the
 * decrypted blob, released when the caller's scope is cleaned up
 * @param client Client that decrypted the message
 * @param file File
 * @param variant `preview` (a thumbnail if there is one) or `original`
 * @returns URL, undefined while decrypting or when it cannot be shown
 */
export function createFileUrl(
  client: Accessor<Client>,
  file: Accessor<File | undefined>,
  variant: Variant,
): Accessor<string | undefined> {
  const [url, setUrl] = createSignal<string>();

  createEffect(() => {
    const f = file();
    setUrl(undefined);
    if (!f?.e2ee) return;

    const [key, entry] = acquire(client(), f, variant);
    let alive = true;
    void entry.promise.then((u) => alive && setUrl(u));
    onCleanup(() => {
      alive = false;
      release(key, entry);
    });
  });

  const shown = createMemo(() => {
    const f = file();
    if (f && !f.e2ee)
      return variant === "preview" ? f.createFileURL() : f.originalUrl;
    return url();
  });

  return shown;
}

/**
 * Decrypted contents of an encrypted file (text preview, download)
 * @param client Client that decrypted the message
 * @param file File
 * @returns Blob in memory
 */
export function decryptedBlob(client: Client, file: File): Promise<Blob> {
  return client.e2ee.decryptFile(file);
}

/** Drop every decrypted file (sign-out, account switch) */
export function revokeAllFileUrls() {
  for (const key of [...entries.keys()]) revoke(key);
}
