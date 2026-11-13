import { useCallback, useEffect, useRef, useState } from "react";
import {
  ASPECT_PRESETS,
  applyRoiOps,
  detectAspectRatio,
  parseAspectRatio,
} from "@sc-roi/schema";
import { RoiStage } from "@/canvas/RoiStage";
import { useRoiStore } from "@/canvas/useRoiStore";
import { ChatPanel, type ChatMessage } from "@/chat/ChatPanel";
import { RoiInspectorBar } from "@/chat/RoiInspectorBar";
import { downloadPack } from "@/export/downloadPack";
import { chatRois } from "@/lib/api";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
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
      setMessages([]);
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
        const tag = document.activeElement?.tagName;
        if (selectedId && tag !== "INPUT" && tag !== "TEXTAREA") {
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

  const chatDisabledReason = !imageUrl
    ? "Import a screenshot first"
    : !apiKey.trim()
      ? "Set API key to enable"
      : undefined;

  const handleChatSend = async (text: string) => {
    if (!imageUrl || !apiKey.trim() || aiBusy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setAiBusy(true);
    try {
      const blob = await fetch(imageUrl).then((r) => r.blob());
      const payloadMessages = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const { message, ops } = await chatRois({
        file: blob,
        aspectRatio,
        messages: payloadMessages,
        rois: rois.map((r) => ({
          id: r.id,
          label: r.label,
          category: r.category,
          norm: r.norm,
        })),
        apiKey: apiKey.trim(),
      });
      const { rois: next, summary } = applyRoiOps(rois, ops);
      const withColors = next.map((r) => ({
        id: r.id,
        label: r.label,
        category: r.category,
        color: r.color ?? randomRoiColor(),
        norm: r.norm,
      }));
      const changed =
        withColors.length !== rois.length ||
        withColors.some((r, i) => {
          const cur = rois[i];
          return (
            !cur ||
            cur.id !== r.id ||
            cur.label !== r.label ||
            cur.category !== r.category ||
            cur.norm.x !== r.norm.x ||
            cur.norm.y !== r.norm.y ||
            cur.norm.w !== r.norm.w ||
            cur.norm.h !== r.norm.h
          );
        });
      if (changed) {
        pushRois(withColors);
        if (selectedId && !withColors.some((r) => r.id === selectedId)) {
          setSelectedId(null);
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message || (summary ? "Updated ROIs." : "Done."),
          opsSummary: summary || undefined,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : String(e),
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  };

  const selected = rois.find((r) => r.id === selectedId);

  return (
    <div className="mx-auto flex min-h-screen max-w-[90rem] flex-col gap-3 p-4 text-stone-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            SC-ROI Forge
          </h1>
          <p className="text-sm text-stone-500">Manual HUD ROI calibration</p>
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
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
            onClick={() => fileInputRef.current?.click()}
          >
            Import image
          </button>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            onClick={undo}
          >
            Undo
          </button>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            onClick={redo}
          >
            Redo
          </button>
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            disabled={!imageUrl || rois.length === 0}
            onClick={handleExport}
          >
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          LLM API key (local only)
          <input
            type="password"
            className="w-56 rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
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
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          Aspect preset
          <select
            className="rounded border border-stone-300 bg-white px-2 py-1.5 text-stone-900"
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
          <label className="flex flex-col gap-1 text-sm text-stone-700">
            Custom A:B
            <input
              className="w-28 rounded border border-stone-300 bg-white px-2 py-1.5 text-stone-900"
              value={customAspect}
              onChange={(e) => setCustomAspect(e.target.value)}
              onBlur={onCustomAspectBlur}
            />
          </label>
        )}
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            aspectMode === "detected"
              ? "bg-sky-100 text-sky-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {aspectMode === "detected" ? "detected" : "manual"} · {aspectRatio}
        </span>
        {detectedAspect && aspectMode === "manual" && (
          <button
            type="button"
            className="text-sm text-sky-700 underline"
            onClick={resetToDetected}
          >
            Reset to detected ({detectedAspect})
          </button>
        )}
        {aspectError && (
          <span className="text-sm text-red-600">{aspectError}</span>
        )}
        <span className="ml-auto text-xs text-stone-500">
          {rois.length} ROI(s) · Paste · Wheel zoom · Space/MMB pan · ⌘Z · Del
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[20rem_1fr]">
        <ChatPanel
          messages={messages}
          busy={aiBusy}
          disabled={!imageUrl || !apiKey.trim()}
          disabledReason={chatDisabledReason}
          onSend={handleChatSend}
        />
        <div className="relative min-h-[28rem]">
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
          {selected && (
            <RoiInspectorBar
              roi={selected}
              onPatchMeta={patchRoiMeta}
              onDelete={(id) => {
                removeRoi(id);
                setSelectedId(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
