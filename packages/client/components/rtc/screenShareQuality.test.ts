import { describe, expect, it } from "vitest";

import {
  SCREEN_SHARE_1080P60,
  pickScreenShareQuality,
} from "./screenShareQuality";

describe("screen share quality", () => {
  it("1080p 60 fps preset", () => {
    expect(SCREEN_SHARE_1080P60.resolution).toMatchObject({
      width: 1920,
      height: 1080,
      frameRate: 60,
    });
    expect(SCREEN_SHARE_1080P60.encoding.maxFramerate).toBe(60);
    expect(SCREEN_SHARE_1080P60.encoding.maxBitrate).toBe(8_000_000);
  });

  it("keeps an allowed quality", () => {
    const all = { low: "l", high: "h", high60: "h60", text: "t" };
    expect(pickScreenShareQuality(all, "high60")).toBe("h60");
    expect(pickScreenShareQuality(all, "text")).toBe("t");
    expect(pickScreenShareQuality(all)).toBe("l");
  });

  it("falls back below the server's limit", () => {
    expect(pickScreenShareQuality({ low: "l", high: "h" }, "high60")).toBe("h");
    expect(pickScreenShareQuality({ low: "l" }, "high60")).toBe("l");
    expect(pickScreenShareQuality({ low: "l" }, "text")).toBe("l");
  });
});
