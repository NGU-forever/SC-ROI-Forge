import { useCallback, useEffect, useRef, useState } from "react";
import { ASPECT_PRESETS, detectAspectRatio, parseAspectRatio } from "@sc-roi/schema";
import { RoiStage } from "@/canvas/RoiStage";
import { useRoiStore } from "@/canvas/useRoiStore";
import { downloadPack } from "@/export/downloadPack";
import { useI18n, type Locale } from "@/i18n";
import { suggestRois } from "@/lib/api";

const PRESET_OPTIONS = [...ASPECT_PRESETS, "custom"] as const;
const API_KEY_STORAGE = "sc-roi-llm-api-key";

const btnPrimary =
  "rounded bg-sky-600 px-2.5 py-1 text-sm font-medium hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-40";
const btnSecondary =
  "rounded border border-slate-600 px-2.5 py-1 text-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-40";
const btnExport =
  "rounded bg-emerald-600 px-2.5 py-1 text-sm font-medium hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-40";
const btnAi =
  "rounded border border-cyan-700/80 px-2.5 py-1 text-sm text-cyan-100 hover:bg-cyan-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-40";
const fieldCompact =
  "rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400";

function acceptImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return null;
  return URL.createObjectURL(file);
}

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const set = (next: Locale) => () => setLocale(next);
  return (
    <div
      className="inline-flex overflow-hidden rounded border border-slate-600 text-xs"
      role="group"
      aria-label={t("langSwitchAria")}
    >
      <button
        type="button"
        className={`px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
          locale === "en"
            ? "bg-slate-700 text-white"
            : "bg-slate-900 text-slate-400 hover:text-slate-200"
        }`}
        aria-pressed={locale === "en"}
        onClick={set("en")}
      >
        {t("langEn")}
      </button>
      <button
        type="button"
        className={`px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
          locale === "zh"
            ? "bg-slate-700 text-white"
            : "bg-slate-900 text-slate-400 hover:text-slate-200"
        }`}
        aria-pressed={locale === "zh"}
        onClick={set("zh")}
      >
        {t("langZh")}
      </button>
    </div>
  );
}

