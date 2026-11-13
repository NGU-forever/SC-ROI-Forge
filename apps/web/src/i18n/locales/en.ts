export const en = {
  appTitle: "SC-ROI Forge",
  appSubtitle: "Manual HUD ROI calibration",
  langEn: "EN",
  langZh: "中文",
  langSwitchAria: "Interface language",

  importImage: "Import image",
  undo: "Undo",
  redo: "Redo",
  export: "Export",
  exportNeedImage: "Import a screenshot first",
  exporting: "Exporting…",
  suggestAi: "Suggest with AI",
  suggesting: "Suggesting…",
  suggestNeedsKey: "Set API key to enable",
  suggestOptional: "Optional cloud AI",

  apiKeyLabel: "LLM API key (local only)",
  apiKeyPlaceholder: "sk-…",
  apiKeyVisionHint: "Model must support multimodal / vision (see the image).",
  aiPromptLabel: "AI prompt",
  aiPromptDefault:
    "Roughly find HUD regions and propose labeled ROI boxes (norm 0..1).",
  aiSettingsShow: "Show AI settings",
  aiSettingsHide: "Hide AI settings",
  aiSettingsToggle: "AI settings",
  aiSettingsHint: "Configure API key & prompt",

  aiAssistant: "AI Assistant",
  chatEmpty:
    "Ask for HUD ROIs, then refine: add, move, rename, or delete boxes.",
  chatMultimodalHint:
    "AI must support multimodal (vision). The screenshot is sent each turn — text-only models (e.g. DeepSeek Chat) cannot see the image and will not work.",
  chatPlaceholder: "Message…",
  chatSend: "Send",
  chatThinking: "Thinking…",
  chatNeedImage: "Import a screenshot first",
  chatNeedKey: "Set API key to enable",
  color: "Color",

  aspectPreset: "Aspect",
  customAspect: "A:B",
  customOption: "Custom…",
  aspectDetected: "detected",
  aspectManual: "manual",
  resetToDetected: "Reset ({aspect})",
  aspectError: "Use format A:B (e.g. 21:9)",

  selection: "Selection",
  label: "Label",
  category: "Category",
  deleteRoi: "Delete ROI",
  selectionHint: "Drag on the canvas to draw a box. Click a box to edit.",
  roiCount: "{count} ROI(s)",
  shortcutsHint: "Paste image · Ctrl/Cmd+Z undo · Del remove",

  emptyCanvas: "Import or paste a screenshot to begin.",
  emptyCanvasHint: "PNG, JPEG, or WebP · clipboard paste supported",
  imageLoading: "Loading image…",

  defaultRoiLabel: "roi_{n}",
  defaultCategory: "general",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
