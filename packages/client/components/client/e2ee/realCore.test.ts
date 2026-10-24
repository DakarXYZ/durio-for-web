// The real crypto core (`@durio/crypt`, release wasm) through the SDK: two
// accounts, two in-memory machines, each behind `StoatCrypto` ↔ RPC ↔
// `serveCryptoWorker` (a MessageChannel stands in for the worker, as in the package's
// own tests), installed with `createStoatCryptoProvider` into a real `Client`. A small
// fake server (`/e2ee/*` in the shapes of the fixtures, messages, doorbells) sits
// behind `fetch`. Covers WEB-03…05 end to end: key upload, query, claim, room-key
// share over to-device, the mailbox and ack, encrypt, decrypt, edits.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { StoatCrypto } from "@durio/crypt";
import { serveCryptoWorker } from "@durio/crypt/worker";
import { Client } from "stoat.js";
import { createStoatCryptoProvider } from "stoat.js/e2ee";
import { ulid } from "ulid";
import { afterAll, describe, expect, it, vi } from "vitest";

const API = "https://api.test";
const pkgDir = dirname(
  createRequire(import.meta.url).resolve("@durio/crypt/package.json"),
);
const wasmBytes = readFileSync(
  join(pkgDir, "dist/wasm/stoat_crypto_wasm_bg.wasm"),
);
const load = async () => {
  const wasm = await import(
    /* @vite-ignore */
    pathToFileURL(join(pkgDir, "dist/wasm/stoat_crypto_wasm.js")).href
  );
  wasm.initSync({ module: wasmBytes });
  return wasm;
};

const ports: MessagePort[] = [];
afterAll(() => ports.forEach((p) => p.close()));

