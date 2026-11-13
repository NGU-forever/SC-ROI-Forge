# Export ZIP Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JSON-only download with a client-side ZIP containing `calibration.json`, `rois.csv`, `rois.xlsx`, and `annotated.png`.

**Architecture:** Pure helpers for table rows + CSV in `apps/web/src/export/`; canvas annotation + ExcelJS + JSZip assembled in `downloadExportZip`; App gates on imported image and wires i18n. JSON pack still from `@sc-roi/schema` `buildExportPack` (unchanged).

**Tech Stack:** Vite/React web, `jszip`, `exceljs`, Canvas 2D, existing `@sc-roi/schema` (`buildExportPack`, `normToPx`).

## Global Constraints

- Client-side only; no API / `export-preview` changes
- JSON `schema_version` stays `"1.0"`
- ZIP members fixed: `calibration.json`, `rois.csv`, `rois.xlsx`, `annotated.png`
- Table `px_*` use **original image** natural size, not 1K/2K/4K
- Block export when no imported image
- Chat history not in pack

---

### Task 1: Table rows + CSV helpers (testable)

**Files:**
- Create: `apps/web/src/export/tableRows.ts`
- Create: `apps/web/src/export/csv.ts`
- Create: `packages/schema/tests/exportTableRows.test.ts` — **OR** add vitest under web; prefer testing pure logic by colocating row builder tests next to schema math via importing web is awkward. Instead keep helpers pure in web and add `apps/web` vitest **minimal**, OR put `buildRoiTableRows` in web and unit-test CSV/rows with a tiny node assert script. **Decision:** add vitest to `@sc-roi/web` for export helpers only.

Actually simplify: put pure `buildRoiTableRows` + `rowsToCsv` in web; add `apps/web/src/export/tableRows.test.ts` + vitest script on web package.

- Modify: `apps/web/package.json` — deps later in Task 2; vitest for this task

**Interfaces:**
- Produces:
  - `export type RoiTableRow = { id: string; label: string; category: string; color: string; norm_x: number; norm_y: number; norm_w: number; norm_h: number; px_x: number; px_y: number; px_w: number; px_h: number }`
  - `export const ROI_TABLE_COLUMNS: (keyof RoiTableRow)[]`
  - `buildRoiTableRows(rois: RoiInput[], imageW: number, imageH: number): RoiTableRow[]`
  - `rowsToCsv(rows: RoiTableRow[]): string` — UTF-8 BOM + header + RFC4180 quoting

- [ ] **Step 1: Add vitest to web + failing tests**

In `apps/web/package.json` scripts add `"test": "vitest run"` and devDependency `vitest`.

`apps/web/src/export/tableRows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRoiTableRows, ROI_TABLE_COLUMNS } from "./tableRows";
import { rowsToCsv } from "./csv";

describe("buildRoiTableRows", () => {
  it("maps norm to original image px via normToPx", () => {
    const rows = buildRoiTableRows(
      [
        {
          id: "a",
          label: "Health",
          category: "hud",
          color: "#FF0000",
          norm: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        },
      ],
      1920,
      1080,
    );
    expect(rows[0].color).toBe("#ff0000");
    expect(rows[0].px_x).toBe(Math.round(0.1 * 1920));
    expect(rows[0].norm_x).toBe(0.1);
  });

  it("defaults missing color to #22c55e", () => {
    const rows = buildRoiTableRows(
      [{ id: "b", label: "x", category: "g", norm: { x: 0, y: 0, w: 0.1, h: 0.1 } }],
      100,
      100,
    );
    expect(rows[0].color).toBe("#22c55e");
  });
});

describe("rowsToCsv", () => {
  it("includes BOM, header, and escapes quotes", () => {
    const rows = buildRoiTableRows(
      [
        {
          id: "1",
          label: 'say "hi"',
          category: "g",
          color: "#aabbcc",
          norm: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
      10,
      10,
    );
    const csv = rowsToCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(ROI_TABLE_COLUMNS.join(","));
    expect(csv).toContain('"say ""hi"""');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test --workspace @sc-roi/web`  
Expected: FAIL (modules missing)

- [ ] **Step 3: Implement helpers**

`tableRows.ts` — use `normToPx` from `@sc-roi/schema`; color `(roi.color ?? "#22c55e").toLowerCase()`.

`csv.ts` — BOM `\uFEFF`; escape fields containing `,`, `"`, or newline by wrapping in `"` and doubling `"`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm run test --workspace @sc-roi/web`

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/export/tableRows.ts apps/web/src/export/csv.ts apps/web/src/export/tableRows.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add ROI table row and CSV helpers for export pack

EOF
)"
```

