import { describe, it, expect } from "vitest";
import { tierResolutions, parseAspectRatio, detectAspectRatio } from "../src/aspect";

describe("tierResolutions", () => {
  it("16:9 matches FHD/QHD/UHD", () => {
    expect(tierResolutions("16:9")).toEqual({
      "1k": { w: 1920, h: 1080 },
      "2k": { w: 2560, h: 1440 },
      "4k": { w: 3840, h: 2160 },
    });
  });

  it("21:9 uses height-aligned formula", () => {
    expect(tierResolutions("21:9")).toEqual({
      "1k": { w: 2520, h: 1080 },
      "2k": { w: 3360, h: 1440 },
      "4k": { w: 5040, h: 2160 },
    });
  });
});

describe("parseAspectRatio", () => {
  it("parses A:B", () => {
    expect(parseAspectRatio("16:10").r).toBeCloseTo(1.6);
  });
});

describe("detectAspectRatio", () => {
  it("snaps 1920x1080 to 16:9", () => {
    expect(detectAspectRatio(1920, 1080)).toBe("16:9");
  });
  it("snaps 2520x1080 to 21:9", () => {
    expect(detectAspectRatio(2520, 1080)).toBe("21:9");
  });
  it("snaps 1920x1200 to 16:10", () => {
    expect(detectAspectRatio(1920, 1200)).toBe("16:10");
  });
});
