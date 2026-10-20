import { useFloating } from "solid-floating-ui";
import {
  For,
  JSX,
  Show,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";

import { flip, offset, shift } from "@floating-ui/dom";
import { Trans } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import {
  RECENT_IMAGES,
  listRecentImages,
} from "@revolt/common/lib/recentImages";
import { Ripple } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

interface Props {
  /** The "+" button */
  anchor: HTMLElement | undefined;
  onClose(): void;
  /** Attach these files */
  onFiles(files: File[]): void;
  /** Pick files of a type with the system dialog */
  pickFiles(accept: string): void;
  /** Take a photo */
  onCamera(): void;
  /** Write a poll; none where polls cannot go (encrypted chats) */
  onPoll?: () => void;
}

/**
 * dur.io: what the "+" of the composer opens — the latest pictures and the gallery on
 * the left; files, a poll and the camera on the right
 */
export function AttachPanel(props: Props) {
  const device = useDevice();
  const [floating, setFloating] = createSignal<HTMLDivElement>();
  const phone = () => device.layout() === "phone";

  const position = useFloating(() => props.anchor, floating, {
    placement: "top-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  let release = () => {};
  const [recent] = createResource(async () => {
    const list = await listRecentImages();
    release = list.release;
    return list.images.slice(0, RECENT_IMAGES);
  });
  onCleanup(() => release());

  function onPointerDown(e: PointerEvent) {
    const target = e.target as Node;
    if (!floating()?.contains(target) && !props.anchor?.contains(target)) {
      props.onClose();
    }
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") props.onClose();
  }
  onMount(() => {
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
  });
  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown);
  });

  /**
   * Close the panel, then run an action
   * @param action Action
   */
  function run(action: () => void) {
    props.onClose();
    action();
  }

  /** Above the "+" across the screen on a phone, next to it otherwise */
  const style = (): JSX.CSSProperties => {
    if (phone()) {
      const top = props.anchor?.getBoundingClientRect().top ?? 0;
      return {
        position: "fixed",
        left: "8px",
        right: "8px",
        width: "auto",
        bottom: `${window.innerHeight - top + 8}px`,
      };
    }

    return {
      position: position.strategy,
      top: `${position.y ?? 0}px`,
      left: `${position.x ?? 0}px`,
    };
  };

  const empty = () =>
    Array(Math.max(0, RECENT_IMAGES - (recent()?.length ?? 0))).fill(0);

  return (
    <Portal mount={document.getElementById("floating")!}>
      <Base ref={setFloating} style={style()}>
        <Grid>
          <For each={recent() ?? []}>
            {(image) => (
              <button
                type="button"
                class={tile({ kind: "photo" })}
                title={image.name}
                onClick={() =>
                  run(async () => props.onFiles([await image.file()]))
                }
              >
                <img src={image.thumbnail} alt={image.name} draggable={false} />
              </button>
            )}
          </For>
          <For each={empty()}>
            {() => <div class={tile({ kind: "empty" })} />}
          </For>
          <button
            type="button"
            class={tile({ kind: "action" })}
            onClick={() => run(() => props.pickFiles("image/*,video/*"))}
          >
            <Ripple />
            <Symbol size={24}>photo_library</Symbol>
            <span>
              <Trans>Gallery</Trans>
            </span>
          </button>
        </Grid>

        <Column>
          <button
            type="button"
            class={side({ kind: "outlined" })}
            onClick={() => run(() => props.pickFiles("*"))}
          >
            <Ripple />
            <Symbol size={22}>attach_file</Symbol>
            <Trans>Files</Trans>
          </button>
          <Show when={props.onPoll}>
            <button
              type="button"
              class={side({ kind: "tonal" })}
              onClick={() => run(() => props.onPoll!())}
            >
              <Ripple />
              <Symbol size={22}>ballot</Symbol>
              <Trans>Poll</Trans>
            </button>
          </Show>
          <button
            type="button"
            class={side({ kind: "camera" })}
            onClick={() => run(() => props.onCamera())}
          >
            <Ripple />
            <Symbol size={22}>photo_camera</Symbol>
            <Trans>Camera</Trans>
          </button>
        </Column>
      </Base>
    </Portal>
  );
}

const Base = styled("div", {
  base: {
    zIndex: 10,
    display: "flex",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    width: "min(480px, calc(100vw - 16px))",
    borderRadius: "16px",
    background: "var(--md-sys-color-surface-container)",
    boxShadow: "0 4px 16px var(--md-sys-color-shadow)",
  },
});

const Grid = styled("div", {
  base: {
    flex: "1 1 0",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "var(--gap-sm)",
  },
});

const Column = styled("div", {
  base: {
    width: "34%",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
  },
});

const tile = cva({
  base: {
    position: "relative",
    overflow: "hidden",
    aspectRatio: "1 / 1",
    border: "none",
    padding: 0,
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-high)",
    color: "var(--md-sys-color-on-surface)",

    "& img": {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
  },
  variants: {
    kind: {
      photo: {
        cursor: "pointer",
        transition: "filter var(--transitions-fast)",
        "&:hover": { filter: "brightness(0.85)" },
      },
      empty: {
        opacity: 0.4,
      },
      action: {
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        fontSize: "0.8125rem",
        fontWeight: 500,
        background: "var(--md-sys-color-secondary-container)",
        color: "var(--md-sys-color-on-secondary-container)",
        fill: "var(--md-sys-color-on-secondary-container)",
      },
    },
  },
});

const side = cva({
  base: {
    position: "relative",
    overflow: "hidden",
    flex: "1 1 0",
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-sm)",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    borderRadius: "var(--borderRadius-md)",
    border: "none",
  },
  variants: {
    kind: {
      outlined: {
        background: "transparent",
        border: "1px solid var(--md-sys-color-outline)",
        color: "var(--md-sys-color-primary)",
        fill: "var(--md-sys-color-primary)",
      },
      tonal: {
        background: "var(--md-sys-color-secondary-container)",
        color: "var(--md-sys-color-on-secondary-container)",
        fill: "var(--md-sys-color-on-secondary-container)",
      },
      // smaller than the other two (upstream's camera tile took half the panel)
      camera: {
        flex: "0 0 auto",
        background: "var(--md-sys-color-tertiary-container)",
        color: "var(--md-sys-color-on-tertiary-container)",
        fill: "var(--md-sys-color-on-tertiary-container)",
      },
    },
  },
});
