import { createEffect, on, onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Client, E2eeEvent } from "stoat.js";

import { useClient, useClientLifecycle } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useSnackbar } from "@revolt/ui";

import { e2eeWarn } from "../log";

import { newUnverifiedDevices } from "./logic/devices";
import { onboardingPrompt } from "./logic/recovery";
import { ONBOARDED, SEEN_DEVICES as SEEN } from "./marks";
import { notices } from "./notices";

/** Wait for the core's key query after a device list update */
const DEVICE_QUERY_MS = 3_000;

function readJson<T>(key: string): T | undefined {
  try {
    const value = localStorage.getItem(key);
    return value === null ? undefined : (JSON.parse(value) as T);
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

/**
 * Global E2EE prompts of the active account (dur.io, WEB-07, WEB-12), on every screen:
 * an incoming verification request, the first prompt of a new device, a new own device
 * to verify, requests that need the user, lost keys, and a session that ended (401 on
 * `/e2ee/*`). Renders nothing; the dialogs are a lazy chunk.
 */
export function E2eeWatcher() {
  const client = useClient();
  const lifecycle = useClientLifecycle();
  const { openModal } = useModals();
  const snackbar = useSnackbar();
  const { t } = useLingui();

  createEffect(
    on(client, (current) => {
      const prompted = new Set<string>();
      let keyLostShown = false;
      let onboardingRuns = false;
      let deviceTimer: ReturnType<typeof setTimeout> | undefined;

      const openSettings = () =>
        openModal({
          type: "settings",
          config: "user",
          context: { page: "encryption" },
        });

      const off = current.e2ee.on((event) => {
        void handle(event).catch((e) =>
          e2eeWarn("prompt failed", (e as { code?: string })?.code),
        );
      });

      async function handle(event: E2eeEvent) {
        switch (event.type) {
          case "verifications":
            for (const flowId of event.flowIds) {
              if (prompted.has(flowId)) continue;
              const flow = await current.e2ee.verification(flowId);
              if (!flow || (await flow.state()).type !== "Incoming") continue;
              prompted.add(flowId);
              openModal({ type: "e2ee", view: { kind: "verify", flowId } });
            }
            break;

          case "unauthorized":
            // the session ended (revoked elsewhere): the "logged out" screen, which
            // signs out properly and deletes the crypto store (WEB-12)
            lifecycle.lifecycle.showError({ type: "InvalidSession" });
            break;

          case "syncProblem":
            notices.setSyncProblem(true);
            break;

          case "actionRequired":
            notices.setActionRequired(event.code);
            if (event.code === "DeviceKeysConflict") showKeyLost();
            else
              snackbar.show({
                message:
                  event.code === "BackupVersionChanged"
                    ? t`The key backup was replaced on another device. Enter your recovery key to use it here.`
                    : t`Encryption needs your attention.`,
                action: t`Open`,
                onAction: openSettings,
              });
            break;

          case "status":
            if (event.status === "keyLost") showKeyLost();
            else if (event.status === "updateApp")
              snackbar.show({
                message: t`Encryption data of this device was saved by a newer version of the app. Update the app to read encrypted chats.`,
                closeable: true,
              });
            else if (event.status === "ready") {
              await onboarding(current);
              await checkNewDevices(current, true);
            }
            break;

          case "deviceList":
            if (event.user !== current.user?.id) break;
            clearTimeout(deviceTimer);
            deviceTimer = setTimeout(
              () => void checkNewDevices(current, false).catch(() => undefined),
              DEVICE_QUERY_MS,
            );
            break;
        }
      }

      function showKeyLost() {
        if (keyLostShown) return;
        keyLostShown = true;
        openModal({ type: "e2ee", view: { kind: "keyLost" } });
      }

      // the first prompt of a device: verify or restore, or set up a recovery key
      async function onboarding(cli: Client) {
        const device = cli.sessionId;
        const self = cli.user?.id;
        if (!device || !self || onboardingRuns || readJson(ONBOARDED + device))
          return;
        onboardingRuns = true;
        try {
          await onboardingOf(cli, device, self);
        } finally {
          onboardingRuns = false;
        }
      }

      async function onboardingOf(cli: Client, device: string, self: string) {
        const otherDevices = async () =>
          (await cli.e2ee.devices(self)).filter(
            (d) => !d.deleted && d.deviceId !== device,
          ).length;

        // a new device has not got its own key query back when it becomes ready:
        // look again before telling it that it is the only one of the account
        let ownDevices = await otherDevices();
        if (!ownDevices) {
          await new Promise((resolve) => setTimeout(resolve, DEVICE_QUERY_MS));
          if (cli.e2ee.status() !== "ready") return;
          ownDevices = await otherDevices();
        }

        const prompt = onboardingPrompt({
          ownDevices,
          backupOnThisDevice: (await cli.e2ee.backup.status()).enabled,
          backupOnServer: await cli.e2ee.backup.exists(),
        });

        writeJson(ONBOARDED + device, true);
        if (prompt)
          openModal({ type: "e2ee", view: { kind: "onboarding", prompt } });
      }

      // a new own device that is not verified: offer to verify it
      async function checkNewDevices(cli: Client, initial: boolean) {
        const device = cli.sessionId;
        const self = cli.user?.id;
        if (!device || !self || cli.e2ee.status() !== "ready") return;

        const devices = await cli.e2ee.devices(self);
        const seenList = readJson<string[]>(SEEN + device);
        const seen = new Set(seenList ?? []);
        const fresh = newUnverifiedDevices(devices, seen, device);
        writeJson(
          SEEN + device,
          devices.map((d) => d.deviceId),
        );

        // the first look on this device knows nothing new: the onboarding covers it
        if (!seenList || !fresh.length || (initial && !seenList.length)) return;
        snackbar.show({
          message: t`A new device signed in to your account. Verify it, so it can read your encrypted chats.`,
          action: t`Verify`,
          onAction: openSettings,
        });
      }

      onCleanup(() => {
        off();
        clearTimeout(deviceTimer);
      });
    }),
  );

  return null;
}
