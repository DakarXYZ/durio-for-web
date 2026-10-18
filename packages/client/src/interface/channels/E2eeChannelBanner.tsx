import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "stoat.js";
import { styled } from "styled-system/jsx";

import { IconButton } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

const DISMISSED = "durio-e2ee-banner-dismissed";

function dismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * What an encrypted DM or group does not protect (dur.io, WEB-07, Q32): calls are not
 * end-to-end encrypted, and in groups members who join later cannot read the earlier
 * history. Shown above the composer until dismissed for the channel.
 */
export function E2eeChannelBanner(props: { channel: Channel }) {
  const { t } = useLingui();
  const [hidden, setHidden] = createSignal(dismissed());

  const show = () =>
    (props.channel.type === "DirectMessage" ||
      props.channel.type === "Group") &&
    props.channel.isEncrypted &&
    !hidden().includes(props.channel.id);

  function dismiss() {
    const next = [...hidden(), props.channel.id].slice(-500);
    setHidden(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      // storage unavailable: hidden for this session
    }
  }

  return (
    <Show when={show()}>
      <Banner>
        <Symbol size={18}>lock</Symbol>
        <span>
          <Trans>End-to-end encrypted (beta).</Trans>{" "}
          <Trans>Calls in this chat are not end-to-end encrypted.</Trans>{" "}
          <Show when={props.channel.type === "Group"}>
            <Trans>
              Members who join later cannot read the messages sent before they
              joined.
            </Trans>
          </Show>
        </span>
        <IconButton
          size="xs"
          onPress={dismiss}
          use:floating={{ tooltip: { placement: "top", content: t`Dismiss` } }}
        >
          <Symbol size={16}>close</Symbol>
        </IconButton>
      </Banner>
    </Show>
  );
}

const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    margin: "0 var(--gap-md) var(--gap-sm)",
    padding: "var(--gap-sm) var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    fontSize: "0.85em",
    color: "var(--md-sys-color-on-surface-variant)",
    background: "var(--md-sys-color-surface-container-high)",
    "& > span": { flexGrow: 1 },
  },
});
