/**
 * dur.io: a link whose preview is shown is not repeated in the text, like Discord
 *
 * A link standing alone (the whole message, or alone on its line) disappears when the
 * message has a preview for it: a picture, a video, or a card with a title or a text (the
 * title, or else the site name, links to the page). A link inside a sentence stays. Previews of imported history often carry
 * another address than the posted link (the page's canonical address, a stored file), so a
 * message that is just one link with just one shown preview hides it as well.
 */

/**
 * The part of an embed this needs
 */
export interface PreviewLike {
  type: string;
  url?: string;
  originalUrl?: string;
  title?: string;
  description?: string;
}

const LINK = /^<?(https?:\/\/[^\s<>]+)>?$/i;

/**
 * Whether a preview shows as something of its own (not an empty card)
 */
export function isShownPreview(embed: PreviewLike) {
  return (
    embed.type === "Image" ||
    embed.type === "Video" ||
    (embed.type === "Website" &&
      !!(embed.title?.trim() || embed.description?.trim()))
  );
}

/**
 * An address compared without its fragment, a trailing slash, or the case of scheme and host
 */
export function normaliseUrl(url: string) {
  const bare = url.split("#")[0].replace(/\/$/, "");
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?]*)(.*)$/i.exec(bare);
  return match ? match[1].toLowerCase() + match[2] : bare;
}

/**
 * The link of a line that is nothing but one link
 */
function lineLink(line: string) {
  return LINK.exec(line.trim())?.[1];
}

/**
 * Text of a message without the links its previews show
 * @param content Text
 * @param embeds Previews of the message
 * @returns The text to render (may be empty)
 */
export function withoutPreviewedLinks(
  content: string,
  embeds: PreviewLike[] | undefined,
) {
  const shown = (embeds ?? []).filter(isShownPreview);
  if (!content || !shown.length) return content;

  const previewed = new Set(
    shown
      .flatMap((embed) => [embed.url, embed.originalUrl])
      .filter((url): url is string => !!url)
      .map(normaliseUrl),
  );

  const lines = content.split("\n");
  const links = lines.map(lineLink);
  const onlyLink =
    shown.length === 1 &&
    lines.filter((line) => line.trim()).length === 1 &&
    links.some((link) => link);

  const kept = lines.filter((line, index) => {
    const link = links[index];
    return !link || !(onlyLink || previewed.has(normaliseUrl(link)));
  });

  // a removed line leaves no blank line behind at either end
  return kept.join("\n").trim()
    ? kept.join("\n").replace(/^\n+|\n+$/g, "")
    : "";
}
