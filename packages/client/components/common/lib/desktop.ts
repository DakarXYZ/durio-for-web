// The dur.io Windows client (plan WEB-09, 90-desktop-windows D2–D4): for-web built with
// `vite build --mode desktop` and served by Electron from `app://durio/`. This module is
// the page's side of the contract with the Electron side (stage 7); the full contract
// is documented in the for-web README ("dur.io fork: desktop build").

import { appPath, routerPath } from "./env";

/** Built for the desktop app (`vite build --mode desktop`, `mise build:desktop`) */
export const IS_DESKTOP = import.meta.env.MODE === "desktop";

/**
 * What dur.io adds to the desktop bridge `window.native` (the upstream part — versions,
 * window controls, screen picker — is typed in `settings/user/Native.tsx`). Every
 * member is optional for the page: an older or a missing bridge degrades, never throws.
 */
export interface DurioNativeBridge {
  /**
   * The key of an account's crypto store: 32 raw bytes kept by the main process with
   * `safeStorage` (DPAPI) in `userData/keys/<accountKey>.bin`, created on first use.
   * `created` says it did not exist before this call: if the account's store exists
   * nevertheless, the old key is lost (the page shows the "keys lost" wizard).
   * Main checks `event.senderFrame.url` starts with `app://durio/` and that
   * `accountKey` is 1–128 of `[A-Za-z0-9_-]`.
   */
  e2eeStoreKey(
    accountKey: string,
  ): Promise<
    | Uint8Array
    | ArrayBuffer
    | { key: Uint8Array | ArrayBuffer; created: boolean }
  >;

  /** Delete the store key of a signed-out account (`secrets:delete`) */
  e2eeDeleteStoreKey(accountKey: string): Promise<void>;

  /** Show and focus the app window, also from the tray (IPC `focus`, D5) */
  focus(): void;

  /**
   * Overlay of the taskbar button (IPC `setBadgeCount`, D5): the number of unread
   * mentions, `-1` for a dot (unread messages without mentions), `0` for none
   */
  setBadgeCount(count: number): void;

  /**
   * Prefill for the server address screen, set at build time of the desktop app
   * (`electron-store`), empty by default (O13). Only a suggestion: the user confirms it.
   */
  servers: {
    default(): string | undefined | Promise<string | undefined>;
  };

  /**
   * The newest pictures of "Pictures" and "Pictures/Screenshots" for the attach panel
   * (IPC `recentImages:list` / `recentImages:read`): PNG thumbnails with ids, and the
   * file of an id from the latest listing (main reads no other path)
   */
  recentImages: {
    list(): Promise<{ id: string; name: string; thumbnail: string }[]>;
    read(id: string): Promise<{ name: string; type: string; data: Uint8Array }>;
  };
}

/** The dur.io part of the desktop bridge, if the page runs inside the desktop app */
export function durioNative(): Partial<DurioNativeBridge> | undefined {
  return (window as unknown as { native?: Partial<DurioNativeBridge> }).native;
}

/**
 * Absolute URL of a path of this app (internal links): `location.origin` is
 * `app://durio` in the desktop app and `null` for an opaque origin, where only the path
 * works
 * @param path Path starting with `/`
 */
export function appHref(path: string): string {
  const origin = location.origin;
  path = appPath(routerPath(path));
  return origin && origin !== "null" ? new URL(path, origin).href : path;
}

/** Name of this session as other devices list it */
export function sessionName(browser?: { name: string; os: string }) {
  if (IS_DESKTOP) return `dur.io Desktop (${browser?.os ?? "Unknown OS"})`;
  return browser
    ? `dur.io Web (${browser.name} on ${browser.os})`
    : "dur.io Web (Unknown Device)";
}
