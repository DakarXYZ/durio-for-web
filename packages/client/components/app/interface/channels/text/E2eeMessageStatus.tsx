import { Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
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

/**
 * Shield of a decrypted message whose sender is not proven (dur.io, WEB-07): its key
 * came from the backup or a key file (`Unauthenticated`), or from a device that is not
 * (or no longer) the sender's (`UnknownDevice`, `Mismatch`)
 */
export function E2eeMessageShield(props: { e2ee?: MessageE2ee }) {
  const { t } = useLingui();

  const warning = () => {
    if (props.e2ee?.state !== "ok") return;
    switch (props.e2ee.verification) {
      case "Unauthenticated":
        return t`The sender of this message cannot be confirmed (key from a backup or a key file).`;
      case "UnknownDevice":
      case "Mismatch":
        return t`Sent from an unknown or mismatching device.`;
    }
  };

  return (
    <Show when={warning()}>
      <Shield
        mismatch={props.e2ee?.verification === "Mismatch"}
        use:floating={{ tooltip: { placement: "top", content: warning()! } }}
      >
        <Symbol size={14}>
          {props.e2ee?.verification === "Unauthenticated"
            ? "shield_question"
            : "gpp_maybe"}
        </Symbol>
        {props.e2ee?.verification === "Unauthenticated" ? (
          <Trans>sender not confirmed</Trans>
        ) : (
          <Trans>unknown device</Trans>
        )}
      </Shield>
    </Show>
  );
}

const Shield = styled("div", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "0.75em",
    color: "var(--md-sys-color-outline)",
    cursor: "default",
  },
  variants: {
    mismatch: {
      true: { color: "var(--md-sys-color-error)" },
    },
  },
});
