import { JSX, Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { API } from "stoat.js";
import { styled } from "styled-system/jsx";

/**
 * dur.io: a message a moderator hid behind a spoiler — blurred under "Spoiler Alert!"
 * or "NSFW" until it is clicked
 */
export function SpoilerCover(props: {
  kind?: API.SpoilerKind;
  children: JSX.Element;
}) {
  const [shown, setShown] = createSignal(false);

  return (
    <Show when={props.kind && !shown()} fallback={props.children}>
      <Cover
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setShown(true);
        }}
        onKeyDown={(e) => e.key === "Enter" && setShown(true)}
      >
        <Hidden aria-hidden="true">{props.children}</Hidden>
        <Label nsfw={props.kind === "nsfw"}>
          <strong>
            <Show
              when={props.kind === "nsfw"}
              fallback={<Trans>Spoiler Alert!</Trans>}
            >
              NSFW
            </Show>
          </strong>
          <small>
            <Trans>Click to show</Trans>
          </small>
        </Label>
      </Cover>
    </Show>
  );
}

const Cover = styled("div", {
  base: {
    position: "relative",
    cursor: "pointer",
    width: "fit-content",
    minWidth: "200px",
    maxWidth: "100%",
    minHeight: "64px",
    borderRadius: "var(--borderRadius-md)",
    overflow: "hidden",
  },
});

const Hidden = styled("div", {
  base: {
    maxHeight: "320px",
    overflow: "hidden",
    filter: "blur(24px)",
    userSelect: "none",
    pointerEvents: "none",
  },
});

const Label = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    textAlign: "center",
    color: "var(--md-sys-color-on-secondary-container)",
    background:
      "color-mix(in srgb, var(--md-sys-color-secondary-container) 85%, transparent)",

    "& strong": {
      fontSize: "1.05em",
      letterSpacing: "0.03em",
    },
    "& small": {
      opacity: 0.8,
    },
  },
  variants: {
    nsfw: {
      true: {
        color: "var(--md-sys-color-on-error-container)",
        background:
          "color-mix(in srgb, var(--md-sys-color-error-container) 85%, transparent)",
      },
    },
  },
});
