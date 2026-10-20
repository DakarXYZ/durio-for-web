import { createSignal } from "solid-js";

/**
 * dur.io: a click or tap on a message selects it and shows its quick actions
 * (recent reactions, copy, reply, more). One message at a time; a press
 * anywhere else, or Escape, clears it.
 */
const [selectedMessage, setSelectedMessage] = createSignal<string>();

export { selectedMessage };

/** What a click on is its own action, not a selection of the message */
const INTERACTIVE =
  "a, button, input, textarea, select, video, audio, img, [role=button], .Toolbar";

let listening = false;

function listen() {
  if (listening) return;
  listening = true;

  document.addEventListener(
    "pointerdown",
    (e) => {
      const id = selectedMessage();
      if (!id) return;
      const target = e.target as Element | null;
      if (!target?.closest?.(`[data-quick-message="${CSS.escape(id)}"]`)) {
        setSelectedMessage(undefined);
      }
    },
    true,
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSelectedMessage(undefined);
  });
}

/** Clear the selection, e.g. once an action ran */
export function clearSelectedMessage() {
  setSelectedMessage(undefined);
}

/**
 * Handle a click on a message
 * @param e Click
 * @param id Message ID
 */
export function onMessageClick(e: MouseEvent, id: string) {
  if (e.button !== 0 || e.defaultPrevented) return;
  if (window.getSelection()?.toString()) return;

  // links, images, names, avatars, spoilers… keep their own click
  for (
    let el = e.target as HTMLElement | null;
    el && el !== e.currentTarget;
    el = el.parentElement
  ) {
    if (el.matches(INTERACTIVE) || getComputedStyle(el).cursor === "pointer")
      return;
  }

  listen();
  setSelectedMessage((current) => (current === id ? undefined : id));
}
