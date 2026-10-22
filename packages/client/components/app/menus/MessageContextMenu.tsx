import { Accessor, For, Match, Show, Switch } from "solid-js";

import { File, ImageEmbed, Message, VideoEmbed, WebsiteEmbed } from "stoat.js";

import { useClient, useUser } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { CustomEmoji, UnicodeEmoji } from "@revolt/markdown/emoji";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { MediaPickerProps } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { useOpenThread } from "@revolt/ui/components/features/messaging/elements/ThreadSummary";

import MdBadge from "@material-design-icons/svg/outlined/badge.svg?component-solid";
import MdContentCopy from "@material-design-icons/svg/outlined/content_copy.svg?component-solid";
import MdDelete from "@material-design-icons/svg/outlined/delete.svg?component-solid";
import MdDeleteSweep from "@material-design-icons/svg/outlined/delete_sweep.svg?component-solid";
import MdDownload from "@material-design-icons/svg/outlined/download.svg?component-solid";
import MdEdit from "@material-design-icons/svg/outlined/edit.svg?component-solid";
import MdEmojiEmotions from "@material-design-icons/svg/outlined/emoji_emotions.svg?component-solid";
import MdLink from "@material-design-icons/svg/outlined/link.svg?component-solid";
import MdMarkChatUnread from "@material-design-icons/svg/outlined/mark_chat_unread.svg?component-solid";
import MdOpenInNew from "@material-design-icons/svg/outlined/open_in_new.svg?component-solid";
import MdPin from "@material-design-icons/svg/outlined/pin_invoke.svg?component-solid";
import MdReply from "@material-design-icons/svg/outlined/reply.svg?component-solid";
import MdReport from "@material-design-icons/svg/outlined/report.svg?component-solid";
import MdShare from "@material-design-icons/svg/outlined/share.svg?component-solid";
import MdShield from "@material-design-icons/svg/outlined/shield.svg?component-solid";

import { Trans, useLingui } from "@lingui/solid/macro";
import MdSentimentContent from "@material-symbols/svg-400/outlined/sentiment_content.svg?component-solid";
import { useSnackbar } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
  ContextMenuSubMenu,
} from "./ContextMenu";

/**
 * Context menu for messages
 */
