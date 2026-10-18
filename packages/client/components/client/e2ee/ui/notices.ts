import { createRoot, createSignal } from "solid-js";

import { onClientDispose } from "../../../instance/dispose";

/**
 * Notices of the active account's E2EE that the settings page shows until they are
 * dealt with (dur.io, WEB-07): the core gave up on one of its requests (`syncProblem`,
 * review O-2), or a request needs the user (`actionRequired`: `MfaRequired`,
 * `BackupVersionChanged`, `DeviceKeysConflict`).
 */
export const notices = createRoot(() => {
  const [syncProblem, setSyncProblem] = createSignal(false);
  const [actionRequired, setActionRequired] = createSignal<string>();
  return { syncProblem, setSyncProblem, actionRequired, setActionRequired };
});

onClientDispose(() => {
  notices.setSyncProblem(false);
  notices.setActionRequired(undefined);
});
