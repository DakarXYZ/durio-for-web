import { visit } from "unist-util-visit";

type ParentNode = {
  type: "string";
  children: (
    | { type: "text"; value: string }
    | { type: "paragraph" | "spoiler" | "nsfw"; children: Node[] }
  )[];
};

/**
 * Turn text between two delimiters into nodes of a type (`||spoilers||`, dur.io:
 * `(!)NSFW(!)` spoilers)
 * @param delimiter Delimiter
 * @param type Node type
 * @returns Transformer
 */
export const remarkDelimited =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (delimiter: string, type: string) => (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tNodes = (tree as any).children;
    let spillover: Node[] | null;
    let spoilerStart = -1;
    let spoilerText: string;

    visit(tree, "paragraph", (node: ParentNode, tIdx) => {
      // Visit all children of paragraphs
      for (let i = 0, s, sl; i < node.children.length; ++i) {
        const child = node.children[i];

        // Find the next text element to start a spoiler from
        if (child.type === "text") {
          const spoilers = child.value.split(delimiter);
          if (spoilers.length === 1) continue; //No spoilers
          node.children.splice(i, 1); //Delete this node

          //Parse spoiler start & end
          for (s = 1, sl = spoilers.length; s < sl; ++s) {
            if (spoilerStart !== -1) {
              //End spoiler
              const sText = spoilers[s - 1],
                elements = node.children.splice(spoilerStart, i - spoilerStart),
                inject = [
                  {
                    type,
                    children: [
                      ...(spoilerText!
                        ? [{ type: "text", value: spoilerText }]
                        : []),
                      ...(spillover || []),
                      ...elements,
                      ...(sText && (spillover || i !== spoilerStart)
                        ? [{ type: "text", value: spoilers[s - 1] }]
                        : []),
                    ],
                  },
                  ...(spoilers[s]
                    ? [{ type: "text", value: spoilers[s] }]
                    : []),
                ];

              //Inject spoiler
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              node.children.splice(spoilerStart, 0, ...(inject as any));
              i = spoilerStart + inject.length - 1;

              spoilerStart = -1;
              spillover = null;
            } else {
              //Inject non-spoiler text
              if (spoilers[s - 1])
                node.children.splice(i++, 0, {
                  type: "text",
                  value: spoilers[s - 1],
                });

              //Start spoiler
              spoilerStart = i;
              spoilerText = spoilers[s];
            }
          }
        }
      }

      //Spillover to next parent node
      if (spoilerStart !== -1) {
        if (!spillover) spillover = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spillover.push(...(node.children.splice(spoilerStart) as any));
        spoilerStart = 0;
      }

      //Append excess spillover
      if (spillover && tIdx === tNodes.length - 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (node.children as any[]).push(
          ...(spoilerText! ? [{ type: "text", value: spoilerText! }] : []),
          ...spillover,
        );
      }
    });
  };