---

### Task 2: Annotated PNG + XLSX + ZIP download

**Files:**
- Create: `apps/web/src/export/annotatedPng.ts`
- Create: `apps/web/src/export/xlsx.ts`
- Modify: `apps/web/src/export/downloadPack.ts` → replace with `downloadExportZip` (keep file or rename; update imports)
- Modify: `apps/web/package.json` — add `jszip`, `exceljs`, `@types/jszip` if needed

**Interfaces:**
- Consumes: `buildRoiTableRows`, `rowsToCsv`, `buildExportPack`, `RoiInput`
- Produces:
  - `renderAnnotatedPng(image: HTMLImageElement | ImageBitmap, rows: RoiTableRow[], rois: RoiInput[]): Promise<Blob>`
  - `rowsToXlsx(rows: RoiTableRow[]): Promise<ArrayBuffer>`
  - `downloadExportZip(input: { aspect_ratio: string; rois: RoiInput[]; image: HTMLImageElement; }): Promise<void>`

- [ ] **Step 1: Install deps**

```bash
npm install jszip exceljs --workspace @sc-roi/web
```

- [ ] **Step 2: Implement annotated PNG**

Draw image full size; for each ROI use `normToPx` / row px; `fillStyle` color + alpha ~0.2; `strokeStyle` color, lineWidth max(2, imageW/500); fillText label above box (clamp y >= font size).

- [ ] **Step 3: Implement XLSX**

ExcelJS workbook, sheet `rois`, columns = `ROI_TABLE_COLUMNS`, add rows from `RoiTableRow`.

- [ ] **Step 4: Implement `downloadExportZip`**

```ts
export async function downloadExportZip(input: {
  aspect_ratio: string;
  rois: RoiInput[];
  image: HTMLImageElement;
}): Promise<void> {
  const pack = buildExportPack({ aspect_ratio: input.aspect_ratio, rois: input.rois });
  const rows = buildRoiTableRows(input.rois, input.image.naturalWidth, input.image.naturalHeight);
  const zip = new JSZip();
  zip.file("calibration.json", JSON.stringify(pack, null, 2));
  zip.file("rois.csv", rowsToCsv(rows));
  zip.file("rois.xlsx", await rowsToXlsx(rows));
  zip.file("annotated.png", await renderAnnotatedPng(input.image, input.rois));
  const blob = await zip.generateAsync({ type: "blob" });
  // trigger <a download> sc-roi-{aspect}.zip
}
```

Remove or thin old `downloadPack` JSON-only export.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(web): build export ZIP with JSON, CSV, XLSX, and annotated PNG

EOF
)"
```

---

### Task 3: App wiring + i18n + verify

**Files:**
- Modify: `apps/web/src/App.tsx` — load image element from `imageUrl`, call `downloadExportZip`, disable without image; optional `exportBusy` state
- Modify: `apps/web/src/i18n/locales/en.ts` — `exportJson` → `export: "Export"`; add `exportNeedImage: "Import a screenshot first"`
- Modify: `apps/web/src/i18n/locales/zh.ts` — `export: "导出"`; `exportNeedImage: "请先导入截图"`
- Keep key rename: replace `exportJson` with `export` everywhere (MessageKey)

**Note:** Existing button also disabled when `rois.length === 0` — keep that (empty pack useless); primary gate per spec is no image.

- [ ] **Step 1: i18n rename + strings**
- [ ] **Step 2: Wire App**

```ts
const handleExport = async () => {
  if (!imageUrl || rois.length === 0 || exportBusy) return;
  setExportBusy(true);
  try {
    const img = await loadHtmlImage(imageUrl); // helper or inline Image()
    await downloadExportZip({
      aspect_ratio: aspectRatio,
      rois: rois.map(...),
      image: img,
    });
  } finally {
    setExportBusy(false);
  }
};
```

Button: `disabled={!imageUrl || rois.length === 0 || exportBusy}`, title/aria when no image uses `exportNeedImage`.

- [ ] **Step 3: Verify**

```bash
npm run test --workspace @sc-roi/web
npm run build --workspace @sc-roi/web
```

Expected: tests PASS; build succeeds.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(web): wire ZIP export button and i18n labels

EOF
)"
```

Also commit design/plan docs if not yet committed:

```bash
git add docs/superpowers/specs/2026-11-14-export-zip-pack-design.md docs/superpowers/plans/2026-11-14-export-zip-pack.md
git commit -m "$(cat <<'EOF'
docs: add export ZIP pack design and implementation plan

EOF
)"
```
