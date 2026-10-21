import { For } from "solid-js";

import { File, ImageEmbed, Message } from "stoat.js";
import { styled } from "styled-system/jsx";

import { MessageContextMenu } from "@revolt/app";
import { useClient } from "@revolt/client";
import { createFileUrl } from "@revolt/client/e2ee";
import { useModals } from "@revolt/modal";

import { withoutPreviewedLinks } from "./linkPreviews";
import { GroupCandidate, gridShape, intoGrids } from "./pictureGroups";

/**
 * dur.io: a picture of a grid and the message it belongs to
 */
export interface Picture {
  message: Message;
  file?: File;
  embed?: ImageEmbed;
}

/**
 * Text of a message as shown: without the links its previews show
 */
export function visibleText(message: Message) {
  return withoutPreviewedLinks(message.content ?? "", message.embeds);
}

/**
 * Whether a file goes into a grid: a picture that is not a spoiler
 */
export function isGridPicture(file: File) {
  return file.metadata.type === "Image" && !file.isSpoiler;
}

/**
 * Pictures of a message that may go into a grid: its pictures, and its picture links
 * when nothing but the links was written
 */
export function messagePictures(message: Message): Picture[] {
  const files = (message.attachments ?? [])
    .filter(isGridPicture)
    .map((file) => ({ message, file }));
  const embeds = visibleText(message).trim()
    ? []
    : (message.embeds ?? [])
        .filter((embed): embed is ImageEmbed => embed.type === "Image")
        .map((embed) => ({ message, embed }));
  return [...files, ...embeds];
}

/**
 * What the grouping needs to know about a message
 */
export function groupCandidate(message: Message): GroupCandidate {
  const text = visibleText(message);
  const embeds = message.embeds ?? [];
  return {
    id: message.id,
    authorKey: [
      message.authorId,
      message.masquerade?.name ?? "",
      message.webhook?.name ?? "",
    ].join("|"),
    createdAt: +message.createdAt,
    visibleText: text,
    pictures: messagePictures(message).length,
    otherFiles:
      (message.attachments ?? []).filter((file) => !isGridPicture(file))
        .length +
      // a card or video would be lost in another message's grid
      embeds.filter((embed) => embed.type !== "Image" && embed.type !== "None")
        .length,
    groupable:
      !message.systemMessage &&
      (!message.e2ee || message.e2ee.state === "ok") &&
      message.author?.relationship !== "Blocked",
    joinable:
      !message.replyIds?.length &&
      !message.reactions.size &&
      !message.poll &&
      !message.pinned,
  };
}

const Grids = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gap: "4px",
    width: "420px",
    maxWidth: "100%",
    borderRadius: "var(--borderRadius-md)",
    overflow: "hidden",

    "& img": {
      width: "100%",
      aspectRatio: "1",
      objectFit: "cover",
      cursor: "pointer",
      display: "block",
      background: "var(--md-sys-color-surface-container-high)",
    },
  },
  variants: {
    columns: {
      1: { gridTemplateColumns: "1fr", width: "160px" },
      2: { gridTemplateColumns: "repeat(2, 1fr)", width: "320px" },
      3: { gridTemplateColumns: "repeat(3, 1fr)" },
    },
  },
});

/**
 * One cell: a thumbnail opening the viewer, with its own message's menu
 */
function Cell(props: { picture: Picture; open: () => void }) {
  const client = useClient();
  // an encrypted picture is decrypted into an object URL (WEB-06)
  const preview = createFileUrl(client, () => props.picture.file, "preview");

  return (
    <img
      loading="lazy"
      src={props.picture.file ? preview() : props.picture.embed?.proxiedURL}
      onClick={() => props.open()}
      use:floating={{
        contextMenu: () => (
          <MessageContextMenu
            message={props.picture.message}
            file={props.picture.file ?? props.picture.embed}
          />
        ),
      }}
    />
  );
}

/**
 * dur.io: several pictures in a row as grids of at most 12
 */
export function PictureGrid(props: { pictures: Picture[] }) {
  const { openModal } = useModals();

  const open = (index: number) =>
    openModal({
      type: "image_viewer",
      file: props.pictures[index].file,
      embed: props.pictures[index].embed,
      gallery: props.pictures.map(({ file, embed }) => ({ file, embed })),
      index,
    });

  return (
    <Grids>
      <For
        each={intoGrids(
          props.pictures.map((picture, index) => ({ picture, index })),
        )}
      >
        {(grid) => (
          <Grid columns={gridShape(grid.length).columns as 1 | 2 | 3}>
            <For each={grid}>
              {(cell) => (
                <Cell picture={cell.picture} open={() => open(cell.index)} />
              )}
            </For>
          </Grid>
        )}
      </For>
    </Grids>
  );
}
