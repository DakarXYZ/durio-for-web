import { createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps, TextField } from "@revolt/ui";
import {
  MAX_THREAD_NAME as MAX_NAME,
  threadNameFrom,
} from "@revolt/ui/components/features/messaging/elements/threadLogic";
import { useOpenThread } from "@revolt/ui/components/features/messaging/elements/ThreadSummary";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * dur.io: name a new thread and start it, from a message or on its own
 */
export function CreateThreadModal(
  props: DialogProps & Modals & { type: "create_thread" },
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const openThread = useOpenThread();

  // the name starts from the message's text as it is when the dialog opens
  // eslint-disable-next-line solid/reactivity
  const [name, setName] = createSignal(threadNameFrom(props.message?.content));
  const [busy, setBusy] = createSignal(false);

  const valid = () =>
    name().trim().length > 0 && name().trim().length <= MAX_NAME;

  async function create() {
    if (!valid() || busy()) return false;
    setBusy(true);
    try {
      const thread = await props.channel.createThread(
        name().trim(),
        props.message?.id,
      );
      openThread(thread);
    } catch (error) {
      showError(error);
      setBusy(false);
      return false;
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>New thread</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Create</Trans>,
          onClick: () => create(),
          isDisabled: !valid() || busy(),
        },
      ]}
    >
      <Fields
        onSubmit={(e) => {
          e.preventDefault();
          // eslint-disable-next-line solid/reactivity
          create().then((result) => result !== false && props.onClose());
        }}
      >
        <TextField
          name="thread-name"
          label={t`Thread name`}
          value={name()}
          maxlength={MAX_NAME}
          autoFocus
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </Fields>
    </Dialog>
  );
}

const Fields = styled("form", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
    minWidth: "min(420px, 80vw)",
  },
});
