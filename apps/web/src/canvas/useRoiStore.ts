import type { Rect } from "@sc-roi/schema";
import { create } from "zustand";

export type Roi = {
  id: string;
  label: string;
  category: string;
  norm: Rect;
};

type State = {
  imageUrl: string | null;
  aspectRatio: string;
  rois: Roi[];
  past: Roi[][];
  future: Roi[][];
  setImageUrl: (url: string | null) => void;
  setAspectRatio: (a: string) => void;
  clearRois: () => void;
  pushRois: (rois: Roi[]) => void;
  addRoi: (roi: Roi) => void;
  updateRoi: (id: string, patch: Partial<Roi>) => void;
  patchRoiMeta: (id: string, patch: Partial<Pick<Roi, "label" | "category">>) => void;
  removeRoi: (id: string) => void;
  undo: () => void;
  redo: () => void;
};

export const useRoiStore = create<State>((set, get) => ({
  imageUrl: null,
  aspectRatio: "16:9",
  rois: [],
  past: [],
  future: [],
  setImageUrl: (imageUrl) => set({ imageUrl }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  clearRois: () => set({ rois: [], past: [], future: [] }),
  pushRois: (rois) => {
    const { rois: cur, past } = get();
    set({ past: [...past, cur], rois, future: [] });
  },
  addRoi: (roi) => get().pushRois([...get().rois, roi]),
  updateRoi: (id, patch) =>
    get().pushRois(
      get().rois.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    ),
  patchRoiMeta: (id, patch) =>
    set({
      rois: get().rois.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }),
  removeRoi: (id) => get().pushRois(get().rois.filter((r) => r.id !== id)),
  undo: () => {
    const { past, rois, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1]!;
    set({ past: past.slice(0, -1), rois: prev, future: [rois, ...future] });
  },
  redo: () => {
    const { past, rois, future } = get();
    if (!future.length) return;
    const [next, ...rest] = future;
    set({ past: [...past, rois], rois: next!, future: rest });
  },
}));
