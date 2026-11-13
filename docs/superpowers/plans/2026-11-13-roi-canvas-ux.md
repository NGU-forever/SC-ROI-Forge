# ROI Canvas UX (Color + Zoom/Pan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-ROI random/editable colors in UI + export JSON, and Figma-like wheel zoom / Space·MMB pan on the Konva stage.

**Architecture:** Add `color` to shared `RoiInput` and web store; assign via `randomRoiColor()` on create/AI; native color input patches meta. Viewport uses Stage (or content Group) `scale` + `x`/`y` with pointer→stage inverse transform; view state is session-only.

**Tech Stack:** TypeScript (`@sc-roi/schema`), React + Konva (`apps/web`), optional FastAPI `RoiIn.color` passthrough.

## Global Constraints

- Vision-only; no process/memory tooling
- Export `schema_version` stays `"1.0"`; `color` is additive (`#rrggbb`)
- Missing `color` on read → `#22c55e`; new web ROIs always set color
- Zoom 0.25×–4× toward pointer; Space/MMB pan; Space blocks new draws
- View transform not exported; reset on new image / aspect change
- Meta edits (label/category/color) do not push undo; geometry does

---

### Task 1: Schema `color` field

**Files:**
- Modify: `packages/schema/src/types.ts`
- Modify: `packages/schema/src/exportPack.ts`
- Modify: `packages/schema/tests/exportPack.test.ts`
- Optional: `apps/api/src/sc_roi_api/models.py` — `color: str | None = None`

**Interfaces:**
- Produces: `RoiInput.color?: string`; `buildExportPack` always writes `color` (default `#22c55e`)

- [ ] **Step 1: Failing test** — assert export includes provided `color` and defaults when omitted

```ts
it("passes through color and defaults when missing", () => {
  const withColor = buildExportPack({
    aspect_ratio: "16:9",
    rois: [{ id: "a", label: "x", category: "ui", color: "#38BDF8", norm: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
  });
  expect(withColor.rois[0].color).toBe("#38bdf8");
  const noColor = buildExportPack({
    aspect_ratio: "16:9",
    rois: [{ id: "b", label: "y", category: "ui", norm: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
  });
  expect(noColor.rois[0].color).toBe("#22c55e");
});
```

- [ ] **Step 2:** `npm test --workspace @sc-roi/schema` → FAIL
- [ ] **Step 3:** Add `color?: string` to `RoiInput`; in `buildExportPack` set `color: (roi.color ?? "#22c55e").toLowerCase()`
- [ ] **Step 4:** Tests PASS
- [ ] **Step 5:** Commit `feat(schema): add ROI color to export pack`

---

### Task 2: Web color create / edit / paint / export

**Files:**
- Create: `apps/web/src/lib/roiColor.ts` — `randomRoiColor()`, `hexWithAlpha(hex, a)`
- Modify: `apps/web/src/canvas/useRoiStore.ts` — `color` on `Roi`; `patchRoiMeta` includes `color`
- Modify: `apps/web/src/canvas/RoiStage.tsx` — random on add; stroke/fill from `roi.color`
- Modify: `apps/web/src/App.tsx` — color input; AI map; export map

**Interfaces:**
- Consumes: schema `color`
- Produces: store ROIs always have `color: string`

- [ ] **Step 1:** Implement `randomRoiColor` (H≈random, S=0.7, L=0.55 → `#rrggbb`)
- [ ] **Step 2:** On `finishDraw` / AI `pushRois`, assign `randomRoiColor()`
- [ ] **Step 3:** Selection panel `<input type="color">` → `patchRoiMeta`
- [ ] **Step 4:** Konva stroke = `roi.color`, fill = alpha ~0.12; selected thicker stroke
- [ ] **Step 5:** Export includes `color`
- [ ] **Step 6:** `npm run build` in `apps/web`
- [ ] **Step 7:** Commit `feat(web): per-ROI color with picker and export`

---

### Task 3: Viewport zoom + pan

**Files:**
- Modify: `apps/web/src/canvas/RoiStage.tsx`
- Touch: `apps/web/src/App.tsx` only if aspect/image reset needs a key/callback to reset view

**Interfaces:**
- View state: `{ scale, x, y }` on Stage or content `Group`
- `pointerPos()` returns stage-local coords after inverse transform

- [ ] **Step 1:** Wheel handler: `preventDefault`, zoom toward pointer, clamp 0.25–4
- [ ] **Step 2:** Space key tracking + middle-button drag → pan; Space blocks draw start
- [ ] **Step 3:** Reset view when `imageUrl` or `aspectRatio` changes
- [ ] **Step 4:** Manual verify: zoomed draw/move still yields sensible `norm`
- [ ] **Step 5:** `npm run build` in `apps/web`
- [ ] **Step 6:** Commit `feat(web): wheel zoom and space/mmb pan on ROI stage`

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `color` in schema/export | 1 |
| Random on manual + AI; picker; paint | 2 |
| Wheel zoom to cursor; Space/MMB pan | 3 |
| View not exported; meta no-undo | 2–3 |
