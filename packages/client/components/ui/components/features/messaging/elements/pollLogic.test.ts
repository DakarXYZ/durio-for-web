import { describe, expect, it } from "vitest";

import type { API } from "stoat.js";

import {
  myPicks,
  samePicks,
  togglePick,
  voteCount,
  voterCount,
} from "./pollLogic";

const poll = (multiple: boolean): API.Poll => ({
  question: "Where?",
  multiple,
  answers: [
    { id: "0", text: "Park", votes: ["me", "a"] },
    { id: "1", text: "Cafe", votes: ["a", "b"] },
    { id: "2", text: "Online", votes: [] },
  ],
});

describe("polls", () => {
  it("knows the user's picks", () => {
    expect(myPicks(poll(false), "me")).toEqual(["0"]);
    expect(myPicks(poll(false), "c")).toEqual([]);
  });

  it("single choice: a click picks the answer, a click on the pick takes it back", () => {
    expect(togglePick(poll(false), ["0"], "2")).toEqual(["2"]);
    expect(togglePick(poll(false), ["0"], "0")).toEqual([]);
  });

  it("multiple choice: a click toggles the answer", () => {
    expect(togglePick(poll(true), ["0"], "1")).toEqual(["0", "1"]);
    expect(togglePick(poll(true), ["0"], "0")).toEqual([]);
  });

  it("compares picks regardless of order", () => {
    expect(samePicks(["0", "2"], ["2", "0"])).toBe(true);
    expect(samePicks(["0"], ["0", "2"])).toBe(false);
  });

  it("counts voters and votes", () => {
    expect(voterCount(poll(true))).toBe(3);
    expect(voteCount(poll(true))).toBe(4);
  });
});