export function MessageContextMenu(props: {
  message?: Message;
  reactPicker?: Accessor<MediaPickerProps | undefined>;
  file?: File | ImageEmbed | VideoEmbed | WebsiteEmbed;
  link?: string;
}) {
  const user = useUser();
  const state = useState();
  const instance = useInstance();
  const client = useClient();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  const { openModal, showError } = useModals();
  const openThread = useOpenThread();

  /**
   * dur.io: a thread can start from a message of a server text channel (not a thread)
   */
  const canStartThread = () =>
    props.message!.channel?.type === "TextChannel" &&
    !props.message!.channel.isThread &&
    !props.message!.threadId &&
    props.message!.channel.havePermission("SendMessage");

  /**
   * dur.io: moderators hide any message behind a spoiler
   */
  const canSpoiler = () =>
    !!props.message!.server &&
    !props.message!.systemMessage &&
    !!props.message!.channel?.havePermission("ManageMessages");

  /**
   * Reply to this message
   */
  function reply() {
    state.draft.addReply(props.message!, user()!.id);
  }

  /**
   * Mark message as unread
   */
  function markAsUnread() {
    props.message!.ack(true, false, true);
  }

  /**
   * Copy message contents to clipboard
   */
  function copyText() {
    navigator.clipboard.writeText(props.message!.content);
  }

  /**
   * Report the message
   */
  function report() {
    openModal({
      type: "report_content",
      target: props.message!,
      client: client(),
    });
  }

  /**
   * Delete the message
   */
  function deleteMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      props.message!.delete();
    } else {
      openModal({
        type: "delete_message",
        message: props.message!,
      });
    }
  }

  /**
   * Pin/unpin the message
   */
  function pinMessage(ev: MouseEvent) {
    if (ev.shiftKey) {
      if (props.message!.pinned) {
        props.message!.unpin().catch(showError);
      } else {
        props.message!.pin().catch(showError);
      }
    } else {
      openModal({
        type: "pin_message",
        message: props.message!,
      });
    }
  }

  /**
   * Open message in Stoat Admin Panel
   */
  function openAdminPanel() {
    window.open(
      `https://admin.stoatinternal.com/panel/inspect/message/${props.message!.id}`,
      "_blank",
    );
  }

  /**
   * Copy message link to clipboard
   */
  function copyMessageLink() {
    navigator.clipboard.writeText(
      instance.href(
        `${
          props.message!.server ? `/server/${props.message!.server?.id}` : ""
        }/channel/${props.message!.channelId}/${props.message!.id}`,
      ),
    );
  }

  /**
   * Copy message id to clipboard
   */
  function copyId() {
    navigator.clipboard.writeText(props.message!.id);
  }

  /**
   * Opens the file preview in a new tab
   */
  function openFile() {
    window.open(getFileUrl(), "_blank");
  }

  /**
   * Copies the link to the original url of the file
   */
  function copyFileLink() {
    navigator.clipboard.writeText(getFileUrl());
  }

  /**
   * Write a blob to the navigator clipboard
   * @param [type] - The blob's MIME type, optional
   */
  async function writeBlobToClipboard(blob: Blob | null, type?: string) {
    if (!blob) throw new Error("Can't write nothing to the clipboard");

    await navigator.clipboard.write([
      new ClipboardItem({
        // Workaround for the clipboard API being extremely picky
        // https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api
        [type ?? blob.type]: blob,
      }),
    ]);

    snackbar.show({ message: t`Copied file to clipboard` });
  }

  /**
   * Download the file from `url` and insert it to the user's clipboard
   */
  async function copyFile(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`Failed to download file: ${res.statusText}.`);

      const blob = await res.blob();
      if (ClipboardItem.supports(blob.type)) {
        await writeBlobToClipboard(blob);
      } else {
        if (blob.type.startsWith("image/")) {
          // Naively convert to PNG
          const c = document.createElement("canvas"),
            ctx = c.getContext("2d"),
            img = new Image();

          img.onload = () => {
            c.width = img.width;
            c.height = img.height;
            ctx!.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);
            c.toBlob(async (b) => {
              try {
                await writeBlobToClipboard(b, "image/png");
              } catch (error) {
                showError(error);
              }
            }, "image/png");
          };

          img.onerror = showError;
          img.src = URL.createObjectURL(blob);
        } else {
          // Workaround for copying unsupported formats to the clipboard
          // See: https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api
          await writeBlobToClipboard(blob, `web ${blob.type}`);
        }
      }
    } catch (error) {
      showError(error);
    }
  }

  /**
   * Get the preview URL of a file or embed.
   */
  function getFileUrl(): string {
    let url: string = "";

    if (props.file instanceof File) {
      url = props.file.previewUrl;
    } else if (
      props.file instanceof ImageEmbed ||
      props.file instanceof VideoEmbed ||
      (props.file instanceof WebsiteEmbed &&
        props.file.specialContent?.type === "GIF")
    ) {
      url = props.file.url!;
    }

    return url;
  }

  function copyLink() {
    navigator.clipboard.writeText(props.link ?? "");
  }

  return (
    <ContextMenu>
      {/* dur.io: an encrypted file has no link, it is decrypted in memory */}
      <Show
        when={props.file && !(props.file instanceof File && props.file.e2ee)}
      >
        <ContextMenuButton icon={MdOpenInNew} onClick={openFile}>
          <Trans>Open file</Trans>
        </ContextMenuButton>
        <ContextMenuButton icon={MdLink} onClick={copyFileLink}>
          <Trans>Copy link to file</Trans>
        </ContextMenuButton>
        <Show when={props.file instanceof File}>
          <a
            target="_blank"
            download={(props.file as File)?.filename}
            href={(props.file as File)?.originalUrl}
          >
            <ContextMenuButton icon={MdDownload}>
              <Trans>Save file</Trans>
            </ContextMenuButton>
          </a>
          <ContextMenuButton
            icon={MdContentCopy}
            onClick={() => copyFile((props.file as File)!.originalUrl)}
          >
            <Trans>Copy file</Trans>
          </ContextMenuButton>
        </Show>

        <Show when={props.link || props.message}>
          <ContextMenuDivider />
        </Show>
      </Show>
      <Show when={props.link}>
        <ContextMenuButton icon={MdLink} onClick={copyLink}>
          <Trans>Copy link</Trans>
        </ContextMenuButton>

        <ContextMenuDivider />
      </Show>
      <Show when={props.message}>
        <Show when={props.message!.channel?.havePermission("SendMessage")}>
          <ContextMenuButton icon={MdReply} onClick={reply}>
            <Trans>Reply</Trans>
          </ContextMenuButton>
        </Show>
        <ContextMenuButton icon={MdMarkChatUnread} onClick={markAsUnread}>
          <Trans>Mark as unread</Trans>
        </ContextMenuButton>
        <ContextMenuButton icon={MdContentCopy} onClick={copyText}>
          <Trans>Copy text</Trans>
        </ContextMenuButton>

        <ContextMenuDivider />

        {/* dur.io: threads */}
        <Show when={props.message!.thread}>
          {(thread) => (
            <ContextMenuButton
              symbol={<Symbol size={16}>forum</Symbol>}
              onClick={() => openThread(thread())}
            >
              <Trans>Open thread</Trans>
            </ContextMenuButton>
          )}
        </Show>
        <Show when={canStartThread()}>
          <ContextMenuButton
            symbol={<Symbol size={16}>forum</Symbol>}
            onClick={() =>
              openModal({
                type: "create_thread",
                channel: props.message!.channel!,
                message: props.message!,
              })
            }
          >
            <Trans>Create thread</Trans>
          </ContextMenuButton>
        </Show>

        <Show
          when={
            props.reactPicker && props.message?.channel?.havePermission("React")
          }
        >
          <ContextMenuButton
            icon={MdEmojiEmotions}
            onClick={(e) => props.reactPicker!()?.onClickEmoji(e)}
          >
            <Trans>React</Trans>
          </ContextMenuButton>
        </Show>

        <Show
          when={
            props.message!.author?.self &&
            props.message!.channel?.havePermission("SendMessage") &&
            // dur.io: in an encrypted channel only decrypted encrypted messages
            (!props.message!.channel?.isEncrypted ||
              props.message!.e2ee?.state === "ok")
          }
        >
          <ContextMenuButton
            icon={MdEdit}
            onClick={() => state.draft.setEditingMessage(props.message!)}
          >
            <Trans>Edit message</Trans>
          </ContextMenuButton>
        </Show>
        <Show
          when={
            props.message!.channel?.type === "DirectMessage" ||
            props.message!.channel?.havePermission("ManageMessages")
          }
        >
          <ContextMenuButton icon={MdPin} onClick={pinMessage}>
            <Switch fallback={<Trans>Pin message</Trans>}>
              <Match when={props.message!.pinned}>
                <Trans>Unpin message</Trans>
              </Match>
            </Switch>
          </ContextMenuButton>
        </Show>
        {/* dur.io: hide behind a spoiler, or take it away */}
        <Show when={canSpoiler()}>
          <Show
            when={props.message!.spoiler}
            fallback={
              <ContextMenuSubMenu
                symbol={<Symbol size={16}>visibility_off</Symbol>}
                buttonContent={<Trans>Hide behind a spoiler</Trans>}
              >
                <ContextMenuButton
                  onClick={() =>
                    props.message!.setSpoiler("spoiler").catch(showError)
                  }
                >
                  <Trans>Spoiler Alert!</Trans>
                </ContextMenuButton>
                <ContextMenuButton
                  onClick={() =>
                    props.message!.setSpoiler("nsfw").catch(showError)
                  }
                >
                  <Trans>NSFW</Trans>
                </ContextMenuButton>
              </ContextMenuSubMenu>
            }
          >
            <ContextMenuButton
              symbol={<Symbol size={16}>visibility</Symbol>}
              onClick={() => props.message!.removeSpoiler().catch(showError)}
            >
              <Trans>Remove the spoiler</Trans>
            </ContextMenuButton>
          </Show>
        </Show>
        <Show
          when={
            props.message!.reactions.size &&
            props.message!.channel?.havePermission("ManageMessages")
          }
        >
          <ContextMenuSubMenu
            icon={MdDeleteSweep}
            onClick={() => props.message!.clearReactions()}
            destructive
            buttonContent={<Trans>Remove reaction</Trans>}
          >
            <For each={[...props.message!.reactions.keys()]}>
              {(key) => (
                <ContextMenuButton
                  onClick={() => props.message!.unreact(key, true)}
                >
                  <Switch fallback={<UnicodeEmoji emoji={key} />}>
                    <Match when={key.length === 26}>
                      <CustomEmoji id={key} />
                    </Match>
                  </Switch>
                </ContextMenuButton>
              )}
            </For>
          </ContextMenuSubMenu>
        </Show>
        <Show
          when={
            props.message!.reactions.size &&
            props.message!.channel?.havePermission("ManageMessages")
          }
        >
          <ContextMenuButton
            symbol={MdSentimentContent}
            onClick={() => props.message!.clearReactions()}
            destructive
          >
            <Trans>Remove all reactions</Trans>
          </ContextMenuButton>
        </Show>
        <Show
          when={
            props.message!.author?.self ||
            props.message!.channel?.havePermission("ManageMessages")
          }
        >
          <ContextMenuButton
            icon={MdDelete}
            onClick={deleteMessage}
            destructive
          >
            <Trans>Delete message</Trans>
          </ContextMenuButton>
        </Show>
        <Show
          when={!props.message!.author?.self && !props.message!.systemMessage}
        >
          <ContextMenuButton icon={MdReport} onClick={report} destructive>
            <Trans>Report message</Trans>
          </ContextMenuButton>
        </Show>
        <ContextMenuDivider />
        <Show when={state.settings.getValue("advanced:admin_panel")}>
          <ContextMenuButton icon={MdShield} onClick={openAdminPanel}>
            <Trans>Admin Panel</Trans>
          </ContextMenuButton>
        </Show>
        <ContextMenuButton icon={MdShare} onClick={copyMessageLink}>
          <Trans>Copy message link</Trans>
        </ContextMenuButton>
        <Show when={state.settings.getValue("advanced:copy_id")}>
          <ContextMenuButton icon={MdBadge} onClick={copyId}>
            <Trans>Copy message ID</Trans>
          </ContextMenuButton>
        </Show>
      </Show>
    </ContextMenu>
  );
}
