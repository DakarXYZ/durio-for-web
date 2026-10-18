import type { E2eePinStore } from "stoat.js";

const PREFIX = "durio-e2ee-pins:";

/**
 * Encrypted channels seen by an account (T18), kept per accountKey: channel ids only,
 * nothing secret, read synchronously before the socket says anything
 * @param accountKey Account key
 */
export function pinStore(accountKey: string): E2eePinStore {
  const key = PREFIX + accountKey;
  const load = (): string[] => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value)
        ? value.filter((id) => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  };

  return {
    load,
    pin(channelId) {
      const pins = load();
      if (pins.includes(channelId)) return;
      localStorage.setItem(key, JSON.stringify([...pins, channelId]));
    },
  };
}

/**
 * Forget the pins of a signed-out account
 * @param accountKey Account key
 */
export function deletePins(accountKey: string) {
  try {
    localStorage.removeItem(PREFIX + accountKey);
  } catch {
    // storage unavailable
  }
}
