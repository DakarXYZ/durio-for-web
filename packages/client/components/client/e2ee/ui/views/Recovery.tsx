import {
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { E2eeRecoverySetup } from "stoat.js";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Button, Checkbox, Dialog, DialogProps } from "@revolt/ui";

import { e2eeWarn } from "../../log";
import {
  type RecoveryFailure,
  CLEAR_CLIPBOARD_MS,
  activateWithMfa,
  recoveryFailure,
  recoveryKeyFileName,
} from "../logic/recovery";
import { Beta, Buttons, Mono, Notice, Stack, saveTextFile } from "../parts";

import { RecoveryFailureText } from "./Restore";

type Step = "intro" | "key" | "activating" | "done";

let clearClipboard: ReturnType<typeof setTimeout> | undefined;

/**
 * A new recovery key and key backup, or a new backup under the same key (dur.io,
 * WEB-07, AN-32, CR-12). The key is shown once, never stored by the app; creating a
 * backup that replaces one (and every rotation) needs an MFA ticket, asked up front.
 */
export function RecoveryDialog(props: DialogProps & { rotate?: boolean }) {
  const client = useClient();
  const { mfaFlow } = useModals();
  const { t } = useLingui();

  const [step, setStep] = createSignal<Step>("intro");
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<RecoveryFailure>();
  const [exists, setExists] = createSignal<boolean>();
  const [saved, setSaved] = createSignal(false);
  const [copyWarning, setCopyWarning] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  // secret: in memory only, dropped when the dialog goes
  const [setup, setSetup] = createSignal<E2eeRecoverySetup>();
  onCleanup(() => setSetup(undefined));

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

  async function create() {
    setBusy(true);
    setFailure(undefined);
    try {
      const backup = client().e2ee.backup;
      setSetup(await (props.rotate ? backup.rotate() : backup.create()));
      // a rotation keeps the key the user has: nothing to show
      if (props.rotate) await activate();
      else setStep("key");
    } catch (e) {
      e2eeWarn("recovery not created", (e as { code?: string })?.code);
      setFailure(recoveryFailure(e));
    }
    setBusy(false);
  }

  async function activate() {
    const current = setup();
    if (!current) return;
    setStep("activating");
    setBusy(true);
    setFailure(undefined);
    try {
      const result = await activateWithMfa({
        rotate: !!props.rotate,
        existsOnServer: exists(),
        activate: (ticket) => client().e2ee.backup.activate(current, ticket),
        requestTicket,
      });

      if (result === "cancelled") setStep(props.rotate ? "intro" : "key");
      else {
        setSetup(undefined);
        setStep("done");
      }
    } catch (e) {
      e2eeWarn("recovery not activated", (e as { code?: string })?.code);
      setFailure(recoveryFailure(e));
      setStep(props.rotate ? "intro" : "key");
    }
    setBusy(false);
  }

  function copy() {
    const key = setup()?.recoveryKey;
    if (!key) return;
    void navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      clearTimeout(clearClipboard);
      clearClipboard = setTimeout(
        () => void navigator.clipboard.writeText("").catch(() => undefined),
        CLEAR_CLIPBOARD_MS,
      );
    });
  }

  const actions = () => {
    switch (step()) {
      case "intro":
        return [
          { text: <Trans>Cancel</Trans> },
          {
            text: props.rotate ? t`Replace the backup` : t`Create recovery key`,
            onClick: () => {
              void create();
              return false;
            },
            isDisabled: busy(),
          },
        ];
      case "key":
        return [
          { text: <Trans>Cancel</Trans> },
          {
            text: <Trans>Turn on backup</Trans>,
            onClick: () => {
              void activate();
              return false;
            },
            isDisabled: busy() || !saved(),
          },
        ];
      case "activating":
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
          {props.rotate ? (
            <Trans>Replace the backup</Trans>
          ) : (
            <Trans>Recovery key</Trans>
          )}
          <Beta />
        </>
      }
      actions={actions()}
      isDisabled={busy()}
    >
      <Stack>
        <Switch>
          <Match when={step() === "intro"}>
            <Show
              when={props.rotate}
              fallback={
                <Trans>
                  The recovery key unlocks the backup of your encryption keys.
                  With it, a new device can read your earlier encrypted
                  messages. The server cannot read the backup. Keep the key
                  somewhere safe: nobody, not even the server, can recover it
                  for you.
                </Trans>
              }
            >
              <Trans>
                Creates a new backup with a new backup key under the same
                recovery key, for example if you suspect that the backup key
                leaked. Needs your password.
              </Trans>
            </Show>
            <Show when={!props.rotate && exists()}>
              <Notice kind="warning">
                <Trans>
                  You already have a backup. A new recovery key replaces it: the
                  old key stops working, and keys that only the old backup has
                  are lost. If you have the old key, restore your history
                  instead.
                </Trans>
              </Notice>
            </Show>
          </Match>
          <Match when={step() === "key"}>
            <Trans>
              Your recovery key. Write it down or save it to a file. It is shown
              only now.
            </Trans>
            <Mono>{setup()?.recoveryKey}</Mono>
            <Buttons>
              <Button
                variant="tonal"
                size="sm"
                onPress={() => (copyWarning() ? copy() : setCopyWarning(true))}
              >
                {copyWarning() ? (
                  <Trans>Copy anyway</Trans>
                ) : (
                  <Trans>Copy</Trans>
                )}
              </Button>
              <Button
                variant="tonal"
                size="sm"
                onPress={() =>
                  saveTextFile(
                    recoveryKeyFileName(),
                    `dur.io recovery key\n\n${setup()?.recoveryKey ?? ""}\n`,
                  )
                }
              >
                <Trans>Save to file</Trans>
              </Button>
            </Buttons>
            <Show when={copyWarning() && !copied()}>
              <Notice kind="warning">
                <Trans>
                  Other apps and clipboard managers can read the clipboard. It
                  is cleared after a minute. Writing the key down is safer.
                </Trans>
              </Notice>
            </Show>
            <Show when={copied()}>
              <Notice>
                <Trans>Copied. The clipboard is cleared in a minute.</Trans>
              </Notice>
            </Show>
            <Checkbox
              checked={saved()}
              onChange={(e) => setSaved(e.currentTarget.checked)}
            >
              <Trans>I have saved my recovery key</Trans>
            </Checkbox>
          </Match>
          <Match when={step() === "activating"}>
            <Trans>Turning on the backup…</Trans>
          </Match>
          <Match when={step() === "done"}>
            <Notice icon="cloud_done">
              <Trans>
                Backup is on. The keys of your encrypted chats are backed up
                from now on.
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
