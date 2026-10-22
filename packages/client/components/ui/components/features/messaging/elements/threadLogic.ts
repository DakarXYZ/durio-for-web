/** Longest thread name the server takes (dur.io threads) */
export const MAX_THREAD_NAME = 100;

/**
 * A name for a thread from the text of its message: the first line, without
 * mentions and markup, cut to fit
 * @param content Message text
 * @returns Name, empty if nothing is left
 */
export function threadNameFrom(content?: string) {
  const line =
    (content ?? "")
      .replace(/<[@#%][^>]+>/g, "")
      .replace(/:[0-9A-HJKMNP-TV-Z]{26}:/g, "")
      .replace(/[*_~`|>#]+/g, "")
      .split("\n")
      .map((text) => text.replace(/\s+/g, " ").trim())
      .find(Boolean) ?? "";

  return line.length > MAX_THREAD_NAME
    ? line.slice(0, MAX_THREAD_NAME - 1) + "…"
    : line;
}
