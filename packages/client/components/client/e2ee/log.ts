// The only console output of the client's E2EE code (50-web-sdk decision 6): a fixed
// text and a code — never plaintext, keys or ids of other users. `console` is
// forbidden elsewhere in this folder by the lint config.

/**
 * Warn about an E2EE problem
 * @param what Fixed description
 * @param code Error code or class name
 */
export function e2eeWarn(what: string, code?: string | number) {
  // eslint-disable-next-line no-console
  console.warn(`[e2ee] ${what}${code === undefined ? "" : `: ${code}`}`);
}
