import { describe, expect, it } from "vitest";

import {
  GroupCandidate,
  gridShape,
  intoGrids,
  pictureRuns,
} from "./pictureGroups";

const at = Date.UTC(2026, 9, 21, 12);

const msg = (
  id: string,
  over: Partial<GroupCandidate> = {},
): GroupCandidate => ({
  id,
  authorKey: "a",
  createdAt: at + Number(id) * 1000,
  visibleText: "",
  pictures: 1,
  otherFiles: 0,
  groupable: true,
  joinable: true,
  ...over,
});

describe("picture grids (dur.io)", () => {
  it("shapes grids by count", () => {
    const shapes = [1, 2, 3, 4, 5, 9, 10, 12].map((n) => {
      const { columns, rows } = gridShape(n);
      return `${columns}x${rows}`;
    });
    expect(shapes).toEqual([
      "1x1",
      "2x1",
      "2x2",
      "2x2",
      "3x2",
      "3x3",
      "3x4",
      "3x4",
    ]);
  });

  it("starts a new grid after 12", () => {
    const grids = intoGrids([...Array(26).keys()]);
    expect(grids.map((grid) => grid.length)).toEqual([12, 12, 2]);
  });

  it("joins picture-only messages of the same author", () => {
    const { runs, merged } = pictureRuns([
      msg("1", { visibleText: "my cats" }),
      msg("2"),
      msg("3", { pictures: 3 }),
      msg("4", { visibleText: "nice" }),
      msg("5"),
    ]);
    expect(runs.get("1")).toEqual(["2", "3"]);
    expect([...merged]).toEqual(["2", "3", "5"]);
    // "4" has text: its own message; "5" joins it
    expect(runs.get("4")).toEqual(["5"]);
  });

  it("breaks on another author, a gap, extras or a divider", () => {
    const { runs } = pictureRuns(
      [
        msg("1"),
        msg("2", { authorKey: "b" }),
        msg("3", { authorKey: "b", createdAt: at + 3000 + 420_000 }),
        msg("4", {
          authorKey: "b",
          createdAt: at + 3001 + 420_000,
          joinable: false,
        }),
        msg("5", {
          authorKey: "b",
          createdAt: at + 3002 + 420_000,
          otherFiles: 1,
        }),
        msg("6", { authorKey: "b", createdAt: at + 3003 + 420_000 }),
        msg("7", { authorKey: "b", createdAt: at + 3004 + 420_000 }),
      ],
      new Set(["7"]),
    );
    // "5" has a file besides its picture: it starts a grid "6" joins; "7" is past a divider
    expect([...runs]).toEqual([["5", ["6"]]]);
  });

  it("leaves a single picture alone", () => {
    const { runs } = pictureRuns([
      msg("1", { pictures: 5 }),
      msg("2", { pictures: 0, visibleText: "x" }),
    ]);
    expect(runs.size).toBe(0);
  });
});
