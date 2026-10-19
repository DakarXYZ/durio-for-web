// Account invite links of our servers (dur.io): `https://<host>/invite/<code>`, a static
// page of the server (self-hosted). Admins make them in "Administration"; on sign-up the
// link or the bare code can be pasted.

/** A pasted invite: its code, and the server host when it was a link */
export interface ParsedInvite {
  code: string;
  host?: string;
}

const LINK =
  /^(?:https?:\/\/)?([^/\s?#]+)\/invite\/([^/\s?#]+)\/?(?:[?#].*)?$/i;

/**
 * Host of a server from its API address (`https://host/api` → `host`)
 * @param apiUrl API address of the server
 */
export function serverHost(apiUrl: string): string {
  return new URL(apiUrl).host;
}

/**
 * Link of an invite on a server
 * @param apiUrl API address of the server
 * @param code Invite code
 */
export function inviteLink(apiUrl: string, code: string): string {
  return `https://${serverHost(apiUrl)}/invite/${encodeURIComponent(code)}`;
}

/**
 * The invite in what was pasted: a link `https://<host>/invite/<code>` (also without
 * the scheme) or a bare code
 * @param input Field value
 * @returns The invite, `undefined` when nothing usable was entered
 */
export function parseInvite(input: string): ParsedInvite | undefined {
  const text = input.trim();
  if (!text) return;

  const link = LINK.exec(text);
  if (link) {
    let code = link[2];
    try {
      code = decodeURIComponent(code);
    } catch {
      // not encoded
    }
    return { code, host: link[1].toLowerCase() };
  }

  if (/[\s/]/.test(text)) return;
  return { code: text };
}

/**
 * Whether two hosts are the same server (case and the default port do not matter)
 * @param a Host
 * @param b Host
 */
export function sameHost(a: string, b: string): boolean {
  const norm = (host: string) => host.toLowerCase().replace(/:443$/, "");
  return norm(a) === norm(b);
}
