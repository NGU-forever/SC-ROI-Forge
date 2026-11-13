import type { Rect } from "./types";

export type RoiLike = {
  id: string;
  label: string;
  category: string;
  color?: string;
  norm: Rect;
};

export type RoiOp = {
  op: "add" | "update" | "delete";
  id?: string;
  label?: string;
  category?: string;
  norm?: Rect;
  color?: string;
};

function newRoiId(addIndex: number): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `roi_${uuid}` : `roi_${Date.now()}_${addIndex}`;
}

export function applyRoiOps(
  rois: RoiLike[],
  ops: RoiOp[],
): { rois: RoiLike[]; skippedIds: string[]; summary: string } {
  let next = rois.map((r) => ({ ...r, norm: { ...r.norm } }));
  const skippedIds: string[] = [];
  let add = 0;
  let update = 0;
  let del = 0;

  for (const op of ops) {
    if (op.op === "add") {
      if (!op.label || !op.norm) continue;
      const id = op.id || newRoiId(add);
      next.push({
        id,
        label: op.label,
        category: op.category || "ui",
        color: op.color,
        norm: { ...op.norm },
      });
      add++;
    } else if (op.op === "update") {
      if (!op.id) continue;
      const i = next.findIndex((r) => r.id === op.id);
      if (i < 0) {
        skippedIds.push(op.id);
        continue;
      }
      const cur = next[i]!;
      next[i] = {
        ...cur,
        label: op.label ?? cur.label,
        category: op.category ?? cur.category,
        norm: op.norm ? { ...op.norm } : cur.norm,
        color: op.color ?? cur.color,
      };
      update++;
    } else if (op.op === "delete") {
      if (!op.id) continue;
      const before = next.length;
      next = next.filter((r) => r.id !== op.id);
      if (next.length === before) skippedIds.push(op.id);
      else del++;
    }
  }

  const parts: string[] = [];
  if (add) parts.push(`+${add}`);
  if (update) parts.push(`update×${update}`);
  if (del) parts.push(`delete×${del}`);
  return { rois: next, skippedIds, summary: parts.join(" · ") };
}
