import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  onMount,
} from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Button, Column, Text, Time } from "@revolt/ui";

import {
  type DeviceRow,
  type DeviceStatus,
  deviceRows,
} from "../logic/devices";
import { backupChange } from "../logic/recovery";
import { fingerprintGroups } from "../logic/report";
import { notices } from "../notices";
import { Beta, Buttons, Mono, Notice } from "../parts";

/**
 * Verification of a device in words
 */
export function StatusText(props: { status: DeviceStatus }) {
  return (
    <StatusLabel status={props.status}>
      <Switch>
        <Match when={props.status === "verified"}>
          <Trans>Verified</Trans>
        </Match>
        <Match when={props.status === "unverified"}>
          <Trans>Not verified</Trans>
        </Match>
        <Match when={props.status === "blocked"}>
          <Trans>Blocked</Trans>
        </Match>
        <Match when={props.status === "none"}>
          <Trans>No encryption</Trans>
        </Match>
        <Match when={props.status === "removed"}>
          <Trans>Removed</Trans>
        </Match>
      </Switch>
    </StatusLabel>
  );
}

const StatusLabel = styled("span", {
  base: { fontSize: "0.85em", fontWeight: 600 },
  variants: {
    status: {
      verified: { color: "var(--md-sys-color-primary)" },
      unverified: { color: "var(--md-sys-color-tertiary)" },
      blocked: { color: "var(--md-sys-color-error)" },
      none: { color: "var(--md-sys-color-outline)" },
      removed: { color: "var(--md-sys-color-outline)" },
    },
  },
});

/**
 * The key backup was deleted on another device (no backup on the server anymore)
 */
function BackupTurnedOffText() {
  return (
    <Trans>
      The key backup was turned off on another device. The keys of this device
      are no longer backed up: set up a new recovery key to turn the backup on
      again.
    </Trans>
  );
}

/**
 * "Devices and encryption" (dur.io, WEB-07, AN-30): status of this device, its
 * fingerprint, the account's devices (a session is a device, C22) with verification,
 * the key backup, key files, the diagnostic report and the reset. Everything E2EE is
 * labelled beta (O8).
 */
