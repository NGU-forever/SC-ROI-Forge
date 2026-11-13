import { describe, it, expect } from "vitest";
import { buildExportPack } from "../src/exportPack";

describe("buildExportPack", () => {
  it("fills compliance, resolutions, and px from norm", () => {
    const pack = buildExportPack({
      aspect_ratio: "16:9",
      rois: [
        {
          id: "a",
          label: "speed",
          category: "telemetry",
          norm: { x: 0.02, y: 0.85, w: 0.12, h: 0.08 },
        },
      ],
    });
    expect(pack.schema_version).toBe("1.0");
    expect(pack.compliance).toBe("vision_only");
    expect(pack.resolutions["1k"]).toEqual({ w: 1920, h: 1080 });
    expect(pack.rois[0].px["1k"]).toEqual({
      x: 38,
      y: 918,
      w: 230,
      h: 86,
    });
    expect(pack.rois[0].color).toBe("#22c55e");
  });

  it("passes through color and defaults when missing", () => {
    const withColor = buildExportPack({
      aspect_ratio: "16:9",
      rois: [
        {
          id: "a",
          label: "x",
          category: "ui",
          color: "#38BDF8",
          norm: { x: 0, y: 0, w: 0.1, h: 0.1 },
        },
      ],
    });
    expect(withColor.rois[0].color).toBe("#38bdf8");

    const noColor = buildExportPack({
      aspect_ratio: "16:9",
      rois: [
        {
          id: "b",
          label: "y",
          category: "ui",
          norm: { x: 0, y: 0, w: 0.1, h: 0.1 },
        },
      ],
    });
    expect(noColor.rois[0].color).toBe("#22c55e");
  });
});
