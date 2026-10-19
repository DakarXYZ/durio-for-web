import type { E2eeSasState } from "stoat.js";
import { describe, expect, it, vi } from "vitest";

import { isNewer } from "../../coreVersion";
import { deviceRows, newUnverifiedDevices } from "./devices";
import {
  MAX_KEY_FILE_BYTES,
  canExport,
  keyFileFailure,
  keyFileName,
  passphraseStrength,
  readKeyFile,
} from "./keyFiles";
import {
  activateWithMfa,
  onboardingPrompt,
  recoveryFailure,
  turnOffWithMfa,
} from "./recovery";
import { composeReport, fingerprintGroups, reportFileName } from "./report";
import { SAS_EMOJI_RU, sasEmojiName, sasView } from "./sas";

const coreError = (code: string) => Object.assign(new Error(code), { code });

describe("key file passphrases (CR-21)", () => {
  it("needs at least 10 characters and some variety", () => {
    expect(passphraseStrength("short")).toBe("tooShort");
    expect(passphraseStrength("aaaaaaaaaaaa")).toBe("weak");
    expect(passphraseStrength("abcdefghijk")).toBe("weak");
    expect(passphraseStrength("abcdefgh1234")).toBe("fair");
    expect(passphraseStrength("Abcdefgh12!x")).toBe("strong");
    expect(passphraseStrength("four words to remember")).toBe("strong");
    // code points, not UTF-16 units
    expect(passphraseStrength("😀😀😀😀😀")).toBe("tooShort");
  });

  it("exports only with equal entries of at least fair strength", () => {
    expect(canExport("abcdefgh1234", "abcdefgh1234")).toBe(true);
    expect(canExport("abcdefgh1234", "abcdefgh123")).toBe(false);
    expect(canExport("aaaaaaaaaaaa", "aaaaaaaaaaaa")).toBe(false);
  });

  it("names failures apart", () => {
    expect(keyFileFailure("WrongPassphrase", false)).toBe("wrongPassphrase");
    expect(keyFileFailure("InvalidKeyFile", false)).toBe("invalidFile");
    expect(keyFileFailure("InvalidKeyFile", true)).toBe("tooManySessions");
    expect(keyFileFailure("Unavailable", true)).toBe("noDevice");
    expect(keyFileFailure(undefined, false)).toBe("other");
  });

  it("refuses files over 64 MiB before reading them", async () => {
    const huge = { size: MAX_KEY_FILE_BYTES + 1, text: vi.fn() };
    expect(await readKeyFile(huge as never)).toEqual({ failure: "tooLarge" });
    expect(huge.text).not.toHaveBeenCalled();
    expect(await readKeyFile(new Blob(["file"]))).toEqual({ text: "file" });
  });

  it("offers dated file names", () => {
    const day = new Date("2026-10-18T12:00:00Z");
    expect(keyFileName(day)).toBe("dur.io-keys-2026-10-18.txt");
    expect(reportFileName(day)).toBe(
      "dur.io-diagnostics-2026-10-18T12-00-00Z.txt",
    );
  });
});

