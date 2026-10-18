import {
  For,
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/solid/macro";
import type { E2eeSasAction, E2eeSasFlow, E2eeSasState } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps } from "@revolt/ui";

import { e2eeWarn } from "../../log";
import { sasEmojiName, sasView } from "../logic/sas";
import { Beta, Notice, Stack } from "../parts";

/** The core cancels a flow after 10 minutes; the dialog re-reads its state meanwhile */
const POLL_MS = 1_000;

/**
 * SAS verification of a device (dur.io, WEB-07, CR-11, AN-31): an incoming request or
 * one we start. The core holds the state machine; the dialog shows the state and passes
 * the user's choice. Verified comes from here only (O-3).
 */
export function VerifyDialog(
  props: DialogProps & { flowId?: string; userId?: string; deviceId?: string },
) {
  const client = useClient();
  const { t } = useLingui();
  const [flow, setFlow] = createSignal<E2eeSasFlow>();
  const [state, setState] = createSignal<E2eeSasState>();
  const [failed, setFailed] = createSignal<"notStarted" | "step">();
  const [busy, setBusy] = createSignal(false);

  const view = () => {
    const current = state();
    return current && sasView(current);
  };

  async function refresh() {
    const current = flow();
    if (!current) return;
    try {
      setState(await current.state());
    } catch (e) {
      e2eeWarn("verification state", (e as { code?: string })?.code);
    }
  }

  onMount(async () => {
    try {
      const e2ee = client().e2ee;
      const found = props.flowId
        ? await e2ee.verification(props.flowId)
        : await e2ee.requestVerification(props.userId!, props.deviceId!);
      if (!found) return setFailed("notStarted");
      setFlow(found);
      await refresh();
    } catch (e) {
      e2eeWarn("verification not started", (e as { code?: string })?.code);
      setFailed("notStarted");
    }
  });

  const timer = setInterval(() => void refresh(), POLL_MS);
  const off = client().e2ee.on((event) => {
    if (
      event.type === "verifications" &&
      event.flowIds.includes(flow()?.flowId ?? "")
    )
      void refresh();
  });

  onCleanup(() => {
    clearInterval(timer);
    off();
    const current = flow();
    if (!current) return;
    // leaving the dialog ends an open flow
    const done = view()?.final ?? false;
    void (done ? Promise.resolve() : current.cancel())
      .catch(() => undefined)
      .finally(() => void current.free().catch(() => undefined));
  });

  async function act(action: E2eeSasAction) {
    const current = flow();
    if (!current) return;
    setBusy(true);
    setFailed(undefined);
    try {
      await client().e2ee.verificationAction(current, action);
    } catch (e) {
      e2eeWarn("verification step failed", (e as { code?: string })?.code);
      setFailed("step");
    }
    await refresh();
    setBusy(false);
  }

  const label = (action: E2eeSasAction) => {
    switch (action) {
      case "accept":
        return t`Accept`;
      case "start":
        return t`Compare emoji`;
      case "confirm":
        return t`They match`;
      case "mismatch":
        return t`They don't match`;
      case "cancel":
        return t`Cancel`;
    }
  };

  const actions = () => {
    const current = view();
    if (!current || current.final || failed() === "notStarted")
      return [{ text: <Trans>Close</Trans> }];
    return current.actions.map((action) => ({
      text: label(action),
      onClick: () => {
        void act(action);
        return action === "cancel";
      },
      isDisabled: busy(),
    }));
  };

  const otherName = () =>
    client().users.get(flow()?.otherUserId ?? "")?.displayName ?? t`Someone`;

  const isSelf = () =>
    flow()?.isSelfVerification ?? props.userId === client().user?.id;

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Verify device</Trans>
          <Beta />
        </>
      }
      actions={actions()}
    >
      <Stack>
        <Switch fallback={<Trans>Starting…</Trans>}>
          <Match when={failed() === "notStarted"}>
            <Trans>
              The verification could not start. Try again a little later.
            </Trans>
          </Match>
          <Match when={view()?.step === "requested"}>
            <Trans>Waiting for the other device to accept…</Trans>
          </Match>
          <Match when={view()?.step === "incoming"}>
            <Show
              when={isSelf()}
              fallback={
                <Trans>{otherName()} wants to verify your device.</Trans>
              }
            >
              <Trans>
                Another of your devices wants to verify this one. Accept only if
                you started the verification yourself.
              </Trans>
            </Show>
          </Match>
          <Match when={view()?.step === "ready"}>
            <Trans>Both devices are ready. Compare emoji to continue.</Trans>
          </Match>
          <Match when={view()?.step === "waiting"}>
            <Trans>Waiting for the other device…</Trans>
          </Match>
          <Match when={view()?.step === "compare"}>
            <Trans>
              Check that the other screen shows the same emoji in the same
              order.
            </Trans>
            <EmojiGrid>
              <For
                each={
                  (state() as E2eeSasState & { type: "ShowCodes" }).emoji ?? []
                }
              >
                {(emoji) => (
                  <EmojiCell>
                    <EmojiSymbol>{emoji.symbol}</EmojiSymbol>
                    <span>{sasEmojiName(emoji, i18n.locale)}</span>
                  </EmojiCell>
                )}
              </For>
            </EmojiGrid>
          </Match>
          <Match when={view()?.step === "confirmed"}>
            <Trans>Waiting for the other device to confirm…</Trans>
          </Match>
          <Match when={view()?.step === "done"}>
            <Notice icon="verified_user">
              <Trans>
                Device verified. Your verified devices share the keys of earlier
                messages with each other.
              </Trans>
            </Notice>
          </Match>
          <Match when={view()?.step === "mismatch"}>
            <Notice kind="error">
              <Trans>
                The codes did not match. Someone may be in the middle: the
                device is not verified. Verify again when you are next to each
                other.
              </Trans>
            </Notice>
          </Match>
          <Match when={view()?.step === "timeout"}>
            <Trans>The verification timed out.</Trans>
          </Match>
          <Match when={view()?.step === "cancelled"}>
            <Trans>The verification was cancelled.</Trans>
          </Match>
        </Switch>
        <Show when={failed() === "step"}>
          <Notice kind="warning">
            <Trans>That step did not work. Try again.</Trans>
          </Notice>
        </Show>
      </Stack>
    </Dialog>
  );
}

const EmojiGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--gap-md)",
    padding: "var(--gap-md) 0",
  },
});

const EmojiCell = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    fontSize: "0.85em",
    gap: "var(--gap-xs)",
  },
});

const EmojiSymbol = styled("span", {
  base: {
    fontSize: "2.4em",
    lineHeight: 1.2,
    // system emoji, never images (AN-31)
    fontFamily:
      '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif',
  },
});
