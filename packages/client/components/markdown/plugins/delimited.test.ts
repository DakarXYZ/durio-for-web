import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { remarkDelimited } from "./delimited";

type AnyNode = { type: string; value?: string; children?: AnyNode[] };

/**
 * The paragraph children of some markdown, with spoilers parsed
 */
function parse(markdown: string): AnyNode[] {
  const pipeline = unified()
    .use(remarkParse)
    .use(() => remarkDelimited("||", "spoiler"))
    .use(() => remarkDelimited("(!)", "nsfw"));
  const tree = pipeline.runSync(pipeline.parse(markdown)) as AnyNode;
  return tree.children![0].children!;
}

const text = (node: AnyNode): string =>
  node.value ?? (node.children ?? []).map(text).join("");

describe("delimited spoilers", () => {
  it("turns ||text|| into a spoiler", () => {
    const nodes = parse("before ||the ending|| after");
    expect(nodes.map((node) => node.type)).toEqual(["text", "spoiler", "text"]);
    expect(text(nodes[1])).toBe("the ending");
  });

  it("turns (!)text(!) into an NSFW spoiler", () => {
    const nodes = parse("look (!)not here(!) ok");
    expect(nodes.map((node) => node.type)).toEqual(["text", "nsfw", "text"]);
    expect(text(nodes[1])).toBe("not here");
  });

  it("keeps both kinds apart in one line", () => {
    const nodes = parse("||a|| and (!)b(!)");
    expect(
      nodes
        .filter((node) => node.type !== "text")
        .map((node) => [node.type, text(node)]),
    ).toEqual([
      ["spoiler", "a"],
      ["nsfw", "b"],
    ]);
  });

  it("leaves a lone delimiter as text", () => {
    const nodes = parse("just (!) once");
    expect(nodes.every((node) => node.type === "text")).toBe(true);
  });
});
