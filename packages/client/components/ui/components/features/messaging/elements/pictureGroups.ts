/**
 * dur.io: several pictures in a row from one author show as one grid
 *
 * The pictures of one message and of the picture-only messages the same author sent right
 * after it (same group, no text, no reply, no reactions, nothing else) are drawn together:
 * 2 side by side, 3–4 in two columns, 5–9 in three, 10–12 in three columns of four rows;
 * a 13th starts the next grid. A single picture stays as it is.
 */

/** Most pictures in one grid */
export const GRID_MAX = 12;

/** Messages further apart than this are separate groups (as in the message list) */
const GROUP_MS = 420_000;

/**
 * What the grouping needs to know about a message
 */
export interface GroupCandidate {
  id: string;
  /** Author, including a masquerade or webhook name */
  authorKey: string;
  createdAt: number;
  /** Text left after previewed links are hidden */
  visibleText: string;
  /** Pictures it would put into a grid */
  pictures: number;
  /** Files that are not pictures (or pictures that must stay alone, like spoilers) */
  otherFiles: number;
  /** It may have a grid at all (not a system message, not undecrypted, not blocked) */
  groupable: boolean;
  /** It may join the grid before it (no reply, reactions, poll, edit …) */
  joinable: boolean;
}

/**
 * Columns and rows of a grid of `count` pictures
 */
export function gridShape(count: number) {
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  return { columns, rows: Math.ceil(count / columns) };
}

/**
 * Split pictures into grids of at most 12
 */
export function intoGrids<T>(pictures: T[]): T[][] {
  const grids: T[][] = [];
  for (let i = 0; i < pictures.length; i += GRID_MAX) {
    grids.push(pictures.slice(i, i + GRID_MAX));
  }
  return grids;
}

/**
 * Whether `next` adds its pictures to the grid `previous` belongs to
 */
export function joins(previous: GroupCandidate, next: GroupCandidate) {
  return (
    next.groupable &&
    next.joinable &&
    previous.groupable &&
    next.authorKey === previous.authorKey &&
    Math.abs(next.createdAt - previous.createdAt) < GROUP_MS &&
    new Date(next.createdAt).toDateString() ===
      new Date(previous.createdAt).toDateString() &&
    !next.visibleText.trim() &&
    next.pictures > 0 &&
    next.otherFiles === 0
  );
}

/**
 * Runs of messages that share a grid
 * @param messages Messages, oldest first
 * @param breaksBefore Ids of messages with a divider (e.g. unread) right before them
 * @returns For each run's first message the ids of the messages joining it; the joining
 *   messages are in `merged`
 */
export function pictureRuns(
  messages: GroupCandidate[],
  breaksBefore: Set<string> = new Set(),
) {
  const runs = new Map<string, string[]>();
  const merged = new Set<string>();

  let head: GroupCandidate | undefined;
  let last: GroupCandidate | undefined;
  for (const message of messages) {
    if (head && last && !breaksBefore.has(message.id) && joins(last, message)) {
      runs.get(head.id)!.push(message.id);
      merged.add(message.id);
      last = message;
      continue;
    }

    head = message.pictures > 0 && message.groupable ? message : undefined;
    last = head;
    if (head) runs.set(head.id, []);
  }

  // a run that nothing joined is just a message
  for (const [id, joined] of runs) {
    if (!joined.length) runs.delete(id);
  }

  return { runs, merged };
}
