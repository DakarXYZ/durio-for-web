import { createSignal } from "solid-js";

/**
 * dur.io: the thread shown in the side panel of its channel (on a phone a thread
 * opens as a page of its own instead)
 */
const [openThreadId, setOpenThreadId] = createSignal<string>();

export { openThreadId };

/**
 * Show a thread in the side panel of its channel
 * @param id Thread ID
 */
export function openThreadPanel(id: string) {
  setOpenThreadId(id);
}

/**
 * Close the thread side panel
 */
export function closeThreadPanel() {
  setOpenThreadId(undefined);
}
