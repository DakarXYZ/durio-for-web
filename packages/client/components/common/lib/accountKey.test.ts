import { describe, expect, test } from "vitest";

import { accountKey, canonicalApiUrl } from "./accountKey";

describe("canonicalApiUrl", () => {
  // the same vectors as pushd `routing.rs` and Android `CanonicalApiUrlTest`
  test.each([
    ["https://duri0.duckdns.org/api", "https://duri0.duckdns.org/api"],
    ["https://duri0.duckdns.org/api/", "https://duri0.duckdns.org/api"],
    ["HTTPS://Duri0.DuckDNS.org/api", "https://duri0.duckdns.org/api"],
    ["https://duri0.duckdns.org:443/api", "https://duri0.duckdns.org/api"],
    ["http://localhost:80/", "http://localhost"],
    ["http://10.0.2.2:14702", "http://10.0.2.2:14702"],
    ["https://example.com:8443/api", "https://example.com:8443/api"],
    ["https://api.stoat.chat", "https://api.stoat.chat"],
    ["duri0.duckdns.org/api", "https://duri0.duckdns.org/api"],
    ["  https://duri0.duckdns.org/API/  ", "https://duri0.duckdns.org/API"],
  ])("%j", (input, expected) => {
    expect(canonicalApiUrl(input)).toBe(expected);
  });
});

describe("accountKey", () => {
  const user = "01HZY0000000000000000000AA";

  test("matches the specified digest", async () => {
    // python: hashlib.sha256(b"https://duri0.duckdns.org/api\n" + user).hexdigest()[:16]
    // (the same vector as Android `AccountKeyTest`)
    expect(await accountKey("https://duri0.duckdns.org/api", user)).toBe(
      "1d81889494246dac",
    );
  });

  test("uses the canonical API URL", async () => {
    const key = await accountKey("https://duri0.duckdns.org/api", user);
    expect(await accountKey("HTTPS://Duri0.DuckDNS.org:443/api/", user)).toBe(
      key,
    );
    expect(await accountKey("duri0.duckdns.org/api", user)).toBe(key);
  });

  test("differs per server and per user", async () => {
    const key = await accountKey("https://duri0.duckdns.org/api", user);
    expect(await accountKey("https://duri1.duckdns.org/api", user)).not.toBe(
      key,
    );
    expect(
      await accountKey(
        "https://duri0.duckdns.org/api",
        "01HZY0000000000000000000AB",
      ),
    ).not.toBe(key);
    // the path is part of the API address
    expect(await accountKey("https://duri0.duckdns.org", user)).not.toBe(key);
  });
});
