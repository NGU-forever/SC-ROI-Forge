# SC-ROI-Forge Design Spec

**Date:** 2026-11-13  
**Status:** Approved (product + tech stack locked)  
**Repo:** https://github.com/NGU-forever/SC-ROI-Forge

## 1. Purpose

SC-ROI-Forge is a **vision-only** ROI (Region of Interest) calibration workbench for Star Citizen HUD / overlay workflows. Players import a screenshot, optionally ask a cloud LLM for a rough set of labeled boxes, then refine everything on a Konva canvas (or skip AI entirely and draw by hand). The tool exports a **standard JSON pack** with normalized coordinates plus absolute pixel boxes for **1K / 2K / 4K** so downstream OCR and overlay pipelines stay resolution-correct.

## 2. Compliance (non-negotiable)

In scope:

- User-provided images (file open, paste, optional OS screen capture of pixels only)
- OCR / template / detection helpers that operate on those pixels
- Optional cloud vision/LLM that receives the screenshot image and returns draft ROIs
- Canvas editing and JSON import/export

Out of scope (never implement):

- Reading game process memory or internal structures
- Memory injection, DLL injection, hooks, or process tampering
- Reverse-engineering the game client for unpublished data
- Bypassing the official client, modifying game files, or interfering with anti-cheat

All inputs are images/frames. All outputs are calibration / visualization artifacts.

## 3. Product flow

```text
Import/Paste screenshot
        → Set aspect ratio (16:9, 16:10, 21:9, 32:9, …)
        → Optional cloud AI rough ROI + labels
           OR pure manual draw
        → Konva canvas refine (move, resize, label, undo/redo)
        → Export standard JSON pack (norm + 1K/2K/4K px)
```

### 3.1 Import

- Open image file (PNG/JPEG/WebP) or paste from clipboard
- Image becomes the canvas background; no game process access

### 3.2 Aspect ratio

- User declares the intended frame: at least `16:9`, `16:10`, `21:9`, `32:9`
- Canvas letterboxes/aligns the image to the selected aspect so boxes are not drawn on the wrong framing

### 3.3 AI path (optional)

- Requires user-configured cloud API key (OpenAI-compatible)
- User can prompt e.g. “roughly recognize this HUD and suggest ROI boxes and categories”
- Draft ROIs land on the same canvas model as manual boxes; fully editable
- If no key / no tokens / user skips AI, the full manual path remains available

### 3.4 Manual / canvas path

- Draw rectangles, assign label + category, select/move/resize, delete, undo/redo
- Feels like a lightweight drawing tool; AI is never required to finish a project

### 3.5 Export

- One JSON pack containing normalized ROIs and derived pixel ROIs for 1K/2K/4K
- Import of the same schema must round-trip (norm is source of truth)

## 4. Coordinate and resolution contract

### 4.1 Tier heights (locked)

| Tier | Height (px) | 16:9 size |
|------|-------------|-----------|
| 1K   | 1080        | 1920×1080 |
| 2K   | 1440        | 2560×1440 |
| 4K   | 2160        | 3840×2160 |

### 4.2 Resolution derivation

For aspect ratio `A:B` (decimal `r = A/B`):

```text
height_1k = 1080
height_2k = 1440
height_4k = 2160
width_tier = round(height_tier * r)
```

Examples for `21:9` (`r = 21/9`):

- 1K → 2520×1080
- 2K → 3360×1440
- 4K → 5040×2160

### 4.3 ROI model

- **Source of truth:** `norm = { x, y, w, h }` each in `[0, 1]` relative to the full frame
- **Derived:** `px[tier] = { x, y, w, h }` integers via  
  `px = round(norm * dimension)` with clamping so boxes stay inside `[0, width)` / `[0, height)`
- Metadata per ROI: stable `id`, `label`, `category` (string enums extensible later)

### 4.4 Export JSON schema (v1.0)

