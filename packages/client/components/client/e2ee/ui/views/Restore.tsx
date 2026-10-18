import { Match, Show, Switch, createEffect, createSignal, on } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { E2eeRecoveryKeyCheck, E2eeRestoreProgress } from "stoat.js";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps } from "@revolt/ui";

import { e2eeWarn } from "../../log";
import { secretBytes } from "../logic/keyFiles";
import { type RecoveryFailure, recoveryFailure } from "../logic/recovery";
import { Beta, Notice, SecretField, Stack } from "../parts";

/**
 * Why a recovery step failed, in words
 */
export function RecoveryFailureText(props: { failure: RecoveryFailure }) {
  return (
    <Switch fallback={<Trans>Something went wrong. Try again.</Trans>}>
      <Match when={props.failure === "typo"}>
        <Trans>There is a typo in the recovery key.</Trans>
      </Match>
      <Match when={props.failure === "wrongKey"}>
        <Trans>
          This is not the recovery key (or passphrase) of your backup.
        </Trans>
      </Match>
      <Match when={props.failure === "noBackup"}>
        <Trans>There is no backup on the server.</Trans>
      </Match>
      <Match when={props.failure === "mismatch"}>
        <Trans>
          The backup on the server does not match its recovery data. It was not
          used.
        </Trans>
      </Match>
      <Match when={props.failure === "versionChanged"}>
        <Trans>
          The backup was replaced on another device meanwhile. Try again.
        </Trans>
      </Match>
      <Match when={props.failure === "network"}>
        <Trans>The server could not be reached. Try again.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * Restore the history of encrypted chats from the key backup on a new device (dur.io,
 * WEB-07, AN-32, CR-12): recovery key or passphrase → unlock → keys in batches →
 * waiting messages are decrypted again.
 */
export function RestoreDialog(props: DialogProps) {
  const client = useClient();
  const [input, setInput] = createSignal("");
  const [check, setCheck] = createSignal<E2eeRecoveryKeyCheck>();
  const [busy, setBusy] = createSignal(false);
  const [progress, setProgress] = createSignal<E2eeRestoreProgress>();
  const [failure, setFailure] = createSignal<RecoveryFailure>();

  // shape of the input while typing: key, key with a typo, or a passphrase
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(input, (value) => {
      clearTimeout(checkTimer);
      if (!value.trim()) return setCheck(undefined);
      checkTimer = setTimeout(
        () =>
          void client()
            .e2ee.recoveryKeyCheck(secretBytes(value.trim()))
            .then(setCheck, () => setCheck(undefined)),
        300,
      );
    }),
  );

  async function restore() {
    setBusy(true);
    setFailure(undefined);
    try {
      const backup = client().e2ee.backup;
      const version = await backup.unlock(secretBytes(input().trim()));
      setInput("");
      await backup.restore(version, setProgress);
    } catch (e) {
      e2eeWarn("backup not restored", (e as { code?: string })?.code);
      setFailure(recoveryFailure(e));
    }
    setBusy(false);
  }

  const done = () => progress()?.finished && !busy();

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Restore history</Trans>
          <Beta />
        </>
      }
      actions={
        done()
          ? [{ text: <Trans>Done</Trans> }]
          : [
              { text: <Trans>Cancel</Trans> },
              {
                text: <Trans>Restore</Trans>,
                onClick: () => {
                  void restore();
                  return false;
                },
                isDisabled: busy() || !input().trim() || check() === "Typo",
              },
            ]
      }
      isDisabled={busy()}
    >
      <Stack>
        <Show
          when={!progress()}
          fallback={
            <Show
              when={done()}
              fallback={
                <Trans>
                  Restoring keys: {progress()!.done} of {progress()!.total}
                </Trans>
              }
            >
              <Notice icon="history">
                <Trans>Restored {progress()!.imported} keys.</Trans>
              </Notice>
              <Trans>
                Messages read with keys from the backup are marked "sender not
                confirmed": the backup cannot prove who wrote them.
              </Trans>
            </Show>
          }
        >
          <Trans>
            Enter your recovery key (or its passphrase) to read your earlier
            encrypted messages on this device.
          </Trans>
          <SecretField
            label={<Trans>Recovery key</Trans>}
            value={input()}
            onInput={setInput}
            type="text"
            multiline
            autofocus
            error={check() === "Typo"}
            helper={
              <Switch>
                <Match when={check() === "Valid"}>
                  <Trans>Looks like a recovery key</Trans>
                </Match>
                <Match when={check() === "Typo"}>
                  <Trans>There is a typo in the recovery key</Trans>
                </Match>
                <Match when={check() === "NotAKey"}>
                  <Trans>Will be used as a passphrase</Trans>
                </Match>
              </Switch>
            }
          />
        </Show>
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
