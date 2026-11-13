# Simple User Install (Windows Pack + macOS/Linux Script) Design Spec

**Date:** 2026-11-14  
**Status:** Draft pending user review  
**Parent:** [`2026-11-13-sc-roi-forge-design.md`](./2026-11-13-sc-roi-forge-design.md)  
**Repo:** https://github.com/NGU-forever/SC-ROI-Forge

## 1. Purpose

Make SC-ROI-Forge usable by **non-technical end users** without installing Node, Python, or Rust.

- **Windows (primary):** unzip a folder → double-click `安装并启动.bat` once → then use the EXE.
- **macOS / Linux (secondary):** a simple shell script (`start.sh`) in the Linux-style “chmod +x && ./start.sh” pattern — no `.app` / `.dmg` / notarization in this round.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Audience | End-user pack (not a from-source developer setup) |
| Windows UX | Folder ZIP + first-run bat + EXE |
| First-run scope | WebView2 check + bundled local API + optional desktop shortcut |
| API for users | Bundled `sc-roi-api.exe` (PyInstaller); no Python required |
| macOS | Simple shell start (Linux-style); no fancy installer |
| Docker / MSI-only story | Out of scope for the user path |

## 3. Windows user pack layout

Release artifact: a ZIP that extracts to:

```text
SC-ROI-Forge/
  安装并启动.bat          # first-run helper (also OK to re-run)
  启动.bat                # start EXE only (skip install steps)
  SC-ROI-Forge.exe        # Tauri UI
  sc-roi-api.exe          # FastAPI sidecar (or Tauri externalBin naming)
  README-用户.txt         # 2–3 sentence Chinese how-to
```

Exact sidecar filename must match Tauri `externalBin` / target-triple conventions used by the desktop app (ship whatever name the shell expects, documented in the pack README).

### 3.1 `安装并启动.bat` behavior

1. Detect WebView2 (registry / known install markers).
2. If missing: open Microsoft’s WebView2 bootstrapper / docs page; print plain-language “install this, then double-click again”; exit without failing silently.
3. Offer or create a desktop shortcut to `SC-ROI-Forge.exe` (default: create; keep prompt simple).
4. Write a local marker file (e.g. `.installed`) so re-runs can skip redundant prompts if desired.
5. Launch `SC-ROI-Forge.exe`.

### 3.2 After first run

- Double-click `SC-ROI-Forge.exe`, `启动.bat`, or the desktop shortcut.
- No Node / Python / Rust on the machine.

## 4. Runtime (EXE ↔ API)

- On EXE start, spawn the bundled API sidecar (existing `try_spawn_api_sidecar` becomes a **required** shipping path, not an optional placeholder).
- API listens on `http://127.0.0.1:8000`; UI uses production `VITE_API_URL=http://127.0.0.1:8000`.
- On EXE exit, terminate the sidecar when feasible (avoid orphaned processes holding port 8000).
- Offline: import image, draw ROIs, export ZIP pack works without cloud.
- AI: optional; user pastes API key in UI; bat does not force key setup.
- WebView2: bat check + Tauri `downloadBootstrapper` as backup.
- User-facing failure copy (bat + `README-用户.txt`): firewall allow, AV false positive, port 8000 in use — one-line each.

## 5. macOS / Linux (simple)

- Ship `deploy/macos/` or pack-root `start.sh` that:
  - starts the local API binary (or documented equivalent), and
  - opens the UI (bundled binary if present, otherwise browser to local UI URL as documented).
- Usage: `chmod +x start.sh && ./start.sh`
- **No** `.app`, `.dmg`, notarization, or App Store flow in this spec.
- Document that users need the binary built for their arch (Apple Silicon vs Intel / Linux x64).

## 6. Maintainer / repo deliverables

| Path | Role |
|------|------|
| `deploy/windows/安装并启动.bat` | First-run template copied into user ZIP |
| `deploy/windows/启动.bat` | Launch-only script |
| `deploy/windows/README-用户.txt` | End-user Chinese readme |
| `deploy/unix/start.sh` | macOS/Linux simple launcher |
| PyInstaller spec under `apps/api` | Produce `sc-roi-api` Windows EXE |
| Desktop Tauri polish | Bundle sidecar; exit cleanup |
| `scripts/pack-windows-user-zip.ps1` (or similar) | Assemble release ZIP from build outputs |
| Root README | Short “给玩家” section linking the user pack |

Windows EXE artifacts must be built on a **Windows** machine or `windows-latest` CI. On macOS-only agent hosts, land scripts/specs first; validate packaging on Windows/CI.

## 7. Out of scope

- Auto-installing Node/Python/Rust for developers via the user bat
- Docker as the end-user install path
- Paid code-signing / store listing pipelines (follow-up)
- Fancy macOS GUI installers

## 8. Acceptance

1. Non-dev Windows PC (no Python/Node/Rust): unzip → `安装并启动.bat` → (WebView2 present) app window → import → draw → export ZIP.
2. Relaunch via EXE / `启动.bat` / shortcut still works.
3. Sidecar API comes up with the EXE; health reachable on `127.0.0.1:8000` while the app runs.
4. macOS/Linux: `./start.sh` starts the documented local flow without an `.app` installer.
5. Maintainer can produce the Windows user ZIP via documented script + Windows build.
