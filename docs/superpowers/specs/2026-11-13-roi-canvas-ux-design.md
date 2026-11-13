# ROI Canvas UX Design Spec

**Date:** 2026-11-13  
**Status:** Approved  
**Parent:** [`2026-11-13-sc-roi-forge-design.md`](./2026-11-13-sc-roi-forge-design.md)  
**Repo:** https://github.com/NGU-forever/SC-ROI-Forge  
**Supersedes draft:** `2026-11-13-roi-color-design.md` (merged into this doc)

## 1. Purpose

Two canvas UX upgrades for the calibration workbench:

1. **Per-ROI color** — random on create (manual + AI), editable in the right Selection panel, persisted in export JSON.
2. **Viewport zoom / pan** — Figma-like editing: wheel zoom toward cursor; Space or middle-mouse drag to pan. View transform is editor-only and **not** exported.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Color in export JSON | Yes (`color` field) |
| Color control | Native `<input type="color">` |
| AI Suggest colors | Random per draft ROI (client-side) |
| Color approach | Store + schema field on each ROI |
| Zoom / pan gestures | Wheel zoom + Space / middle-button pan |
| Zoom pivot | Pointer position |
| Viewport approach | Konva Stage `scale` + `position` (not CSS transform, not resizing stage logical size) |

## 3. Color data model

### 3.1 Field

- Name: `color`
- Format: `#` + 6 hex digits; lowercase preferred on write (e.g. `#38bdf8`)
- Required on **new** ROIs created in the web app
- On **read** of packs / drafts missing `color`: default `#22c55e`

### 3.2 Types to update

- `packages/schema` `RoiInput` / `RoiExport` — add `color: string`
- Web `Roi` in `useRoiStore` — add `color: string`
- API ROI models — optional `color` passthrough when present; AI Suggest does **not** invent colors server-side (web assigns after response)

`schema_version` stays `"1.0"` (backward-compatible additive field).

### 3.3 Export fragment

```json
{
  "id": "…",
  "label": "speed",
  "category": "telemetry",
  "color": "#38bdf8",
  "norm": { "x": 0.1, "y": 0.2, "w": 0.15, "h": 0.08 },
  "px": { "1k": {}, "2k": {}, "4k": {} }
}
```

## 4. Color UX

### 4.1 Manual create

On finish-draw, set `color: randomRoiColor()` before `onAddRoi`. Draw preview may stay amber; committed box uses its color.

### 4.2 AI Suggest

After `suggestRois`, map each draft with `color: randomRoiColor()` (independent). LLM need not emit colors.

### 4.3 Edit

Selection aside, below Label / Category:

- Color → `<input type="color" value={selected.color} />`
- On change: `patchRoiMeta(id, { color })` — **same as label/category: no undo history push**

### 4.4 Rendering

- Stroke / fill from `roi.color` (fill ≈ 12% alpha of that color)
- Selected: thicker stroke; do **not** replace with a global blue/green that hides the ROI color
- Labels stay high-contrast light text

### 4.5 `randomRoiColor()`

- Hue uniform in `[0, 360)`; saturation ≈ 70%; lightness ≈ 55%
- Output `#rrggbb`; uniqueness not required for MVP

## 5. Viewport zoom / pan

### 5.1 Mental model

- Logical stage size stays the locked-aspect pixel size from `stageSize(aspectRatio)` (unchanged for `norm` math).
- A **view transform** (`scale`, `offsetX`, `offsetY` or Stage `scale` + `x`/`y`) maps stage content into the scrollable / clipped viewport.
- Pointer events used for draw / drag / transform must convert **screen → stage** via the inverse view transform before `normFromStage`.

### 5.2 Gestures

| Gesture | Behavior |
|---------|----------|
| Wheel | Zoom toward pointer; clamp scale to about **0.25×–4×**; step ~1.1× per notch |
| Space held + drag | Pan (change view position); cursor `grab` / `grabbing` |
| Middle mouse drag | Pan (same as Space+drag) |
| Space held | **Disable** new ROI draw starts (mousedown on empty stage does not begin a box) |
| Box drag / resize | Unchanged once started; coordinates account for view transform |

Optional later (out of scope now): `+` / `−` / fit buttons, Ctrl+0 reset.

### 5.3 Implementation sketch (`RoiStage`)

- Keep Stage width/height = logical `stageW` × `stageH` **or** wrap Stage in a fixed viewport div and set Stage `scaleX`/`scaleY` + `x`/`y`.
- Prefer: outer `div` with `overflow: hidden` (and existing max-height), Stage listens `wheel` (`preventDefault`), updates view state.
- `pointerPos()` returns stage-space coordinates (divide by scale, subtract offset).
- Transformer / ROI nodes live in stage space; view transform applies to the Stage (or a single parent Group containing image + rois).

### 5.4 Persistence

- View scale/pan is **session UI state only** — not in export JSON, not in undo stack.
- Changing aspect ratio or loading a new image may reset view to scale `1` and origin `(0,0)` (simple, predictable).

## 6. Out of scope

- Color palettes / swatches
- Per-category default colors
- LLM-chosen colors
- Toolbar zoom buttons / fit-to-view
- Pinch-zoom (trackpad wheel zoom is enough)
- Persisting viewport in JSON
- Changing geometry vs meta undo rules beyond documenting current behavior

## 7. Verification

**Color**

1. Draw two boxes → different random colors  
2. Select → change color in panel → canvas updates  
3. Export → each ROI has `"color": "#……"`  
4. AI Suggest → each draft has a color  

**Viewport**

5. Wheel over canvas → zooms toward cursor; boxes stay aligned to image  
6. Space+drag or middle-drag → pans; releasing Space restores draw  
7. Draw / move / resize ROI while zoomed → exported `norm` still correct (spot-check vs unzoomed)  
8. Schema tests pass; one export test asserts `color` when provided  

## 8. Implementation touchpoints

- `packages/schema/src/types.ts` (+ export test for `color`)
- `apps/web/src/lib/roiColor.ts` — `randomRoiColor`, optional `colorWithAlpha`
- `apps/web/src/canvas/useRoiStore.ts` — `color` on `Roi`; `patchRoiMeta` includes `color`
- `apps/web/src/canvas/RoiStage.tsx` — colors, view transform, wheel / Space / MMB
- `apps/web/src/App.tsx` — color input; AI map assigns colors; export includes `color`
- Optional: API Pydantic ROI models for optional `color` passthrough
