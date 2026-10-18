// The version of the crypto core that last opened an account's store (dur.io, CR-23):
// a store written by a newer core is not opened by an older one ("update the app").
// Kept per accountKey in localStorage; nothing secret.

const CORE_VERSION = "durio-e2ee-core:";

/** Version of the core that last opened the account's store (CR-23) */
export function storedCoreVersion(accountKey: string) {
  try {
    return localStorage.getItem(CORE_VERSION + accountKey) ?? undefined;
  } catch {
    return undefined;
  }
}

export function rememberCoreVersion(accountKey: string, version: string) {
  try {
    if (!isNewer(storedCoreVersion(accountKey), version))
      localStorage.setItem(CORE_VERSION + accountKey, version);
  } catch {
    // storage unavailable
  }
}

export function forgetCoreVersion(accountKey: string) {
  try {
    localStorage.removeItem(CORE_VERSION + accountKey);
  } catch {
    // storage unavailable
  }
}

/**
 * Whether `stored` is a newer version than `current` (numeric x.y.z)
 * @param stored Version that wrote the store
 * @param current Version of this build's core
 */
export function isNewer(stored: string | undefined, current: string) {
  if (!stored) return false;
  const a = stored.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
