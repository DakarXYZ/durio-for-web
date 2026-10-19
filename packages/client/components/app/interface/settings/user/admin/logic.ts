// Administration page (dur.io): the decisions of the page without the page, so they can
// be tested.

/** Why an admin call failed, for the UI */
export type AdminFailure =
  /** 404: the user, or the session, is gone */
  | "notFound"
  /** 403: this account is not (or no longer) an admin */
  | "forbidden"
  /** 403 `AdminElevationRequired`: admin mode is off (or ran out) */
  | "elevation"
  /** 403 `TotpRequired`: admin mode needs an authenticator app on the account */
  | "totpRequired"
  /** 401 `InvalidToken` on elevation: the 2FA code (ticket) was wrong, expired or used */
  | "invalidCode"
  /** 400 `IsBot`: bots have no sessions */
  | "bot"
  /** No answer */
  | "network"
  | "other";

/**
 * The failure of an admin call, from an `AdminRequestError` of the SDK
 * @param error Error
 */
export function adminFailure(error: unknown): AdminFailure {
  const { status, type } = (error ?? {}) as {
    status?: unknown;
    type?: unknown;
  };
  if (status === 0) return "network";
  if (type === "AdminElevationRequired") return "elevation";
  if (type === "TotpRequired") return "totpRequired";
  // only the elevation sends a ticket: not an ended session, no logout
  if (type === "InvalidToken") return "invalidCode";
  if (status === 404) return "notFound";
  if (status === 403 || type === "NotPrivileged") return "forbidden";
  if (type === "IsBot") return "bot";
  return "other";
}

/**
 * Run an admin call; when admin mode is off, turn it on (the 2FA prompt) and run the
 * call once more
 * @param call Admin call
 * @param elevate Ask for the 2FA code and turn admin mode on; `false` when the user
 *   cancelled or cannot (no authenticator app)
 * @returns The result, `undefined` when admin mode was not turned on
 * @throws whatever the call throws otherwise
 */
export async function withElevation<T>(
  call: () => Promise<T>,
  elevate: () => Promise<boolean>,
): Promise<T | undefined> {
  try {
    return await call();
  } catch (e) {
    if (adminFailure(e) !== "elevation") throw e;
    if (!(await elevate())) return;
    return call();
  }
}

/**
 * Name of a found user as people type it
 * @param user User
 */
export function userTag(user: { username: string; discriminator: string }) {
  return `${user.username}#${user.discriminator}`;
}

/**
 * An invite code short enough for a list row (the whole code is in the copied link)
 * @param code Invite code
 */
export function shortCode(code: string) {
  return code.length > 12 ? `${code.slice(0, 6)}…${code.slice(-4)}` : code;
}
