import type { Roi } from "@/canvas/useRoiStore";

type Props = {
  roi: Roi;
  onPatchMeta: (
    id: string,
    patch: Partial<Pick<Roi, "label" | "category" | "color">>,
  ) => void;
  onDelete: (id: string) => void;
};

export function RoiInspectorBar({ roi, onPatchMeta, onDelete }: Props) {
  return (
    <div className="pointer-events-auto absolute inset-x-4 bottom-3 z-10 mx-auto flex max-w-2xl flex-wrap items-end gap-2 rounded-lg border border-sky-300 bg-white/95 p-2 shadow-md backdrop-blur-sm">
      <label className="flex min-w-[7rem] flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-stone-500">
        Label
        <input
          className="rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900"
          value={roi.label}
          onChange={(e) => onPatchMeta(roi.id, { label: e.target.value })}
        />
      </label>
      <label className="flex min-w-[7rem] flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-stone-500">
        Category
        <input
          className="rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900"
          value={roi.category}
          onChange={(e) => onPatchMeta(roi.id, { category: e.target.value })}
        />
      </label>
      <label className="flex w-16 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-stone-500">
        Color
        <input
          type="color"
          className="h-8 w-full cursor-pointer rounded border border-stone-300 bg-white"
          value={roi.color}
          onChange={(e) => onPatchMeta(roi.id, { color: e.target.value })}
        />
      </label>
      <button
        type="button"
        className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
        onClick={() => onDelete(roi.id)}
      >
        Delete
      </button>
    </div>
  );
}
