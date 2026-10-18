import { describe, expect, test } from "vitest";

import type { Session } from "./Auth";
import {
  cleanSession,
  findSession,
  migrateSessionStores,
  SessionStore,
  sessionStoreName,
  unusedSessionStores,
} from "./sessions";

const session = (userId: string, host: string): Session => ({
  _id: `ses-${userId}`,
  token: `token-${userId}`,
  userId,
  host,
  valid: true,
});

describe("cleanSession", () => {
  const legacy = {
    _id: "ses",
    token: "token",
    userId: "01HZY0000000000000000000AA",
    valid: true,
  };

  test("moves a session without host to the default instance", () => {
    expect(cleanSession(legacy, "duri0.duckdns.org")).toEqual({
      ...legacy,
      host: "duri0.duckdns.org",
      cachedName: undefined,
      cachedAvatar: undefined,
    });
  });

  test("drops a session without host when there is no default instance", () => {
    expect(cleanSession(legacy, "")).toBeUndefined();
  });

  test("keeps and normalizes the host", () => {
    expect(
      cleanSession(
        { ...legacy, host: "Duri1.DuckDNS.org" },
        "duri0.duckdns.org",
      )?.host,
    ).toBe("duri1.duckdns.org");
  });

  test("throws away unknown fields and invalid sessions", () => {
    const clean = cleanSession(
      { ...legacy, host: "a.example", extra: 1 } as Partial<Session>,
      "",
    );
    expect(clean).not.toHaveProperty("extra");
    expect(cleanSession({ ...legacy, valid: false }, "a.example")).toBe(
      undefined,
    );
    expect(cleanSession(undefined, "a.example")).toBeUndefined();
  });
});

describe("findSession", () => {
  const saved = [session("alice", "a.example"), session("bob", "a.example")];

  test("finds by host and user (dup_login)", () => {
    expect(findSession(saved, "a.example", "bob")).toBe(1);
  });

  test("the same user ID on another host is another account", () => {
    expect(findSession(saved, "b.example", "alice")).toBe(-1);
  });
});

/** In-memory localforage database: store name -> key -> value */
function fakeDatabase(stores: Record<string, Record<string, unknown>>) {
  const open = (name: string): SessionStore => {
    stores[name] ??= {};
    return {
      keys: async () => Object.keys(stores[name]),
      getItem: async (key) => stores[name][key],
      setItem: async (key, value) => (stores[name][key] = value),
    };
  };
  return { stores, open };
}

describe("migrateSessionStores", () => {
  test("copies the old per-user store to the per-instance name", async () => {
    const db = fakeDatabase({
      global: { auth: {} },
      "@alice": { layout: { a: 1 }, draft: { b: 2 } },
    });
    const sessions = [session("alice", "a.example")];

    const created = await migrateSessionStores(
      Object.keys(db.stores),
      sessions,
      db.open,
    );

    expect(created).toEqual(["@a.example/alice"]);
    expect(db.stores["@a.example/alice"]).toEqual({
      layout: { a: 1 },
      draft: { b: 2 },
    });
    // the old store goes away in the cleanup
    expect(unusedSessionStores(Object.keys(db.stores), sessions)).toEqual([
      "@alice",
    ]);
  });

  test("does not overwrite a store that already exists", async () => {
    const db = fakeDatabase({
      "@alice": { layout: "old" },
      "@a.example/alice": { layout: "new" },
    });

    expect(
      await migrateSessionStores(
        Object.keys(db.stores),
        [session("alice", "a.example")],
        db.open,
      ),
    ).toEqual([]);
    expect(db.stores["@a.example/alice"]).toEqual({ layout: "new" });
  });

  test("skips sessions without an old store", async () => {
    const db = fakeDatabase({ global: {} });

    expect(
      await migrateSessionStores(
        Object.keys(db.stores),
        [session("bob", "b.example")],
        db.open,
      ),
    ).toEqual([]);
    expect(db.stores).not.toHaveProperty("@b.example/bob");
  });
});

describe("unusedSessionStores", () => {
  test("keeps the stores of known sessions and non-session stores", () => {
    const sessions = [
      session("alice", "a.example"),
      session("alice", "b.example"),
    ];

    expect(
      unusedSessionStores(
        [
          "global",
          "@a.example/alice",
          "@b.example/alice",
          "@c.example/alice",
          "@bob",
        ],
        sessions,
      ),
    ).toEqual(["@c.example/alice", "@bob"]);
  });

  test("store name is per instance and user", () => {
    expect(sessionStoreName(session("alice", "localhost:4173"))).toBe(
      "@localhost:4173/alice",
    );
  });
});
