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
// - Account switch (`onClientDispose`): close → terminate. Sign-out: the SDK's `logout`
//   closes and destroys the store; `forgetE2eeAccount` drops the key and the pins.
import type { Client } from "stoat.js";

import { onClientDispose } from "../../instance/dispose";
import type Instance from "../../instance/Instance";

import { revokeAllFileUrls } from "./files";
import { e2eeWarn } from "./log";
import { deletePins, pinStore } from "./pins";
import { type StoreKey, deleteStoreKey, getStoreKey } from "./storeKey";

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
    { StoatCrypto, isStoatCryptoError, lockName },
    { createStoatCryptoProvider },
  ] = await Promise.all([
    import("@durio/stoat-crypto"),
    import("stoat.js/e2ee"),
  ]);

  const worker = new Worker(new URL("./e2ee.worker.ts", import.meta.url), {
    type: "module",
  });

  let crypto: Awaited<ReturnType<typeof StoatCrypto.start>> | undefined;
  try {
    crypto = await StoatCrypto.start(worker);
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

    e2eeWarn(
      "crypto core did not start",
      isStoatCryptoError(e) ? e.code : (e as Error)?.name,
    );
    return client.e2ee.setStatus("error");
  } finally {
    key.fill(0);
  }

  const provider = createStoatCryptoProvider(crypto, {
    userId,
    deviceId,
    accountKey,
  });

  if (disposed.has(client)) return void provider.close();
  await client.e2ee.install(provider);
}

/**
 * Sign-out of an account (WEB-12): its store key and channel pins go; the store
 * itself is destroyed by the SDK's `logout` while the worker runs, or here
 * @param client Client being signed out
 * @param instance Instance
 */
export async function forgetE2eeAccount(client: Client, instance: Instance) {
  const userId = client.user?.id;
  if (!userId) return;

  // before any await: `logout` takes the provider away right after this call
  const hadCore = !!client.e2ee.provider || client.e2ee.status() === "starting";
  const locked = client.e2ee.status() === "locked";
  const accountKey = await instance.accountKey(userId);
  deletePins(accountKey);
  revokeAllFileUrls();

  try {
    await deleteStoreKey(accountKey);
  } catch (e) {
    e2eeWarn("store key not deleted", (e as Error)?.name);
  }

  // no worker of ours (never started, or it trapped): delete the store with a new one
  if (hadCore || locked) return;
  try {
    const { StoatCrypto } = await import("@durio/stoat-crypto");
    const crypto = await StoatCrypto.start(
      new Worker(new URL("./e2ee.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
    try {
      await crypto.destroyStore(accountKey);
    } finally {
      crypto.terminate();
    }
  } catch (e) {
    e2eeWarn("crypto store not deleted", (e as { code?: string })?.code);
  }
}
