import { useCallback, useEffect, useRef, useState } from "react";
import { ASPECT_PRESETS, detectAspectRatio, parseAspectRatio } from "@sc-roi/schema";
import { RoiStage } from "@/canvas/RoiStage";
import { useRoiStore } from "@/canvas/useRoiStore";
import { downloadPack } from "@/export/downloadPack";
import { suggestRois } from "@/lib/api";
import { randomRoiColor } from "@/lib/roiColor";

const PRESET_OPTIONS = [...ASPECT_PRESETS, "custom"] as const;
const API_KEY_STORAGE = "sc-roi-llm-api-key";

function acceptImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return null;
  return URL.createObjectURL(file);
}

export default function App() {
  const {
    imageUrl,
    aspectRatio,
    rois,
    setImageUrl,
    setAspectRatio,
    clearRois,
    pushRois,
    addRoi,
    updateRoi,
    patchRoiMeta,
    removeRoi,
    undo,
    redo,
  } = useRoiStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detectedAspect, setDetectedAspect] = useState<string | null>(null);
  const [aspectMode, setAspectMode] = useState<"detected" | "manual">("detected");
  const [preset, setPreset] = useState<string>("16:9");
  const [customAspect, setCustomAspect] = useState("16:9");
  const [aspectError, setAspectError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) ?? "",
  );
  const [aiPrompt, setAiPrompt] = useState(
    "Roughly find HUD regions and propose labeled ROI boxes (norm 0..1).",
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastImageUrlRef = useRef<string | null>(null);

  const revokePrevious = useCallback((next: string | null) => {
    const prev = lastImageUrlRef.current;
    if (prev && prev !== next) URL.revokeObjectURL(prev);
    lastImageUrlRef.current = next;
  }, []);

  const loadImage = useCallback(
    (url: string) => {
      revokePrevious(url);
      clearRois();
      setSelectedId(null);
      setAspectMode("detected");
      setImageUrl(url);
    },
    [clearRois, revokePrevious, setImageUrl],
  );

  const onImageLoaded = useCallback(
    (w: number, h: number) => {
      const detected = detectAspectRatio(w, h);
      setDetectedAspect(detected);
      if (aspectMode === "detected") {
        setAspectRatio(detected);
        setPreset(
          (ASPECT_PRESETS as readonly string[]).includes(detected)
            ? detected
            : "custom",
        );
        if (!(ASPECT_PRESETS as readonly string[]).includes(detected)) {
          setCustomAspect(detected);
        }
      }
    },
    [aspectMode, setAspectRatio],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const url = acceptImageFile(file);
            if (url) loadImage(url);
          }
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadImage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && document.activeElement?.tagName !== "INPUT") {
          removeRoi(selectedId);
          setSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, removeRoi, selectedId]);

  const applyAspect = (value: string) => {
    try {
      parseAspectRatio(value);
      setAspectError(null);
      setAspectRatio(value);
      return true;
    } catch {
      setAspectError("Use format A:B (e.g. 21:9)");
      return false;
    }
  };

  const onPresetChange = (value: string) => {
    setPreset(value);
    setAspectMode("manual");
    if (value === "custom") {
      applyAspect(customAspect);
    } else {
      applyAspect(value);
    }
  };

  const onCustomAspectBlur = () => {
    setAspectMode("manual");
    setPreset("custom");
    applyAspect(customAspect);
  };

  const resetToDetected = () => {
    if (!detectedAspect) return;
    setAspectMode("detected");
    setPreset(
      (ASPECT_PRESETS as readonly string[]).includes(detectedAspect)
        ? detectedAspect
        : "custom",
    );
    if (!(ASPECT_PRESETS as readonly string[]).includes(detectedAspect)) {
      setCustomAspect(detectedAspect);
    }
    applyAspect(detectedAspect);
  };

  const handleExport = () => {
    downloadPack(
      aspectRatio,
      rois.map((r) => ({
        id: r.id,
        label: r.label,
        category: r.category,
        color: r.color,
        norm: r.norm,
      })),
    );
  };

  const selected = rois.find((r) => r.id === selectedId);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">SC-ROI Forge</h1>
          <p className="text-sm text-slate-400">Manual HUD ROI calibration</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = acceptImageFile(file);
                if (url) loadImage(url);
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500"
            onClick={() => fileInputRef.current?.click()}
          >
            Import image
          </button>
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
            onClick={undo}
          >
            Undo
          </button>
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
            onClick={redo}
          >
            Redo
          </button>
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
            disabled={!imageUrl || rois.length === 0}
            onClick={handleExport}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="rounded border border-violet-600 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-950/50 disabled:opacity-40"
            disabled={!imageUrl || !apiKey.trim() || aiBusy}
            title={!apiKey.trim() ? "Set API key to enable" : "Optional cloud AI"}
            onClick={async () => {
              if (!imageUrl) return;
              setAiBusy(true);
              setAiError(null);
              try {
                const blob = await fetch(imageUrl).then((r) => r.blob());
                const { rois: drafts } = await suggestRois({
                  file: blob,
                  prompt: aiPrompt,
                  aspectRatio,
                  apiKey: apiKey.trim(),
                });
                pushRois(
                  drafts.map((d) => ({
                    id: d.id,
                    label: d.label,
                    category: d.category,
                    color: randomRoiColor(),
                    norm: d.norm,
                  })),
                );
              } catch (e) {
                setAiError(e instanceof Error ? e.message : String(e));
              } finally {
                setAiBusy(false);
              }
            }}
          >
            {aiBusy ? "Suggesting…" : "Suggest with AI"}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            LLM API key (local only)
            <input
              type="password"
              className="w-56 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              value={apiKey}
              onChange={(e) => {
                const v = e.target.value;
                setApiKey(v);
                localStorage.setItem(API_KEY_STORAGE, v);
              }}
              placeholder="sk-…"
              autoComplete="off"
            />
          </label>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs text-slate-400">
            AI prompt
            <input
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          </label>
          {aiError && (
            <span className="max-w-md text-xs text-red-400">{aiError}</span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Aspect preset
          <select
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5"
            value={preset}
            onChange={(e) => onPresetChange(e.target.value)}
          >
            {PRESET_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === "custom" ? "Custom…" : p}
              </option>
            ))}
          </select>
        </label>
        {preset === "custom" && (
          <label className="flex flex-col gap-1 text-sm">
            Custom A:B
            <input
              className="w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1.5"
              value={customAspect}
              onChange={(e) => setCustomAspect(e.target.value)}
              onBlur={onCustomAspectBlur}
            />
          </label>
        )}
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            aspectMode === "detected"
              ? "bg-sky-900/60 text-sky-300"
              : "bg-amber-900/50 text-amber-200"
          }`}
        >
          {aspectMode === "detected" ? "detected" : "manual"} · {aspectRatio}
        </span>
        {detectedAspect && aspectMode === "manual" && (
          <button
            type="button"
            className="text-sm text-sky-400 underline"
            onClick={resetToDetected}
          >
            Reset to detected ({detectedAspect})
          </button>
        )}
        {aspectError && (
          <span className="text-sm text-red-400">{aspectError}</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <RoiStage
          imageUrl={imageUrl}
          aspectRatio={aspectRatio}
          rois={rois}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onImageLoaded={onImageLoaded}
          onAddRoi={addRoi}
          onUpdateRoi={updateRoi}
        />
        <aside className="flex flex-col gap-3 rounded border border-slate-800 bg-slate-900/40 p-3 text-sm">
          <h2 className="font-medium text-slate-300">Selection</h2>
          {selected ? (
            <>
              <label className="flex flex-col gap-1">
                Label
                <input
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1"
                  value={selected.label}
                  onChange={(e) =>
                    patchRoiMeta(selected.id, { label: e.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                Category
                <input
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1"
                  value={selected.category}
                  onChange={(e) =>
                    patchRoiMeta(selected.id, { category: e.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                Color
                <input
                  type="color"
                  className="h-9 w-full cursor-pointer rounded border border-slate-600 bg-slate-950"
                  value={selected.color}
                  onChange={(e) =>
                    patchRoiMeta(selected.id, { color: e.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="mt-1 rounded border border-red-800 py-1 text-red-300 hover:bg-red-950/40"
                onClick={() => {
                  removeRoi(selected.id);
                  setSelectedId(null);
                }}
              >
                Delete ROI
              </button>
            </>
          ) : (
            <p className="text-slate-500">
              Drag on the canvas to draw a box. Click a box to edit.
            </p>
          )}
          <div className="mt-auto border-t border-slate-800 pt-3 text-xs text-slate-500">
            <p>{rois.length} ROI(s)</p>
            <p className="mt-1">
              Paste · Wheel zoom · Space/MMB pan · Ctrl/Cmd+Z · Del
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
