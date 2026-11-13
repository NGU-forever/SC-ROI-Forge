import { describe, expect, it } from "vitest";
import { rowsToCsv } from "./csv";
import { buildRoiTableRows, ROI_TABLE_COLUMNS } from "./tableRows";

describe("buildRoiTableRows", () => {
  it("maps norm to original image px via normToPx", () => {
    const rows = buildRoiTableRows(
      [
        {
          id: "a",
          label: "Health",
          category: "hud",
          color: "#FF0000",
          norm: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        },
      ],
      1920,
      1080,
    );
    expect(rows[0].color).toBe("#ff0000");
    expect(rows[0].px_x).toBe(Math.round(0.1 * 1920));
    expect(rows[0].norm_x).toBe(0.1);
  });

  it("defaults missing color to #22c55e", () => {
    const rows = buildRoiTableRows(
      [
        {
          id: "b",
          label: "x",
          category: "g",
          norm: { x: 0, y: 0, w: 0.1, h: 0.1 },
        },
      ],
      100,
      100,
    );
    expect(rows[0].color).toBe("#22c55e");
  });
});

describe("rowsToCsv", () => {
  it("includes BOM, header, and escapes quotes", () => {
    const rows = buildRoiTableRows(
      [
        {
          id: "1",
          label: 'say "hi"',
          category: "g",
          color: "#aabbcc",
          norm: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
      10,
      10,
    );
    const csv = rowsToCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(ROI_TABLE_COLUMNS.join(","));
    expect(csv).toContain('"say ""hi"""');
  });
});
