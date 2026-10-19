import { describe, expect, it } from "vitest";

import { adminFailure, userTag } from "./logic";

describe("administration page", () => {
  it("names the failures of admin calls", () => {
    expect(adminFailure({ status: 0 })).toBe("network");
    expect(adminFailure({ status: 404, type: "NotFound" })).toBe("notFound");
    expect(adminFailure({ status: 403, type: "NotPrivileged" })).toBe(
      "forbidden",
    );
    expect(adminFailure({ status: 400, type: "IsBot" })).toBe("bot");
    expect(adminFailure({ status: 500 })).toBe("other");
    expect(adminFailure(new Error("x"))).toBe("other");
    expect(adminFailure(undefined)).toBe("other");
  });

  it("shows a user as username#discriminator", () => {
    expect(userTag({ username: "Bob", discriminator: "0001" })).toBe(
      "Bob#0001",
    );
  });
});