export default function App() {
  const { t, messages } = useI18n();
  const {
    imageUrl,
    aspectRatio,
    rois,
    past,
    future,
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
  const [aiPromptDraft, setAiPromptDraft] = useState<string | null>(null);
  const aiPrompt = aiPromptDraft ?? messages.aiPromptDefault;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
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
        const tag = document.activeElement?.tagName;
        if (
          selectedId &&
          tag !== "INPUT" &&
          tag !== "TEXTAREA" &&
          tag !== "SELECT"
        ) {
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
      setAspectError(t("aspectError"));
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
        norm: r.norm,
      })),
    );
  };

  const runSuggest = async () => {
    if (!imageUrl) return;
    if (!apiKey.trim()) {
      setAiOpen(true);
      return;
    }
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
          norm: d.norm,
        })),
      );
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
      setAiOpen(true);
    } finally {
      setAiBusy(false);
    }
  };

  const selected = rois.find((r) => r.id === selectedId);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return (
    <div className="mx-auto flex h-dvh max-w-[90rem] flex-col overflow-hidden px-3 pb-3 pt-2">
      <header className="shrink-0 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 shrink-0">
            <h1 className="text-base font-semibold leading-tight tracking-tight text-slate-100">
              {t("appTitle")}
            </h1>
            <p className="hidden text-[11px] leading-tight text-slate-500 sm:block">
              {t("appSubtitle")}
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 border-l border-slate-800 pl-3"
            aria-label={t("aspectPreset")}
          >
            <span className="text-xs text-slate-500">{t("aspectPreset")}</span>
            <select
              className={fieldCompact}
              value={preset}
              onChange={(e) => onPresetChange(e.target.value)}
            >
              {PRESET_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p === "custom" ? t("customOption") : p}
                </option>
              ))}
            </select>
            {preset === "custom" && (
              <input
                className={`${fieldCompact} w-20`}
                aria-label={t("customAspect")}
                value={customAspect}
                onChange={(e) => setCustomAspect(e.target.value)}
                onBlur={onCustomAspectBlur}
              />
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                aspectMode === "detected"
                  ? "bg-sky-900/60 text-sky-300"
                  : "bg-amber-900/50 text-amber-200"
              }`}
            >
              {aspectMode === "detected" ? t("aspectDetected") : t("aspectManual")} ·{" "}
              {aspectRatio}
            </span>
            {detectedAspect && aspectMode === "manual" && (
              <button
                type="button"
                className="rounded border border-sky-800 px-1.5 py-0.5 text-[11px] text-sky-300 hover:bg-sky-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={resetToDetected}
              >
                {t("resetToDetected", { aspect: detectedAspect })}
              </button>
            )}
            {aspectError && (
              <span className="text-xs text-red-400" role="alert">
                {aspectError}
              </span>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <LanguageSwitcher />
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
              className={btnPrimary}
              onClick={() => fileInputRef.current?.click()}
            >
              {t("importImage")}
            </button>
            <span className="mx-0.5 hidden h-4 w-px bg-slate-700 sm:inline-block" aria-hidden />
            <button
              type="button"
              className={btnSecondary}
              disabled={!canUndo}
              onClick={undo}
            >
              {t("undo")}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={!canRedo}
              onClick={redo}
            >
              {t("redo")}
            </button>
            <span className="mx-0.5 hidden h-4 w-px bg-slate-700 sm:inline-block" aria-hidden />
            <button
              type="button"
              className={btnExport}
              disabled={!imageUrl || rois.length === 0}
              onClick={handleExport}
            >
              {t("exportJson")}
            </button>
            <span className="mx-0.5 hidden h-4 w-px bg-slate-700 sm:inline-block" aria-hidden />
            <button
              type="button"
              className={btnAi}
              disabled={!imageUrl || aiBusy}
              title={!apiKey.trim() ? t("suggestNeedsKey") : t("suggestOptional")}
              onClick={() => void runSuggest()}
            >
              {aiBusy ? t("suggesting") : t("suggestAi")}
            </button>
            <button
              type="button"
              className={`${btnSecondary} ${aiOpen ? "border-cyan-700 bg-cyan-950/30 text-cyan-100" : ""}`}
              aria-expanded={aiOpen}
              aria-controls="ai-settings-panel"
              title={t("aiSettingsHint")}
              onClick={() => setAiOpen((v) => !v)}
            >
              {t("aiSettingsToggle")}
            </button>
          </div>
        </div>

        {aiOpen && (
          <div
            id="ai-settings-panel"
            className="mt-2 flex flex-wrap items-end gap-2 rounded border border-slate-800 bg-slate-900/50 px-2.5 py-2"
          >
            <label className="flex flex-col gap-0.5 text-[11px] text-slate-400">
              {t("apiKeyLabel")}
              <input
                type="password"
                className={`${fieldCompact} w-52`}
                value={apiKey}
                onChange={(e) => {
                  const v = e.target.value;
                  setApiKey(v);
                  localStorage.setItem(API_KEY_STORAGE, v);
                }}
                placeholder={t("apiKeyPlaceholder")}
                autoComplete="off"
              />
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-0.5 text-[11px] text-slate-400">
              {t("aiPromptLabel")}
              <input
                className={fieldCompact}
                value={aiPrompt}
                onChange={(e) => setAiPromptDraft(e.target.value)}
              />
            </label>
            {aiError && (
              <span className="max-w-md text-xs text-red-400" role="alert">
                {aiError}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="mt-2 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-h-0 min-w-0">
          <RoiStage
            imageUrl={imageUrl}
            aspectRatio={aspectRatio}
            rois={rois}
            selectedId={selectedId}
            defaultLabel={(n) => t("defaultRoiLabel", { n })}
            defaultCategory={t("defaultCategory")}
            onSelect={setSelectedId}
            onImageLoaded={onImageLoaded}
            onAddRoi={addRoi}
            onUpdateRoi={updateRoi}
            onImportClick={() => fileInputRef.current?.click()}
          />
        </div>
        <aside className="flex min-h-0 flex-col gap-2 overflow-auto rounded border border-slate-800 bg-slate-900/40 p-2.5 text-sm lg:max-h-none">
          <h2 className="font-medium text-slate-300">{t("selection")}</h2>
          {selected ? (
            <>
              <label className="flex flex-col gap-1">
                {t("label")}
                <input
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={selected.label}
                  onChange={(e) =>
                    patchRoiMeta(selected.id, { label: e.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                {t("category")}
                <input
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={selected.category}
                  onChange={(e) =>
                    patchRoiMeta(selected.id, { category: e.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="mt-1 rounded border border-red-800 py-1 text-red-300 hover:bg-red-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                onClick={() => {
                  removeRoi(selected.id);
                  setSelectedId(null);
                }}
              >
                {t("deleteRoi")}
              </button>
            </>
          ) : (
            <p className="text-slate-500">{t("selectionHint")}</p>
          )}
          <div className="mt-auto border-t border-slate-800 pt-2 text-xs text-slate-500">
            <p>{t("roiCount", { count: rois.length })}</p>
            <p className="mt-1">{t("shortcutsHint")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
