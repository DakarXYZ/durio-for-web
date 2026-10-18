import { For, Show, createResource } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Channel, E2eeDevice } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Button, Dialog, DialogProps } from "@revolt/ui";

import { deviceStatus } from "../logic/devices";
import { fingerprintGroups } from "../logic/report";
import { Beta, Notice, Stack } from "../parts";

import { StatusText } from "./Devices";

/**
 * Encryption of a DM or group (dur.io, WEB-07, AN-30): the members' devices with their
 * verification, and what is not encrypted (calls, history before joining, Q32)
 */
export function ChannelEncryptionDialog(
  props: DialogProps & { channel: Channel },
) {
  const client = useClient();
  const { openModal } = useModals();

  const members = () =>
    [...props.channel.recipientIds].filter((id) => id !== client().user?.id);

  const [devices, { refetch }] = createResource(
    () => client().e2ee.status() === "ready" && members(),
    async (ids) => {
      const out: { userId: string; devices: E2eeDevice[] }[] = [];
      for (const userId of ids)
        out.push({
          userId,
          devices: (await client().e2ee.devices(userId)).filter(
            (d) => !d.deleted,
          ),
        });
      return out;
    },
  );

  async function setBlocked(device: E2eeDevice, blocked: boolean) {
    await client().e2ee.setDeviceTrust(
      device,
      blocked ? "Blocked" : "Unverified",
    );
    void refetch();
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>End-to-end encrypted</Trans>
          <Beta />
        </>
      }
      actions={[{ text: <Trans>Close</Trans> }]}
    >
      <Stack>
        <Trans>
          Messages and files here are readable only on the members' devices, not
          by the server. Search does not work here, and links get no previews.
        </Trans>
        <Notice kind="warning" icon="call">
          <Trans>Calls in this chat are not end-to-end encrypted.</Trans>
        </Notice>
        <Show when={props.channel.type === "Group"}>
          <Notice icon="history">
            <Trans>
              Members who join later cannot read the messages sent before they
              joined.
            </Trans>
          </Notice>
        </Show>
        <Show
          when={client().e2ee.status() === "ready"}
          fallback={
            <Trans>Encryption is not available on this device right now.</Trans>
          }
        >
          <For each={devices() ?? []}>
            {(member) => (
              <Member>
                <strong>
                  {client().users.get(member.userId)?.displayName ??
                    member.userId}
                </strong>
                <Show
                  when={member.devices.length}
                  fallback={
                    <Notice kind="warning">
                      <Trans>
                        No device of this person can read encrypted messages
                        yet: they need the dur.io app and to sign in again.
                      </Trans>
                    </Notice>
                  }
                >
                  <For each={member.devices}>
                    {(device) => (
                      <DeviceLine>
                        <div>
                          <StatusText status={deviceStatus(device)} />
                          <Key>{fingerprintGroups(device.ed25519 ?? "")}</Key>
                        </div>
                        <Show when={device.trust === "Unverified"}>
                          <Button
                            size="sm"
                            variant="tonal"
                            onPress={() =>
                              openModal({
                                type: "e2ee",
                                view: {
                                  kind: "verifyDevice",
                                  userId: device.userId,
                                  deviceId: device.deviceId,
                                },
                              })
                            }
                          >
                            <Trans>Verify</Trans>
                          </Button>
                        </Show>
                        <Button
                          size="sm"
                          variant="text"
                          onPress={() =>
                            void setBlocked(device, device.trust !== "Blocked")
                          }
                        >
                          {device.trust === "Blocked" ? (
                            <Trans>Unblock</Trans>
                          ) : (
                            <Trans>Block</Trans>
                          )}
                        </Button>
                      </DeviceLine>
                    )}
                  </For>
                </Show>
              </Member>
            )}
          </For>
        </Show>
      </Stack>
    </Dialog>
  );
}

const Member = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "var(--gap-sm)" },
});

const DeviceLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    "& > div": { flexGrow: 1, minWidth: 0 },
  },
});

const Key = styled("div", {
  base: {
    fontFamily: "var(--fonts-monospace)",
    fontSize: "0.8em",
    wordBreak: "break-all",
    color: "var(--md-sys-color-outline)",
  },
});
