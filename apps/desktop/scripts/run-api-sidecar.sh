#!/usr/bin/env bash
# Start the FastAPI backend beside the Tauri shell (macOS/Linux dev).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/apps/api"

if [[ ! -x .venv/bin/python ]]; then
  echo "Create apps/api .venv first (see root quick start)."
  exit 1
fi

export SC_ROI_AGENT_ENABLED=0
exec .venv/bin/python -m uvicorn sc_roi_api.main:app --host 127.0.0.1 --port 8000
