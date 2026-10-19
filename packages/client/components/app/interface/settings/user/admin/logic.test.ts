import { describe, expect, it } from "vitest";

import { adminFailure, shortCode, userTag, withElevation } from "./logic";

describe("administration page", () => {
  it("names the failures of admin calls", () => {
    expect(adminFailure({ status: 0 })).toBe("network");
    expect(adminFailure({ status: 404, type: "NotFound" })).toBe("notFound");
    expect(adminFailure({ status: 403, type: "NotPrivileged" })).toBe(
      "forbidden",
    );
    expect(adminFailure({ status: 400, type: "IsBot" })).toBe("bot");
    expect(adminFailure({ status: 403, type: "AdminElevationRequired" })).toBe(
      "elevation",
    );
    expect(adminFailure({ status: 403, type: "TotpRequired" })).toBe(
      "totpRequired",
    );
    expect(
      adminFailure({ status: 401, type: "InvalidToken", location: "x" }),
    ).toBe("invalidCode");
    expect(adminFailure({ status: 500 })).toBe("other");
    expect(adminFailure(new Error("x"))).toBe("other");
    expect(adminFailure(undefined)).toBe("other");
  });

  it("shows a user as username#discriminator", () => {
    expect(userTag({ username: "Bob", discriminator: "0001" })).toBe(
      "Bob#0001",
    );
  });

  it("turns admin mode on when the server asks, then retries once", async () => {
    const elevation = { status: 403, type: "AdminElevationRequired" };
    let calls = 0;
    const call = async () => {
      if (calls++ === 0) throw elevation;
      return "done";
    };
    expect(await withElevation(call, async () => true)).toBe("done");
    expect(calls).toBe(2);

    calls = 0;
    expect(await withElevation(call, async () => false)).toBeUndefined();
    expect(calls).toBe(1);

    const always = async () => {
      throw elevation;
    };
    await expect(withElevation(always, async () => true)).rejects.toBe(
      elevation,
    );
    await expect(
      withElevation(
        async () => {
          throw { status: 404 };
        },
        async () => true,
      ),
    ).rejects.toEqual({ status: 404 });
  });

  it("shortens long invite codes for the list", () => {
    expect(shortCode("AbC12")).toBe("AbC12");
    expect(shortCode("0123456789abcdefXYZW")).toBe("012345…XYZW");
  });
});
