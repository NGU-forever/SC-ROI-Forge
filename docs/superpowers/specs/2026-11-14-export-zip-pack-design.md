# Export ZIP Pack Design Spec

**Date:** 2026-11-14  
**Status:** Approved  
**Parent:** [`2026-11-13-sc-roi-forge-design.md`](./2026-11-13-sc-roi-forge-design.md)  
**Repo:** https://github.com/NGU-forever/SC-ROI-Forge

## 1. Purpose

Replace the single JSON download with a **ZIP pack** that downstream users can open without parsing JSON only: calibration JSON (unchanged), tabular CSV + Excel for spreadsheet review, and one **annotated PNG** of the imported screenshot with ROI boxes drawn.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Delivery | One ZIP download |
| Contents | `calibration.json` + `rois.csv` + `rois.xlsx` + `annotated.png` |
| Annotated image | Current import only, original resolution (not 1K/2K/4K) |
| Table columns | Compact: id/label/category/color + norm_* + px_* on **original image** size |
| No image | Block export; require import first |
| Implementation | Client-side only (browser); no new API |
| JSON schema | Unchanged (`schema_version` `"1.0"`; still includes 1K/2K/4K px) |

## 3. ZIP layout and naming

- Download filename: `sc-roi-{aspect}.zip` where `:` in aspect becomes `x` (e.g. `sc-roi-16x9.zip`).
- Archive members (fixed names):

| Path in ZIP | Role |
|-------------|------|
| `calibration.json` | Existing `CalibrationPack` from `buildExportPack` |
| `rois.csv` | UTF-8 with BOM (Excel-friendly Chinese) |
| `rois.xlsx` | Single sheet; same columns/rows as CSV |
| `annotated.png` | Screenshot + ROI overlays |

## 4. Table schema

One row per ROI. Column order:

```text
id, label, category, color,
norm_x, norm_y, norm_w, norm_h,
px_x, px_y, px_w, px_h
```

- `norm_*` — from ROI `norm` (0..1), same source of truth as JSON.
- `px_*` — `norm × (imageNaturalWidth, imageNaturalHeight)`, rounded to integer pixels.
- `color` — `#rrggbb` (same defaulting as JSON export when missing).

Tier (1K/2K/4K) pixel columns are **not** duplicated in CSV/XLSX; they remain only in JSON.

## 5. UI / gating

- Toolbar label: change “Export JSON” / “导出 JSON” → **Export** / **导出**.
- Disabled when there is no imported image; user must import (or paste) a screenshot first.
- On click: build ZIP once, trigger download; briefly disable while building to avoid double-clicks.
- Chat history remains session-only and is **not** included in the pack.

## 6. Annotated PNG rules

- Base: current imported image at natural width/height.
- For each ROI: stroke + semi-transparent fill using that ROI’s `color`; draw `label` near the box (readable; no complex typography).
- Do **not** render selection chrome, transformer handles, or editor zoom/pan — data boxes only.
- Box geometry uses the same `norm → original px` mapping as the table.

## 7. Architecture

```text
App (has imageUrl + image size + rois + aspect)
  → downloadExportZip(...)
       → buildExportPack (schema) → calibration.json
       → build table rows (norm + original px)
       → CSV string (+ BOM)
       → XLSX workbook (ExcelJS)
       → canvas draw → annotated.png blob
       → JSZip → .zip → <a download>
```

- **Touch:** `apps/web/src/export/` (extend/replace `downloadPack.ts`), i18n keys, `App.tsx` export handler + button disabled state.
- **Reuse:** `@sc-roi/schema` `buildExportPack`, `normToPx`.
- **Do not:** put JSZip/xlsx into `packages/schema`; do not change API `export-preview`; do not bump JSON `schema_version`.

### Dependencies (web)

- `jszip` — archive
- `exceljs` — write `.xlsx`
- CSV and PNG via string + `<canvas>` (no extra image library)

## 8. Out of scope

- Multi-tier annotated images (1K/2K/4K)
- Including the raw screenshot as a separate file in the ZIP
- Server-side ZIP generation
- Changing chat persistence / packing chat into export
- Separate per-format download buttons or an export menu

## 9. Acceptance

1. With image + ROIs: downloaded ZIP contains exactly the four named files.
2. `calibration.json` matches today’s pack semantics (aspect, resolutions, rois with norm/px/color).
3. CSV and XLSX share the same columns and row values; `px_*` match boxes on `annotated.png`.
4. Annotated PNG shows colored boxes and labels on the original screenshot.
5. Without an image: Export is disabled / blocked with a clear need-to-import signal.
6. `npm run build --workspace @sc-roi/web` succeeds.
