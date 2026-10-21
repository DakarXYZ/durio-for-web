import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

import Panzoom, { PanzoomObject } from "@panzoom/panzoom";
import { css, cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Column, Dialog, DialogProps, IconButton, Text } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { MessageContextMenu } from "@revolt/app";
import { useClient } from "@revolt/client";
import { createFileUrl } from "@revolt/client/e2ee";
import { isGifBox } from "@revolt/common/lib/gifs";
import { Modals } from "../types";

export function ImageViewerModal(
  props: DialogProps & Modals & { type: "image_viewer" },
) {
  const [ref, setRef] = createSignal<HTMLElement>();
  const client = useClient();

  // dur.io: a grid's pictures, one at a time
  const [index, setIndex] = createSignal(untrack(() => props.index ?? 0));
  const count = () => props.gallery?.length ?? 0;
  const file = () => (count() ? props.gallery![index()].file : props.file);
  const embed = () => (count() ? props.gallery![index()].embed : props.embed);
  const step = (by: number) => {
    if (count() < 2) return;
    setIndex((index() + by + count()) % count());
    panzoom?.reset({ animate: false });
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  // dur.io: an encrypted image is decrypted into an object URL (WEB-06)
  const original = createFileUrl(client, file, "original");

  let panzoom: PanzoomObject;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 2) {
      panzoom.handleDown(e);
      return;
    }
  }

  function onMouseWheel(event: WheelEvent) {
    panzoom.zoom(panzoom.getScale() - event.deltaY / 1000);
  }

  createEffect(
    on(
      () => ref(),
      (ref) => {
        if (ref) {
          const zoom = Panzoom(ref, {
            minScale: 0.1,
            maxScale: 5,
            noBind: true,
          });

          panzoom = zoom;

          ref.addEventListener("pointerdown", onPointerDown);
          document.addEventListener("pointermove", panzoom.handleMove);
          document.addEventListener("pointerup", panzoom.handleUp);
          document.addEventListener("pointerleave", panzoom.handleUp);
          document.addEventListener("pointercancel", panzoom.handleUp);
          document.addEventListener("wheel", onMouseWheel as never);

          onCleanup(() => {
            ref.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("pointercancel", panzoom.handleUp);
            document.removeEventListener("pointermove", panzoom.handleMove);
            document.removeEventListener("pointerup", panzoom.handleUp);
            document.removeEventListener("pointerleave", panzoom.handleUp);
            document.removeEventListener("wheel", onMouseWheel as never);
          });
        }
      },
    ),
  );

  return (
    <Portal mount={document.getElementById("floating")!}>
      <Dialog.Scrim
        dark
        padding={false}
        overflow={false}
        show={props.show}
        onClick={props.onClose}
      >
        <Presence>
          <Show when={props?.show}>
            <Motion.div
              class={css({
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",

                minHeight: 0,
                width: "100%",
                height: "100%",

                paddingInline: "20px",
              })}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{
                duration: 0.3,
                easing: [0.17, 0.67, 0.58, 0.98],
              }}
            >
              <Relative>
                <Bar>
                  <Switch fallback={<div />}>
                    <Match when={file()}>
                      <Card onClick={(e) => e.stopPropagation()}>
                        <Column>
                          <Text class="title">{file()!.filename}</Text>
                          <Text class="label">{file()!.humanReadableSize}</Text>
                        </Column>
                      </Card>
                    </Match>
                  </Switch>
                  <Card onClick={(e) => e.stopPropagation()}>
                    <Show when={count() > 1}>
                      <IconButton onPress={() => step(-1)}>
                        <Symbol>chevron_left</Symbol>
                      </IconButton>
                      <Text class="label">
                        {index() + 1} / {count()}
                      </Text>
                      <IconButton onPress={() => step(1)}>
                        <Symbol>chevron_right</Symbol>
                      </IconButton>
                    </Show>
                    <IconButton onPress={() => panzoom?.zoomOut()}>
                      <Symbol>zoom_out</Symbol>
                    </IconButton>
                    <IconButton onPress={() => panzoom?.zoomIn()}>
                      <Symbol>zoom_in</Symbol>
                    </IconButton>
                    <Show when={file()}>
                      <a
                        target="_blank"
                        href={original()}
                        download={file()?.filename}
                      >
                        <IconButton>
                          <Symbol>download</Symbol>
                        </IconButton>
                      </a>
                    </Show>
                    <Show when={embed() || props.gif}>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={embed()?.url || props.gif?.url}
                      >
                        <IconButton>
                          <Symbol>open_in_new</Symbol>
                        </IconButton>
                      </a>
                    </Show>
                    <IconButton onPress={props.onClose}>
                      <Symbol>close</Symbol>
                    </IconButton>
                  </Card>
                </Bar>
              </Relative>
              <Switch>
                <Match when={file()}>
                  <img
                    class={Image()}
                    use:floating={{
                      contextMenu: () => <MessageContextMenu file={file()} />,
                    }}
                    ref={setRef}
                    style={{
                      "aspect-ratio": `${(file()!.metadata as { width: number }).width}/${(file()!.metadata as { height: number }).height}`,
                    }}
                    src={original()}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                </Match>
                <Match when={embed()}>
                  <img
                    class={Image()}
                    ref={setRef}
                    use:floating={{
                      contextMenu: () => <MessageContextMenu file={embed()} />,
                    }}
                    style={{
                      "aspect-ratio": `${embed()!.width}/${embed()!.height}`,
                    }}
                    src={embed()!.proxiedURL}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Match>
                <Match when={props.gif}>
                  <video
                    class={Video()}
                    ref={setRef}
                    use:floating={{
                      contextMenu: () => (
                        <MessageContextMenu file={props.gif} />
                      ),
                    }}
                    playsinline
                    loop
                    muted
                    autoplay
                    style={{
                      "aspect-ratio": `${props.gif!.width}/${props.gif!.height}`,
                    }}
                    src={
                      isGifBox(props.gif!)
                        ? props.gif!.proxiedURL
                        : props.gif!.url
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </Match>
              </Switch>
              <div />
            </Motion.div>
          </Show>
        </Presence>
      </Dialog.Scrim>
    </Portal>
  );
}

const Image = cva({
  base: {
    minHeight: 0,
    alignSelf: "center",
    objectFit: "contain",

    background: "rgba(0, 0, 0, 0.6)",
  },
});

const Video = cva({
  base: {
    minHeight: 0,
    alignSelf: "center",
    objectFit: "contain",

    background: "rgba(0, 0, 0, 0.6)",
  },
});

const Relative = styled("div", {
  base: {
    position: "relative",
  },
});

const Bar = styled("div", {
  base: {
    width: "100%",
    position: "absolute",

    height: "120px",
    flexShrink: 0,

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const Card = styled("div", {
  base: {
    zIndex: 999,
    display: "flex",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-lg)",
    background: "var(--md-sys-color-surface)",
    color: "var(--md-sys-color-on-surface)",
  },
});
