// Account invite links of our servers (dur.io): `https://<host>/join/<code>`, a static
// page of the server (self-hosted). Admins make them in "Administration"; on sign-up the
// link or the bare code can be pasted. `/invite/<code>` is a server (guild) invite of
// the app, not a sign-up invite.

/** A pasted sign-up invite: its code, and the server host when it was a link */
export interface ParsedInvite {
  code: string;
  host?: string;
  serverInvite?: false;
}

/** A pasted server (guild) invite link: no use for signing up */
export interface ParsedServerInvite {
  serverInvite: true;
  host: string;
}

const LINK =
  /^(?:https?:\/\/)?([^/\s?#]+)\/(join|invite)\/([^/\s?#]+)\/?(?:[?#].*)?$/i;

/**
 * Host of a server from its API address (`https://host/api` → `host`)
 * @param apiUrl API address of the server
 */
export function serverHost(apiUrl: string): string {
  return new URL(apiUrl).host;
}

/**
 * Sign-up link of an invite on a server
 * @param apiUrl API address of the server
 * @param code Invite code
 */
export function inviteLink(apiUrl: string, code: string): string {
  return `https://${serverHost(apiUrl)}/join/${encodeURIComponent(code)}`;
}

/**
 * The invite in what was pasted: a link `https://<host>/join/<code>` (also without the
 * scheme) or a bare code; a server invite link `…/invite/<code>` is told apart
 * @param input Field value
 * @returns The invite, `undefined` when nothing usable was entered
 */
export function parseInvite(
  input: string,
): ParsedInvite | ParsedServerInvite | undefined {
  const text = input.trim();
  if (!text) return;

  const link = LINK.exec(text);
  if (link) {
    const host = link[1].toLowerCase();
    if (link[2].toLowerCase() === "invite") return { serverInvite: true, host };

    let code = link[3];
    try {
      code = decodeURIComponent(code);
    } catch {
      // not encoded
    }
    return { code, host };
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
