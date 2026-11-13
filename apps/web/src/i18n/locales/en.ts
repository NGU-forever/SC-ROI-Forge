export const en = {
  appTitle: "SC-ROI Forge",
  appSubtitle: "Manual HUD ROI calibration",
  langEn: "EN",
  langZh: "中文",
  langSwitchAria: "Interface language",

  importImage: "Import image",
  undo: "Undo",
  redo: "Redo",
  exportJson: "Export JSON",
  suggestAi: "Suggest with AI",
  suggesting: "Suggesting…",
  suggestNeedsKey: "Set API key to enable",
  suggestOptional: "Optional cloud AI",

  apiKeyLabel: "LLM API key (local only)",
  apiKeyPlaceholder: "sk-…",
  aiPromptLabel: "AI prompt",
  aiPromptDefault:
    "Roughly find HUD regions and propose labeled ROI boxes (norm 0..1).",
  aiSettingsShow: "Show AI settings",
  aiSettingsHide: "Hide AI settings",
  aiSettingsToggle: "AI settings",
  aiSettingsHint: "Configure API key & prompt",

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
