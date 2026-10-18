// Own devices as the "Devices and encryption" page lists them (dur.io, plan WEB-07,
// AN-30): a session is a device (C22), its E2EE keys say whether it is verified.
import type { E2eeDevice, E2eeUndeliveredDevice } from "stoat.js";

export type DeviceStatus =
  | "verified"
  | "unverified"
  | "blocked"
  /** A session without E2EE keys (an old app, or a bot) */
  | "none"
  /** Keys deleted on the server: the session is gone */
  | "removed";

export interface DeviceRow {
  /** Session id = device id */
  id: string;
  name?: string;
  createdAt?: Date;
  current: boolean;
  status: DeviceStatus;
  device?: E2eeDevice;
  /** Its mailbox stays full: it misses our keys */
  missesKeys: boolean;
}

/**
 * Status of a device
 * @param device E2EE device, if the session has keys
 */
export function deviceStatus(device: E2eeDevice | undefined): DeviceStatus {
  if (!device) return "none";
  if (device.deleted) return "removed";
  switch (device.trust) {
    case "Verified":
      return "verified";
    case "Blocked":
      return "blocked";
    default:
      return "unverified";
  }
}

/**
 * Sessions and E2EE devices of the user as one list: this device first, then the
 * newest; a device without a session (removed) at the end
 * @param sessions Sessions of the account
 * @param devices E2EE devices of the user
 * @param currentId This session
 * @param undelivered Devices that miss keys
 */
export function deviceRows(
  sessions: { id: string; name?: string; createdAt?: Date }[],
  devices: E2eeDevice[],
  currentId: string | undefined,
  undelivered: E2eeUndeliveredDevice[] = [],
): DeviceRow[] {
  const byId = new Map(devices.map((device) => [device.deviceId, device]));
  const missing = new Set(
    undelivered.filter((d) => d.gaveUp).map((d) => d.deviceId),
  );

  const rows: DeviceRow[] = sessions.map((session) => ({
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    current: session.id === currentId,
    status: deviceStatus(byId.get(session.id)),
    device: byId.get(session.id),
    missesKeys: missing.has(session.id),
  }));

  const known = new Set(sessions.map((session) => session.id));
  for (const device of devices) {
    if (known.has(device.deviceId) || device.deleted) continue;
    rows.push({
      id: device.deviceId,
      current: device.deviceId === currentId,
      status: deviceStatus(device),
      device,
      missesKeys: missing.has(device.deviceId),
    });
  }

  return rows.sort(
    (a, b) =>
      +b.current - +a.current ||
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  );
}

/**
 * Own devices that appeared since the last look and are not verified (banner "a new
 * device signed in")
 * @param devices Own E2EE devices
 * @param seen Ids seen before
 * @param currentId This device
 */
export function newUnverifiedDevices(
  devices: E2eeDevice[],
  seen: Set<string>,
  currentId: string,
): E2eeDevice[] {
  return devices.filter(
    (device) =>
      device.deviceId !== currentId &&
      !device.deleted &&
      device.trust === "Unverified" &&
      !seen.has(device.deviceId),
  );
}
