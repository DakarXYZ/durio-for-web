// Administration page (dur.io): the decisions of the page without the page, so they can
// be tested.

/** Why an admin call failed, for the UI */
export type AdminFailure =
  /** 404: the user, or the session, is gone */
  | "notFound"
  /** 403: this account is not (or no longer) an admin */
  | "forbidden"
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
  if (status === 404) return "notFound";
  if (status === 403 || type === "NotPrivileged") return "forbidden";
  if (type === "IsBot") return "bot";
  return "other";
}

/**
 * Name of a found user as people type it
 * @param user User
 */
export function userTag(user: { username: string; discriminator: string }) {
  return `${user.username}#${user.discriminator}`;
}