const mxid = (user: string) => `@${user.toLowerCase()}:stoat.invalid`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(check: () => boolean, what: string, ms = 10_000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out: ${what}`);
    await sleep(20);
  }
}

interface Account {
  userId: string;
  deviceId: string;
  token: string;
  client: Client;
}

/** In-memory server: device keys, one-time keys, mailboxes, messages */
class FakeServer {
  accounts = new Map<string, Account>();
  deviceKeys = new Map<string, { userId: string; keys: unknown }>();
  otks = new Map<string, Map<string, unknown>>();
  fallbacks = new Map<string, Map<string, unknown>>();
  mailbox = new Map<
    string,
    {
      id: string;
      sender: string;
      sender_device: string;
      type: string;
      content: unknown;
    }[]
  >();
  messages: Record<string, unknown>[] = [];

  constructor() {
    vi.stubGlobal("fetch", (input: string, init: RequestInit = {}) =>
      this.handle(input.toString(), init),
    );
  }

  userOf(mx: string) {
    return [...this.accounts.values()].find((a) => mxid(a.userId) === mx);
  }

  counts(device: string) {
    return {
      one_time_key_counts: {
        signed_curve25519: this.otks.get(device)?.size ?? 0,
      },
      device_unused_fallback_key_types: this.fallbacks.get(device)?.size
        ? ["signed_curve25519"]
        : [],
    };
  }

  /** Socket event to every client of a user (or one device) */
  emit(event: object, filter: (a: Account) => boolean) {
    for (const account of this.accounts.values())
      if (filter(account)) account.client.events.emit("event", event as never);
  }

  async handle(url: string, init: RequestInit) {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const me = [...this.accounts.values()].find(
      (a) => a.token === headers["X-Session-Token"],
    )!;
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.slice(API.length);
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    const json = (status: number, data?: unknown) =>
      new Response(data === undefined ? null : JSON.stringify(data), {
        status,
      });

    if (method === "POST" && path === "/e2ee/keys/upload") {
      if (body.device_keys)
        this.deviceKeys.set(me.deviceId, {
          userId: me.userId,
          keys: body.device_keys,
        });
      const otks = this.otks.get(me.deviceId) ?? new Map();
      for (const [k, v] of Object.entries(body.one_time_keys ?? {}))
        otks.set(k, v);
      this.otks.set(me.deviceId, otks);
      const fallbacks = this.fallbacks.get(me.deviceId) ?? new Map();
      for (const [k, v] of Object.entries(body.fallback_keys ?? {}))
        fallbacks.set(k, v);
      this.fallbacks.set(me.deviceId, fallbacks);
      return json(200, this.counts(me.deviceId));
    }

    if (method === "GET" && path === "/e2ee/keys/count")
      return json(200, this.counts(me.deviceId));

    if (method === "POST" && path === "/e2ee/keys/query") {
      const out: Record<string, Record<string, unknown>> = {};
      for (const user of Object.keys(body.device_keys)) {
        out[user] = {};
        for (const [device, d] of this.deviceKeys)
          if (mxid(d.userId) === user) out[user][device] = d.keys;
      }
      return json(200, {
        device_keys: out,
        failures: {},
        master_keys: {},
        self_signing_keys: {},
        user_signing_keys: {},
      });
    }

    if (method === "POST" && path === "/e2ee/keys/claim") {
      const out: Record<string, Record<string, unknown>> = {};
      for (const [user, devices] of Object.entries(
        body.one_time_keys as Record<string, Record<string, string>>,
      )) {
        out[user] = {};
        for (const device of Object.keys(devices)) {
          const otks = this.otks.get(device);
          const first = otks?.keys().next().value;
          if (first) {
            out[user][device] = { [first]: otks!.get(first) };
            otks!.delete(first);
          } else {
            const fb = this.fallbacks.get(device)?.entries().next().value;
            if (fb) out[user][device] = { [fb[0]]: fb[1] };
          }
        }
      }
      return json(200, { one_time_keys: out, failures: {} });
    }

    if (method === "PUT" && path.startsWith("/e2ee/to_device/")) {
      for (const [user, devices] of Object.entries(
        body.messages as Record<string, Record<string, unknown>>,
      )) {
        const account = this.userOf(user);
        if (!account) continue;
        for (const [device, content] of Object.entries(devices)) {
          const targets =
            device === "*"
              ? [...this.deviceKeys]
                  .filter(
                    ([d, k]) =>
                      k.userId === account.userId && d !== me.deviceId,
                  )
                  .map(([d]) => d)
              : [device];
          for (const target of targets) {
            const id = ulid();
            const box = this.mailbox.get(target) ?? [];
            box.push({
              id,
              sender: mxid(me.userId),
              sender_device: me.deviceId,
              type: body.type,
              content,
            });
            this.mailbox.set(target, box);
            this.emit(
              {
                type: "E2eeToDevice",
                id,
                recipient_device: target,
                sender: mxid(me.userId),
                sender_device: me.deviceId,
                event_type: body.type,
              },
              (a) => a.deviceId === target,
            );
          }
        }
      }
      return json(200, {});
    }

    if (method === "GET" && path.startsWith("/e2ee/to_device?")) {
      const limit = Number(new URL(url).searchParams.get("limit"));
      return json(200, {
        messages: (this.mailbox.get(me.deviceId) ?? []).slice(0, limit),
      });
    }

    if (method === "POST" && path === "/e2ee/to_device/ack") {
      const ids = new Set(body.ids as string[]);
      this.mailbox.set(
        me.deviceId,
        (this.mailbox.get(me.deviceId) ?? []).filter((m) => !ids.has(m.id)),
      );
      return json(204);
    }

    const send = path.match(/^\/channels\/(\w+)\/messages$/);
    if (method === "POST" && send) {
      const message = {
        _id: ulid(),
        channel: send[1],
        author: me.userId,
        nonce: body.nonce,
        content: "🔒 Encrypted message. Update the app.",
        encrypted: body.encrypted,
        ...(body.replies
          ? { replies: body.replies.map((r: { id: string }) => r.id) }
          : {}),
      };
      this.messages.push(message);
      this.emit({ type: "Message", ...message }, () => true);
      return json(200, message);
    }

    const edit = path.match(/^\/channels\/(\w+)\/messages\/(\w+)$/);
    if (method === "PATCH" && edit) {
      const message = this.messages.find((m) => m._id === edit[2])!;
      message.encrypted = body.encrypted;
      this.emit(
        {
          type: "MessageUpdate",
          id: edit[2],
          channel: edit[1],
          data: { encrypted: body.encrypted, edited: new Date().toISOString() },
        },
        () => true,
      );
      return json(200, message);
    }

    return json(404);
  }
}

const config = {
  stoat: "0.16.0",
  revolt: "0.16.0",
  ws: "wss://events.test",
  app: "https://app.test",
  vapid: "",
  features: {
    autumn: { enabled: true, url: "https://files.test" },
    january: { enabled: false, url: "" },
    e2ee: {
      enabled: true,
      envelope_versions: [1],
      max_envelope_bytes: 16384,
      default_for_new_dms: false,
      max_to_device_batch: 1000,
      max_to_device_bytes: 65536,
      max_attachments: 10,
      max_request_bytes: 4194304,
    },
  },
};

async function account(server: FakeServer): Promise<Account> {
  const userId = ulid();
  const deviceId = ulid();
  const token = ulid();
  const client = new Client({ baseURL: API }, config as never);
  client.useExistingSession({ _id: deviceId, token, user_id: userId });
  const a = { userId, deviceId, token, client };
  server.accounts.set(userId, a);
  return a;
}

async function crypto(a: Account) {
  const { port1, port2 } = new MessageChannel();
  ports.push(port1, port2);
  serveCryptoWorker({ endpoint: port2 as never, load });
  const core = await StoatCrypto.start(port1 as never);
  await core.open(a.userId, a.deviceId, { kind: "memory" });
  // the library's key requests wait a few seconds by default
  await core.setTiming({
    keyRequestDelayMs: 0,
    toDeviceRetryMs: 100,
    toDeviceRetryAttempts: 3,
  });
  return createStoatCryptoProvider(core, {
    userId: a.userId,
    deviceId: a.deviceId,
  });
}

describe("real crypto core through the SDK (WEB-03…05)", () => {
  it("shares keys, sends, decrypts and edits between two accounts", async () => {
    const server = new FakeServer();
    const alice = await account(server);
    const bob = await account(server);

    for (const [me, other] of [
      [alice, bob],
      [bob, alice],
    ]) {
      me.client.user = me.client.users.getOrCreate(me.userId, {
        _id: me.userId,
        username: "me",
        discriminator: "0001",
        relationship: "User",
        online: true,
      } as never);
      me.client.users.getOrCreate(other.userId, {
        _id: other.userId,
        username: "other",
        discriminator: "0002",
        relationship: "Friend",
        online: true,
      } as never);
    }

    const dmId = ulid();
    for (const a of [alice, bob]) {
      a.client.channels.getOrCreate(dmId, {
        _id: dmId,
        channel_type: "DirectMessage",
        active: true,
        recipients: [alice.userId, bob.userId],
        encryption: {
          algorithm: "m.megolm.v1.aes-sha2",
          enabled_at: "2026-10-18T00:00:00Z",
          enabled_by: alice.userId,
        },
      } as never);
      await a.client.e2ee.install(await crypto(a), {
        sync: { safetyIntervalMs: 0 },
      });
      a.client.e2ee.onReady();
    }

    await until(
      () =>
        server.deviceKeys.size === 2 &&
        (server.otks.get(bob.deviceId)?.size ?? 0) > 0,
      "device keys uploaded",
    );

    // Alice → Bob
    const sent = await alice.client.channels
      .get(dmId)!
      .sendMessage("hello <@" + bob.userId + ">", ulid());
    expect(JSON.stringify(server.messages)).not.toContain("hello");
    await until(() => sent.e2ee?.state === "ok", "own message shown");
    expect(sent.content).toBe(`hello <@${bob.userId}>`);

    const atBob = () => bob.client.messages.get(sent.id);
    await until(() => atBob()?.e2ee?.state === "ok", "Bob decrypts");
    expect(atBob()!.content).toBe(`hello <@${bob.userId}>`);
    expect(atBob()!.mentioned).toBe(true);
    expect(server.mailbox.get(bob.deviceId) ?? []).toHaveLength(0);

    // Bob → Alice, a reply
    const reply = await bob.client.channels
      .get(dmId)!
      .sendMessage(
        { content: "hi back", replies: [{ id: sent.id, mention: false }] },
        ulid(),
      );
    await until(
      () => alice.client.messages.get(reply.id)?.e2ee?.state === "ok",
      "Alice decrypts",
    );
    expect(alice.client.messages.get(reply.id)!.content).toBe("hi back");

    // Alice edits her message
    await alice.client.messages.get(sent.id)!.edit({ content: "edited" });
    await until(() => atBob()?.content === "edited", "Bob sees the edit");
    expect(atBob()!.e2ee?.state).toBe("ok");

    await alice.client.e2ee.uninstall();
    await bob.client.e2ee.uninstall();
    vi.unstubAllGlobals();
  }, 30_000);
});
