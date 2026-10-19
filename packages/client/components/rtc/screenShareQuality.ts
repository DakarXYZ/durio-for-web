import { VideoPreset } from "livekit-client";

import type { ScreenShareQualityName } from "@revolt/state/stores/Voice";

/**
 * dur.io: 1080p at 60 fps for games and video; LiveKit has no such preset
 * (h1080fps30 is 5 Mbps), so twice the frames get 8 Mbps
 */
export const SCREEN_SHARE_1080P60 = new VideoPreset(
  1920,
  1080,
  8_000_000,
  60,
  "medium",
);

/**
 * Next lower quality to try when the server's limit hides one
 */
const FALLBACK: Record<ScreenShareQualityName, ScreenShareQualityName> = {
  high60: "high",
  high: "low",
  text: "low",
  low: "low",
};

/**
 * The wanted quality, or the best lower one the server allows ("low" always is)
 * @param qualities Qualities allowed by the server's limits
 * @param name Wanted quality, "low" when unset
 */
export function pickScreenShareQuality<T>(
  qualities: Partial<Record<ScreenShareQualityName, T>>,
  name: ScreenShareQualityName = "low",
): T {
  let current = name;
  while (!qualities[current] && current !== "low") current = FALLBACK[current];
  return qualities[current] ?? qualities.low!;
}
