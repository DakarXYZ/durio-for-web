import { createEffect, on, onCleanup } from "solid-js";

import { durioNative } from "@revolt/common/lib/desktop";

import { useClient } from ".";

/**
 * Badge of the desktop app's taskbar button (dur.io, stage 7, D5): the number of
 * unread mentions (every message of a DM or group counts as one), `-1` for unread
 * messages without mentions, `0` for none. Muted channels do not count. Renders nothing.
 */
export function DesktopBadge() {
  const client = useClient();
  const setBadgeCount = durioNative()?.setBadgeCount;
  if (!setBadgeCount) return null;

  const count = () => {
    let mentions = 0;
    let unread = false;
    for (const channel of client().channels.values()) {
      if (channel.muted) continue;
      mentions += channel.mentions?.size ?? 0;
      unread ||= channel.unread;
    }

    return mentions || (unread ? -1 : 0);
  };

  createEffect(on(count, (value) => setBadgeCount(value)));
  onCleanup(() => setBadgeCount(0));
  return null;
}
