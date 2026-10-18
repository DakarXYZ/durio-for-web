import type { Client } from "stoat.js";

type DisposeHook = (client: Client) => void;

const hooks = new Set<DisposeHook>();

/**
 * Run a hook whenever a client is thrown away (account or instance switch).
 * Per-client resources live here, e.g. the E2EE crypto worker's `terminate()` (WEB-03, WEB-12)
 * @returns Function to remove the hook
 */
export function onClientDispose(hook: DisposeHook) {
  hooks.add(hook);
  return () => hooks.delete(hook);
}

/**
 * Dispose a client: run the hooks, drop listeners and close the socket
 * @param client Client
 */
export function disposeClient(client: Client) {
  for (const hook of hooks)
    try {
      hook(client);
    } catch (e) {
      console.error("[instance] client dispose hook failed", e);
    }

  client.events.removeAllListeners();
  client.removeAllListeners();
  client.events.disconnect();
}
