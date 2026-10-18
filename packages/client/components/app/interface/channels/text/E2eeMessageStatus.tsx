import { Match, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { MessageE2ee } from "stoat.js";
import { styled } from "styled-system/jsx";

import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Why an encrypted message shows no text (dur.io, WEB-05): never the server's
 * placeholder, never the ciphertext
 */
export function E2eeMessageStatus(props: { e2ee: MessageE2ee }) {
  return (
    <Status error={props.e2ee.state === "suspicious"}>
      <Symbol size={16}>
        {props.e2ee.state === "suspicious" ? "gpp_maybe" : "lock"}
      </Symbol>
      <Switch fallback={<Trans>Decrypting…</Trans>}>
        <Match when={props.e2ee.state === "missing_key"}>
          <Trans>Waiting for the key to decrypt this message…</Trans>
        </Match>
        <Match when={props.e2ee.state === "suspicious"}>
          <Trans>
            This message may have been tampered with and is not shown.
          </Trans>
        </Match>
        <Match when={props.e2ee.state === "unsupported"}>
          <Trans>
            This message is from a newer version of the app. Update to read it.
          </Trans>
        </Match>
        <Match when={props.e2ee.reason === "locked"}>
          <Trans>
            Encryption is active in another window: messages can be read there.
          </Trans>
        </Match>
        <Match when={props.e2ee.reason === "unavailable"}>
          <Trans>Encryption is not available on this device.</Trans>
        </Match>
        <Match when={props.e2ee.reason === "withheld"}>
          <Trans>
            The sender's device did not share the key for this message.
          </Trans>
        </Match>
        <Match when={props.e2ee.reason === "missing_key"}>
          <Trans>
            Unable to decrypt this message: its key has not arrived. Verify this
            device with another one of yours or restore the key backup.
          </Trans>
        </Match>
        <Match when={props.e2ee.state === "failed"}>
          <Trans>This message could not be decrypted.</Trans>
        </Match>
      </Switch>
    </Status>
  );
}

const Status = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontStyle: "italic",
    color: "var(--md-sys-color-outline)",
  },
  variants: {
    error: {
      true: {
        color: "var(--md-sys-color-error)",
      },
    },
  },
});