describe("backup activation with MFA (AN-32)", () => {
  it("asks for the ticket up front when a backup may exist", async () => {
    const activate = vi.fn(async () => undefined);
    const requestTicket = vi.fn(async () => "T");
    for (const existsOnServer of [true, undefined]) {
      expect(
        await activateWithMfa({
          rotate: false,
          existsOnServer,
          activate,
          requestTicket,
        }),
      ).toBe("done");
    }
    expect(requestTicket).toHaveBeenCalledTimes(2);
    expect(activate).toHaveBeenCalledWith("T");
  });

  it("always asks for a rotation", async () => {
    const requestTicket = vi.fn(async () => "T");
    await activateWithMfa({
      rotate: true,
      existsOnServer: false,
      activate: async () => undefined,
      requestTicket,
    });
    expect(requestTicket).toHaveBeenCalledOnce();
  });

  it("goes without a ticket when there is no backup, asks when one appeared", async () => {
    const activate = vi
      .fn<(ticket?: string) => Promise<void>>()
      .mockRejectedValueOnce(coreError("MfaRequired"))
      .mockResolvedValueOnce(undefined);
    const requestTicket = vi.fn(async () => "T");
    expect(
      await activateWithMfa({
        rotate: false,
        existsOnServer: false,
        activate,
        requestTicket,
      }),
    ).toBe("done");
    expect(activate.mock.calls).toEqual([[undefined], ["T"]]);
  });

  it("stops when the user cancels the prompt, rethrows other errors", async () => {
    expect(
      await activateWithMfa({
        rotate: true,
        existsOnServer: true,
        activate: async () => undefined,
        requestTicket: async () => undefined,
      }),
    ).toBe("cancelled");

    await expect(
      activateWithMfa({
        rotate: false,
        existsOnServer: true,
        activate: async () => {
          throw coreError("MfaRequired");
        },
        requestTicket: async () => "T",
      }),
    ).rejects.toMatchObject({ code: "MfaRequired" });
  });

  it("maps failures for the UI", () => {
    expect(recoveryFailure(coreError("RecoveryKeyTypo"))).toBe("typo");
    expect(recoveryFailure(coreError("WrongRecoveryKey"))).toBe("wrongKey");
    expect(recoveryFailure(coreError("NoBackup"))).toBe("noBackup");
    expect(recoveryFailure(coreError("BackupKeyMismatch"))).toBe("mismatch");
    expect(recoveryFailure(coreError("RequestFailed"))).toBe("network");
    expect(recoveryFailure(new Error("x"))).toBe("other");
  });

  it("prompts a new device like Android", () => {
    const base = { ownDevices: 0, backupOnThisDevice: false };
    expect(onboardingPrompt({ ...base, backupOnServer: false })).toBe(
      "setUpRecovery",
    );
    expect(onboardingPrompt({ ...base, backupOnServer: true })).toBe(
      "newDevice",
    );
    expect(
      onboardingPrompt({ ...base, ownDevices: 1, backupOnServer: false }),
    ).toBe("newDevice");
    expect(
      onboardingPrompt({
        ownDevices: 2,
        backupOnThisDevice: true,
        backupOnServer: true,
      }),
    ).toBeUndefined();
  });
});

describe("SAS dialog (CR-11)", () => {
  it("maps every state of the flow to a step and the user's actions", () => {
    expect(sasView({ type: "Requested" })).toEqual({
      step: "requested",
      actions: ["cancel"],
      final: false,
    });
    expect(sasView({ type: "Incoming" }).actions).toEqual(["cancel", "accept"]);
    expect(sasView({ type: "Ready" }).actions).toEqual(["cancel", "start"]);
    expect(sasView({ type: "Started" }).step).toBe("waiting");
    expect(
      sasView({ type: "ShowCodes", emoji: [], decimals: [1, 2, 3] }),
    ).toEqual({
      step: "compare",
      actions: ["mismatch", "confirm"],
      final: false,
    });
    expect(sasView({ type: "Confirmed" }).step).toBe("confirmed");
    expect(sasView({ type: "Done" })).toEqual({
      step: "done",
      actions: [],
      final: true,
    });
    const cancelled = (reason: "Mismatch" | "Timeout" | "User") =>
      sasView({ type: "Cancelled", reason, code: "c", byUs: false }).step;
    expect(cancelled("Mismatch")).toBe("mismatch");
    expect(cancelled("Timeout")).toBe("timeout");
    expect(cancelled("User")).toBe("cancelled");
  });

  it("never offers Verified outside the flow: no step has a trust action", () => {
    const states: E2eeSasState[] = [
      { type: "Requested" },
      { type: "Incoming" },
      { type: "Ready" },
      { type: "Started" },
      { type: "ShowCodes", emoji: [], decimals: [] },
      { type: "Confirmed" },
      { type: "Done" },
    ];
    for (const state of states)
      for (const action of sasView(state).actions)
        expect(["accept", "start", "confirm", "mismatch", "cancel"]).toContain(
          action,
        );
  });

  it("names the 64 emoji in Russian and English", () => {
    expect(SAS_EMOJI_RU).toHaveLength(64);
    expect(sasEmojiName({ index: 0, description: "Dog" }, "ru")).toBe("Собака");
    expect(sasEmojiName({ index: 34, description: "Spanner" }, "ru")).toBe(
      "Гаечный ключ",
    );
    expect(sasEmojiName({ index: 63, description: "Pin" }, "ru")).toBe(
      "Булавка",
    );
    expect(sasEmojiName({ index: 0, description: "Dog" }, "en")).toBe("Dog");
  });
});

