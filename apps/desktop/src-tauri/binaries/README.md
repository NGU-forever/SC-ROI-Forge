# Sidecar binaries

Tauri `externalBin` expects a **target-triple** suffix:

| Platform | Filename |
|----------|----------|
| Windows | `sc-roi-api-x86_64-pc-windows-msvc.exe` |
| macOS Intel | `sc-roi-api-x86_64-apple-darwin` |
| macOS ARM | `sc-roi-api-aarch64-apple-darwin` |
| Linux | `sc-roi-api-x86_64-unknown-linux-gnu` |

## Build API EXE (Windows)

From `apps/api` (Windows, with project deps installed):

```powershell
pip install pyinstaller
pip install -e .
pyinstaller packaging/sc-roi-api.spec
copy dist\sc-roi-api.exe ..\desktop\src-tauri\binaries\sc-roi-api-x86_64-pc-windows-msvc.exe
```

Then `cd apps/desktop && npm run build`, and run `scripts/pack-windows-user-zip.ps1` from the repo root.

Without a sidecar binary the UI still starts; API features need the sidecar or a separate uvicorn process.
