const TIER_HEIGHTS = { "1k": 1080, "2k": 1440, "4k": 2160 } as const;

export function parseAspectRatio(s: string): { a: number; b: number; r: number } {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) throw new Error(`Invalid aspect ratio: ${s}`);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a <= 0 || b <= 0) throw new Error(`Invalid aspect ratio: ${s}`);
  return { a, b, r: a / b };
}

/** Known game/UI design aspects — layouts differ across these; do not mix. */
export const ASPECT_PRESETS = ["16:9", "16:10", "21:9", "32:9", "4:3"] as const;

export function detectAspectRatio(
  width: number,
  height: number,
  tolerance = 0.01,
): string {
  const r = width / height;
  let best: string | null = null;
  let bestErr = Infinity;
  for (const p of ASPECT_PRESETS) {
    const { r: pr } = parseAspectRatio(p);
    const err = Math.abs(r - pr) / pr;
    if (err < bestErr) {
      bestErr = err;
      best = p;
    }
  }
  if (best && bestErr <= tolerance) return best;
  const g = gcd(Math.round(width), Math.round(height));
  return `${Math.round(width) / g}:${Math.round(height) / g}`;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function tierResolutions(aspect: string) {
  const { r } = parseAspectRatio(aspect);
  return {
    "1k": { w: Math.round(TIER_HEIGHTS["1k"] * r), h: TIER_HEIGHTS["1k"] },
    "2k": { w: Math.round(TIER_HEIGHTS["2k"] * r), h: TIER_HEIGHTS["2k"] },
    "4k": { w: Math.round(TIER_HEIGHTS["4k"] * r), h: TIER_HEIGHTS["4k"] },
  } as const;
}

export function normToPx(
  norm: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
) {
  const clamp = (v: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(v)));
  const x = clamp(norm.x * width, width - 1);
  const y = clamp(norm.y * height, height - 1);
  const w = clamp(norm.w * width, width - x);
  const h = clamp(norm.h * height, height - y);
  return { x, y, w, h };
}
