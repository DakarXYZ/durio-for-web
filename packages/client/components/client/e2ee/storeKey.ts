import { e2eeWarn } from "./log";

/**
 * Store keys from the desktop app (stage 7, D4): 32 raw bytes per account from Electron
 * `safeStorage`, created on first use. The page hands them to the crypto worker once
 * and keeps no copy.
 */
export interface E2eeNativeBridge {
  /** Store key of an account (32 bytes) */
  e2eeStoreKey(accountKey: string): Promise<Uint8Array | ArrayBuffer>;
  /** Delete the store key of a signed-out account */
  e2eeDeleteStoreKey?(accountKey: string): Promise<void>;
}

const bridge = () =>
  (window as unknown as { native?: Partial<E2eeNativeBridge> }).native;

const DEV_PREFIX = "durio-e2ee-insecure-dev-key:";

/**
 * The account's store key: from the desktop bridge, or — only in `vite dev` — the
 * insecure development fallback. Undefined: this build cannot store keys
 * @param accountKey Account key
 */
export async function getStoreKey(
  accountKey: string,
): Promise<Uint8Array | undefined> {
  const native = bridge();
  if (native?.e2eeStoreKey) {
    const key = new Uint8Array(await native.e2eeStoreKey(accountKey));
    if (key.length !== 32) throw new Error("store key must be 32 bytes");
    return key;
  }

  if (import.meta.env.DEV) return insecureDevStoreKey(accountKey);
}

/**
 * Delete the store key of a signed-out account
 * @param accountKey Account key
 */
export async function deleteStoreKey(accountKey: string) {
  await bridge()?.e2eeDeleteStoreKey?.(accountKey);
  if (import.meta.env.DEV) localStorage.removeItem(DEV_PREFIX + accountKey);
}

/**
 * INSECURE, development only (`vite dev` without Electron): a random key kept in
 * localStorage next to the data it protects. Never part of a production build.
 * @param accountKey Account key
 */
function insecureDevStoreKey(accountKey: string) {
  e2eeWarn("INSECURE development store key in localStorage (vite dev only)");
  const name = DEV_PREFIX + accountKey;
  let hex = localStorage.getItem(name);
  if (!hex || !/^[0-9a-f]{64}$/.test(hex)) {
    hex = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(name, hex);
  }

  return Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
}
