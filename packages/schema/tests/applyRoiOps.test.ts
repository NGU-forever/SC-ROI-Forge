import { describe, expect, it } from "vitest";
import { applyRoiOps } from "../src/applyRoiOps";

const base = [
  {
    id: "a",
    label: "speed",
    category: "ui",
    color: "#22c55e",
    norm: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
  },
];

describe("applyRoiOps", () => {
  it("adds, updates, deletes and skips unknown ids", () => {
    const { rois, skippedIds, summary } = applyRoiOps(base, [
      { op: "update", id: "a", label: "velocity" },
      {
        op: "add",
        id: "b",
        label: "radar",
        category: "sensors",
        norm: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      },
      { op: "delete", id: "missing" },
      { op: "delete", id: "a" },
    ]);
    expect(rois.map((r) => r.id)).toEqual(["b"]);
    expect(rois[0]!.label).toBe("radar");
    expect(skippedIds).toEqual(["missing"]);
    expect(summary).toBe("+1 · update×1 · delete×1");
  });

  it("empty ops leaves list unchanged", () => {
    const { rois, summary } = applyRoiOps(base, []);
    expect(rois).toEqual(base);
    expect(summary).toBe("");
  });
});
