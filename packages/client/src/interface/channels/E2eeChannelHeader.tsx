import { Match, Switch } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { Channel } from "stoat.js";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { IconButton } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Encryption of a DM or group in the channel header (dur.io, WEB-05, O5, O8): the lock
 * with the "beta" label, the downgrade warning (T18), or the action to turn it on
 */
export function E2eeChannelHeader(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();

  const encryptable = () =>
    props.channel.type === "DirectMessage" || props.channel.type === "Group";

  return (
    <Switch>
      <Match when={encryptable() && props.channel.encryptionDowngraded}>
        <IconButton
          use:floating={{
            tooltip: {
              placement: "bottom",
              content: t`The server removed encryption from this conversation. Your messages here are still encrypted.`,
            },
          }}
        >
          <Symbol color="var(--md-sys-color-error)">gpp_maybe</Symbol>
        </IconButton>
      </Match>
      <Match when={encryptable() && props.channel.isEncrypted}>
        <IconButton
          use:floating={{
            tooltip: {
              placement: "bottom",
              content:
                client().e2ee.status() === "locked"
                  ? t`End-to-end encrypted (beta). Encryption is active in another window.`
                  : t`End-to-end encrypted (beta)`,
            },
          }}
        >
          <Symbol>lock</Symbol>
        </IconButton>
      </Match>
      <Match
        when={
          encryptable() &&
          client().e2ee.enabled &&
          props.channel.havePermission("ManageChannel")
        }
      >
        <IconButton
          onPress={() =>
            openModal({ type: "enable_encryption", channel: props.channel })
          }
          use:floating={{
            tooltip: {
              placement: "bottom",
              content: t`Turn on end-to-end encryption (beta)`,
            },
          }}
        >
          <Symbol>lock_open</Symbol>
        </IconButton>
      </Match>
    </Switch>
  );
}
