import { parseAspectRatio } from "@sc-roi/schema";

const BASE_HEIGHT = 720;

export function stageSize(aspectRatio: string): { width: number; height: number } {
  const { r } = parseAspectRatio(aspectRatio);
  return { width: Math.round(BASE_HEIGHT * r), height: BASE_HEIGHT };
}

export function normFromStage(
  x: number,
  y: number,
  w: number,
  h: number,
  stageW: number,
  stageH: number,
) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  return {
    x: clamp01(x / stageW),
    y: clamp01(y / stageH),
    w: clamp01(w / stageW),
    h: clamp01(h / stageH),
  };
}

export function stageFromNorm(
  norm: { x: number; y: number; w: number; h: number },
  stageW: number,
  stageH: number,
) {
  return {
    x: norm.x * stageW,
    y: norm.y * stageH,
    width: norm.w * stageW,
    height: norm.h * stageH,
  };
}
