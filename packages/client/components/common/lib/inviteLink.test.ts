import { describe, expect, it } from "vitest";

import { inviteLink, parseInvite, sameHost, serverHost } from "./inviteLink";

describe("invite links", () => {
  it("makes the link on the host of the API", () => {
    expect(serverHost("https://duri0.example.org/api")).toBe(
      "duri0.example.org",
    );
    expect(inviteLink("https://srv1.localhost:14443/api", "AbC12")).toBe(
      "https://srv1.localhost:14443/invite/AbC12",
    );
  });

  it("reads a pasted link or a bare code", () => {
    expect(parseInvite("  AbC12 ")).toEqual({ code: "AbC12" });
    expect(parseInvite("https://Srv1.localhost:14443/invite/AbC12")).toEqual({
      code: "AbC12",
      host: "srv1.localhost:14443",
    });
    expect(parseInvite("duri0.example.org/invite/AbC12/")).toEqual({
      code: "AbC12",
      host: "duri0.example.org",
    });
    expect(parseInvite("http://h.org/invite/AbC12?utm=x#top")).toEqual({
      code: "AbC12",
      host: "h.org",
    });
    expect(parseInvite(inviteLink("https://h.org/api", "a b"))).toEqual({
      code: "a b",
      host: "h.org",
    });
  });

  it("refuses what is neither", () => {
    expect(parseInvite("")).toBeUndefined();
    expect(parseInvite("   ")).toBeUndefined();
    expect(parseInvite("https://h.org/servers/abc")).toBeUndefined();
    expect(parseInvite("two words")).toBeUndefined();
  });

  it("compares hosts without case and the default port", () => {
    expect(sameHost("H.org", "h.org:443")).toBe(true);
    expect(sameHost("h.org", "h.org:14443")).toBe(false);
    expect(sameHost("a.org", "b.org")).toBe(false);
  });
});
