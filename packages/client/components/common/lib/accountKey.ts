/**
 * Account identity across servers (dur.io, 00-architecture §6, C17).
 *
 * Both functions must give exactly the same output as Android (`canonicalApiUrl`, `accountKey`)
 * and pushd (`canonical_api_url` in `crates/daemons/pushd/src/consumers/outbound/routing.rs`):
 * the tests share their vectors.
 */

/** Lowercase ASCII letters only, like Rust's `to_ascii_lowercase` */
const asciiLowercase = (str: string) =>
  str.replace(/[A-Z]/g, (c) => c.toLowerCase());

/**
 * Canonical form of an API URL: surrounding whitespace trimmed, missing scheme means `https`,
 * scheme and host lowercased (path case kept), default port dropped, no trailing slash
 * @param url API URL
 * @returns Canonical API URL
 */
export function canonicalApiUrl(url: string) {
  const trimmed = url.trim();
  const schemeEnd = trimmed.indexOf("://");
  const scheme =
    schemeEnd === -1 ? "https" : asciiLowercase(trimmed.slice(0, schemeEnd));
  const rest = schemeEnd === -1 ? trimmed : trimmed.slice(schemeEnd + 3);

  const pathStart = rest.indexOf("/") === -1 ? rest.length : rest.indexOf("/");
  let authority = asciiLowercase(rest.slice(0, pathStart));
  const path = rest.slice(pathStart).replace(/\/+$/, "");

  const defaultPort =
    scheme === "https" ? ":443" : scheme === "http" ? ":80" : undefined;
  if (defaultPort && authority.endsWith(defaultPort))
    authority = authority.slice(0, -defaultPort.length);

  return `${scheme}://${authority}${path}`;
}

/**
 * Account key: `sha256(canonicalApiUrl + "\n" + userId)`, first 16 hex characters.
 * Names everything that belongs to one account on one server: crypto database, storage key,
 * notification tags, Web Locks.
 * @param apiUrl API URL of the server
 * @param userId User ID
 * @returns 16 lowercase hex characters
 */
export async function accountKey(apiUrl: string, userId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${canonicalApiUrl(apiUrl)}\n${userId}`),
  );

  return Array.from(new Uint8Array(digest).slice(0, 8), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
