import { buildExportPack, type RoiInput } from "@sc-roi/schema";
import JSZip from "jszip";
import { renderAnnotatedPng } from "./annotatedPng";
import { rowsToCsv } from "./csv";
import { buildRoiTableRows } from "./tableRows";
import { rowsToXlsx } from "./xlsx";

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadExportZip(input: {
  aspect_ratio: string;
  rois: RoiInput[];
  image: HTMLImageElement;
}): Promise<void> {
  const pack = buildExportPack({
    aspect_ratio: input.aspect_ratio,
    rois: input.rois,
  });
  const rows = buildRoiTableRows(
    input.rois,
    input.image.naturalWidth,
    input.image.naturalHeight,
  );

  const zip = new JSZip();
  zip.file("calibration.json", JSON.stringify(pack, null, 2));
  zip.file("rois.csv", rowsToCsv(rows));
  zip.file("rois.xlsx", await rowsToXlsx(rows));
  zip.file("annotated.png", await renderAnnotatedPng(input.image, input.rois));

  const blob = await zip.generateAsync({ type: "blob" });
  const name = `sc-roi-${input.aspect_ratio.replace(":", "x")}.zip`;
  triggerDownload(blob, name);
}

/** Load an HTMLImageElement from a blob/object URL. */
export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for export"));
    img.src = src;
  });
}
