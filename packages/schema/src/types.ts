export type Tier = "1k" | "2k" | "4k";
export type Rect = { x: number; y: number; w: number; h: number };
export type RoiInput = {
  id: string;
  label: string;
  category: string;
  norm: Rect;
};
export type RoiExport = RoiInput & { px: Record<Tier, Rect> };
export type CalibrationPack = {
  schema_version: "1.0";
  aspect_ratio: string;
  compliance: "vision_only";
  resolutions: Record<Tier, { w: number; h: number }>;
  rois: RoiExport[];
};
