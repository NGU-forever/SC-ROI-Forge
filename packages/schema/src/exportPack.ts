import { tierResolutions, normToPx } from "./aspect";
import type { CalibrationPack, RoiInput } from "./types";

export function buildExportPack(input: {
  aspect_ratio: string;
  rois: RoiInput[];
}): CalibrationPack {
  const resolutions = tierResolutions(input.aspect_ratio);
  const rois = input.rois.map((roi) => ({
    ...roi,
    color: (roi.color ?? "#22c55e").toLowerCase(),
    px: {
      "1k": normToPx(roi.norm, resolutions["1k"].w, resolutions["1k"].h),
      "2k": normToPx(roi.norm, resolutions["2k"].w, resolutions["2k"].h),
      "4k": normToPx(roi.norm, resolutions["4k"].w, resolutions["4k"].h),
    },
  }));
  return {
    schema_version: "1.0",
    aspect_ratio: input.aspect_ratio,
    compliance: "vision_only",
    resolutions: { ...resolutions },
    rois,
  };
}
