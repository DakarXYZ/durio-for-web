import { Show } from "solid-js";

import { Plural, Trans } from "@lingui/solid/macro";
import { Channel, Message } from "stoat.js";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { useTime } from "@revolt/i18n";
import { useNavigate } from "@revolt/routing";
import { Ripple } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { openThreadPanel } from "./threadPanel";

/**
 * dur.io: open a thread — in the side panel of its channel, or as a page on a phone
 */
export function useOpenThread() {
  const { layout } = useDevice();
  const navigate = useNavigate();

  return (thread: Channel) => {
    if (layout() === "phone") {
      navigate(thread.path);
    } else {
      openThreadPanel(thread.id);
    }
  };
}

/**
 * dur.io: the thread started from a message, under it: name, messages, last activity
 */
export function ThreadSummary(props: { message: Message }) {
  const dayjs = useTime();
  const openThread = useOpenThread();

  return (
    <Show when={props.message.thread}>
      {(thread) => (
        <Card
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            openThread(thread());
          }}
          onKeyDown={(e) => e.key === "Enter" && openThread(thread())}
        >
          <Ripple />
          <Symbol size={20}>forum</Symbol>
          <Name unread={thread().unread}>{thread().name}</Name>
          <Meta>
            <Plural
              value={thread().messageCount}
              one="# message"
              other="# messages"
            />
            <Show when={thread().lastMessageAt}>
              {" · "}
              {dayjs(thread().lastMessageAt).fromNow()}
            </Show>
            <Show when={thread().archived}>
              {" · "}
              <Trans>archived</Trans>
            </Show>
          </Meta>
        </Card>
      )}
    </Show>
  );
}

const Card = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    width: "fit-content",
    maxWidth: "100%",
    marginBlock: "var(--gap-xs)",
    padding: "6px 12px",
    borderRadius: "var(--borderRadius-md)",
    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
    background: "var(--md-sys-color-surface-container)",
    border: "1px solid var(--md-sys-color-outline-variant)",
  },
});

const Name = styled("span", {
  base: {
    fontWeight: 600,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  variants: {
    unread: {
      true: {
        color: "var(--md-sys-color-primary)",
      },
    },
  },
});

const Meta = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "0.85em",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});
