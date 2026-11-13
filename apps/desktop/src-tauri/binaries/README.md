# Sidecar binaries (placeholder)

Tauri expects target-triple suffixed executables here, e.g.:

- `sc-roi-api-x86_64-pc-windows-msvc.exe` (Windows release)
- `sc-roi-api-x86_64-apple-darwin` (macOS dev smoke)

MVP does **not** ship a PyInstaller build. Drop a built `sc-roi-api` binary when ready, or start the API with uvicorn beside the desktop shell (documented in `../README.md`).
