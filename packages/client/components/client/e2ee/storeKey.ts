import { durioNative } from "@revolt/common/lib/desktop";

import { e2eeWarn } from "./log";

/**
 * Store keys from the desktop app (stage 7, D4; contract: `DurioNativeBridge` in
 * `common/lib/desktop.ts`): 32 raw bytes per account from Electron `safeStorage`,
 * created on first use. The page hands them to the crypto worker once and keeps no copy.
 */

const DEV_PREFIX = "durio-e2ee-insecure-dev-key:";

/** A store key and whether it was created just now (an older one may be lost) */
export interface StoreKey {
  key: Uint8Array;
  created: boolean;
}

/**
 * The account's store key: from the desktop bridge, or — only in `vite dev` — the
 * insecure development fallback. Undefined: this build cannot store keys
 * @param accountKey Account key
 */
export async function getStoreKey(
  accountKey: string,
): Promise<StoreKey | undefined> {
  const native = durioNative();
  if (native?.e2eeStoreKey) {
    const answer = await native.e2eeStoreKey(accountKey);
    const wrapped = !(
      answer instanceof Uint8Array || answer instanceof ArrayBuffer
    );
    const key = new Uint8Array(wrapped ? answer.key : answer);
    if (key.length !== 32) throw new Error("store key must be 32 bytes");
    return { key, created: wrapped ? answer.created : false };
  }

  if (import.meta.env.DEV) return insecureDevStoreKey(accountKey);
}

/**
 * Delete the store key of a signed-out account
 * @param accountKey Account key
 */
export async function deleteStoreKey(accountKey: string) {
  await durioNative()?.e2eeDeleteStoreKey?.(accountKey);
  if (import.meta.env.DEV) localStorage.removeItem(DEV_PREFIX + accountKey);
}

/**
 * INSECURE, development only (`vite dev` without Electron): a random key kept in
 * localStorage next to the data it protects. Never part of a production build.
 * @param accountKey Account key
 */
function insecureDevStoreKey(accountKey: string): StoreKey {
  e2eeWarn("INSECURE development store key in localStorage (vite dev only)");
  const name = DEV_PREFIX + accountKey;
  let hex = localStorage.getItem(name);
  const created = !hex || !/^[0-9a-f]{64}$/.test(hex);
  if (created) {
    hex = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(name, hex);
  }

  return {
    key: Uint8Array.from(hex!.match(/../g)!, (h) => parseInt(h, 16)),
    created,
  };
}
