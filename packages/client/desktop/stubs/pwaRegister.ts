// Desktop build (WEB-09): no service worker — `virtual:pwa-register` resolves here.
// The app is updated with the desktop app, never by a Workbox cache.

/**
 * Register nothing
 * @returns An update function that does nothing
 */
export function registerSW(_options?: unknown) {
  return async (_reload?: boolean) => {};
}
