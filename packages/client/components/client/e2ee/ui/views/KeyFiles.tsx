import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { E2eeKeyImportResult } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Checkbox, Dialog, DialogProps } from "@revolt/ui";

import { e2eeWarn } from "../../log";
import {
  type KeyFileFailure,
  MIN_PASSPHRASE,
  canExport,
  keyFileFailure,
  keyFileName,
  passphraseStrength,
  readKeyFile,
  secretBytes,
} from "../logic/keyFiles";
import { Beta, Notice, SecretField, Stack, saveTextFile } from "../parts";

function FailureText(props: { failure: KeyFileFailure }) {
  return (
    <Switch fallback={<Trans>Something went wrong. Try again.</Trans>}>
      <Match when={props.failure === "tooManySessions"}>
        <Trans>
          Too many keys for one file. Export the chats one by one (untick "All
          encrypted chats").
        </Trans>
      </Match>
      <Match when={props.failure === "wrongPassphrase"}>
        <Trans>Wrong passphrase, or the file was modified.</Trans>
      </Match>
      <Match when={props.failure === "invalidFile"}>
        <Trans>This is not a key file, or it is damaged.</Trans>
      </Match>
      <Match when={props.failure === "tooLarge"}>
        <Trans>The file is too large (more than 64 MiB).</Trans>
      </Match>
      <Match when={props.failure === "fileAccess"}>
        <Trans>The file could not be read.</Trans>
      </Match>
      <Match when={props.failure === "noDevice"}>
        <Trans>Encryption is not available on this device right now.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * Strength of a passphrase in words
 */
function StrengthText(props: { passphrase: string }) {
  return (
    <Switch>
      <Match when={passphraseStrength(props.passphrase) === "tooShort"}>
        <Trans>Too short: at least {MIN_PASSPHRASE} characters.</Trans>
      </Match>
      <Match when={passphraseStrength(props.passphrase) === "weak"}>
        <Trans>Weak: easy to guess. Use several words.</Trans>
      </Match>
      <Match when={passphraseStrength(props.passphrase) === "fair"}>
        <Trans>Fair. A longer passphrase is safer.</Trans>
      </Match>
      <Match when={passphraseStrength(props.passphrase) === "strong"}>
        <Trans>Strong.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * Export the keys of encrypted chats to a passphrase-protected file (dur.io, WEB-07,
 * CR-21): the Matrix "Megolm session export", readable by other Matrix apps too
 */
export function ExportKeysDialog(props: DialogProps) {
  const client = useClient();
  const [passphrase, setPassphrase] = createSignal("");
  const [repeated, setRepeated] = createSignal("");
  const [all, setAll] = createSignal(true);
  const [chosen, setChosen] = createSignal<string[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<KeyFileFailure>();
  const [exported, setExported] = createSignal<number>();

  const channels = createMemo(() =>
    client().channels.filter((channel) => client().e2ee.isEncrypted(channel)),
  );

  const mismatch = () => !!repeated() && passphrase() !== repeated();
  const ready = () =>
    canExport(passphrase(), repeated()) && (all() || chosen().length > 0);

  async function run() {
    setBusy(true);
    setFailure(undefined);
    try {
      const file = await client().e2ee.exportKeys(
        secretBytes(passphrase()),
        all() ? [] : chosen(),
      );
      setPassphrase("");
      setRepeated("");
      saveTextFile(keyFileName(), file.data);
      setExported(file.sessions);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      e2eeWarn("keys not exported", code);
      setFailure(keyFileFailure(code, true));
    }
    setBusy(false);
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Export keys</Trans>
          <Beta />
        </>
      }
      actions={
        exported() !== undefined
          ? [{ text: <Trans>Done</Trans> }]
          : [
              { text: <Trans>Cancel</Trans> },
              {
                text: <Trans>Export and save</Trans>,
                onClick: () => {
                  void run();
                  return false;
                },
                isDisabled: busy() || !ready(),
              },
            ]
      }
      isDisabled={busy()}
    >
      <Stack>
        <Show
          when={exported() === undefined}
          fallback={
            <Notice icon="key">
              <Trans>Saved: keys of {exported()} sessions.</Trans>
            </Notice>
          }
        >
          <Trans>
            Anyone with this file and its passphrase can read your encrypted
            chats. Choose a long passphrase (several words) and keep the file
            somewhere safe. The passphrase cannot be recovered.
          </Trans>
          <SecretField
            label={<Trans>Passphrase</Trans>}
            value={passphrase()}
            onInput={setPassphrase}
            autofocus
            helper={
              passphrase() ? (
                <StrengthText passphrase={passphrase()} />
              ) : undefined
            }
          />
          <SecretField
            label={<Trans>Repeat the passphrase</Trans>}
            value={repeated()}
            onInput={setRepeated}
            error={mismatch()}
            helper={
              mismatch() ? (
                <Trans>The passphrases do not match.</Trans>
              ) : undefined
            }
          />
          <Checkbox
            checked={all()}
            onChange={(e) => setAll(e.currentTarget.checked)}
          >
            <Trans>All encrypted chats</Trans>
          </Checkbox>
          <Show when={!all()}>
            <Show
              when={channels().length}
              fallback={
                <Trans>
                  No encrypted chats are loaded yet: all keys this device has
                  are exported.
                </Trans>
              }
            >
              <ChannelList>
                <For each={channels()}>
                  {(channel) => (
                    <Checkbox
                      checked={chosen().includes(channel.id)}
                      onChange={(e) =>
                        setChosen((ids) =>
                          e.currentTarget.checked
                            ? [...ids, channel.id]
                            : ids.filter((id) => id !== channel.id),
                        )
                      }
                    >
                      {channel.displayName}
                    </Checkbox>
                  )}
                </For>
              </ChannelList>
            </Show>
          </Show>
          <Show when={busy()}>
            <Trans>Encrypting the keys…</Trans>
          </Show>
        </Show>
        <Show when={failure()}>
          {(f) => (
            <Notice kind="error">
              <FailureText failure={f()} />
            </Notice>
          )}
        </Show>
      </Stack>
    </Dialog>
  );
}

/**
 * Import a key file of dur.io or another Matrix app (dur.io, WEB-07, CR-21): keys
 * already known are kept; messages waiting for the imported keys are decrypted again
 */
export function ImportKeysDialog(props: DialogProps) {
  const client = useClient();
  const [file, setFile] = createSignal<File>();
  const [passphrase, setPassphrase] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<KeyFileFailure>();
  const [result, setResult] = createSignal<E2eeKeyImportResult>();

  async function run() {
    const chosen = file();
    if (!chosen) return;
    setBusy(true);
    setFailure(undefined);
    const read = await readKeyFile(chosen);
    if ("failure" in read) {
      setFailure(read.failure);
      return setBusy(false);
    }

    try {
      setResult(
        await client().e2ee.importKeys(read.text, secretBytes(passphrase())),
      );
      setPassphrase("");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      e2eeWarn("keys not imported", code);
      setFailure(keyFileFailure(code, false));
    }
    setBusy(false);
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={
        <>
          <Trans>Import keys</Trans>
          <Beta />
        </>
      }
      actions={
        result()
          ? [{ text: <Trans>Done</Trans> }]
          : [
              { text: <Trans>Cancel</Trans> },
              {
                text: <Trans>Import</Trans>,
                onClick: () => {
                  void run();
                  return false;
                },
                isDisabled: busy() || !file() || !passphrase(),
              },
            ]
      }
      isDisabled={busy()}
    >
      <Stack>
        <Show
          when={result()}
          fallback={
            <>
              <Trans>
                Choose a key file exported from dur.io or another Matrix app and
                enter its passphrase. Keys you already have are kept; messages
                waiting for these keys become readable.
              </Trans>
              <FileInput
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => setFile(e.currentTarget.files?.[0])}
              />
              <SecretField
                label={<Trans>Passphrase</Trans>}
                value={passphrase()}
                onInput={setPassphrase}
              />
              <Show when={busy()}>
                <Trans>Decrypting the file…</Trans>
              </Show>
            </>
          }
        >
          {(r) => (
            <>
              <Notice icon="key">
                <Trans>
                  Imported {r().imported} of {r().total} keys.
                </Trans>
              </Notice>
              <Show when={r().skipped}>
                <Trans>
                  {r().skipped} keys of rooms from other apps were left out.
                </Trans>
              </Show>
              <Trans>
                Messages read with imported keys are marked "sender not
                confirmed": a file cannot prove who wrote them.
              </Trans>
            </>
          )}
        </Show>
        <Show when={failure()}>
          {(f) => (
            <Notice kind="error">
              <FailureText failure={f()} />
            </Notice>
          )}
        </Show>
      </Stack>
    </Dialog>
  );
}

const ChannelList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    maxHeight: "200px",
    overflowY: "auto",
  },
});

const FileInput = styled("input", {
  base: { color: "var(--md-sys-color-on-surface)" },
});
