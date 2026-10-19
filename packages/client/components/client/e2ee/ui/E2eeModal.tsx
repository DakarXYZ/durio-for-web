import { Match, Switch } from "solid-js";

import type { DialogProps } from "@revolt/ui";

import type { E2eeModalView } from "./types";
import { BackupOffDialog } from "./views/BackupOff";
import { ChannelEncryptionDialog } from "./views/ChannelEncryption";
import { DiagnosticsDialog } from "./views/Diagnostics";
import { ExportKeysDialog, ImportKeysDialog } from "./views/KeyFiles";
import { KeyLostDialog, LogoutDialog, OnboardingDialog } from "./views/Prompts";
import { RecoveryDialog } from "./views/Recovery";
import { RestoreDialog } from "./views/Restore";
import { VerifyDialog } from "./views/Verify";

/**
 * Every E2EE dialog (dur.io, WEB-07, WEB-12), loaded as one lazy chunk when the first
 * of them opens (`{ type: "e2ee", view }`)
 */
export default function E2eeModal(
  props: DialogProps & { view: E2eeModalView },
) {
  const view = <K extends E2eeModalView["kind"]>(kind: K) =>
    props.view.kind === kind
      ? (props.view as Extract<E2eeModalView, { kind: K }>)
      : undefined;

  return (
    <Switch>
      <Match when={view("verify")}>
        {(v) => (
          <VerifyDialog
            show={props.show}
            onClose={props.onClose}
            flowId={v().flowId}
          />
        )}
      </Match>
      <Match when={view("verifyDevice")}>
        {(v) => (
          <VerifyDialog
            show={props.show}
            onClose={props.onClose}
            userId={v().userId}
            deviceId={v().deviceId}
          />
        )}
      </Match>
      <Match when={view("recovery")}>
        {(v) => (
          <RecoveryDialog
            show={props.show}
            onClose={props.onClose}
            rotate={v().rotate}
          />
        )}
      </Match>
      <Match when={view("backupOff")}>
        <BackupOffDialog show={props.show} onClose={props.onClose} />
      </Match>
      <Match when={view("restore")}>
        <RestoreDialog show={props.show} onClose={props.onClose} />
      </Match>
      <Match when={view("exportKeys")}>
        <ExportKeysDialog show={props.show} onClose={props.onClose} />
      </Match>
      <Match when={view("importKeys")}>
        <ImportKeysDialog show={props.show} onClose={props.onClose} />
      </Match>
      <Match when={view("diagnostics")}>
        <DiagnosticsDialog show={props.show} onClose={props.onClose} />
      </Match>
      <Match when={view("onboarding")}>
        {(v) => (
          <OnboardingDialog
            show={props.show}
            onClose={props.onClose}
            prompt={v().prompt}
          />
        )}
      </Match>
      <Match when={view("channel")}>
        {(v) => (
          <ChannelEncryptionDialog
            show={props.show}
            onClose={props.onClose}
            channel={v().channel}
          />
        )}
      </Match>
      <Match when={view("keyLost")}>
        <KeyLostDialog show={props.show} onClose={props.onClose} />
      </Match>
      <Match when={view("logout")}>
        {(v) => (
          <LogoutDialog
            show={props.show}
            onClose={props.onClose}
            backup={v().backup}
            reset={v().reset}
          />
        )}
      </Match>
    </Switch>
  );
}
