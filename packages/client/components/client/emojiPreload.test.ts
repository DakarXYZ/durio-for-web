import { describe, expect, it } from "vitest";

import { serverEmojiUrls } from "./emojiPreload";

const client = (emojis: { id: string; parent: { type: string } }[]) =>
  ({
    configuration: { features: { autumn: { url: "https://files.test" } } },
    emojis: { toList: () => emojis },
  }) as never;

describe("server emoji preload", () => {
  it("takes the server emoji with the URL CustomEmoji uses", () => {
    expect(
      serverEmojiUrls(
        client([
          { id: "A", parent: { type: "Server" } },
          { id: "B", parent: { type: "Detached" } },
        ]),
      ),
    ).toEqual(["https://files.test/emojis/A"]);
  });

  it("stops at 1000 and needs a file server", () => {
    const many = Array.from({ length: 1_500 }, (_, i) => ({
      id: String(i),
      parent: { type: "Server" },
    }));
    expect(serverEmojiUrls(client(many))).toHaveLength(1_000);
    expect(
      serverEmojiUrls({ emojis: { toList: () => many } } as never),
    ).toEqual([]);
  });
});
