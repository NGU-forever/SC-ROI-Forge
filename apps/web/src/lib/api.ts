const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type SuggestedRoi = {
  id: string;
  label: string;
  category: string;
  norm: { x: number; y: number; w: number; h: number };
};

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Cloud AI rough ROI suggestions (vision-only backend). */
export async function suggestRois(input: {
  file: Blob;
  prompt: string;
  aspectRatio: string;
  apiKey: string;
}): Promise<{ rois: SuggestedRoi[] }> {
  const fd = new FormData();
  fd.append("file", input.file, "shot.png");
  fd.append("prompt", input.prompt);
  fd.append("aspect_ratio", input.aspectRatio);
  const r = await fetch(`${API_BASE}/v1/agent/suggest-rois`, {
    method: "POST",
    headers: { "X-API-Key": input.apiKey },
    body: fd,
  });
  if (!r.ok) {
    let detail = await r.text();
    try {
      const j = JSON.parse(detail) as { detail?: string };
      if (j.detail) detail = j.detail;
    } catch {
      /* keep text */
    }
    throw new Error(detail || `suggest failed (${r.status})`);
  }
  return (await r.json()) as { rois: SuggestedRoi[] };
}
