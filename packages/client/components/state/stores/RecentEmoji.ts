import { State } from "..";

import { AbstractStore } from ".";

/**
 * How many emoji are kept (the quick reactions show the first few)
 */
const KEEP = 20;

/**
 * Shown while the user has reacted with fewer emoji than the quick bar holds
 */
export const DEFAULT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢"];

export type TypeRecentEmoji = {
  /**
   * Emoji most recently reacted with, newest first: unicode or a custom emoji ID
   */
  emoji: string[];

  /**
   * How often each emoji was used (for the favourites of the emoji picker)
   */
  counts: Record<string, number>;
};

/**
 * How many emoji keep a use count
 */
const KEEP_COUNTS = 64;

/**
 * The same emoji again within this long is one use (the picker and the reaction
 * both report it)
 */
const REPEAT_MS = 1500;

/**
 * dur.io: the emoji used for reactions, for the quick reactions of a message
 */
export class RecentEmoji extends AbstractStore<"recentEmoji", TypeRecentEmoji> {
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "recentEmoji");
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {}

  /**
   * Generate default values
   */
  default(): TypeRecentEmoji {
    return {
      emoji: [],
      counts: {},
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeRecentEmoji>): TypeRecentEmoji {
    return {
      emoji: Array.isArray(input.emoji)
        ? input.emoji
            .filter((emoji) => typeof emoji === "string" && emoji)
            .slice(0, KEEP)
        : [],
      counts:
        input.counts && typeof input.counts === "object"
          ? Object.fromEntries(
              Object.entries(input.counts)
                .filter(
                  ([emoji, count]) =>
                    emoji && typeof count === "number" && count > 0,
                )
                .slice(0, KEEP_COUNTS),
            )
          : {},
    };
  }

  /**
   * The emoji and time of the last use
   */
  #last?: [string, number];

  /**
   * Remember an emoji the user reacted with
   * @param emoji Unicode emoji or custom emoji ID
   */
  use(emoji: string) {
    const now = Date.now();
    if (this.#last?.[0] === emoji && now - this.#last[1] < REPEAT_MS) return;
    this.#last = [emoji, now];

    const counts = {
      ...this.get().counts,
      [emoji]: (this.get().counts[emoji] ?? 0) + 1,
    };
    // keep the most used ones
    const kept = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEEP_COUNTS);
    this.set("counts", Object.fromEntries(kept));

    this.set(
      "emoji",
      [emoji, ...this.get().emoji.filter((entry) => entry !== emoji)].slice(
        0,
        KEEP,
      ),
    );
  }

  /**
   * The quick reactions: the most recent emoji, topped up with defaults
   * @param count How many
   * @returns Emoji
   */
  frequent(count = 16) {
    const recent = this.get().emoji;
    return Object.entries(this.get().counts)
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          // ties: the more recent first
          (recent.indexOf(a[0]) === -1 ? Infinity : recent.indexOf(a[0])) -
            (recent.indexOf(b[0]) === -1 ? Infinity : recent.indexOf(b[0])),
      )
      .slice(0, count)
      .map(([emoji]) => emoji);
  }

  /**
   * The quick reactions: the most recent emoji, topped up with defaults
   * @param count How many
   * @returns Emoji
   */
  quick(count = 5) {
    const list = [...this.get().emoji];
    for (const emoji of DEFAULT_QUICK_REACTIONS) {
      if (list.length >= count) break;
      if (!list.includes(emoji)) list.push(emoji);
    }

    return list.slice(0, count);
  }
}
