import { For, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { MessageContextMenu, useMessage } from "@revolt/app";
import { useUser } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { Emoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Ripple, useSnackbar } from "@revolt/ui/components/design";
import { iconSize } from "@revolt/ui/components/utils";

import MdContentCopy from "@material-design-icons/svg/outlined/content_copy.svg?component-solid";
import MdDelete from "@material-design-icons/svg/outlined/delete.svg?component-solid";
import MdEdit from "@material-design-icons/svg/outlined/edit.svg?component-solid";
import MdEmojiEmotions from "@material-design-icons/svg/outlined/emoji_emotions.svg?component-solid";
import MdMoreHoriz from "@material-design-icons/svg/outlined/more_horiz.svg?component-solid";
import MdReply from "@material-design-icons/svg/outlined/reply.svg?component-solid";

import { clearSelectedMessage } from "./quickActions";

/**
 * Quick actions of a message: shown on hover, or once the message is clicked
 * or tapped. dur.io: the five emoji reacted with most recently, copy and
 * reply up front; "…" opens the full context menu.
 */
export function MessageToolbar() {
  const { t } = useLingui();
  const user = useUser();
  const state = useState();
  const snackbar = useSnackbar();
  const { openModal } = useModals();
  const { layout } = useDevice();
  const { message, reactPicker, react } = useMessage();

  let reactRef;

  // todo: a11y for buttons; tabindex

  /** On a phone only the quick actions fit, the rest is behind "…" */
  const wide = () => layout() !== "phone";

  /**
   * React with one of the recent emoji, or take it back
   * @param emoji Emoji
   */
  function quickReact(emoji: string) {
    if (message?.reactions.get(emoji)?.has(user()!.id)) {
      message.unreact(emoji);
    } else {
      react?.(emoji);
    }
    clearSelectedMessage();
  }

  /**
   * Copy the text of the message
   */
  function copyText() {
    navigator.clipboard.writeText(message!.content);
    snackbar.show({ message: t`Copied!` });
    clearSelectedMessage();
  }

  /**
   * Delete the message
   */
  function deleteMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      message?.delete();
    } else if (message) {
      openModal({
        type: "delete_message",
        message: message,
      });
    }
  }

  return (
    <Base class="Toolbar">
      <Show when={message?.channel?.havePermission("React")}>
        <For each={state.recentEmoji.quick()}>
          {(emoji) => (
            <div
              class={tool({ emoji: true })}
              onClick={() => quickReact(emoji)}
            >
              <Ripple />
              <Emoji emoji={emoji} />
            </div>
          )}
        </For>
        <Show when={wide()}>
          <div
            ref={reactRef}
            class={tool()}
            aria-label={t`React`}
            onClick={(e) => reactPicker!()?.onClickEmoji(e, reactRef)}
          >
            <Ripple />
            <MdEmojiEmotions {...iconSize(20)} />
          </div>
        </Show>
        <Divider />
      </Show>
      <Show when={message?.content}>
        <div class={tool()} aria-label={t`Copy text`} onClick={copyText}>
          <Ripple />
          <MdContentCopy {...iconSize(20)} />
        </div>
      </Show>
      <Show when={message?.channel?.havePermission("SendMessage")}>
        <div
          class={tool()}
          aria-label={t`Reply`}
          onClick={() => {
            state.draft.addReply(message!, user()!.id);
            clearSelectedMessage();
          }}
        >
          <Ripple />
          <MdReply {...iconSize(20)} />
        </div>
      </Show>
      <Show when={wide() && message?.author?.self}>
        <div
          class={tool()}
          onClick={() => state.draft.setEditingMessage(message)}
        >
          <Ripple />
          <MdEdit {...iconSize(20)} />
        </div>
      </Show>
      <Show
        when={
          wide() &&
          (message?.author?.self ||
            message?.channel?.havePermission("ManageMessages"))
        }
      >
        <div class={tool()} onClick={deleteMessage}>
          <Ripple />
          <MdDelete {...iconSize(20)} />
        </div>
      </Show>
      <div
        class={tool()}
        use:floating={{
          contextMenu: () => (
            <MessageContextMenu message={message!} reactPicker={reactPicker} />
          ),
          contextMenuHandler: "click",
        }}
      >
        <Ripple />
        <MdMoreHoriz {...iconSize(20)} />
      </div>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    top: "-22px",
    right: "16px",
    position: "absolute",
    zIndex: 1,

    alignItems: "center",
    gap: "2px",
    padding: "2px",

    display: "none",
    overflow: "hidden",
    borderRadius: "var(--borderRadius-md)",
    boxShadow: "0 1px 4px var(--md-sys-color-shadow)",
    border: "1px solid var(--md-sys-color-outline-variant)",

    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
    background: "var(--md-sys-color-surface-container-high)",
  },
});

const tool = cva({
  base: {
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-xs)",
  },
  variants: {
    emoji: {
      true: {
        width: "32px",
        height: "32px",
        padding: "4px",
        "--emoji-size": "20px",

        "& img": {
          width: "20px",
          height: "20px",
          objectFit: "contain",
        },
      },
    },
  },
});

const Divider = styled("div", {
  base: {
    width: "1px",
    height: "20px",
    margin: "0 2px",
    background: "var(--md-sys-color-outline-variant)",
  },
});
