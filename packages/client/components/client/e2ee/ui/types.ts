import type { Channel } from "stoat.js";

import type { OnboardingPrompt } from "./logic/recovery";

/**
 * What the E2EE modal shows (dur.io, WEB-07, WEB-12). One modal type for all of them:
 * the views are a lazy chunk, loaded when one opens.
 */
export type E2eeModalView =
  /** SAS verification: an existing flow, or a new one with a device */
  | { kind: "verify"; flowId: string }
  | { kind: "verifyDevice"; userId: string; deviceId: string }
  /** New recovery key, or a new backup under the same key */
  | { kind: "recovery"; rotate?: boolean }
  /** Delete the server's backup and stop backing up */
  | { kind: "backupOff" }
  /** Restore history with the recovery key */
  | { kind: "restore" }
  | { kind: "exportKeys" }
  | { kind: "importKeys" }
  | { kind: "diagnostics" }
  /** The first prompt of a device */
  | { kind: "onboarding"; prompt: OnboardingPrompt }
  /** Encryption of a DM or group: members' devices, what is and is not encrypted */
  | { kind: "channel"; channel: Channel }
  /** The keys of this device are lost: sign out and in again (AN-42) */
  | { kind: "keyLost" }
  /** Sign-out without a key backup: offer one first (WEB-12) */
  | { kind: "logout"; backup: boolean; reset?: boolean };
