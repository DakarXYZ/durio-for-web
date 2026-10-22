import { describe, expect, it } from "vitest";

import { MAX_THREAD_NAME, threadNameFrom } from "./threadLogic";

describe("threadNameFrom", () => {
  it("takes the first line with text", () => {
    expect(threadNameFrom("\n\n  Release plan  \nmore")).toBe("Release plan");
  });

  it("drops mentions, custom emoji and markup", () => {
    expect(
      threadNameFrom(
        "<@01HZZZZZZZZZZZZZZZZZZZZZZZ> **look** at ||this|| :01HZZZZZZZZZZZZZZZZZZZZZZZ:",
      ),
    ).toBe("look at this");
  });

  it("cuts long text to what the server takes", () => {
    const name = threadNameFrom("x".repeat(300));
    expect(name.length).toBe(MAX_THREAD_NAME);
    expect(name.endsWith("…")).toBe(true);
  });

  it("is empty without text", () => {
    expect(threadNameFrom(undefined)).toBe("");
    expect(threadNameFrom("<@01HZZZZZZZZZZZZZZZZZZZZZZZ>")).toBe("");
  });
});
