// E2EE of the logged-in account (dur.io, plan WEB-03, WEB-12): one crypto worker per
// account and server (`@durio/stoat-crypto`), installed into the SDK as its
// `E2eeProvider`.
//
// - Starts lazily after the first `Ready`, if the server has E2EE or the account has an
//   encrypted channel; the worker, the wasm and the page side of the package are
//   separate chunks.
// - One owner per accountKey (Q28): the worker holds the Web Lock; another holder →
//   `locked` ("encryption is active in another window": no writing to encrypted
//   channels) until that lock is released.
// - The store key comes from the desktop bridge (stage 7); `vite dev` has an insecure
//   fallback, other builds without the bridge report `unavailable`.
// - Account switch (`onClientDispose`): close → terminate. Sign-out
//   (`forgetE2eeAccount`, WEB-12): the SDK closes and destroys the store — or, if that
//   did not happen, a worker of our own does, a blocked deletion retried — then the
//   store key, pins and the device's local marks go.
// - Lost keys (AN-42): the bridge created a new store key although the account's store
//   exists, or the store cannot be opened with its key → `keyLost` (reset = sign out
//   and in again). A store written by a newer core → `updateApp` (CR-23).
import type { Client } from "stoat.js";

import { onClientDispose } from "../../instance/dispose";
import type Instance from "../../instance/Instance";

import {
  forgetCoreVersion,
  isNewer,
  rememberCoreVersion,
  storedCoreVersion,
} from "./coreVersion";
import { revokeAllFileUrls } from "./files";
import { e2eeWarn } from "./log";
import { deletePins, pinStore } from "./pins";
import { type StoreKey, deleteStoreKey, getStoreKey } from "./storeKey";
import { forgetDeviceMarks } from "./ui/marks";

export { createFileUrl, decryptedBlob, liveFileUrls } from "./files";
export { uploadEncryptedFile } from "./upload";

const disposed = new WeakSet<Client>();
const attached = new WeakSet<Client>();

onClientDispose((client) => {
  disposed.add(client);
  void client.e2ee.uninstall();
  revokeAllFileUrls();
});

/**
 * Start E2EE for a client once it is ready (call once per client)
 * @param client Client
 * @param instance Instance the client belongs to
 */
export function attachE2ee(client: Client, instance: Instance) {
  if (attached.has(client)) return;
  attached.add(client);

  let restarted = false;
  client.e2ee.on((event) => {
    // the core trapped (`Panic`): one new worker
    if (event.type === "status" && event.status === "error" && !restarted) {
      restarted = true;
      setTimeout(() => {
        if (disposed.has(client) || client.e2ee.status() !== "error") return;
        client.e2ee.setStatus("off");
        void start(client, instance);
      }, 5_000);
    }
  });

  const onReady = () => {
    if (client.e2ee.status() === "off") void start(client, instance);
  };

  client.on("ready", onReady);
  client.on("channelUpdate", (channel) => {
    if (channel.isEncrypted && client.ready()) onReady();
  });
}

/**
 * Start the crypto worker and install it into the SDK
 * @param client Client
 * @param instance Instance
 */
