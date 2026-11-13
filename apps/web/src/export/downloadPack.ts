import { buildExportPack, type RoiInput } from "@sc-roi/schema";

export function downloadPack(aspect_ratio: string, rois: RoiInput[]) {
  const pack = buildExportPack({ aspect_ratio, rois });
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `sc-roi-${aspect_ratio.replace(":", "x")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
