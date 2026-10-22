import { createSignal } from "solid-js";

import { Handler } from "mdast-util-to-hast";
import { styled } from "styled-system/jsx";
import { Plugin } from "unified";

import { remarkDelimited } from "./delimited";

const Spoiler = styled("span", {
  base: {
    position: "relative",
    display: "inline-block",
    padding: "0 6px",
    borderRadius: "var(--borderRadius-md)",
  },
  variants: {
    // dur.io: (!)NSFW(!) spoilers say so while closed
    nsfw: {
      true: {},
      false: {},
    },
    shown: {
      true: {
        background: "var(--md-sys-color-inverse-on-surface)",
      },
      false: {
        cursor: "pointer",
        userSelect: "none",
        color: "transparent",
        background: "var(--md-sys-color-on-secondary-fixed-variant)",

        "& *": {
          opacity: 0,
          pointerEvents: "none",
        },
      },
    },
  },
  compoundVariants: [
    {
      nsfw: true,
      shown: false,
      css: {
        minWidth: "3.6em",
        background: "var(--md-sys-color-error-container)",

        "&::after": {
          content: '"NSFW"',
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: "0.7em",
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: "var(--md-sys-color-on-error-container)",
        },
      },
    },
  ],
});

export function RenderSpoiler(props: {
  children: Element;
  disabled?: boolean;
  nsfw?: boolean;
}) {
  const [shown, setShown] = createSignal(false);

  return (
    <Spoiler
      shown={shown()}
      nsfw={!!props.nsfw}
      onClick={props.disabled ? undefined : () => setShown(true)}
    >
      {props.children}
    </Spoiler>
  );
}

/**
 * dur.io: a (!)NSFW(!) spoiler
 */
export function RenderNsfw(props: { children: Element; disabled?: boolean }) {
  return (
    <RenderSpoiler nsfw disabled={props.disabled}>
      {props.children}
    </RenderSpoiler>
  );
}

/**
 * Text between two `||` becomes a spoiler
 */
export const remarkSpoiler: Plugin = () => remarkDelimited("||", "spoiler");

/**
 * dur.io: text between two `(!)` becomes an NSFW spoiler
 */
export const remarkNsfw: Plugin = () => remarkDelimited("(!)", "nsfw");

/**
 * Spoilers
 */
export const spoilerHandler: Handler = (h, node) =>
  delimitedHandler(h, node, "spoiler");

/**
 * dur.io: (!)NSFW(!) spoilers
 */
export const nsfwHandler: Handler = (h, node) =>
  delimitedHandler(h, node, "nsfw");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delimitedHandler = (h: any, node: any, tagName: string) => {
  return {
    type: "element" as const,
    tagName,
    children: h.all({
      type: "paragraph",
      children: node.children,
    }),
    properties: {},
  };
};