async function start(client: Client, instance: Instance) {
  const userId = client.user?.id;
  const deviceId = client.sessionId;
  if (!userId || !deviceId || disposed.has(client)) return;

  const accountKey = await instance.accountKey(userId);
  client.e2ee.setPinStore(pinStore(accountKey));

  const needed =
    client.e2ee.enabled || client.channels.find((c) => c.isEncrypted);
  if (!needed || client.e2ee.status() !== "off" || disposed.has(client)) return;

  client.e2ee.setStatus("starting");

  let storeKey: StoreKey | undefined;
  try {
    storeKey = await getStoreKey(accountKey);
  } catch (e) {
    e2eeWarn("no store key", (e as Error)?.name);
  }

  if (!storeKey) return client.e2ee.setStatus("unavailable");
  const key = storeKey.key;

  const [
    { StoatCrypto, isStoatCryptoError, lockName, storeName },
    { createStoatCryptoProvider },
  ] = await Promise.all([
    import("@durio/stoat-crypto"),
    import("stoat.js/e2ee"),
  ]);

  // a new key for an existing store: the old key is lost (AN-42)
  if (storeKey.created && (await storeExists(storeName(accountKey)))) {
    key.fill(0);
    e2eeWarn("store key lost");
    return client.e2ee.setStatus("keyLost");
  }

  const worker = new Worker(new URL("./e2ee.worker.ts", import.meta.url), {
    type: "module",
  });

  let crypto: Awaited<ReturnType<typeof StoatCrypto.start>> | undefined;
  try {
    crypto = await StoatCrypto.start(worker);

    // a store written by a newer core is not opened (CR-23)
    if (isNewer(storedCoreVersion(accountKey), crypto.info.coreVersion)) {
      crypto.terminate();
      key.fill(0);
      return client.e2ee.setStatus("updateApp");
    }

    await crypto.open(userId, deviceId, {
      kind: "indexedDb",
      accountKey,
      key,
    });
  } catch (e) {
    if (crypto) crypto.terminate();
    else worker.terminate();

    if (isStoatCryptoError(e) && e.code === "StoreLocked") {
      client.e2ee.setStatus("locked");
      // wait until the other window lets go, then try again
      void navigator.locks
        ?.request(lockName(accountKey), () => undefined)
        .then(() => {
          if (disposed.has(client) || client.e2ee.status() !== "locked") return;
          client.e2ee.setStatus("off");
          void start(client, instance);
        });
      return;
    }

    const code = isStoatCryptoError(e) ? e.code : (e as Error)?.name;
    e2eeWarn("crypto core did not start", code);
    // the store is there but does not open with this key, or is not this device's
    return client.e2ee.setStatus(
      code === "Store" || code === "StoreMismatch" ? "keyLost" : "error",
    );
  } finally {
    key.fill(0);
  }

  rememberCoreVersion(accountKey, crypto.info.coreVersion);

  const provider = createStoatCryptoProvider(crypto, {
    userId,
    deviceId,
    accountKey,
  });

  if (disposed.has(client)) return void provider.close();
  await client.e2ee.install(provider);
}

/**
 * Sign-out of an account (WEB-12), also after its session ended (401): the crypto
 * store, its key, the channel pins, the device's local marks and object URLs go
 * @param client Client being signed out
 * @param instance Instance
 * @param session The stored session: a client whose session ended before `Ready`
 *   (the app started after a revocation) knows no user
 */
export async function forgetE2eeAccount(
  client: Client,
  instance: Instance,
  session?: { userId: string; _id?: string },
) {
  const userId = client.user?.id ?? session?.userId;
  const deviceId = client.sessionId ?? session?._id;
  if (!userId) return;

  // first, synchronously: the SDK's `logout` finds no core left to close
  const uninstalled = client.e2ee.uninstall({ destroy: true });
  revokeAllFileUrls();

  const accountKey = await instance.accountKey(userId);
  deletePins(accountKey);
  forgetCoreVersion(accountKey);
  if (deviceId) forgetDeviceMarks(deviceId);

  // the store was not destroyed with the core (none ran, it trapped, or the deletion
  // stayed blocked): delete it with a worker of our own
  if (!(await uninstalled)) {
    try {
      const [{ StoatCrypto }, { retryWhileLocked }] = await Promise.all([
        import("@durio/stoat-crypto"),
        import("stoat.js/e2ee"),
      ]);
      const crypto = await StoatCrypto.start(
        new Worker(new URL("./e2ee.worker.ts", import.meta.url), {
          type: "module",
        }),
      );
      try {
        await retryWhileLocked(() => crypto.destroyStore(accountKey));
      } finally {
        crypto.terminate();
      }
    } catch (e) {
      e2eeWarn("crypto store not deleted", (e as { code?: string })?.code);
    }
  }

  // the key last: a store that could not be deleted stays unreadable
  try {
    await deleteStoreKey(accountKey);
  } catch (e) {
    e2eeWarn("store key not deleted", (e as Error)?.name);
  }
}

/**
 * Whether an IndexedDB store of the crypto core exists
 * @param name Store name prefix (`durio-e2ee-<accountKey>`)
 */
async function storeExists(name: string) {
  try {
    const databases = await indexedDB.databases?.();
    return !!databases?.some((db) => db.name?.startsWith(name));
  } catch {
    return false;
  }
}
