import type { AppConfig } from "@revolt/common/lib/env";

/** Server address screen, outside of any instance */
export const CONNECT_PATH = "/connect";

/**
 * Find the API of an instance by its host (00-architecture §6): `/.well-known/stoat` first,
 * then `https://<host>/api` and the host itself
 * @param host Normalized host
 * @returns App configuration
 */
export async function discoverInstance(host: string): Promise<AppConfig> {
  const origin = `https://${host}`;
  let error: unknown = new Error("Failed to fetch");

  try {
    const res = await fetch(`${origin}/.well-known/stoat`);
    const appCfg = res.ok && ((await res.json()) as AppConfig);
    if (appCfg && typeof appCfg.api === "string") return appCfg;
  } catch (e) {
    error = e;
  }

  for (const api of [`${origin}/api`, origin])
    try {
      const res = await fetch(`${api}/`);
      if (res.ok && typeof (await res.json())?.ws === "string") return { api };
    } catch {
      // try the next candidate
    }

  throw error;
}

/**
 * Host of the last used account, read from the auth backup in localStorage
 * (the state store is per instance and not loaded yet)
 * @returns Host or undefined
 */
export function lastSessionHost(): string | undefined {
  try {
    const auth = JSON.parse(localStorage.getItem("auth") ?? "null") as {
      session?: { host?: string };
      saved?: { host?: string }[];
    } | null;

    const host = auth?.session?.host ?? auth?.saved?.[0]?.host;
    return typeof host === "string" && host ? host : undefined;
  } catch {
    return undefined;
  }
}
