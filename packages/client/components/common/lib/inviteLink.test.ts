import { describe, expect, it } from "vitest";

import { parseInvite, sameHost, serverHost } from "./inviteLink";

describe("invite links", () => {
  it("takes the host of the API", () => {
    expect(serverHost("https://duri0.example.org/api")).toBe(
      "duri0.example.org",
    );
  });

  it("reads a pasted invite link or a bare code", () => {
    expect(parseInvite("  AbC12 ")).toEqual({ code: "AbC12" });
    expect(parseInvite("https://Srv1.localhost:14443/invite/AbC12")).toEqual({
      code: "AbC12",
      host: "srv1.localhost:14443",
    });
    expect(parseInvite("duri0.example.org/invite/AbC12/")).toEqual({
      code: "AbC12",
      host: "duri0.example.org",
    });
    expect(parseInvite("http://h.org/INVITE/AbC12?utm=x#top")).toEqual({
      code: "AbC12",
      host: "h.org",
    });
    expect(parseInvite("https://h.org/invite/a%20b")).toEqual({
      code: "a b",
      host: "h.org",
    });
  });

  it("refuses what is no invite", () => {
    expect(parseInvite("")).toBeUndefined();
    expect(parseInvite("   ")).toBeUndefined();
    expect(parseInvite("https://h.org/servers/abc")).toBeUndefined();
    // the old sign-up links are gone
    expect(parseInvite("https://h.org/join/AbC12")).toBeUndefined();
    expect(parseInvite("two words")).toBeUndefined();
  });

  it("compares hosts without case and the default port", () => {
    expect(sameHost("H.org", "h.org:443")).toBe(true);
    expect(sameHost("h.org", "h.org:14443")).toBe(false);
    expect(sameHost("a.org", "b.org")).toBe(false);
  });
});
