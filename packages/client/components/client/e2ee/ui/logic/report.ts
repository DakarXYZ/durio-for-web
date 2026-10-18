// "Diagnostic report" instead of Sentry (dur.io, plan WEB-07, CR-22, O8; Android's
// `E2eeDiagnostics` is the reference): the core's `debugReport()` (counts, states and
// error codes; its own user and device id are the only ids in it) plus what the app
// knows without secrets. No server address, no other ids, no message text. The user
// sees the whole text before saving it, and picks where it goes.

export const REPORT_FORMAT = 1;

/** The app's part of the report: no ids, no addresses */
export interface ReportAppInfo {
  /** for-web version */
  version: string;
  /** Desktop app version and its Electron/Chrome, if inside it */
  desktop?: string;
  build: "desktop" | "web";
  userAgentPlatform: string;
  coreVersion?: string;
  e2eeStatus: string;
  syncProblem: boolean;
  accounts: number;
}

/**
 * The text the user sees and saves
 * @param app App part
 * @param coreReport The core's JSON, if there is a device
 * @param now Time of the report
 */
export function composeReport(
  app: ReportAppInfo,
  coreReport: string | undefined,
  now = new Date(),
): string {
  const lines = [
    "dur.io diagnostic report",
    `format: ${REPORT_FORMAT}`,
    `created: ${now.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    `app: ${app.version} (${app.build})`,
    ...(app.desktop ? [`desktop: ${app.desktop}`] : []),
    `platform: ${app.userAgentPlatform}`,
    `e2ee core: ${app.coreVersion ?? "unknown"}`,
    `e2ee status: ${app.e2eeStatus}${app.syncProblem ? ", sync problem" : ""}`,
    `accounts: ${app.accounts}`,
    "",
    "core report:",
    coreReport ?? "unavailable (no E2EE device on the active account)",
  ];

  return lines.join("\n") + "\n";
}

/**
 * Name of the saved report
 * @param now Time
 */
export function reportFileName(now = new Date()): string {
  return `dur.io-diagnostics-${now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replaceAll(":", "-")}.txt`;
}

/**
 * Ed25519 key in groups of four for reading aloud and comparing
 * @param key Base64 key
 */
export function fingerprintGroups(key: string): string {
  return key.match(/.{1,4}/g)?.join(" ") ?? "";
}
