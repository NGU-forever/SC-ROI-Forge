# SC-ROI-Forge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a vision-only ROI calibration workbench: import screenshot, lock aspect (auto-detect or manual), draw/edit boxes on Konva (optional cloud AI drafts), export standard JSON where 1K/2K/4K are proportional scales of that same aspect; runnable in browser, Docker, and a Tauri EXE skeleton.

**Architecture:** Shared resolution/ROI math in `packages/schema` (TypeScript source of truth for web; Python mirror in API). React+Vite+Konva SPA talks to FastAPI for export helpers and optional `suggest-rois`. Tauri loads the web UI and starts a local FastAPI sidecar. No game memory or injection code paths.

**Tech Stack:** React, Vite, TypeScript, Tailwind, Konva/react-konva, FastAPI, Uvicorn, Pydantic, OpenCV + RapidOCR (optional assist), OpenAI-compatible cloud API, Docker Compose, Tauri 2.

## Global Constraints

- Compliance: vision-only — images in, calibration JSON out; never process IDs, memory, hooks, or client patching
- Aspect is locked per pack (16:9 / 16:10 / 21:9 / …); different aspects mean different UI layouts — do not cross-convert layouts
- Within one aspect, 1K/2K/4K are uniform scales only: `width = round(height * (A/B))` with heights 1080 / 1440 / 2160
- Aspect input: auto-detect from screenshot size, with user preset/custom override
- `norm` is source of truth; recompute `px` and `resolutions` on every export
- AI is optional; full manual path must work with no API key
- Spec: `docs/superpowers/specs/2026-11-13-sc-roi-forge-design.md`

## File structure (target)

```text
packages/schema/
  package.json
  src/index.ts
  src/aspect.ts
  src/exportPack.ts
  src/types.ts
  tests/aspect.test.ts
  tests/exportPack.test.ts
apps/api/
  pyproject.toml
  src/sc_roi_api/main.py
  src/sc_roi_api/geometry.py
  src/sc_roi_api/models.py
  src/sc_roi_api/agent.py
  tests/test_geometry.py
  tests/test_export_preview.py
  tests/test_agent_disabled.py
apps/web/
  package.json
  vite.config.ts
  index.html
  src/main.tsx
  src/App.tsx
  src/lib/api.ts
  src/canvas/RoiStage.tsx
  src/canvas/useRoiStore.ts
  src/export/downloadPack.ts
apps/desktop/
  src-tauri/…          # Tauri 2 skeleton + sidecar hook
deploy/docker/
  Dockerfile.api
  Dockerfile.web
  compose.yml
.gitignore
README.md
```

---

### Task 1: Shared aspect + export math (TypeScript package)

**Files:**
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/src/types.ts`
- Create: `packages/schema/src/aspect.ts`
- Create: `packages/schema/src/exportPack.ts`
- Create: `packages/schema/src/index.ts`
- Create: `packages/schema/tests/aspect.test.ts`
- Create: `packages/schema/tests/exportPack.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: `parseAspectRatio(s: string): { a: number; b: number; r: number }`
- Produces: `detectAspectRatio(width: number, height: number, tolerance?: number): string` — snap to presets or reduced `W:H`
- Produces: `tierResolutions(aspect: string): { "1k"|"2k"|"4k": { w: number; h: number } }` — proportional sizes under locked aspect
- Produces: `normToPx(norm, width, height): { x,y,w,h }` integers
- Produces: `buildExportPack({ aspect_ratio, rois }): CalibrationPack`

- [ ] **Step 1: Add `.gitignore`**

```gitignore
node_modules/
dist/
build/
.env
.env.*
!.env.example
__pycache__/
.venv/
*.pyc
.pytest_cache/
.DS_Store
apps/desktop/src-tauri/target/
```

- [ ] **Step 2: Scaffold `packages/schema/package.json` and tsconfig**

```json
{
  "name": "@sc-roi/schema",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write failing tests**

```typescript
// packages/schema/tests/aspect.test.ts
import { describe, it, expect } from "vitest";
import { tierResolutions, parseAspectRatio, detectAspectRatio } from "../src/aspect";

