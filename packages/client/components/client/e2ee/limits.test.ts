import { describe, expect, it } from "vitest";

import { MAX_ENCRYPTED_FILE_BYTES, attachmentLimit } from "./limits";

describe("attachment size caps", () => {
  it("takes the server's limit for plain files", () => {
    expect(attachmentLimit(100_000_000, false)).toBe(100_000_000);
    expect(attachmentLimit(500_000_000, false)).toBe(500_000_000);
    expect(attachmentLimit(5_000_000, false)).toBe(5_000_000);
  });

  it("never lets encrypted files grow over the client's ceiling", () => {
    expect(attachmentLimit(500_000_000, true)).toBe(MAX_ENCRYPTED_FILE_BYTES);
    expect(attachmentLimit(100_000_000, true)).toBe(100_000_000);
    expect(attachmentLimit(5_000_000, true)).toBe(5_000_000);
  });

  it("falls back to 20 MB when the server does not say", () => {
    expect(attachmentLimit(undefined, false)).toBe(20_000_000);
    expect(attachmentLimit(0, true)).toBe(20_000_000);
  });
});
