import { Match, Show, Switch, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Dialog, DialogProps } from "@revolt/ui";

import { e2eeWarn } from "../../log";
import {
  type RecoveryFailure,
  recoveryFailure,
  turnOffWithMfa,
} from "../logic/recovery";
import { Beta, Notice, Stack } from "../parts";

import { RecoveryFailureText } from "./Restore";

type Step = "intro" | "working" | "done";

/**
 * Turn the key backup off (dur.io): the server deletes the backup and its keys (needs
 * an MFA ticket), this device stops backing up, the other devices stop at their next
 * upload. A new recovery key turns it on again.
 */
export function BackupOffDialog(props: DialogProps) {
  const client = useClient();
  const { mfaFlow } = useModals();
  const { t } = useLingui();

  const [step, setStep] = createSignal<Step>("intro");
  const [failure, setFailure] = createSignal<RecoveryFailure>();
  const [exists, setExists] = createSignal<boolean>();

  onMount(async () => {
    try {
      setExists(await client().e2ee.backup.exists());
    } catch {
      setExists(undefined);
    }
  });

  async function requestTicket() {
    const mfa = await client().account.mfa();
    const ticket = await mfaFlow(mfa as never);
    return ticket?.token;
  }

  async function turnOff() {
    setStep("working");
    setFailure(undefined);
    try {
      const result = await turnOffWithMfa({
        existsOnServer: exists(),
        turnOff: (ticket) => client().e2ee.backup.turnOff(ticket),
        requestTicket,
      });
      setStep(result === "done" ? "done" : "intro");
    } catch (e) {
      e2eeWarn("backup not turned off", (e as { code?: string })?.code);
      setFailure(recoveryFailure(e));
      setStep("intro");
    }
  }

  const actions = () => {
    switch (step()) {
      case "intro":
        return [
          { text: <Trans>Cancel</Trans> },
          {
            text: t`Turn off backup`,
            onClick: () => {
              void turnOff();
              return false;
            },
          },
        ];
      case "working":
        return [];
      case "done":
        return [{ text: <Trans>Done</Trans> }];
    }
  };

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Turn off key backup</Trans>
          <Beta />
        </>
      }
      actions={actions()}
      isDisabled={step() === "working"}
    >
      <Stack>
        <Switch>
          <Match when={step() === "intro"}>
            <Trans>
              Deletes the backup of your encryption keys from the server. This
              device stops backing up its keys, and so do your other devices.
              Needs your password.
            </Trans>
            <Notice kind="warning">
              <Trans>
                Without a backup, a new device can read your earlier encrypted
                messages only if you verify it with another device or load a key
                file. Your recovery key stops working.
              </Trans>
            </Notice>
          </Match>
          <Match when={step() === "working"}>
            <Trans>Turning off the backup…</Trans>
          </Match>
          <Match when={step() === "done"}>
            <Notice icon="cloud_off">
              <Trans>
                Backup is off. The server no longer keeps your keys. A new
                recovery key turns it on again.
              </Trans>
            </Notice>
          </Match>
        </Switch>
        <Show when={failure()}>
          {(f) => (
            <Notice kind="error">
              <RecoveryFailureText failure={f()} />
            </Notice>
          )}
        </Show>
      </Stack>
    </Dialog>
  );
}
