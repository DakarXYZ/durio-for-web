import { For, Show, createMemo, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { Message } from "stoat.js";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Ripple } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { nextPicks, voterCount } from "./pollLogic";

/**
 * dur.io: a poll in a message — the answers with their share of the voters; a click
 * votes, the author can close it
 */
export function PollCard(props: { message: Message }) {
  const { t } = useLingui();
  const client = useClient();
  const { showError } = useModals();
  const [busy, setBusy] = createSignal(false);

  const poll = () => props.message.poll!;
  const me = () => client().user!.id;
  const voters = createMemo(() => voterCount(poll()));
  const canClose = () =>
    !poll().closed &&
    (props.message.authorId === me() ||
      !!props.message.channel?.havePermission("ManageMessages"));

  async function vote(answerId: string) {
    if (poll().closed || busy()) return;
    setBusy(true);
    try {
      await props.message.votePoll(nextPicks(poll(), me(), answerId));
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
          const mine = () => !!answer.votes?.includes(me());
          const share = () =>
            voters() ? Math.round((count() / voters()) * 100) : 0;

          return (
            <button
              type="button"
              class={row({ mine: mine(), closed: !!poll().closed })}
              disabled={!!poll().closed || busy()}
              aria-pressed={mine()}
              onClick={() => vote(answer.id)}
            >
              <Show when={!poll().closed}>
                <Ripple />
              </Show>
              <Bar style={{ width: `${share()}%` }} />
              <Mark>
                <Symbol size={18}>
                  {mine()
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
        <Show when={canClose()}>
          <CloseButton type="button" onClick={close} title={t`Close poll`}>
            <Trans>Close poll</Trans>
          </CloseButton>
        </Show>
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

const CloseButton = styled("button", {
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
  },
});
