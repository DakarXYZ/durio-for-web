/* global console, fetch, Buffer */
// The RNNoise noise suppression worklet for the desktop build (plan WEB-11, Q63): the
// desktop app loads no remote code, so the worklet and its wasm — which
// `livekit-rnnoise-processor` otherwise loads from jsDelivr — are downloaded once at
// build time, checked against pinned SHA-256 sums, and packaged into dist-desktop by the
// desktop plugin. They are not committed (binary, third-party).
//
// CLI: node desktop/fetch-rnnoise.mjs   (idempotent; `mise build:desktop` runs it)
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The commit `livekit-rnnoise-processor` (RNNoiseNode.js) pins for its CDN files */
export const RNNOISE_COMMIT = "5edbd8a06a95c2c1736d38458ed34793e8d90bae";

export const RNNOISE_FILES = {
  "RNNoiseWorklet.js":
    "14fbc044a0f81cf7880c66e1bfb4162bf4d0a15935104d2a63ec66b268c619d7",
  "rnnoise.wasm":
    "f4a9474de4b1dcf53c5a8f96ec5dfb8034f92aae87fd5dbeb10fe5570d079d9a",
};

export const RNNOISE_CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  ".cache",
  "durio-rnnoise",
);

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/**
 * Whether the cached files are all there with the pinned hashes
 * @returns {Promise<boolean>}
 */
export async function rnnoiseCached() {
  for (const [name, hash] of Object.entries(RNNOISE_FILES)) {
    try {
      if (sha256(await readFile(join(RNNOISE_CACHE, name))) !== hash)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Download the files into the cache unless they are there already */
export async function fetchRnnoise() {
  if (await rnnoiseCached()) return console.log("rnnoise: cached");

  await mkdir(RNNOISE_CACHE, { recursive: true });
  for (const [name, hash] of Object.entries(RNNOISE_FILES)) {
    const url = `https://cdn.jsdelivr.net/gh/dadadah/livekit-rnnoise-processor@${RNNOISE_COMMIT}/dist/${name}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`rnnoise: ${name}: HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    const actual = sha256(data);
    if (actual !== hash)
      throw new Error(`rnnoise: ${name}: sha256 ${actual}, expected ${hash}`);
    await writeFile(join(RNNOISE_CACHE, name), data);
    console.log(`rnnoise: ${name} ok`);
  }
}
