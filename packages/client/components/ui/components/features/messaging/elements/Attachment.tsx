import { Match, Show, Switch } from "solid-js";

import { File, ImageEmbed, Message, VideoEmbed } from "stoat.js";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { MessageContextMenu, useMessage } from "@revolt/app";
import { useClient } from "@revolt/client";
import { createFileUrl } from "@revolt/client/e2ee";
import { useModals } from "@revolt/modal";
import { Column } from "@revolt/ui/components/layout";
import { SizedContent, Spoiler } from "@revolt/ui/components/utils";

import { FileInfo } from "./FileInfo";
import { TextFile } from "./TextFile";

/**
 * List of attachments
 */
export const AttachmentContainer = styled(Column, {
  base: {
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    color: "var(--md-sys-color-on-secondary-container)",
    background: "var(--md-sys-color-secondary-container)",
    alignSelf: "start",
    width: "420px",
    maxWidth: "100%",
    overflow: "hidden",

    "& audio": {
      width: "100%",
    },
  },
  variants: {
    dynamic: {
      grow: {
        width: "auto",
        minWidth: "min(420px, 100%)",
      },
      shrink: {
        width: "auto",
        maxWidth: "min(420px, 100%)",
      },
    },
  },
});

/**
 * Render a given list of files
 */
export function Attachment(props: { file: File; message?: Message }) {
  const { openModal } = useModals();
  const { reactPicker } = useMessage();
  const client = useClient();

  // dur.io: an encrypted file is decrypted into an object URL (WEB-06)
  const preview = createFileUrl(
    client,
    () => (props.file.metadata.type === "Image" ? props.file : undefined),
    "preview",
  );
  const original = createFileUrl(
    client,
    () =>
      props.file.metadata.type === "Video" ||
      props.file.metadata.type === "Audio"
        ? props.file
        : undefined,
    "original",
  );

  return (
    <Switch fallback={`Could not render ${props.file.metadata.type}!`}>
      <Match when={props.file.metadata.type === "Image"}>
        <SizedContent
          width={(props.file.metadata as ImageEmbed).width}
          height={(props.file.metadata as ImageEmbed).height}
        >
          <Show when={props.file.isSpoiler}>
            <Spoiler contentType="Image" />
          </Show>
          <img
            class={css({ cursor: "pointer" })}
            onClick={() =>
              openModal({
                type: "image_viewer",
                file: props.file,
              })
            }
            loading="lazy"
            src={preview()}
            use:floating={{
              contextMenu: () => (
                <MessageContextMenu
                  message={props.message}
                  reactPicker={reactPicker}
                  file={props.file}
                />
              ),
            }}
          />
        </SizedContent>
      </Match>
      <Match when={props.file.metadata.type === "Video"}>
        <SizedContent
          width={(props.file.metadata as VideoEmbed).width}
          height={(props.file.metadata as VideoEmbed).height}
        >
          <Show when={props.file.isSpoiler}>
            <Spoiler contentType="Video" />
          </Show>
          <video
            controls
            playsinline
            preload="metadata"
            src={original()}
            use:floating={{
              contextMenu: () => (
                <MessageContextMenu
                  message={props.message}
                  reactPicker={reactPicker}
                  file={props.file}
                />
              ),
            }}
          />
        </SizedContent>
      </Match>
      <Match when={props.file.metadata.type === "Audio"}>
        <AttachmentContainer>
          <FileInfo file={props.file} />
          <audio
            controls
            src={original()}
            use:floating={{
              contextMenu: () => (
                <MessageContextMenu
                  message={props.message}
                  reactPicker={reactPicker}
                  file={props.file}
                />
              ),
            }}
          />
        </AttachmentContainer>
      </Match>
      <Match when={props.file.metadata.type === "File"}>
        <AttachmentContainer dynamic="shrink">
          <FileInfo file={props.file} />
        </AttachmentContainer>
      </Match>
      <Match when={props.file.metadata.type === "Text"}>
        <AttachmentContainer dynamic="grow">
          <FileInfo file={props.file} />
          <TextFile file={props.file} />
        </AttachmentContainer>
      </Match>
    </Switch>
  );
}
