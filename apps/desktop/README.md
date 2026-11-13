# SC ROI Forge — Desktop (Tauri 2)

Windows-focused **Tauri 2** shell that loads the shared Vite/React UI from `apps/web`. The FastAPI backend is expected at **`http://127.0.0.1:8000`** (same as browser dev with Vite proxy).

MVP scope:

- **EXE UI** via `tauri build` (developer machine).
- **API sidecar**: documented scripts + Tauri `externalBin` hook; full **PyInstaller** bundling is follow-up polish.
- If `sc-roi-api` is not bundled next to the EXE, start uvicorn manually — the UI still works when the API is up.

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Rust](https://rustup.rs/) stable + `cargo` | Builds the native shell |
| MSVC Build Tools (Windows) | `x86_64-pc-windows-msvc` target |
| [Node.js](https://nodejs.org/) 20+ | Web build + `@tauri-apps/cli` |
| WebView2 (Windows) | Usually preinstalled on Win11; bootstrapper configured in `tauri.conf.json` |

From repo root (once):

```bash
npm install
```

Install desktop CLI (workspace):

```bash
npm install --workspace @sc-roi/desktop
```

## Development

**Terminal A — API** (required for health / export / optional agent):

```bash
# macOS/Linux
./apps/desktop/scripts/run-api-sidecar.sh

# Windows PowerShell
.\apps\desktop\scripts\run-api-sidecar.ps1
```

**Terminal B — Desktop shell:**

```bash
cd apps/desktop
npm run dev
```

`tauri dev` runs `apps/web` on **`http://127.0.0.1:1420`** (see `src-tauri/tauri.conf.json`). Vite dev proxy still forwards `/health` and `/v1` to port 8000.

## Production / Windows EXE

1. Ensure `apps/web` builds: production sets `VITE_API_URL=http://127.0.0.1:8000` in `beforeBuildCommand` so fetches hit the local API (no Vite proxy in the bundled `dist/`).
2. From `apps/desktop`:

```powershell
npm run build
```

Artifacts (typical):

- `apps/desktop/src-tauri/target/release/bundle/msi/*.msi`
- `apps/desktop/src-tauri/target/release/bundle/nsis/*-setup.exe`
- `apps/desktop/src-tauri/target/release/sc-roi-forge-desktop.exe`

Exact paths depend on Tauri bundler settings and target triple.

### Sidecar binary (optional)

Place a PyInstaller (or other) build at:

`apps/desktop/src-tauri/binaries/sc-roi-api-<TARGET_TRIPLE>[.exe]`

Example Windows name: `sc-roi-api-x86_64-pc-windows-msvc.exe`

On app startup, `src/lib.rs` attempts `shell().sidecar("sc-roi-api")`. If missing, it logs and continues — **start the API separately** for MVP.

## Layout

```
apps/desktop/
  package.json          # @tauri-apps/cli scripts
  scripts/              # uvicorn helpers for dev
  src-tauri/
    tauri.conf.json     # devUrl :1420, frontendDist ../web/dist
    capabilities/       # shell sidecar permissions
    binaries/           # sc-roi-api placeholders (see README there)
    src/lib.rs          # sidecar spawn hook
```

## Limitations (this worktree)

Scaffold was committed **without** running `cargo` / `tauri build` on the agent host (Rust toolchain not installed there). Validate on a Windows dev box:

```bash
rustc --version
cargo install tauri-cli   # or use npm @tauri-apps/cli
cd apps/desktop && npm run dev
```

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Blank window in dev | Web dev server on 1420; `beforeDevCommand` logs |
| API errors in UI | `curl http://127.0.0.1:8000/health` |
| CSP blocked fetch | `connect-src` includes `http://127.0.0.1:8000` in `tauri.conf.json` |
| Sidecar won't start | Binary name must match target triple; see `binaries/README.md` |

## Follow-ups (post-MVP)

- PyInstaller spec for `sc-roi-api` + CI artifact into `binaries/`
- Single-installer story (NSIS custom action to start sidecar)
- Code signing for Windows distribution
