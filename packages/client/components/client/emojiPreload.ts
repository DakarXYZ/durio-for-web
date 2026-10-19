// Custom emoji of the user's servers, fetched in the background after `Ready` (dur.io):
// otherwise the first messages that use them load each image on first sight, in the same
// moment as encrypted messages are decrypted and their files fetched. The images land in
// the HTTP cache (autumn: `max-age` one week), `CustomEmoji` then shows them from there.
import type { Client } from "stoat.js";

import { onClientDispose } from "../instance/dispose";

/** Images fetched at the same time */
const PARALLEL = 4;
/** Not more than this many per start (big servers have thousands) */
const MAX_EMOJIS = 1_000;
/** Let the first screen settle first */
const START_DELAY_MS = 3_000;

const disposed = new WeakSet<Client>();
const started = new WeakSet<Client>();

onClientDispose((client) => disposed.add(client));

/**
 * URLs of the custom emoji of the client's servers, as `CustomEmoji` requests them
 * @param client Client after `Ready`
 */
export function serverEmojiUrls(client: Client): string[] {
  const media = client.configuration?.features.autumn.url;
  if (!media) return [];

  return client.emojis
    .toList()
    .filter((emoji) => emoji.parent?.type === "Server")
    .slice(0, MAX_EMOJIS)
    .map((emoji) => `${media}/emojis/${emoji.id}`);
}

/**
 * Preload the server emoji once the client is ready (once per client)
 * @param client Client
 */
export function preloadServerEmojis(client: Client) {
  client.once("ready", () => {
    if (started.has(client)) return;
    started.add(client);
    setTimeout(() => void run(client), START_DELAY_MS);
  });
}

async function run(client: Client) {
  const queue = serverEmojiUrls(client);
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      if (disposed.has(client)) return;
      await load(url);
    }
  };

  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

/**
 * Fetch one image into the HTTP cache; failures do not matter
 * @param url Image URL
 */
function load(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = image.onerror = () => resolve();
    image.src = url;
  });
}
