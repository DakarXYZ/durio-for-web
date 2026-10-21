import { IS_DESKTOP, durioNative } from "@revolt/common/lib/desktop";

import { e2eeWarn } from "./log";

/**
 * Store keys from the desktop app (stage 7, D4; contract: `DurioNativeBridge` in
 * `common/lib/desktop.ts`): 32 raw bytes per account from Electron `safeStorage`,
 * created on first use. The page hands them to the crypto worker once and keeps no copy.
 *
 * In a browser (the web client a dur.io server hosts at /web/app/) the key is kept by the
 * browser itself: 32 random bytes encrypted with a non-extractable AES-GCM `CryptoKey`,
 * both in IndexedDB. Weaker than the desktop app: the key sits in the same browser
 * profile as the store it protects (the wrapping only keeps the raw bytes out of the
 * database), and the page's code comes from the server. Users are told so
 * (`KEYS_IN_BROWSER`, the first E2EE prompt).
 */

/** The keys of this device are kept by the browser (not the desktop app, not `vite dev`) */
export const KEYS_IN_BROWSER = !IS_DESKTOP && !import.meta.env.DEV;

const BROWSER_DB = "durio-e2ee-store-keys";
const BROWSER_STORE = "keys";

/** A store key as the browser keeps it */
interface BrowserStoreKey {
  wrapKey: CryptoKey;
  iv: Uint8Array<ArrayBuffer>;
  wrapped: ArrayBuffer;
}

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
  if (KEYS_IN_BROWSER) return browserStoreKey(accountKey);
}

/**
 * Delete the store key of a signed-out account
 * @param accountKey Account key
 */
export async function deleteStoreKey(accountKey: string) {
  await durioNative()?.e2eeDeleteStoreKey?.(accountKey);
  if (import.meta.env.DEV) localStorage.removeItem(DEV_PREFIX + accountKey);
  if (KEYS_IN_BROWSER)
    await withKeyStore("readwrite", (store) => store.delete(accountKey));
}

/**
 * Run one request on the browser's key store
 * @param mode Transaction mode
 * @param request The request
 * @returns Its result, once the transaction is done
 */
function withKeyStore<T>(
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(BROWSER_DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(BROWSER_STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(BROWSER_STORE, mode);
      const req = request(tx.objectStore(BROWSER_STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error ?? req.error);
      };
    };
  });
}

/**
 * The account's store key kept by the browser, created on first use. One tab at a
 * time (Web Lock), so two tabs never create two keys for one store
 * @param accountKey Account key
 */
async function browserStoreKey(accountKey: string): Promise<StoreKey> {
  const run = async (): Promise<StoreKey> => {
    const kept = await withKeyStore<BrowserStoreKey | undefined>(
      "readonly",
      (store) => store.get(accountKey),
    );
    if (kept) {
      const key = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: kept.iv },
        kept.wrapKey,
        kept.wrapped,
      );
      return { key: new Uint8Array(key), created: false };
    }

    // ask the browser not to evict the store under storage pressure (best effort)
    void navigator.storage?.persist?.().catch(() => false);

    const wrapKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const key = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrapKey,
      key,
    );
    await withKeyStore("readwrite", (store) =>
      store.put({ wrapKey, iv, wrapped } satisfies BrowserStoreKey, accountKey),
    );
    return { key, created: true };
  };

  return navigator.locks
    ? navigator.locks.request(`durio-e2ee-store-key:${accountKey}`, run)
    : run();
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
