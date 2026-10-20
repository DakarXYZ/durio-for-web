/**
 * dur.io: swipe a message to the left to reply to it (touch only), as in Discord.
 *
 * Runs on touch events next to the phone layout's SlideDrawer: with the
 * conversation in view the drawer cannot move further left, so a left swipe
 * only moves the message.
 */

/** Horizontal movement before the swipe takes over from scrolling */
const START = 12;

/** How far to swipe for the reply */
const TRIGGER = 64;

/** How far the message follows the finger */
const MAX = 96;

/** Elements whose own horizontal scrolling or gestures win */
const IGNORE = "pre, code, input, textarea, video, audio, [data-no-swipe]";

/** How long after a swipe a click is swallowed (the tap of the finger lifting) */
const CLICK_SUPPRESS_WINDOW = 400;

/**
 * Swallow the click that follows a swipe: the finger lifted on an image or a
 * link would open it, while the swipe meant to reply
 */
function suppressNextClick() {
  function suppress(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    cleanup();
  }

  function cleanup() {
    clearTimeout(timeout);
    document.removeEventListener("click", suppress, true);
  }

  document.addEventListener("click", suppress, true);
  const timeout = setTimeout(cleanup, CLICK_SUPPRESS_WINDOW);
}

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>';

/**
 * Listen for left swipes on a message
 * @param element The message
 * @param onReply Called once the swipe went far enough and the finger lifted
 * @returns Cleanup
 */
export function addSwipeReplyListener(
  element: HTMLElement,
  onReply: () => void,
) {
  let id: number | undefined;
  let startX = 0;
  let startY = 0;
  let engaged = false;
  let armed = false;
  let indicator: HTMLDivElement | undefined;

  function reset() {
    id = undefined;
    engaged = false;
    armed = false;
    element.style.transition = "transform var(--transitions-fast)";
    element.style.transform = "";
    indicator?.remove();
    indicator = undefined;
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) return reset();
    if ((e.target as Element | null)?.closest?.(IGNORE)) return;

    const t = e.touches[0];
    id = t.identifier;
    startX = t.clientX;
    startY = t.clientY;
    engaged = false;
    armed = false;
  }

  function onTouchMove(e: TouchEvent) {
    if (id === undefined) return;
    const t = [...e.changedTouches].find((touch) => touch.identifier === id);
    if (!t) return;

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (!engaged) {
      if (Math.abs(dy) > START && Math.abs(dy) > Math.abs(dx)) return reset();
      if (dx > -START || Math.abs(dx) < Math.abs(dy) * 2) return;

      engaged = true;
      element.style.transition = "none";
      indicator = document.createElement("div");
      indicator.innerHTML = ICON;
      Object.assign(indicator.style, {
        position: "absolute",
        top: "50%",
        right: "12px",
        display: "flex",
        padding: "6px",
        borderRadius: "50%",
        pointerEvents: "none",
        color: "var(--md-sys-color-on-surface)",
        background: "var(--md-sys-color-surface-container-high)",
        opacity: "0",
      } satisfies Partial<CSSStyleDeclaration>);
      element.appendChild(indicator);
    }

    e.preventDefault();

    const distance = Math.min(Math.max(-dx - START, 0), MAX);
    element.style.transform = `translateX(${-distance}px)`;

    // the icon stays put on screen, in the space the message leaves
    const progress = Math.min(Math.max((distance - 16) / (TRIGGER - 16), 0), 1);
    indicator!.style.opacity = String(progress);
    indicator!.style.transform = `translate(${distance}px, -50%) scale(${0.6 + 0.4 * progress})`;

    if (!armed && distance >= TRIGGER) {
      armed = true;
      indicator!.style.color = "var(--md-sys-color-on-primary)";
      indicator!.style.background = "var(--md-sys-color-primary)";
      navigator.vibrate?.(10);
    } else if (armed && distance < TRIGGER) {
      armed = false;
      indicator!.style.color = "var(--md-sys-color-on-surface)";
      indicator!.style.background =
        "var(--md-sys-color-surface-container-high)";
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (id === undefined) return;
    if (![...e.changedTouches].some((touch) => touch.identifier === id)) return;

    const swiped = engaged;
    const reply = engaged && armed && e.type === "touchend";
    reset();
    if (swiped) suppressNextClick();
    if (reply) onReply();
  }

  element.addEventListener("touchstart", onTouchStart, { passive: true });
  element.addEventListener("touchmove", onTouchMove, { passive: false });
  element.addEventListener("touchend", onTouchEnd);
  element.addEventListener("touchcancel", onTouchEnd);

  return () => {
    element.removeEventListener("touchstart", onTouchStart);
    element.removeEventListener("touchmove", onTouchMove);
    element.removeEventListener("touchend", onTouchEnd);
    element.removeEventListener("touchcancel", onTouchEnd);
    reset();
  };
}
