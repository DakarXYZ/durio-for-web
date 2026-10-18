import { Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClientLifecycle } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Dialog, DialogProps } from "@revolt/ui";

import type { OnboardingPrompt } from "../logic/recovery";
import { Beta, Notice, Stack } from "../parts";

const openEncryptionSettings = (
  openModal: ReturnType<typeof useModals>["openModal"],
) =>
  openModal({
    type: "settings",
    config: "user",
    context: { page: "encryption" },
  });

/**
 * The first prompt of a device (dur.io, WEB-07, AN-31, AN-32): a new device is offered
 * to verify itself with another one or to restore the history; the first device of an
 * account without a backup is offered a recovery key
 */
export function OnboardingDialog(
  props: DialogProps & { prompt: OnboardingPrompt },
) {
  const { openModal } = useModals();
  const { t } = useLingui();

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          {props.prompt === "newDevice" ? (
            <Trans>New device</Trans>
          ) : (
            <Trans>Protect your encrypted history</Trans>
          )}
          <Beta />
        </>
      }
      actions={
        props.prompt === "newDevice"
          ? [
              { text: <Trans>Later</Trans> },
              {
                text: t`Restore with recovery key`,
                onClick: () =>
                  openModal({ type: "e2ee", view: { kind: "restore" } }),
              },
              {
                text: t`Verify with another device`,
                onClick: () => openEncryptionSettings(openModal),
              },
            ]
          : [
              { text: <Trans>Later</Trans> },
              {
                text: t`Create recovery key`,
                onClick: () =>
                  openModal({ type: "e2ee", view: { kind: "recovery" } }),
              },
            ]
      }
    >
      <Show
        when={props.prompt === "newDevice"}
        fallback={
          <Trans>
            Create a recovery key, so you can read your encrypted messages on a
            new device too.
          </Trans>
        }
      >
        <Trans>
          To read your earlier encrypted messages here, verify this device with
          another of your devices, or restore your history with the recovery
          key.
        </Trans>
      </Show>
    </Dialog>
  );
}

/**
 * The keys of this device are lost (dur.io, WEB-12, AN-42): the store cannot be opened
 * with its key, or the server has other keys for this device. Encrypted chats cannot be
 * read or written here; the way out is a new device: sign out and in again.
 */
export function KeyLostDialog(props: DialogProps) {
  const { logout } = useClientLifecycle();

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Encryption was reset</Trans>
          <Beta />
        </>
      }
      actions={[
        { text: <Trans>Later</Trans> },
        { text: <Trans>Log out and log in again</Trans>, onClick: logout },
      ]}
    >
      <Stack>
        <Trans>
          The encryption keys of this device are lost (the app data was restored
          or cleared, or the server has other keys for this device). Encrypted
          messages cannot be read or sent here.
        </Trans>
        <ol>
          <li>
            <Trans>Log out — the old keys of this device are deleted.</Trans>
          </li>
          <li>
            <Trans>Log in again — this becomes a new device.</Trans>
          </li>
          <li>
            <Trans>
              Restore your history with the recovery key, or verify the device
              with another one.
            </Trans>
          </li>
        </ol>
        <Notice kind="warning">
          <Trans>
            Without a recovery key or another device, earlier encrypted messages
            cannot be read on this device afterwards.
          </Trans>
        </Notice>
      </Stack>
    </Dialog>
  );
}

/**
 * Sign-out (or "reset encryption") of a device without a key backup (dur.io, WEB-12):
 * its keys are deleted with it, so offer a backup first
 */
export function LogoutDialog(
  props: DialogProps & { backup: boolean; reset?: boolean },
) {
  const { logout } = useClientLifecycle();
  const { openModal } = useModals();
  const { t } = useLingui();

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        props.reset ? (
          <>
            <Trans>Reset encryption</Trans>
            <Beta />
          </>
        ) : (
          <Trans>Log out?</Trans>
        )
      }
      actions={[
        { text: <Trans>Cancel</Trans> },
        ...(props.backup
          ? []
          : [
              {
                text: t`Set up key backup`,
                onClick: () =>
                  openModal({ type: "e2ee", view: { kind: "recovery" } }),
              },
            ]),
        {
          text: props.reset ? t`Log out and reset` : t`Log out`,
          onClick: logout,
        },
      ]}
    >
      <Stack>
        <Show when={props.reset}>
          <Trans>
            Logs this device out. After you log in again it is a new device:
            restore your history with the recovery key or verify it with another
            device.
          </Trans>
        </Show>
        <Switch>
          <Match when={!props.backup}>
            <Notice kind="warning">
              <Trans>
                This device has no key backup. Its encryption keys are deleted
                when you log out: without a backup or another verified device,
                your encrypted history cannot be read on a new device.
              </Trans>
            </Notice>
          </Match>
          <Match when={props.backup}>
            <Trans>
              The encryption keys of this device are deleted when you log out;
              your key backup stays on the server.
            </Trans>
          </Match>
        </Switch>
      </Stack>
    </Dialog>
  );
}
