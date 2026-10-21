import { Index, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import {
  Checkbox,
  Dialog,
  DialogProps,
  IconButton,
  TextField,
  iconSize,
} from "@revolt/ui";

import MdClose from "@material-design-icons/svg/outlined/close.svg?component-solid";

import { useModals } from "..";
import { Modals } from "../types";

/** Limits of the server (dur.io polls) */
const MAX_QUESTION = 300;
const MAX_ANSWER = 100;
const MAX_ANSWERS = 10;

/**
 * dur.io: write a poll and send it to the channel (with the replies of the draft)
 */
export function CreatePollModal(
  props: DialogProps & Modals & { type: "create_poll" },
) {
  const { t } = useLingui();
  const state = useState();
  const { showError } = useModals();

  const [question, setQuestion] = createSignal("");
  const [answers, setAnswers] = createSignal(["", ""]);
  const [multiple, setMultiple] = createSignal(false);
  const [changeable, setChangeable] = createSignal(true);
  const [sending, setSending] = createSignal(false);

  const filled = () =>
    answers()
      .map((answer) => answer.trim())
      .filter(Boolean);
  const valid = () =>
    question().trim().length > 0 &&
    question().trim().length <= MAX_QUESTION &&
    filled().length >= 2 &&
    filled().every((answer) => answer.length <= MAX_ANSWER);

  function setAnswer(index: number, value: string) {
    setAnswers((list) => {
      const next = list.map((answer, i) => (i === index ? value : answer));
      // a new empty field once the last one is used
      if (next.length < MAX_ANSWERS && next[next.length - 1].trim()) {
        next.push("");
      }
      return next;
    });
  }

  function removeAnswer(index: number) {
    setAnswers((list) =>
      list.length > 2 ? list.filter((_, i) => i !== index) : list,
    );
  }

  async function send() {
    if (!valid() || sending()) return false;
    setSending(true);
    try {
      const draft = state.draft.getDraft(props.channel.id);
      await props.channel.sendMessage({
        poll: {
          question: question().trim(),
          answers: filled(),
          multiple: multiple(),
          final_votes: !changeable(),
        },
        replies: draft.replies?.length ? draft.replies : undefined,
      });
      // the replies went with the poll; the text of the draft stays
      state.draft.setDraft(props.channel.id, (data) => ({
        ...data,
        replies: [],
      }));
    } catch (error) {
      showError(error);
      setSending(false);
      return false;
    }
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>New poll</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Send</Trans>,
          onClick: () => send(),
          isDisabled: !valid() || sending(),
        },
      ]}
    >
      <Fields>
        <TextField
          name="poll-question"
          label={t`Question`}
          value={question()}
          maxlength={MAX_QUESTION}
          onInput={(e) => setQuestion(e.currentTarget.value)}
        />
        {/* by position: answers are plain strings, and equal ones (two empty
            fields) would swap their inputs in a <For> */}
        <Index each={answers()}>
          {(answer, index) => (
            <AnswerRow>
              <TextField
                name={`poll-answer-${index}`}
                label={t`Answer ${index + 1}`}
                value={answer()}
                maxlength={MAX_ANSWER}
                onInput={(e) => setAnswer(index, e.currentTarget.value)}
              />
              <Show when={answers().length > 2}>
                <IconButton
                  size="sm"
                  aria-label={t`Remove answer`}
                  onPress={() => removeAnswer(index)}
                >
                  <MdClose {...iconSize(18)} />
                </IconButton>
              </Show>
            </AnswerRow>
          )}
        </Index>
        <Checkbox
          name="poll-multiple"
          checked={multiple()}
          onChange={(e) => setMultiple(e.currentTarget.checked)}
        >
          <Trans>Allow several answers</Trans>
        </Checkbox>
        <Checkbox
          name="poll-changeable"
          checked={changeable()}
          onChange={(e) => setChangeable(e.currentTarget.checked)}
        >
          <Trans>Allow changing the vote</Trans>
        </Checkbox>
      </Fields>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
    minWidth: "min(420px, 80vw)",
  },
});

const AnswerRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",

    "& > :first-child": {
      flexGrow: 1,
    },
  },
});