describe("tierResolutions", () => {
  it("16:9 matches FHD/QHD/UHD", () => {
    expect(tierResolutions("16:9")).toEqual({
      "1k": { w: 1920, h: 1080 },
      "2k": { w: 2560, h: 1440 },
      "4k": { w: 3840, h: 2160 },
    });
  });

  it("21:9 uses height-aligned formula", () => {
    expect(tierResolutions("21:9")).toEqual({
      "1k": { w: 2520, h: 1080 },
      "2k": { w: 3360, h: 1440 },
      "4k": { w: 5040, h: 2160 },
    });
  });
});

describe("parseAspectRatio", () => {
  it("parses A:B", () => {
    expect(parseAspectRatio("16:10").r).toBeCloseTo(1.6);
  });
});

describe("detectAspectRatio", () => {
  it("snaps 1920x1080 to 16:9", () => {
    expect(detectAspectRatio(1920, 1080)).toBe("16:9");
  });
  it("snaps 2520x1080 to 21:9", () => {
    expect(detectAspectRatio(2520, 1080)).toBe("21:9");
  });
  it("snaps 1920x1200 to 16:10", () => {
    expect(detectAspectRatio(1920, 1200)).toBe("16:10");
  });
});
```

Update the import line at the top of `aspect.test.ts` to also import `detectAspectRatio`. Common marketing sizes like 2560×1080 are ~1.6% off true 21:9 — snap with default 1% tolerance will not force them; user can manually select `21:9`.

```typescript
// packages/schema/tests/exportPack.test.ts
import { describe, it, expect } from "vitest";
import { buildExportPack } from "../src/exportPack";