```json
{
  "schema_version": "1.0",
  "aspect_ratio": "16:9",
  "compliance": "vision_only",
  "resolutions": {
    "1k": { "w": 1920, "h": 1080 },
    "2k": { "w": 2560, "h": 1440 },
    "4k": { "w": 3840, "h": 2160 }
  },
  "rois": [
    {
      "id": "hud_speed",
      "label": "speed",
      "category": "telemetry",
      "norm": { "x": 0.02, "y": 0.85, "w": 0.12, "h": 0.08 },
      "px": {
        "1k": { "x": 38, "y": 918, "w": 230, "h": 86 },
        "2k": { "x": 51, "y": 1224, "w": 307, "h": 115 },
        "4k": { "x": 77, "y": 1836, "w": 461, "h": 173 }
      }
    }
  ]
}
```

Rules:

- Re-export must recompute `resolutions` and `px` from `aspect_ratio` + `norm` (do not trust stale px on import)
- `compliance` is always `"vision_only"`
- Unknown future fields: ignore on import; do not strip `schema_version`

## 5. Architecture

```text
Browser ──┐
          ├──► React SPA (Konva canvas) ──HTTP/SSE──► FastAPI
Tauri EXE─┘         │                                    │
                    │                              optional cloud LLM
                    └── export/import JSON               + OCR helpers
```

### 5.1 Tech stack (locked)

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite + TypeScript + Tailwind |
| Canvas | Konva / react-konva |
| Backend | FastAPI + Uvicorn + Pydantic |
| Agent | OpenAI-compatible cloud API; disable-able; tools limited to image→draft ROIs |
| Vision | OpenCV + RapidOCR (pluggable); assist rough labeling, not required |
| Browser | Same SPA, static hosted or via API |
| Docker | Compose: `api` + static `web` |
| Windows EXE | Tauri 2 shell + Python FastAPI sidecar |
| Secrets | User settings / env; never commit API keys |

### 5.2 Repository layout

```text
apps/web          # React + Konva workbench
apps/api          # FastAPI + optional Agent + OCR
apps/desktop      # Tauri shell
deploy/docker     # Dockerfile(s) + compose
packages/schema   # Shared JSON Schema / TS + Python types
docs/             # Specs, plans, compliance notes
```

### 5.3 API surface (v1 sketch)

- `GET /health` — liveness
- `POST /v1/calibrations/export-preview` — body: aspect + norms → full pack with px
- `POST /v1/agent/suggest-rois` — multipart/base64 image + prompt → draft ROI list (requires API key; 503/400 if disabled/missing)
- No endpoints that accept process IDs, memory addresses, or injection payloads

### 5.4 Agent tools (allowed)

- Read uploaded screenshot bytes
- Suggest ROI boxes + labels/categories
- Optionally run OCR on a crop to help naming

Forbidden tool ideas: anything touching game memory, hooks, or client files.

## 6. MVP scope

**In:**

- Screenshot import / paste
- Aspect presets
- Konva manual draw + annotate + undo/redo
- Optional cloud AI rough suggest → canvas
- Standard JSON import/export (norm + 1K/2K/4K)
- Docker + browser deploy path
- Tauri EXE skeleton (sidecar boots local API)

**Out:**

- Local LLMs, Kubernetes, multi-tenant SaaS
- Forced online AI
- Any non-vision game integration

## 7. Testing and quality

- Unit tests for resolution derivation and norm↔px (Python + mirrored TS if shared package logic exists in both)
- API tests for export-preview and agent disabled behavior
- Frontend smoke: draw box → export JSON contains expected keys
- Document compliance boundary in README (already present; keep in sync)

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| AI boxes inaccurate | Always editable on canvas; AI optional |
| Ultrawide width mismatch vs marketing resolutions | Spec uses formula heights; document that 2520≠2560 for 21:9 |
| EXE packaging complexity | MVP ships Tauri skeleton; polish installers later |
| API key leakage | Local settings only; `.gitignore` env files |

## 9. Success criteria

1. User can complete a calibration **without** any AI/API key and export valid JSON
2. With API key, AI draft ROIs appear on canvas and remain editable
3. Exported pack includes correct `resolutions` and `px` for 1K/2K/4K under the locked formula
4. Docker compose brings up usable browser UI + API
5. README and this spec both state vision-only compliance

## 10. Next step

Implementation plan: `docs/superpowers/plans/2026-11-13-sc-roi-forge-mvp.md`
