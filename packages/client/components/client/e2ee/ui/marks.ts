// Per-device marks of the E2EE prompts in localStorage (dur.io, WEB-07): the first
// prompt was shown, own devices already seen. Device ids only, nothing secret; removed
// on sign-out (WEB-12).

export const ONBOARDED = "durio-e2ee-onboarded:";
export const SEEN_DEVICES = "durio-e2ee-seen-devices:";

/**
 * Forget the marks of a signed-out device
 * @param deviceId Session id
 */
export function forgetDeviceMarks(deviceId: string) {
  try {
    localStorage.removeItem(ONBOARDED + deviceId);
    localStorage.removeItem(SEEN_DEVICES + deviceId);
  } catch {
    // storage unavailable
  }
}
