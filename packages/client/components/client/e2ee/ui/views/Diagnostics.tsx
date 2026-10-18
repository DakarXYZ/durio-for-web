import { Show, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { IS_DESKTOP } from "@revolt/common/lib/desktop";
import { useState } from "@revolt/state";
import { Dialog, DialogProps } from "@revolt/ui";

import pkg from "../../../../../../../package.json";
import { composeReport, reportFileName } from "../logic/report";
import { notices } from "../notices";
import { Beta, ReportText, Stack, saveTextFile } from "../parts";

/**
 * "Diagnostic report" instead of Sentry (dur.io, WEB-07, CR-22, O8): built on this
 * device, shown in full, saved to a file only when the user says so. No server address,
 * no messages, keys or other people's ids.
 */
export function DiagnosticsDialog(props: DialogProps) {
  const client = useClient();
  const state = useState();
  const [report, setReport] = createSignal<string>();

  onMount(async () => {
    let core: string | undefined;
    try {
      core = await client().e2ee.debugReport();
    } catch {
      core = undefined;
    }

    let coreVersion: string | undefined;
    try {
      coreVersion = core
        ? (JSON.parse(core) as { core_version?: string }).core_version
        : undefined;
    } catch {
      coreVersion = undefined;
    }

    const native = window.native?.versions;
    setReport(
      composeReport(
        {
          version: pkg.version,
          build: IS_DESKTOP ? "desktop" : "web",
          desktop: native
            ? `${native.desktop()} (electron ${native.electron()}, chrome ${native.chrome()})`
            : undefined,
          userAgentPlatform: navigator.platform || "unknown",
          coreVersion,
          e2eeStatus: client().e2ee.status(),
          syncProblem: notices.syncProblem(),
          accounts: state.auth.getSessions().length,
        },
        core,
      ),
    );
  });

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Diagnostic report</Trans>
          <Beta />
        </>
      }
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Save to file</Trans>,
          onClick: () => {
            const text = report();
            if (text) saveTextFile(reportFileName(), text);
          },
          isDisabled: !report(),
        },
      ]}
    >
      <Stack>
        <Trans>
          A report for the developers: counts, states and error codes of
          encryption on this device, app and system version. No messages, keys,
          server address or other people's IDs. This is everything it contains;
          you choose where it goes.
        </Trans>
        <Show when={report()} fallback={<Trans>Building the report…</Trans>}>
          <ReportText>{report()}</ReportText>
        </Show>
      </Stack>
    </Dialog>
  );
}
