# Start the FastAPI backend beside the Tauri shell (Windows dev).
# From repo root:
#   .\apps\desktop\scripts\run-api-sidecar.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")

Push-Location (Join-Path $Root "apps\api")
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Host "Create apps/api .venv first (see apps/api README / root quick start)."
  exit 1
}

$env:SC_ROI_AGENT_ENABLED = "0"
& .\.venv\Scripts\python.exe -m uvicorn sc_roi_api.main:app --host 127.0.0.1 --port 8000
Pop-Location
