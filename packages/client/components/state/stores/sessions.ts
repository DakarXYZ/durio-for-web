import { normalizeHost } from "../../common/lib/env";

import type { Session } from "./Auth";

/**
 * Sessions and their per-account stores across instances (dur.io, WEB-02).
 * A session belongs to a pair (host, userId); the same user ID on another host is another account.
 */

function strOrNone(str?: string) {
  if (typeof str === "string" && str) return str;
  return undefined;
}

/**
 * Validate a stored session. Sessions saved before multi-instance support have no host:
 * they belong to the default instance, and are dropped if there is none
 * @param inSes Session as found on disk
 * @param defaultHost Host of the default instance (may be empty)
 * @returns Clean session
 */
export function cleanSession(
  inSes: Partial<Session> | undefined,
  defaultHost: string,
): Session | undefined {
  if (
    typeof inSes === "object" &&
    typeof inSes._id === "string" &&
    typeof inSes.token === "string" &&
    typeof inSes.userId === "string" &&
    inSes.valid
  ) {
    const host =
      typeof inSes.host === "string" && inSes.host
        ? normalizeHost(inSes.host)
        : defaultHost;
    if (!host) return;

    return {
      _id: inSes._id,
      token: inSes.token,
      userId: inSes.userId,
      host,
      cachedName: strOrNone(inSes.cachedName),
      cachedAvatar: strOrNone(inSes.cachedAvatar),
      valid: true,
    };
  }
}

/**
 * Find the session of an account
 * @returns Index in the list or -1
 */
export const findSession = (
  sessions: Session[],
  host: string,
  userId: string,
) => sessions.findIndex((s) => s.host === host && s.userId === userId);

/** Name of the localforage store with the per-account state of a session */
export const sessionStoreName = (ses: Pick<Session, "host" | "userId">) =>
  `@${ses.host}/${ses.userId}`;

/** Store name used before multi-instance support */
export const legacySessionStoreName = (userId: string) => `@${userId}`;

/** The part of localforage used by the migration */
export interface SessionStore {
  keys(): Promise<string[]>;
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<unknown>;
}

/**
 * Copy per-account stores from `@<userId>` to `@<host>/<userId>` (C17). The old stores are
 * left for the unused store cleanup, which runs right after
 * @param storeNames Object stores currently in the database
 * @param sessions All known sessions
 * @param open Open a store by name
 * @returns Names of the created stores
 */
export async function migrateSessionStores(
  storeNames: Iterable<string>,
  sessions: Session[],
  open: (name: string) => SessionStore,
) {
  const existing = new Set(storeNames);
  const created: string[] = [];

  for (const ses of sessions) {
    const from = legacySessionStoreName(ses.userId),
      to = sessionStoreName(ses);
    if (!existing.has(from) || existing.has(to)) continue;

    const src = open(from),
      dst = open(to);
    for (const key of await src.keys())
      await dst.setItem(key, await src.getItem(key));

    existing.add(to);
    created.push(to);
  }

  return created;
}

/**
 * Per-account stores that no session uses any more
 * @param storeNames Object stores currently in the database
 * @param sessions All known sessions
 */
export function unusedSessionStores(
  storeNames: Iterable<string>,
  sessions: Session[],
) {
  const used = sessions.map(sessionStoreName);
  return [...storeNames].filter(
    (name) => name.indexOf("@") !== -1 && !used.includes(name),
  );
}
