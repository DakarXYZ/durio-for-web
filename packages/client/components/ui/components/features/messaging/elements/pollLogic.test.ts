import { describe, expect, it } from "vitest";

import type { API } from "stoat.js";

import { nextPicks, voterCount } from "./pollLogic";

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
  it("single choice: a click picks the answer, a click on the pick takes it back", () => {
    expect(nextPicks(poll(false), "me", "2")).toEqual(["2"]);
    expect(nextPicks(poll(false), "me", "0")).toEqual([]);
  });

  it("multiple choice: a click toggles the answer", () => {
    expect(nextPicks(poll(true), "me", "1")).toEqual(["0", "1"]);
    expect(nextPicks(poll(true), "me", "0")).toEqual([]);
  });

  it("counts voters, not votes", () => {
    expect(voterCount(poll(true))).toBe(3);
  });
});
