// Key export and import files (dur.io, plan WEB-07, CR-21; Android's `E2eeKeyFiles` is the
// reference): the Matrix "Megolm session export" protected with a passphrase. The rules
// for the passphrase and the file are the same on every client.

/** How hard a key file passphrase is to guess, roughly */
export type PassphraseStrength = "tooShort" | "weak" | "fair" | "strong";

/** Why exporting or importing a key file failed, for the UI */
export type KeyFileFailure =
  /** Export: the file would pass the core's 64 MiB limit — export per chat */
  | "tooManySessions"
  /** Import: wrong passphrase, or the file was modified (one MAC: the core cannot tell) */
  | "wrongPassphrase"
  /** Import: not a key file, or a cut-off one */
  | "invalidFile"
  /** Import: bigger than the core accepts; not even read */
  | "tooLarge"
  /** The chosen file could not be read */
  | "fileAccess"
  /** No E2EE device right now */
  | "noDevice"
  | "other";

/** The core refuses bigger files (`key_export::MAX_FILE_LEN`, review O-8) */
export const MAX_KEY_FILE_BYTES = 64 * 1024 * 1024;

export const MIN_PASSPHRASE = 10;

const RANK: Record<PassphraseStrength, number> = {
  tooShort: 0,
  weak: 1,
  fair: 2,
  strong: 3,
};

/**
 * A rough estimate, not a cracker model: length first (several words are best), then
 * variety. Export needs at least `fair`.
 * @param passphrase Passphrase
 */
export function passphraseStrength(passphrase: string): PassphraseStrength {
  const points = [...passphrase];
  const length = points.length;
  if (length < MIN_PASSPHRASE) return "tooShort";

  const distinct = new Set(points).size;
  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u].filter(
    (test) => test.test(passphrase),
  ).length;

  if (distinct < 5 || (length < 14 && classes < 2)) return "weak";
  if (length >= 16 || (length >= 12 && classes >= 3)) return "strong";
  return "fair";
}

/**
 * Whether an export may start: both entries equal and at least `fair`
 * @param passphrase Passphrase
 * @param repeated Second entry
 */
export function canExport(passphrase: string, repeated: string): boolean {
  return (
    passphrase === repeated && RANK[passphraseStrength(passphrase)] >= RANK.fair
  );
}

/**
 * Name offered for a saved key file
 * @param today Date
 */
export function keyFileName(today = new Date()): string {
  return `dur.io-keys-${today.toISOString().slice(0, 10)}.txt`;
}

/**
 * Read a chosen key file as text; refused before reading when it is too large
 * @param file File
 * @returns Text, or the failure
 */
export async function readKeyFile(
  file: Blob,
): Promise<{ text: string } | { failure: KeyFileFailure }> {
  if (file.size > MAX_KEY_FILE_BYTES) return { failure: "tooLarge" };
  try {
    return { text: await file.text() };
  } catch {
    return { failure: "fileAccess" };
  }
}

/**
 * The failure of an export or import, from the core's error code
 * @param code Error code
 * @param exporting Whether it was an export
 */
export function keyFileFailure(
  code: string | undefined,
  exporting: boolean,
): KeyFileFailure {
  switch (code) {
    case "InvalidKeyFile":
      // an export refused as an invalid file is one that grew past the limit
      return exporting ? "tooManySessions" : "invalidFile";
    case "WrongPassphrase":
      return "wrongPassphrase";
    case "PayloadTooLarge":
      return exporting ? "tooManySessions" : "tooLarge";
    case "Unavailable":
    case "Locked":
    case "NotOpen":
      return "noDevice";
    default:
      return "other";
  }
}

/**
 * UTF-8 bytes of a secret typed by the user, for the core (it wipes them)
 * @param text Text
 */
export const secretBytes = (text: string) => new TextEncoder().encode(text);
