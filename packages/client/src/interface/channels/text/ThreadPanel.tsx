import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "stoat.js";
import { styled } from "styled-system/jsx";

import { DraftMessages, Messages } from "@revolt/app";
import { useTime } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import {
  Button,
  IconButton,
  MessageReply,
  Ripple,
  Spacer,
  main,
} from "@revolt/ui";
import { useOpenThread } from "@revolt/ui/components/features/messaging/elements/ThreadSummary";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { MessageComposition } from "./Composition";

/**
 * Close a thread or open it again: its starter, or `ManageChannel`
 */
export function ThreadLockButton(props: { thread: Channel }) {
  const { t } = useLingui();
  const { showError } = useModals();

  return (
    <Show when={props.thread.canManageThread}>
      <IconButton
        use:floating={{
          tooltip: {
            placement: "bottom",
            content: props.thread.locked
              ? t`Open the thread again`
              : t`Close the thread`,
          },
        }}
        onPress={() =>
          props.thread
            .editThread({ locked: !props.thread.locked })
            .catch(showError)
        }
      >
        <Symbol>{props.thread.locked ? "lock_open" : "lock"}</Symbol>
      </IconButton>
    </Show>
  );
}

/**
 * dur.io: a thread next to its channel — its messages and a composer
 */
export function ThreadPanel(props: { thread: Channel; onClose: () => void }) {
  const { t } = useLingui();
  const navigate = useNavigate();

  let jumpToBottomRef: ((nearby?: string) => void) | undefined;
  const [atEnd, setEnd] = createSignal(true);

  // read while open and scrolled to the end
  createEffect(
    on(
      () => props.thread.unread && atEnd(),
      (unread) => unread && document.hasFocus() && props.thread.ack(),
    ),
  );

  // the message the thread hangs off, shown on top
  createEffect(
    on(
      () => props.thread.id,
      () => {
        const info = props.thread.threadInfo;
        if (info && !props.thread.threadMessage) {
          props.thread.parent?.fetchMessage(info.message).catch(() => {});
        }
      },
    ),
  );

  return (
    <Panel>
      <PanelHeader>
        <Symbol>forum</Symbol>
        <Title title={props.thread.name}>{props.thread.name}</Title>
        <Spacer />
        <ThreadLockButton thread={props.thread} />
        <IconButton
          use:floating={{
            tooltip: { placement: "bottom", content: t`Open as a page` },
          }}
          onPress={() => navigate(props.thread.path)}
        >
          <Symbol>open_in_full</Symbol>
        </IconButton>
        <IconButton
          use:floating={{
            tooltip: { placement: "bottom", content: t`Close` },
          }}
          onPress={props.onClose}
        >
          <Symbol>close</Symbol>
        </IconButton>
      </PanelHeader>
      <Show when={props.thread.threadMessage}>
        {(message) => (
          <Starter>
            <MessageReply message={message()} />
          </Starter>
        )}
      </Show>
      <main class={main()}>
        <Messages
          channel={props.thread}
          lastReadId={() => undefined}
          highlightedMessageId={() => undefined}
          clearHighlightedMessage={() => {}}
          jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
          atEnd={[atEnd, setEnd]}
          pendingMessages={(pendingProps) => (
            <DraftMessages
              channel={props.thread}
              tail={pendingProps.tail}
              sentIds={pendingProps.ids}
            />
          )}
        />
        <MessageComposition
          channel={props.thread}
          onMessageSend={() => jumpToBottomRef?.()}
          secondary
        />
      </main>
    </Panel>
  );
}

/**
 * dur.io: the threads of a channel, active ones first, and a button to start one
 */
export function ThreadList(props: { channel: Channel; onClose: () => void }) {
  const dayjs = useTime();
  const { openModal } = useModals();
  const openThread = useOpenThread();

  // threads archived on the server may not have reached this client yet
  createEffect(
    on(
      () => props.channel.id,
      () => props.channel.fetchThreads().catch(() => {}),
    ),
  );

  const active = createMemo(() =>
    props.channel.threads.filter((thread) => !thread.archived),
  );
  const archived = createMemo(() =>
    props.channel.threads.filter((thread) => thread.archived),
  );

  const Row = (rowProps: { thread: Channel }) => (
    <ThreadRow role="button" onClick={() => openThread(rowProps.thread)}>
      <Ripple />
      <Symbol>forum</Symbol>
      <RowText>
        <RowName unread={rowProps.thread.unread}>
          {rowProps.thread.name}
        </RowName>
        <RowMeta>
          <Plural
            value={rowProps.thread.messageCount}
            one="# message"
            other="# messages"
          />
          {" · "}
          {dayjs(rowProps.thread.updatedAt).fromNow()}
        </RowMeta>
      </RowText>
    </ThreadRow>
  );

  return (
    <ListBase>
      <PanelHeader>
        <Symbol>forum</Symbol>
        <Title>
          <Trans>Threads</Trans>
        </Title>
        <Spacer />
        <Show when={props.channel.havePermission("SendMessage")}>
          <Button
            size="sm"
            onPress={() =>
              openModal({ type: "create_thread", channel: props.channel })
            }
          >
            <Trans>New thread</Trans>
          </Button>
        </Show>
        <IconButton onPress={props.onClose}>
          <Symbol>close</Symbol>
        </IconButton>
      </PanelHeader>
      <Show
        when={props.channel.threads.length}
        fallback={
          <Empty>
            <Trans>
              No threads yet. Start one from a message, or with "New thread".
            </Trans>
          </Empty>
        }
      >
        <For each={active()}>{(thread) => <Row thread={thread} />}</For>
        <Show when={archived().length}>
          <Section>
            <Trans>Archived</Trans>
          </Section>
          <For each={archived()}>{(thread) => <Row thread={thread} />}</For>
        </Show>
      </Show>
    </ListBase>
  );
}

const Panel = styled("div", {
  base: {
    flexShrink: 0,
    width: "420px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",

    "& > main": {
      flexGrow: 1,
      minHeight: 0,
    },
  },
});

const Starter = styled("div", {
  base: {
    display: "flex",
    paddingInline: "var(--gap-md)",
    paddingBottom: "var(--gap-sm)",
  },
});

const ListBase = styled("div", {
  base: {
    width: "360px",
    paddingRight: "var(--gap-md)",
    display: "flex",
    flexDirection: "column",
  },
});

const PanelHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    padding: "var(--gap-md)",
    minHeight: "56px",
    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
  },
});

const Title = styled("span", {
  base: {
    fontWeight: 600,
    fontSize: "1.05em",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

const ThreadRow = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-sm) var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface-variant)",
  },
});

const RowText = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

const RowName = styled("span", {
  base: {
    fontWeight: 500,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  variants: {
    unread: {
      true: {
        fontWeight: 700,
        color: "var(--md-sys-color-primary)",
      },
    },
  },
});

const RowMeta = styled("span", {
  base: {
    fontSize: "0.8em",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const Section = styled("div", {
  base: {
    padding: "var(--gap-md) var(--gap-md) var(--gap-xs)",
    fontSize: "0.8em",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const Empty = styled("div", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});