export default function E2eeSettings() {
  const client = useClient();
  const { openModal, mfaFlow, showError } = useModals();

  onMount(() => void client().sessions.fetch());

  const ready = () => client().e2ee.status() === "ready";

  const [identity] = createResource(ready, () => client().e2ee.identityKeys());

  const [own, { refetch }] = createResource(
    () => ready() && client().user?.id,
    async (self) => ({
      devices: await client().e2ee.devices(self),
      undelivered: await client().e2ee.undeliveredDevices(),
    }),
  );

  const [backup, { refetch: refetchBackup }] = createResource(ready, () =>
    client().e2ee.backup.status(),
  );

  // the core stops uploads on 404 and 409 alike: ask the server which it was
  const backupStopped = () =>
    !!backup()?.outdated ||
    (notices.actionRequired() === "BackupVersionChanged" &&
      backup()?.outdated !== false);
  const [change] = createResource(backupStopped, () =>
    backupChange(() => client().e2ee.backup.exists()),
  );

  const rows = createMemo<DeviceRow[]>(() =>
    deviceRows(
      client().sessions.toList(),
      own()?.devices ?? [],
      client().sessionId,
      own()?.undelivered ?? [],
    ),
  );

  const others = () => rows().filter((row) => !row.current);
  const noneVerified = () =>
    others().some((row) => row.status === "unverified") &&
    !others().some((row) => row.status === "verified");

  async function logOutDevice(id: string) {
    try {
      const session = client().sessions.get(id);
      if (!session) return;
      const mfa = await client().account.mfa();
      const ticket = await mfaFlow(mfa as never);
      if (ticket) await session.delete(ticket);
      void refetch();
    } catch (e) {
      showError(e);
    }
  }

  async function setBlocked(row: DeviceRow, blocked: boolean) {
    if (!row.device) return;
    try {
      await client().e2ee.setDeviceTrust(
        row.device,
        blocked ? "Blocked" : "Unverified",
      );
      void refetch();
    } catch (e) {
      showError(e);
    }
  }

  async function reset() {
    let hasBackup = false;
    try {
      hasBackup = (await client().e2ee.backup.status()).enabled;
    } catch {
      hasBackup = false;
    }
    openModal({
      type: "e2ee",
      view: { kind: "logout", backup: hasBackup, reset: true },
    });
  }

  const open = (
    kind:
      | "recovery"
      | "backupOff"
      | "restore"
      | "exportKeys"
      | "importKeys"
      | "diagnostics",
    rotate?: boolean,
  ) => {
    openModal({
      type: "e2ee",
      view: kind === "recovery" ? { kind, rotate } : { kind },
    });
    // the dialogs change the backup: read it again when they are done
    setTimeout(() => void refetchBackup(), 1_000);
  };

  return (
    <Column gap="lg">
      <Section>
        <Text class="title">
          <Trans>Devices and encryption</Trans>
          <Beta />
        </Text>
        <Switch>
          <Match when={ready()}>
            <Notice icon="lock">
              <Trans>End-to-end encryption is on for this device.</Trans>
            </Notice>
          </Match>
          <Match when={client().e2ee.status() === "starting"}>
            <Notice>
              <Trans>Encryption is starting…</Trans>
            </Notice>
          </Match>
          <Match when={client().e2ee.status() === "locked"}>
            <Notice kind="warning">
              <Trans>
                Encryption is active in another window. Manage it there.
              </Trans>
            </Notice>
          </Match>
          <Match when={client().e2ee.status() === "keyLost"}>
            <Notice
              kind="error"
              action={
                <Button
                  size="sm"
                  onPress={() =>
                    openModal({ type: "e2ee", view: { kind: "keyLost" } })
                  }
                >
                  <Trans>Reset encryption</Trans>
                </Button>
              }
            >
              <Trans>
                The encryption keys of this device are lost. Reset encryption to
                keep chatting in encrypted chats.
              </Trans>
            </Notice>
          </Match>
          <Match when={client().e2ee.status() === "updateApp"}>
            <Notice kind="error">
              <Trans>
                The encryption data of this device was saved by a newer version
                of the app. Install the latest version to read encrypted chats
                again. Resetting encryption instead loses the keys that are not
                in your backup.
              </Trans>
            </Notice>
          </Match>
          <Match
            when={client().e2ee.status() === "off" && !client().e2ee.enabled}
          >
            <Notice>
              <Trans>This server does not offer end-to-end encryption.</Trans>
            </Notice>
          </Match>
          <Match when={true}>
            <Notice kind="warning">
              <Trans>
                Encryption is not available right now. Check the connection or
                log in again.
              </Trans>
            </Notice>
          </Match>
        </Switch>
        <Show when={notices.syncProblem()}>
          <Notice kind="warning">
            <Trans>
              The server refused some encryption data of this device (keys or
              verification messages). Chatting goes on; if messages stay
              unreadable for others, send a diagnostic report below.
            </Trans>
          </Notice>
        </Show>
        <Show when={backupStopped()}>
          <Switch>
            <Match when={change() === "turnedOff"}>
              <Notice
                kind="warning"
                action={
                  <Button size="sm" onPress={() => open("recovery")}>
                    <Trans>New recovery key</Trans>
                  </Button>
                }
              >
                <BackupTurnedOffText />
              </Notice>
            </Match>
            <Match when={!change.loading}>
              <Notice
                kind="warning"
                action={
                  <Button size="sm" onPress={() => open("restore")}>
                    <Trans>Enter recovery key</Trans>
                  </Button>
                }
              >
                <Trans>
                  The backup was replaced on another device. Enter your recovery
                  key to use it here.
                </Trans>
              </Notice>
            </Match>
          </Switch>
        </Show>
      </Section>

      <Show when={ready()}>
        <Section>
          <Text class="label">
            <Trans>This device</Trans>
          </Text>
          <Show when={identity()}>
            {(keys) => (
              <>
                <Text class="body">
                  <Trans>
                    Device key — compare it with the other screen when
                    verifying:
                  </Trans>
                </Text>
                <Mono>{fingerprintGroups(keys().ed25519)}</Mono>
              </>
            )}
          </Show>
        </Section>

        <Section>
          <Text class="label">
            <Trans>Your other devices</Trans>
          </Text>
          <Show when={noneVerified()}>
            <Notice>
              <Trans>
                None of your other devices is verified. Verify this device with
                one of them: then it can share the keys of your earlier
                messages.
              </Trans>
            </Notice>
          </Show>
          <Show when={own.error}>
            <Notice kind="warning">
              <Trans>The device list could not be loaded.</Trans>
            </Notice>
          </Show>
          <For each={others()}>
            {(row) => (
              <DeviceCard>
                <div>
                  <strong>{row.name ?? row.id}</strong>{" "}
                  <StatusText status={row.status} />
                  <Show when={row.createdAt}>
                    <Text class="label">
                      <Trans>
                        Signed in{" "}
                        <Time value={row.createdAt!} format="relative" />
                      </Trans>
                    </Text>
                  </Show>
                  <Show when={row.missesKeys}>
                    <Notice kind="warning">
                      <Trans>
                        This device does not receive keys: its inbox on the
                        server is full.
                      </Trans>
                    </Notice>
                  </Show>
                </div>
                <Buttons>
                  <Show when={row.status === "unverified"}>
                    <Button
                      size="sm"
                      variant="tonal"
                      onPress={() =>
                        openModal({
                          type: "e2ee",
                          view: {
                            kind: "verifyDevice",
                            userId: row.device!.userId,
                            deviceId: row.id,
                          },
                        })
                      }
                    >
                      <Trans>Verify</Trans>
                    </Button>
                  </Show>
                  <Show
                    when={
                      row.status === "unverified" || row.status === "blocked"
                    }
                  >
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() =>
                        void setBlocked(row, row.status !== "blocked")
                      }
                    >
                      {row.status === "blocked" ? (
                        <Trans>Unblock</Trans>
                      ) : (
                        <Trans>Block</Trans>
                      )}
                    </Button>
                  </Show>
                  <Show when={row.name}>
                    <Button
                      size="sm"
                      variant="text"
                      onPress={() => void logOutDevice(row.id)}
                    >
                      <Trans>Log out</Trans>
                    </Button>
                  </Show>
                </Buttons>
              </DeviceCard>
            )}
          </For>
          <Text class="label">
            <Trans>
              Reinstalled the app? The old installation stays in this list as a
              separate device until you log it out.
            </Trans>
          </Text>
        </Section>

        <Section>
          <Text class="label">
            <Trans>Recovery and key backup</Trans>
          </Text>
          <Switch>
            <Match when={backup()?.outdated && change() === "turnedOff"}>
              <Notice kind="warning">
                <BackupTurnedOffText />
              </Notice>
            </Match>
            <Match when={backup()?.outdated}>
              <Notice kind="warning">
                <Trans>
                  The backup was replaced on another device. Enter your recovery
                  key to use it here.
                </Trans>
              </Notice>
            </Match>
            <Match when={backup()?.enabled}>
              <Notice icon="cloud_done">
                <Trans>
                  Key backup is on: the keys of your encrypted chats are stored
                  on the server, encrypted with your recovery key.
                </Trans>{" "}
                <Trans>
                  Keys backed up: {backup()!.keysBackedUp} of{" "}
                  {backup()!.keysTotal}
                </Trans>
              </Notice>
            </Match>
            <Match when={backup()}>
              <Notice kind="warning">
                <Trans>
                  No key backup on this device. Without it, a new device cannot
                  read your earlier encrypted messages unless you verify it with
                  another one.
                </Trans>
              </Notice>
            </Match>
          </Switch>
          <Buttons>
            <Button size="sm" variant="tonal" onPress={() => open("recovery")}>
              <Trans>New recovery key</Trans>
            </Button>
            <Button size="sm" variant="tonal" onPress={() => open("restore")}>
              <Trans>Restore history</Trans>
            </Button>
            <Show when={backup()?.enabled}>
              <Button
                size="sm"
                variant="text"
                onPress={() => open("recovery", true)}
              >
                <Trans>Replace the backup (keeps the recovery key)</Trans>
              </Button>
              <Button
                size="sm"
                variant="text"
                onPress={() => open("backupOff")}
              >
                <Trans>Turn off backup</Trans>
              </Button>
            </Show>
          </Buttons>
        </Section>

        <Section>
          <Text class="label">
            <Trans>Key files</Trans>
          </Text>
          <Text class="body">
            <Trans>
              Save the keys of your encrypted chats to a file protected with a
              passphrase, or load such a file — for example after reinstalling
              without a key backup.
            </Trans>
          </Text>
          <Buttons>
            <Button
              size="sm"
              variant="tonal"
              onPress={() => open("exportKeys")}
            >
              <Trans>Export keys</Trans>
            </Button>
            <Button
              size="sm"
              variant="tonal"
              onPress={() => open("importKeys")}
            >
              <Trans>Import keys</Trans>
            </Button>
          </Buttons>
        </Section>
      </Show>

      <Section>
        <Text class="label">
          <Trans>Diagnostics</Trans>
        </Text>
        <Text class="body">
          <Trans>
            Builds a report for the developers: counts, states and error codes
            of encryption on this device, app and system version. You see it
            before it is saved, and you choose where it goes.
          </Trans>
        </Text>
        <Buttons>
          <Button size="sm" variant="tonal" onPress={() => open("diagnostics")}>
            <Trans>Diagnostic report</Trans>
          </Button>
        </Buttons>
      </Section>

      <Section>
        <Text class="label">
          <Trans>Reset encryption</Trans>
        </Text>
        <Text class="body">
          <Trans>
            Resetting encryption logs this device out. Use it if encrypted chats
            keep failing on this device.
          </Trans>
        </Text>
        <Buttons>
          <Button size="sm" variant="_error" onPress={() => void reset()}>
            <Trans>Reset encryption</Trans>
          </Button>
        </Buttons>
      </Section>
    </Column>
  );
}

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});

const DeviceCard = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container)",
    "& > div:first-child": {
      display: "flex",
      flexDirection: "column",
      gap: "var(--gap-xs)",
      minWidth: 0,
    },
  },
});