describe("devices and report (AN-30, CR-22)", () => {
  const device = (deviceId: string, trust = "Unverified", deleted = false) =>
    ({
      userId: "U",
      deviceId,
      ed25519: "k",
      trust,
      deleted,
    }) as never;

  it("lists sessions as devices, this one first, then the newest", () => {
    const rows = deviceRows(
      [
        { id: "A", name: "old", createdAt: new Date(1) },
        { id: "B", name: "new", createdAt: new Date(3) },
        { id: "C", name: "me", createdAt: new Date(2) },
        { id: "D", name: "bot-ish", createdAt: new Date(0) },
      ],
      [device("A", "Verified"), device("B"), device("C"), device("E")],
      "C",
      [{ userId: "U", deviceId: "B", attempts: 5, gaveUp: true }],
    );
    expect(rows.map((r) => [r.id, r.status, r.missesKeys])).toEqual([
      ["C", "unverified", false],
      ["B", "unverified", true],
      ["A", "verified", false],
      ["D", "none", false],
      ["E", "unverified", false],
    ]);
  });

  it("finds new unverified own devices", () => {
    const fresh = newUnverifiedDevices(
      [
        device("A"),
        device("B"),
        device("C", "Verified"),
        device("D", "Unverified", true),
        device("ME"),
      ],
      new Set(["A"]),
      "ME",
    );
    expect(fresh.map((d: { deviceId: string }) => d.deviceId)).toEqual(["B"]);
  });

  it("composes a report without addresses", () => {
    const text = composeReport(
      {
        version: "0.16.3",
        build: "desktop",
        desktop: "1.5.4",
        userAgentPlatform: "Win32",
        coreVersion: "0.2.0",
        e2eeStatus: "ready",
        syncProblem: true,
        accounts: 2,
      },
      '{"core_version":"0.2.0"}',
      new Date("2026-10-18T12:00:00.123Z"),
    );
    expect(text).toContain("dur.io diagnostic report");
    expect(text).toContain("created: 2026-10-18T12:00:00Z");
    expect(text).toContain("e2ee status: ready, sync problem");
    expect(text).not.toMatch(/https?:\/\//);
    expect(
      composeReport({ ...JSON.parse("{}"), accounts: 0 }, undefined),
    ).toContain("unavailable");
  });

  it("groups a fingerprint by four", () => {
    expect(fingerprintGroups("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
  });
});

describe("store written by a newer core (CR-23)", () => {
  it("compares versions numerically", () => {
    expect(isNewer(undefined, "0.2.0")).toBe(false);
    expect(isNewer("0.2.0", "0.2.0")).toBe(false);
    expect(isNewer("0.10.0", "0.9.9")).toBe(true);
    expect(isNewer("0.2.1", "0.3.0")).toBe(false);
    expect(isNewer("1.0", "0.99.0")).toBe(true);
  });
});

describe("turning the key backup off", () => {
  it("asks for a ticket when the server has a backup (or might)", async () => {
    for (const existsOnServer of [true, undefined]) {
      const turnOff = vi.fn(async (_ticket?: string) => undefined);
      const requestTicket = vi.fn(async () => "T");
      expect(
        await turnOffWithMfa({ existsOnServer, turnOff, requestTicket }),
      ).toBe("done");
      expect(requestTicket).toHaveBeenCalledOnce();
      expect(turnOff).toHaveBeenCalledWith("T");
    }
  });

  it("turns off without a ticket when the server has none", async () => {
    const turnOff = vi.fn(async (_ticket?: string) => undefined);
    const requestTicket = vi.fn(async () => "T");
    await turnOffWithMfa({ existsOnServer: false, turnOff, requestTicket });
    expect(requestTicket).not.toHaveBeenCalled();
    expect(turnOff).toHaveBeenCalledWith(undefined);
  });

  it("does nothing when the password prompt is cancelled", async () => {
    const turnOff = vi.fn(async (_ticket?: string) => undefined);
    expect(
      await turnOffWithMfa({
        existsOnServer: true,
        turnOff,
        requestTicket: async () => undefined,
      }),
    ).toBe("cancelled");
    expect(turnOff).not.toHaveBeenCalled();
  });

  it("asks when a backup appeared meanwhile", async () => {
    const turnOff = vi
      .fn<(ticket?: string) => Promise<void>>()
      .mockRejectedValueOnce(coreError("MfaRequired"))
      .mockResolvedValueOnce(undefined);
    const requestTicket = vi.fn(async () => "T");
    expect(
      await turnOffWithMfa({ existsOnServer: false, turnOff, requestTicket }),
    ).toBe("done");
    expect(turnOff).toHaveBeenLastCalledWith("T");
  });
});
