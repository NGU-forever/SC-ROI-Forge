import { normToPx, type RoiInput } from "@sc-roi/schema";

export async function renderAnnotatedPng(
  image: HTMLImageElement,
  rois: RoiInput[],
): Promise<Blob> {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  ctx.drawImage(image, 0, 0, w, h);

  const lineWidth = Math.max(2, Math.round(w / 500));
  const fontSize = Math.max(12, Math.round(w / 80));
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = "bottom";

  for (const roi of rois) {
    const color = (roi.color ?? "#22c55e").toLowerCase();
    const { x, y, w: rw, h: rh } = normToPx(roi.norm, w, h);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x, y, rw, rh);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x + lineWidth / 2, y + lineWidth / 2, rw - lineWidth, rh - lineWidth);

    const label = roi.label || roi.id;
    const labelY = Math.max(fontSize + 2, y - 4);
    ctx.fillStyle = color;
    ctx.fillText(label, x, labelY);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
}
