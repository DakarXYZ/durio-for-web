import type { Client } from "stoat.js";

import type { E2eeModalView } from "./types";

/**
 * Sign out, but first offer a key backup when this device has encrypted chats and no
 * backup: its keys are deleted with the sign-out (dur.io, WEB-12)
 * @param client Active client
 * @param openModal Opens the sign-out dialog
 * @param logout Signs out
 */
export async function logoutWithBackupCheck(
  client: Client,
  openModal: (modal: { type: "e2ee"; view: E2eeModalView }) => void,
  logout: () => void,
) {
  const e2ee = client.e2ee;
  if (
    e2ee.status() === "ready" &&
    client.channels.find((channel) => e2ee.isEncrypted(channel))
  ) {
    try {
      if (!(await e2ee.backup.status()).enabled)
        return openModal({
          type: "e2ee",
          view: { kind: "logout", backup: false },
        });
    } catch {
      // no answer from the core: sign out as asked
    }
  }

  logout();
}
