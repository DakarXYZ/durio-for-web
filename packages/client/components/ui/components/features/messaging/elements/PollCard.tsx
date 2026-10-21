import { For, Show, createMemo, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { Message } from "stoat.js";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Ripple } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  myPicks,
  samePicks,
  togglePick,
  voteCount,
  voterCount,
} from "./pollLogic";

/**
 * dur.io: a poll in a message — the answers with their share of the votes; the user
 * picks answers and sends them with "Vote", changes them later when the poll allows it,
 * the author can close it
 */
export function PollCard(props: { message: Message }) {
  const { t } = useLingui();
  const client = useClient();
  const { showError } = useModals();
  const [busy, setBusy] = createSignal(false);
  // picks not sent yet; changing: choosing again after a vote
  const [picks, setPicks] = createSignal<string[]>([]);
  const [changing, setChanging] = createSignal(false);

  const poll = () => props.message.poll!;
  const me = () => client().user!.id;
  const mine = createMemo(() => myPicks(poll(), me()));
  const voted = () => mine().length > 0;
  const voters = createMemo(() => voterCount(poll()));
  const votes = createMemo(() => voteCount(poll()));
  const choosing = () => !poll().closed && (!voted() || changing());
  const canChange = () => !poll().closed && voted() && !poll().final_votes;
  const canSend = () =>
    !busy() &&
    !samePicks(picks(), mine()) &&
    // a first vote needs a pick; a changed one may take the vote back
    (picks().length > 0 || voted());
  const canClose = () =>
    !poll().closed &&
    (props.message.authorId === me() ||
      !!props.message.channel?.havePermission("ManageMessages"));

  function pick(answerId: string) {
    if (!choosing() || busy()) return;
    setPicks((list) => togglePick(poll(), list, answerId));
  }

  function change() {
    setPicks(mine());
    setChanging(true);
  }

  function cancel() {
    setPicks([]);
    setChanging(false);
  }

  async function vote() {
    if (!canSend()) return;
    setBusy(true);
    try {
      await props.message.votePoll(picks());
      setPicks([]);
      setChanging(false);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    try {
      await props.message.closePoll();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <Card>
      <Question>
        <Symbol size={18}>ballot</Symbol>
        {poll().question}
      </Question>

      <For each={poll().answers}>
        {(answer) => {
          const count = () => answer.votes?.length ?? 0;
          const marked = () =>
            choosing()
              ? picks().includes(answer.id)
              : mine().includes(answer.id);
          const share = () =>
            votes() ? Math.round((count() / votes()) * 100) : 0;

          return (
            <button
              type="button"
              class={row({ mine: marked(), closed: !choosing() })}
              disabled={!choosing() || busy()}
              aria-pressed={marked()}
              onClick={() => pick(answer.id)}
            >
              <Show when={choosing()}>
                <Ripple />
              </Show>
              <Bar style={{ width: `${share()}%` }} />
              <Mark>
                <Symbol size={18}>
                  {marked()
                    ? poll().multiple
                      ? "check_box"
                      : "radio_button_checked"
                    : poll().multiple
                      ? "check_box_outline_blank"
                      : "radio_button_unchecked"}
                </Symbol>
              </Mark>
              <Text>{answer.text}</Text>
              <Count>
                {share()}% · {count()}
              </Count>
            </button>
          );
        }}
      </For>

      <Footer>
        <span>
          <Plural value={voters()} one="# vote" other="# votes" />
          <Show when={poll().multiple}>
            {" · "}
            <Trans>several answers</Trans>
          </Show>
          <Show when={poll().closed}>
            {" · "}
            <Trans>poll closed</Trans>
          </Show>
        </span>
        <FooterActions>
          <Show when={choosing()}>
            <Show when={changing()}>
              <TextButton type="button" onClick={cancel} disabled={busy()}>
                <Trans>Cancel</Trans>
              </TextButton>
            </Show>
            <VoteButton type="button" onClick={vote} disabled={!canSend()}>
              <Show
                when={picks().length === 0 && voted()}
                fallback={<Trans>Vote</Trans>}
              >
                <Trans>Take back vote</Trans>
              </Show>
            </VoteButton>
          </Show>
          <Show when={canChange() && !changing()}>
            <TextButton type="button" onClick={change}>
              <Trans>Change vote</Trans>
            </TextButton>
          </Show>
          <Show when={canClose()}>
            <TextButton type="button" onClick={close} title={t`Close poll`}>
              <Trans>Close poll</Trans>
            </TextButton>
          </Show>
        </FooterActions>
      </Footer>
    </Card>
  );
}

const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxWidth: "440px",
    marginBlock: "4px",
    padding: "12px",
    borderRadius: "var(--borderRadius-md)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-low)",
  },
});

const Question = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 600,
    marginBottom: "4px",
    overflowWrap: "anywhere",
  },
});

const row = cva({
  base: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    padding: "6px 10px",
    textAlign: "start",
    font: "inherit",
    color: "var(--md-sys-color-on-surface)",
    borderRadius: "var(--borderRadius-md)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "transparent",
    cursor: "pointer",
  },
  variants: {
    mine: {
      true: {
        borderColor: "var(--md-sys-color-primary)",
      },
    },
    closed: {
      true: {
        cursor: "default",
      },
    },
  },
});

const Bar = styled("div", {
  base: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    pointerEvents: "none",
    background:
      "color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)",
    transition: "width var(--transitions-medium)",
  },
});

const Mark = styled("span", {
  base: {
    position: "relative",
    display: "flex",
    color: "var(--md-sys-color-primary)",
    fill: "var(--md-sys-color-primary)",
  },
});

const Text = styled("span", {
  base: {
    position: "relative",
    flexGrow: 1,
    overflowWrap: "anywhere",
  },
});

const Count = styled("span", {
  base: {
    position: "relative",
    flexShrink: 0,
    fontSize: "0.8125rem",
    color: "var(--md-sys-color-on-surface-variant)",
    fontFeatureSettings: "'tnum' 1",
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "2px",
    fontSize: "0.8125rem",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const FooterActions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },
});

const TextButton = styled("button", {
  base: {
    border: "none",
    background: "transparent",
    padding: "2px 4px",
    font: "inherit",
    color: "var(--md-sys-color-primary)",
    cursor: "pointer",
    borderRadius: "var(--borderRadius-xs)",

    "&:hover": {
      textDecoration: "underline",
    },

    "&:disabled": {
      cursor: "default",
      opacity: 0.5,
      textDecoration: "none",
    },
  },
});

const VoteButton = styled("button", {
  base: {
    border: "none",
    padding: "4px 12px",
    font: "inherit",
    fontWeight: 600,
    color: "var(--md-sys-color-on-primary)",
    background: "var(--md-sys-color-primary)",
    cursor: "pointer",
    borderRadius: "var(--borderRadius-full)",

    "&:disabled": {
      cursor: "default",
      opacity: 0.38,
    },
  },
});
