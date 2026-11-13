import { normToPx, type RoiInput } from "@sc-roi/schema";

export type RoiTableRow = {
  id: string;
  label: string;
  category: string;
  color: string;
  norm_x: number;
  norm_y: number;
  norm_w: number;
  norm_h: number;
  px_x: number;
  px_y: number;
  px_w: number;
  px_h: number;
};

export const ROI_TABLE_COLUMNS: (keyof RoiTableRow)[] = [
  "id",
  "label",
  "category",
  "color",
  "norm_x",
  "norm_y",
  "norm_w",
  "norm_h",
  "px_x",
  "px_y",
  "px_w",
  "px_h",
];

export function buildRoiTableRows(
  rois: RoiInput[],
  imageW: number,
  imageH: number,
): RoiTableRow[] {
  return rois.map((roi) => {
    const px = normToPx(roi.norm, imageW, imageH);
    return {
      id: roi.id,
      label: roi.label,
      category: roi.category,
      color: (roi.color ?? "#22c55e").toLowerCase(),
      norm_x: roi.norm.x,
      norm_y: roi.norm.y,
      norm_w: roi.norm.w,
      norm_h: roi.norm.h,
      px_x: px.x,
      px_y: px.y,
      px_w: px.w,
      px_h: px.h,
    };
  });
}
