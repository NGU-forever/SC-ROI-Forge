import type { RoiOp } from "@sc-roi/schema";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type SuggestedRoi = {
  id: string;
  label: string;
  category: string;
  norm: { x: number; y: number; w: number; h: number };
};

export type ChatMessagePayload = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRoiPayload = {
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

/** Multi-turn chat ROI ops (vision-only backend). */
export async function chatRois(input: {
  file: Blob;
  aspectRatio: string;
  messages: ChatMessagePayload[];
  rois: ChatRoiPayload[];
  apiKey: string;
}): Promise<{ message: string; ops: RoiOp[] }> {
  const fd = new FormData();
  fd.append("file", input.file, "shot.png");
  fd.append("aspect_ratio", input.aspectRatio);
  fd.append("messages", JSON.stringify(input.messages));
  fd.append("rois", JSON.stringify(input.rois));
  const r = await fetch(`${API_BASE}/v1/agent/chat-rois`, {
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
    throw new Error(detail || `chat failed (${r.status})`);
  }
  return (await r.json()) as { message: string; ops: RoiOp[] };
}
