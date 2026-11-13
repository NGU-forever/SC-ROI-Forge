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
  });
});