describe("buildExportPack", () => {
  it("fills compliance, resolutions, and px from norm", () => {
    const pack = buildExportPack({
      aspect_ratio: "16:9",
      rois: [
        {
          id: "a",
          label: "speed",
          category: "telemetry",
          norm: { x: 0.02, y: 0.85, w: 0.12, h: 0.08 },
        },
      ],
    });
    expect(pack.schema_version).toBe("1.0");
    expect(pack.compliance).toBe("vision_only");
    expect(pack.resolutions["1k"]).toEqual({ w: 1920, h: 1080 });
    expect(pack.rois[0].px["1k"]).toEqual({
      x: 38,
      y: 918,
      w: 230,
      h: 86,
    });
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL**

Run: `cd packages/schema && npm install && npm test`  
Expected: FAIL (modules missing)

- [ ] **Step 5: Implement types + aspect + exportPack**

```typescript
// packages/schema/src/types.ts
export type Tier = "1k" | "2k" | "4k";
export type Rect = { x: number; y: number; w: number; h: number };
export type RoiInput = {
  id: string;
  label: string;
  category: string;
  norm: Rect;
};
export type RoiExport = RoiInput & { px: Record<Tier, Rect> };
export type CalibrationPack = {
  schema_version: "1.0";
  aspect_ratio: string;
  compliance: "vision_only";
  resolutions: Record<Tier, { w: number; h: number }>;
  rois: RoiExport[];
};
```

```typescript
// packages/schema/src/aspect.ts
const TIER_HEIGHTS = { "1k": 1080, "2k": 1440, "4k": 2160 } as const;

export function parseAspectRatio(s: string): { a: number; b: number; r: number } {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) throw new Error(`Invalid aspect ratio: ${s}`);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a <= 0 || b <= 0) throw new Error(`Invalid aspect ratio: ${s}`);
  return { a, b, r: a / b };
}

/** Known game/UI design aspects — layouts differ across these; do not mix. */
export const ASPECT_PRESETS = ["16:9", "16:10", "21:9", "32:9", "4:3"] as const;

export function detectAspectRatio(
  width: number,
  height: number,
  tolerance = 0.01,
): string {
  const r = width / height;
  let best: string | null = null;
  let bestErr = Infinity;
  for (const p of ASPECT_PRESETS) {
    const { r: pr } = parseAspectRatio(p);
    const err = Math.abs(r - pr) / pr;
    if (err < bestErr) {
      bestErr = err;
      best = p;
    }
  }
  if (best && bestErr <= tolerance) return best;
  const g = gcd(Math.round(width), Math.round(height));
  return `${Math.round(width) / g}:${Math.round(height) / g}`;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function tierResolutions(aspect: string) {
  const { r } = parseAspectRatio(aspect);
  return {
    "1k": { w: Math.round(TIER_HEIGHTS["1k"] * r), h: TIER_HEIGHTS["1k"] },
    "2k": { w: Math.round(TIER_HEIGHTS["2k"] * r), h: TIER_HEIGHTS["2k"] },
    "4k": { w: Math.round(TIER_HEIGHTS["4k"] * r), h: TIER_HEIGHTS["4k"] },
  } as const;
}

export function normToPx(
  norm: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
) {
  const clamp = (v: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(v)));
  const x = clamp(norm.x * width, width - 1);
  const y = clamp(norm.y * height, height - 1);
  const w = clamp(norm.w * width, width - x);
  const h = clamp(norm.h * height, height - y);
  return { x, y, w, h };
}
```

```typescript
// packages/schema/src/exportPack.ts
import { tierResolutions, normToPx } from "./aspect";
import type { CalibrationPack, RoiInput } from "./types";

export function buildExportPack(input: {
  aspect_ratio: string;
  rois: RoiInput[];
}): CalibrationPack {
  const resolutions = tierResolutions(input.aspect_ratio);
  const rois = input.rois.map((roi) => ({
    ...roi,
    px: {
      "1k": normToPx(roi.norm, resolutions["1k"].w, resolutions["1k"].h),
      "2k": normToPx(roi.norm, resolutions["2k"].w, resolutions["2k"].h),
      "4k": normToPx(roi.norm, resolutions["4k"].w, resolutions["4k"].h),
    },
  }));
  return {
    schema_version: "1.0",
    aspect_ratio: input.aspect_ratio,
    compliance: "vision_only",
    resolutions: { ...resolutions },
    rois,
  };
}
```

```typescript
// packages/schema/src/index.ts
export * from "./types";
export * from "./aspect";
export * from "./exportPack";
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd packages/schema && npm test`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .gitignore packages/schema
git commit -m "feat(schema): add aspect tiers and calibration export pack math"
```

---

### Task 2: Python geometry mirror + FastAPI export-preview

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/src/sc_roi_api/__init__.py`
- Create: `apps/api/src/sc_roi_api/geometry.py`
- Create: `apps/api/src/sc_roi_api/models.py`
- Create: `apps/api/src/sc_roi_api/main.py`
- Create: `apps/api/tests/test_geometry.py`
- Create: `apps/api/tests/test_export_preview.py`

**Interfaces:**
- Consumes: same formula as Task 1
- Produces: `POST /v1/calibrations/export-preview` → CalibrationPack JSON
- Produces: `GET /health` → `{ "status": "ok" }`

- [ ] **Step 1: Write failing geometry tests**

```python
# apps/api/tests/test_geometry.py
from sc_roi_api.geometry import tier_resolutions, build_export_pack

def test_tier_resolutions_16_9():
    assert tier_resolutions("16:9") == {
        "1k": {"w": 1920, "h": 1080},
        "2k": {"w": 2560, "h": 1440},
        "4k": {"w": 3840, "h": 2160},
    }

def test_tier_resolutions_21_9():
    assert tier_resolutions("21:9") == {
        "1k": {"w": 2520, "h": 1080},
        "2k": {"w": 3360, "h": 1440},
        "4k": {"w": 5040, "h": 2160},
    }

def test_build_export_pack_px():
    pack = build_export_pack(
        "16:9",
        [
            {
                "id": "a",
                "label": "speed",
                "category": "telemetry",
                "norm": {"x": 0.02, "y": 0.85, "w": 0.12, "h": 0.08},
            }
        ],
    )
    assert pack["compliance"] == "vision_only"
    assert pack["rois"][0]["px"]["1k"] == {"x": 38, "y": 918, "w": 230, "h": 86}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/api && python -m venv .venv && .venv/bin/pip install -e ".[dev]" && .venv/bin/pytest tests/test_geometry.py -v`  
Expected: FAIL (package missing) — create `pyproject.toml` first if pip fails, then re-run; still FAIL on import until Step 3

- [ ] **Step 3: Implement geometry + models + pyproject**

```toml
# apps/api/pyproject.toml
[project]
name = "sc-roi-api"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "pydantic>=2.8.0",
  "python-multipart>=0.0.9",
  "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27.0"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]
```

```python
# apps/api/src/sc_roi_api/geometry.py
from __future__ import annotations

import re
from typing import Any

TIER_HEIGHTS = {"1k": 1080, "2k": 1440, "4k": 2160}
_ASPECT_RE = re.compile(r"^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$")


def parse_aspect_ratio(s: str) -> float:
    m = _ASPECT_RE.match(s.strip())
    if not m:
        raise ValueError(f"Invalid aspect ratio: {s}")
    a, b = float(m.group(1)), float(m.group(2))
    if a <= 0 or b <= 0:
        raise ValueError(f"Invalid aspect ratio: {s}")
    return a / b


def tier_resolutions(aspect: str) -> dict[str, dict[str, int]]:
    r = parse_aspect_ratio(aspect)
    return {
        tier: {"w": round(h * r), "h": h}
        for tier, h in TIER_HEIGHTS.items()
    }


def norm_to_px(norm: dict[str, float], width: int, height: int) -> dict[str, int]:
    def clamp(v: int, max_v: int) -> int:
        return max(0, min(max_v, v))

    x = clamp(round(norm["x"] * width), width - 1)
    y = clamp(round(norm["y"] * height), height - 1)
    w = clamp(round(norm["w"] * width), width - x)
    h = clamp(round(norm["h"] * height), height - y)
    return {"x": x, "y": y, "w": w, "h": h}


def build_export_pack(aspect_ratio: str, rois: list[dict[str, Any]]) -> dict[str, Any]:
    resolutions = tier_resolutions(aspect_ratio)
    out_rois = []
    for roi in rois:
        px = {
            tier: norm_to_px(roi["norm"], res["w"], res["h"])
            for tier, res in resolutions.items()
        }
        out_rois.append({**roi, "px": px})
    return {
        "schema_version": "1.0",
        "aspect_ratio": aspect_ratio,
        "compliance": "vision_only",
        "resolutions": resolutions,
        "rois": out_rois,
    }
```

```python
# apps/api/src/sc_roi_api/models.py
from pydantic import BaseModel, Field


class RectNorm(BaseModel):
    x: float
    y: float
    w: float
    h: float


class RoiIn(BaseModel):
    id: str
    label: str
    category: str
    norm: RectNorm


class ExportPreviewRequest(BaseModel):
    aspect_ratio: str = Field(examples=["16:9"])
    rois: list[RoiIn]
```

```python
# apps/api/src/sc_roi_api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sc_roi_api.geometry import build_export_pack
from sc_roi_api.models import ExportPreviewRequest

app = FastAPI(title="SC-ROI-Forge API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/v1/calibrations/export-preview")
def export_preview(body: ExportPreviewRequest):
    return build_export_pack(
        body.aspect_ratio,
        [r.model_dump() for r in body.rois],
    )
```

```python
# apps/api/src/sc_roi_api/__init__.py
"""SC-ROI-Forge API — vision-only calibration helpers."""
```

- [ ] **Step 4: API test with TestClient**

```python
# apps/api/tests/test_export_preview.py
from fastapi.testclient import TestClient
from sc_roi_api.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_export_preview():
    r = client.post(
        "/v1/calibrations/export-preview",
        json={
            "aspect_ratio": "16:9",
            "rois": [
                {
                    "id": "a",
                    "label": "speed",
                    "category": "telemetry",
                    "norm": {"x": 0.02, "y": 0.85, "w": 0.12, "h": 0.08},
                }
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["compliance"] == "vision_only"
    assert body["rois"][0]["px"]["1k"]["x"] == 38
```

- [ ] **Step 5: Run all API tests — expect PASS**

Run: `cd apps/api && .venv/bin/pytest -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): add health and export-preview with locked geometry"
```

---

### Task 3: React + Konva manual calibration UI

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.app.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/canvas/useRoiStore.ts`
- Create: `apps/web/src/canvas/RoiStage.tsx`
- Create: `apps/web/src/export/downloadPack.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `package.json` (workspace root, optional)

**Interfaces:**
- Consumes: `@sc-roi/schema` `buildExportPack`
- Produces: UI actions — import image, set aspect, draw rects, edit label, undo/redo, download JSON
- Produces: `downloadPack(aspect, rois)` browser file download

- [ ] **Step 1: Scaffold Vite React-TS app in `apps/web`**

Run:

```bash
cd /Users/xiongtianyu/Desktop/sc-roi-forge
npm create vite@latest apps/web -- --template react-ts
cd apps/web
npm install
npm install konva react-konva zustand
npm install -D tailwindcss @tailwindcss/vite
npm install ../packages/schema
```

Configure `vite.config.ts` with `@tailwindcss/vite` plugin and `@` alias if desired. Wire `src/index.css` with `@import "tailwindcss";`.

- [ ] **Step 2: Implement Zustand store**

```typescript
// apps/web/src/canvas/useRoiStore.ts
import { create } from "zustand";
import type { Rect } from "@sc-roi/schema";

export type Roi = {
  id: string;
  label: string;
  category: string;
  norm: Rect;
};

type State = {
  imageUrl: string | null;
  aspectRatio: string;
  rois: Roi[];
  past: Roi[][];
  future: Roi[][];
  setImageUrl: (url: string | null) => void;
  setAspectRatio: (a: string) => void;
  pushRois: (rois: Roi[]) => void;
  addRoi: (roi: Roi) => void;
  updateRoi: (id: string, patch: Partial<Roi>) => void;
  removeRoi: (id: string) => void;
  undo: () => void;
  redo: () => void;
};

export const useRoiStore = create<State>((set, get) => ({
  imageUrl: null,
  aspectRatio: "16:9",
  rois: [],
  past: [],
  future: [],
  setImageUrl: (imageUrl) => set({ imageUrl }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  pushRois: (rois) => {
    const { rois: cur, past } = get();
    set({ past: [...past, cur], rois, future: [] });
  },
  addRoi: (roi) => get().pushRois([...get().rois, roi]);
  updateRoi: (id, patch) =>
    get().pushRois(get().rois.map((r) => (r.id === id ? { ...r, ...patch } : r))),
  removeRoi: (id) => get().pushRois(get().rois.filter((r) => r.id !== id)),
  undo: () => {
    const { past, rois, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ past: past.slice(0, -1), rois: prev, future: [rois, ...future] });
  },
  redo: () => {
    const { past, rois, future } = get();
    if (!future.length) return;
    const [next, ...rest] = future;
    set({ past: [...past, rois], rois: next, future: rest });
  },
}));
```

- [ ] **Step 3: Implement RoiStage (draw + transform)**

Implement `RoiStage.tsx` with:

- `Stage` / `Layer` / `Image` background from `imageUrl`
- Drag-to-create rectangle while holding a “draw” mode (or click-drag on empty canvas)
- Selected `Rect` with Konva transformers; on transform end, convert stage coords → `norm` using stage width/height
- Display label text near each box

Keep stage logical size consistent with selected aspect (e.g. base height 720, width = round(720 * r)).

- [ ] **Step 4: App shell — import, aspect select, export**

`App.tsx` responsibilities:

- File input + paste listener → `URL.createObjectURL` → `setImageUrl`
- On image load: read naturalWidth/Height → `detectAspectRatio(w, h)` → `setAspectRatio` (auto)
- Aspect UI: preset `<select>` (`16:9`, `16:10`, `21:9`, `32:9`, …) **plus** custom `A:B` text input so the user can override detection; show badge “detected” vs “manual”
- Buttons: Undo, Redo, Export JSON, optional “Suggest with AI” (wired in Task 4; can be disabled stub)
- Call `buildExportPack` from `@sc-roi/schema` client-side for export (do not require API for manual path); pack keeps one locked `aspect_ratio`, with 1K/2K/4K as proportional scales only

```typescript
// apps/web/src/export/downloadPack.ts
import { buildExportPack, type RoiInput } from "@sc-roi/schema";

export function downloadPack(aspect_ratio: string, rois: RoiInput[]) {
  const pack = buildExportPack({ aspect_ratio, rois });
  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sc-roi-${aspect_ratio.replace(":", "x")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 5: Manual smoke check**

Run: `cd apps/web && npm run dev`  
Verify: import image → draw box → export JSON has `schema_version`, `compliance`, `resolutions`, `px`.

- [ ] **Step 6: Commit**

```bash
git add apps/web package-lock.json packages/schema
git commit -m "feat(web): Konva canvas with manual ROI draw and JSON export"
```

---

### Task 4: Optional cloud AI suggest-rois

**Files:**
- Create: `apps/api/src/sc_roi_api/agent.py`
- Modify: `apps/api/src/sc_roi_api/main.py`
- Create: `apps/api/tests/test_agent_disabled.py`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/App.tsx`
- Create: `.env.example`

**Interfaces:**
- Produces: `POST /v1/agent/suggest-rois` (multipart: `file`, form `prompt`, header `X-API-Key` or form `api_key`)
- Produces: `{ rois: RoiIn[] }` draft list only — never writes files server-side
- If `SC_ROI_AGENT_ENABLED=0` or no key → HTTP 400 with clear message

- [ ] **Step 1: Failing test — agent disabled**

```python
# apps/api/tests/test_agent_disabled.py
import os
from fastapi.testclient import TestClient

os.environ["SC_ROI_AGENT_ENABLED"] = "0"

from sc_roi_api.main import app  # import after env

client = TestClient(app)


def test_suggest_disabled():
    r = client.post(
        "/v1/agent/suggest-rois",
        files={"file": ("x.png", b"fakepng", "image/png")},
        data={"prompt": "find hud"},
    )
    assert r.status_code == 400
    assert "disabled" in r.json()["detail"].lower() or "not enabled" in r.json()["detail"].lower()
```

- [ ] **Step 2: Implement agent module (OpenAI-compatible, vision-only)**

```python
# apps/api/src/sc_roi_api/agent.py
from __future__ import annotations

import json
import os
from typing import Any

import httpx

SYSTEM = """You help calibrate HUD ROIs from a screenshot only.
Return JSON: {"rois":[{"id":"string","label":"string","category":"string","norm":{"x":0,"y":0,"w":0,"h":0}}]}
norm values must be 0..1 relative to the full image. No other keys. Vision only — never discuss memory or injection."""


def agent_enabled() -> bool:
    return os.getenv("SC_ROI_AGENT_ENABLED", "1") not in {"0", "false", "False"}


async def suggest_rois(
    image_bytes: bytes,
    prompt: str,
    api_key: str,
    base_url: str | None = None,
    model: str | None = None,
) -> list[dict[str, Any]]:
    if not agent_enabled():
        raise RuntimeError("Agent is disabled")
    if not api_key:
        raise RuntimeError("API key required")
    base = (base_url or os.getenv("SC_ROI_LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = model or os.getenv("SC_ROI_LLM_MODEL") or "gpt-4o-mini"
    import base64

    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                ],
            },
        ],
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
    data = json.loads(content)
    return data.get("rois", [])
```

Wire `POST /v1/agent/suggest-rois` in `main.py` using `UploadFile`, catch `RuntimeError` → 400.

- [ ] **Step 3: Frontend — settings field for API key (localStorage) + Suggest button**

```typescript
// apps/web/src/lib/api.ts
export async function suggestRois(file: Blob, prompt: string, apiKey: string) {
  const fd = new FormData();
  fd.append("file", file, "shot.png");
  fd.append("prompt", prompt);
  const r = await fetch("/v1/agent/suggest-rois", {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: fd,
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { rois: Array<{ id: string; label: string; category: string; norm: { x: number; y: number; w: number; h: number } }> };
}
```

Proxy `/v1` to FastAPI in `vite.config.ts` during dev.

On success, `pushRois` merge or replace drafts onto canvas.

- [ ] **Step 4: `.env.example`**

```env
SC_ROI_AGENT_ENABLED=1
SC_ROI_LLM_BASE_URL=https://api.openai.com/v1
SC_ROI_LLM_MODEL=gpt-4o-mini
# API keys are provided by the user in the UI or as SC_ROI_LLM_API_KEY for server-side default (optional)
```

- [ ] **Step 5: Run API tests**

Run: `cd apps/api && .venv/bin/pytest -v`  
Expected: PASS including disabled agent

- [ ] **Step 6: Commit**

```bash
git add apps/api apps/web .env.example
git commit -m "feat(agent): optional cloud ROI suggest with disable path"
```

---

### Task 5: Docker Compose (browser + API)

**Files:**
- Create: `deploy/docker/Dockerfile.api`
- Create: `deploy/docker/Dockerfile.web`
- Create: `deploy/docker/compose.yml`
- Create: `apps/web/nginx.conf` (or Caddy) to serve SPA and proxy `/v1` + `/health`

**Interfaces:**
- Produces: `docker compose -f deploy/docker/compose.yml up --build` serves UI on `:8080`, API on `:8000` (or UI proxies to API)

- [ ] **Step 1: Dockerfile.api**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY apps/api /app
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "sc_roi_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Dockerfile.web + nginx proxy**

Multi-stage: `node` build `apps/web` (copy `packages/schema` too), then nginx image with `try_files` + `location /v1/ { proxy_pass http://api:8000; }` and `/health`.

- [ ] **Step 3: compose.yml**

```yaml
services:
  api:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile.api
    environment:
      SC_ROI_AGENT_ENABLED: "1"
    ports:
      - "8000:8000"
  web:
    build:
      context: ../..
      dockerfile: deploy/docker/Dockerfile.web
    ports:
      - "8080:80"
    depends_on:
      - api
```

- [ ] **Step 4: Build smoke**

Run: `docker compose -f deploy/docker/compose.yml up --build -d`  
Then: `curl -s http://localhost:8080/health` or API health; open UI once.

- [ ] **Step 5: Commit**

```bash
git add deploy/docker apps/web/nginx.conf
git commit -m "chore(deploy): Docker Compose for API and web UI"
```

---

### Task 6: Tauri EXE skeleton + sidecar hook

**Files:**
- Create: `apps/desktop/` via `npm create tauri-app` (or manual Tauri 2 scaffold)
- Create: sidecar start script docs in `apps/desktop/README.md`
- Modify: Tauri config to load `http://127.0.0.1:1420` in dev and bundled dist in prod; on startup spawn packaged `sc-roi-api` if present

**Interfaces:**
- Produces: `apps/desktop` builds on developer machine; documents Windows `tauri build` producing EXE
- Sidecar: run uvicorn next to the app; UI points API to `http://127.0.0.1:8000`

- [ ] **Step 1: Scaffold Tauri 2 app under `apps/desktop` pointing at `apps/web` as frontend**

Follow Tauri 2 + Vite external frontend docs; set `beforeDevCommand` / `beforeBuildCommand` to build web.

- [ ] **Step 2: Document sidecar**

`apps/desktop/README.md`: how to run API locally beside the shell; note full PyInstaller bundling is follow-up polish, MVP accepts “EXE UI + separately started API” or simple `sidecar` binary path placeholder.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop
git commit -m "feat(desktop): Tauri shell skeleton for Windows EXE path"
```

---

### Task 7: README sync + compliance checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README** with:

- Link to design spec and this plan
- Quick start: schema tests, API uvicorn, web vite, docker compose
- Reiterate vision-only compliance and optional AI
- Aspect / 1K·2K·4K formula summary

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: sync README with MVP architecture and quick start"
```

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Vision-only compliance | Global + Tasks 4, 7 |
| Import screenshot / paste | Task 3 |
| Aspect lock + auto-detect + manual override | Tasks 1, 3 |
| Same-aspect proportional 1K/2K/4K | Tasks 1–3 |
| Konva manual draw + undo | Task 3 |
| Optional AI drafts | Task 4 |
| Norm + 1K/2K/4K JSON | Tasks 1–3 |
| Height-aligned ultrawide formula | Tasks 1–2 |
| Docker + browser | Task 5 |
| Tauri EXE skeleton | Task 6 |
| AI optional / disabled path | Task 4 |

## Placeholder scan

No TBD steps; geometry numbers locked to spec; agent disable path explicit.

## Type consistency

- `norm` / `px` / tiers `"1k"|"2k"|"4k"` shared naming across TS + Python
- `buildExportPack` / `build_export_pack` same field names as design spec §4.4
- API routes `/health`, `/v1/calibrations/export-preview`, `/v1/agent/suggest-rois`

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-13-sc-roi-forge-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks  

**2. Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
