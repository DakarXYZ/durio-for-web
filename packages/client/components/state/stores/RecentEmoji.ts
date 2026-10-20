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
};

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
    };
  }

  /**
   * Remember an emoji the user reacted with
   * @param emoji Unicode emoji or custom emoji ID
   */
  use(emoji: string) {
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
  quick(count = 5) {
    const list = [...this.get().emoji];
    for (const emoji of DEFAULT_QUICK_REACTIONS) {
      if (list.length >= count) break;
      if (!list.includes(emoji)) list.push(emoji);
    }

    return list.slice(0, count);
  }
}
