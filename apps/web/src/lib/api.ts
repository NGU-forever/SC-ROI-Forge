const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Task 4: cloud AI rough ROI suggestions */
export async function suggestRois(_imageBase64: string): Promise<never> {
  throw new Error("Suggest with AI — available in Task 4");
}
