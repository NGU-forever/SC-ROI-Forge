import type { Messages } from "./en";

export const zh: Messages = {
  appTitle: "SC-ROI Forge",
  appSubtitle: "HUD 兴趣区手工标定",
  langEn: "EN",
  langZh: "中文",
  langSwitchAria: "界面语言",

  importImage: "导入图片",
  undo: "撤销",
  redo: "重做",
  exportJson: "导出 JSON",
  suggestAi: "AI 建议标定",
  suggesting: "正在建议…",
  suggestNeedsKey: "请先填写 API Key",
  suggestOptional: "可选云端 AI",

  apiKeyLabel: "LLM API Key（仅存本机）",
  apiKeyPlaceholder: "sk-…",
  aiPromptLabel: "AI 提示词",
  aiPromptDefault: "大致找出 HUD 区域，并给出带标签的 ROI 框（归一化坐标 0..1）。",
  aiSettingsShow: "显示 AI 设置",
  aiSettingsHide: "隐藏 AI 设置",
  aiSettingsToggle: "AI 设置",
  aiSettingsHint: "配置 API Key 与提示词",

  aspectPreset: "画幅",
  customAspect: "A:B",
  customOption: "自定义…",
  aspectDetected: "已检测",
  aspectManual: "手动",
  resetToDetected: "恢复（{aspect}）",
  aspectError: "请使用 A:B 格式（例如 21:9）",

  selection: "选中项",
  label: "标签",
  category: "分类",
  deleteRoi: "删除 ROI",
  selectionHint: "在画布上拖拽画框。点击框体可编辑。",
  roiCount: "{count} 个 ROI",
  shortcutsHint: "粘贴图片 · Ctrl/Cmd+Z 撤销 · Del 删除",

  emptyCanvas: "导入或粘贴截图以开始",
  emptyCanvasHint: "支持 PNG / JPEG / WebP · 可从剪贴板粘贴",
  imageLoading: "正在加载图片…",

  defaultRoiLabel: "roi_{n}",
  defaultCategory: "general",
};
