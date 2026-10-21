import { describe, expect, it } from "vitest";

import { isShownPreview, withoutPreviewedLinks } from "./linkPreviews";

const card = (url: string, title = "Title") => ({
  type: "Website",
  url,
  originalUrl: url,
  title,
});

describe("links with a preview (dur.io)", () => {
  it("hides a lone link with a card, an image or a video", () => {
    expect(
      withoutPreviewedLinks("https://news.example/a", [
        card("https://news.example/a"),
      ]),
    ).toBe("");
    expect(
      withoutPreviewedLinks("<https://img.example/a.png>", [
        { type: "Image", url: "https://img.example/a.png" },
      ]),
    ).toBe("");
  });

  it("hides a link alone on its line, keeps the text and links in sentences", () => {
    expect(
      withoutPreviewedLinks("look at this\nhttps://news.example/a/\nwow", [
        card("https://NEWS.example/a#top"),
      ]),
    ).toBe("look at this\nwow");
    expect(
      withoutPreviewedLinks("see https://news.example/a here", [
        card("https://news.example/a"),
      ]),
    ).toBe("see https://news.example/a here");
  });

  it("keeps links without a shown preview", () => {
    expect(
      withoutPreviewedLinks("https://news.example/a", [
        card("https://news.example/a", " "),
      ]),
    ).toBe("https://news.example/a");
    expect(withoutPreviewedLinks("https://news.example/a", [])).toBe(
      "https://news.example/a",
    );
    expect(
      withoutPreviewedLinks("one\nhttps://other.example/b", [
        card("https://news.example/a"),
      ]),
    ).toBe("one\nhttps://other.example/b");
  });

  it("hides a lone link with one preview for another address (imported history)", () => {
    expect(
      withoutPreviewedLinks("https://youtu.be/x", [
        card("https://www.youtube.com/watch?v=x"),
      ]),
    ).toBe("");
    expect(
      withoutPreviewedLinks("https://tenor.com/view/cat", [
        { type: "Video", url: "https://chat.example/autumn/attachments/F" },
      ]),
    ).toBe("");
    // two previews: only matching addresses go
    expect(
      withoutPreviewedLinks("https://youtu.be/x", [
        card("https://www.youtube.com/watch?v=x"),
        card("https://other.example"),
      ]),
    ).toBe("https://youtu.be/x");
  });

  it("knows which previews show", () => {
    expect(isShownPreview({ type: "Text", title: "x" })).toBe(false);
    expect(isShownPreview({ type: "None" })).toBe(false);
    expect(isShownPreview({ type: "Website" })).toBe(false);
    // a post without a title (e.g. a tweet) is shown by its text
    expect(isShownPreview({ type: "Website", description: "post" })).toBe(true);
  });
});
