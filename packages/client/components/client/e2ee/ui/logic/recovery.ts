// Recovery key and key backup flows (dur.io, plan WEB-07, AN-32): the decisions of the
// screens without the screens, so they can be tested.

/** Why a recovery step failed, for the UI */
export type RecoveryFailure =
  /** Shaped like a recovery key, with a typo in it */
  | "typo"
  | "wrongKey"
  /** No backup on the server */
  | "noBackup"
  /** The server's backup does not fit its recovery data: never restored from */
  | "mismatch"
  /** The backup was replaced elsewhere meanwhile */
  | "versionChanged"
  | "network"
  | "other";

/**
 * The failure of a recovery step, from an error of the SDK or the core
 * @param error Error
 */
export function recoveryFailure(error: unknown): RecoveryFailure {
  const code = (error as { code?: unknown } | undefined)?.code;
  switch (code) {
    case "RecoveryKeyTypo":
      return "typo";
    case "WrongRecoveryKey":
      return "wrongKey";
    case "NoBackup":
    case "NoRecovery":
      return "noBackup";
    case "BackupKeyMismatch":
    case "InvalidRecoveryData":
      return "mismatch";
    case "BackupVersionChanged":
      return "versionChanged";
    case "NoResponse":
    case "RequestFailed":
      return "network";
    default:
      return "other";
  }
}

/**
 * What happened to the backup when this device's uploads stopped
 * (`BackupVersionChanged`: the core sees 404 and 409 alike): turned off on another
 * device (no backup on the server anymore) or replaced by a new one
 */
export type BackupChange = "turnedOff" | "replaced";

/**
 * Ask the server which change it was
 * @param exists Whether the server holds a backup (`client.e2ee.backup.exists`)
 * @returns The change, `undefined` when the server could not be asked
 */
export async function backupChange(
  exists: () => Promise<boolean>,
): Promise<BackupChange | undefined> {
  try {
    return (await exists()) ? "replaced" : "turnedOff";
  } catch {
    return undefined;
  }
}

/**
 * Activate a new backup on the server. An MFA ticket is asked for **up front** when a
 * backup exists there (or might: unknown) and for every rotation — without one the
 * server answers 401. If a backup appeared meanwhile (another device), the core says
 * `MfaRequired` and the ticket is asked for then.
 * @param options What is known and how to act
 * @returns `done`, or `cancelled` when the user closed the MFA prompt
 * @throws whatever `activate` throws otherwise
 */
export async function activateWithMfa(options: {
  rotate: boolean;
  /** `undefined`: could not be checked */
  existsOnServer: boolean | undefined;
  activate: (ticket?: string) => Promise<void>;
  /** Ask the user for an MFA ticket; `undefined` when they cancelled */
  requestTicket: () => Promise<string | undefined>;
}): Promise<"done" | "cancelled"> {
  let ticket: string | undefined;
  if (options.rotate || options.existsOnServer !== false) {
    ticket = await options.requestTicket();
    if (!ticket) return "cancelled";
  }

  try {
    await options.activate(ticket);
  } catch (e) {
    const code = (e as { code?: unknown } | undefined)?.code;
    if (code !== "MfaRequired" || ticket) throw e;

    ticket = await options.requestTicket();
    if (!ticket) return "cancelled";
    await options.activate(ticket);
  }

  return "done";
}

/**
 * Turn the key backup off for the account: the server deletes a backup only with an MFA
 * ticket, asked for up front when one exists there (or might); without one this device
 * just stops uploading
 * @param options What is known and how to act
 * @returns `done`, or `cancelled` when the user closed the MFA prompt
 * @throws whatever `turnOff` throws otherwise
 */
export function turnOffWithMfa(options: {
  /** `undefined`: could not be checked */
  existsOnServer: boolean | undefined;
  turnOff: (ticket?: string) => Promise<void>;
  /** Ask the user for an MFA ticket; `undefined` when they cancelled */
  requestTicket: () => Promise<string | undefined>;
}): Promise<"done" | "cancelled"> {
  return activateWithMfa({
    rotate: false,
    existsOnServer: options.existsOnServer,
    activate: options.turnOff,
    requestTicket: options.requestTicket,
  });
}

/** The first prompt of a device (AN-31, AN-32) */
export type OnboardingPrompt = "newDevice" | "setUpRecovery";

/**
 * What to offer a device once it is ready: a new device of a user with other devices or
 * a backup — verify or restore (T7); the first device without a backup — set one up
 * @param state What is known
 */
export function onboardingPrompt(state: {
  ownDevices: number;
  backupOnThisDevice: boolean;
  backupOnServer: boolean;
}): OnboardingPrompt | undefined {
  if (state.backupOnThisDevice) return;
  if (state.ownDevices > 0 || state.backupOnServer) return "newDevice";
  return "setUpRecovery";
}

/**
 * Name of a saved recovery key file
 * @param today Date
 */
export function recoveryKeyFileName(today = new Date()): string {
  return `dur.io-recovery-key-${today.toISOString().slice(0, 10)}.txt`;
}

/** The clipboard is cleared this long after the recovery key was copied */
export const CLEAR_CLIPBOARD_MS = 60_000;
