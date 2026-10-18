import { Trans } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Turn on end-to-end encryption in a DM or group (dur.io, O5, O8): irreversible
 */
export function EnableEncryptionModal(
  props: DialogProps & Modals & { type: "enable_encryption" },
) {
  const { showError } = useModals();

  const enable = useMutation(() => ({
    mutationFn: () => props.channel.enableEncryption(),
    onError: showError,
  }));

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Turn on end-to-end encryption? (beta)</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Turn on encryption</Trans>,
          onClick: () => enable.mutateAsync(),
        },
      ]}
      isDisabled={enable.isPending}
    >
      <Trans>
        New messages and files in this conversation will be readable only on its
        members' devices — not by the server. This cannot be turned off later.
        <br />
        <br />
        Search will not work here, links get no previews, and members who join
        later will not see earlier messages. Older apps cannot read encrypted
        messages. Calls are not end-to-end encrypted.
        <br />
        <br />
        End-to-end encryption is in beta: it has not been audited yet.
      </Trans>
    </Dialog>
  );
}
