import { createEffect, on, onCleanup } from "solid-js";

import { durioNative } from "@revolt/common/lib/desktop";

import { useClient } from ".";

/**
 * Badge of the desktop app's taskbar button (dur.io, stage 7, D5): unread mentions
 * plus one for every DM or group with unread messages (encrypted messages carry no
 * mentions for the server), `-1` for other unread messages, `0` for none. Muted
 * channels do not count. Renders nothing.
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
      const direct =
        channel.type === "DirectMessage" || channel.type === "Group";
      mentions += Math.max(
        channel.mentions?.size ?? 0,
        direct && channel.unread ? 1 : 0,
      );
      unread ||= channel.unread;
    }

    return mentions || (unread ? -1 : 0);
  };

  createEffect(on(count, (value) => setBadgeCount(value)));
  onCleanup(() => setBadgeCount(0));
  return null;
}
