import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps } from "@revolt/ui";

import { Modals } from "../types";

/**
 * dur.io: take a photo with the camera of the computer and attach it
 */
export function CameraCaptureModal(
  props: DialogProps & Modals & { type: "camera_capture" },
) {
  let video!: HTMLVideoElement;
  let stream: MediaStream | undefined;
  const [ready, setReady] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  onMount(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      setReady(true);
    } catch {
      setFailed(true);
    }
  });

  onCleanup(() => stream?.getTracks().forEach((track) => track.stop()));

  /**
   * The current frame as a JPEG file
   */
  async function capture() {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    props.onCapture(
      new File([blob], `photo-${stamp}.jpg`, { type: "image/jpeg" }),
    );
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Camera</Trans>}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Take photo</Trans>,
          onClick: () => capture(),
          isDisabled: !ready(),
        },
      ]}
    >
      <Show
        when={!failed()}
        fallback={
          <Trans>
            The camera is not available: no camera, or access to it was denied.
          </Trans>
        }
      >
        <Preview ref={video} muted playsinline />
      </Show>
    </Dialog>
  );
}

const Preview = styled("video", {
  base: {
    width: "100%",
    maxHeight: "60vh",
    borderRadius: "var(--borderRadius-md)",
    background: "black",
  },
});
