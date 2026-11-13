#!/usr/bin/env bash
# Simple Linux/macOS launcher (no .app installer).
# Usage: chmod +x start.sh && ./start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# Allow running from repo: deploy/unix/start.sh → repo root
if [[ -d "$ROOT/../../apps/api" ]]; then
  REPO="$(cd "$ROOT/../.." && pwd)"
else
  REPO="$ROOT"
fi

API_PID=""
cleanup() {
  if [[ -n "${API_PID}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

start_api() {
  if [[ -x "$ROOT/sc-roi-api" ]]; then
    echo "[sc-roi] starting bundled API: $ROOT/sc-roi-api"
    "$ROOT/sc-roi-api" &
    API_PID=$!
    return
  fi
  if [[ -x "$REPO/apps/desktop/src-tauri/binaries/sc-roi-api-x86_64-apple-darwin" ]]; then
    echo "[sc-roi] starting desktop binaries API"
    "$REPO/apps/desktop/src-tauri/binaries/sc-roi-api-x86_64-apple-darwin" &
    API_PID=$!
    return
  fi
  if [[ -x "$REPO/apps/api/.venv/bin/python" ]]; then
    echo "[sc-roi] starting uvicorn via apps/api .venv"
    (
      cd "$REPO/apps/api"
      export SC_ROI_AGENT_ENABLED="${SC_ROI_AGENT_ENABLED:-1}"
      .venv/bin/python -m uvicorn sc_roi_api.main:app --host 127.0.0.1 --port 8000
    ) &
    API_PID=$!
    return
  fi
  echo "[sc-roi] WARN: no API binary / .venv found. UI may fail until API is on :8000"
}

open_ui() {
  if [[ -x "$ROOT/SC-ROI-Forge" ]]; then
    echo "[sc-roi] launching $ROOT/SC-ROI-Forge"
    exec "$ROOT/SC-ROI-Forge"
  fi
  if [[ -d "$ROOT/SC-ROI-Forge.app" ]]; then
    echo "[sc-roi] opening SC-ROI-Forge.app"
    open "$ROOT/SC-ROI-Forge.app"
    wait "${API_PID:-}"
    return
  fi
  # Dev / browser fallback
  local url="http://127.0.0.1:5173"
  if curl -sf "http://127.0.0.1:8080" >/dev/null 2>&1; then
    url="http://127.0.0.1:8080"
  fi
  echo "[sc-roi] open browser: $url"
  echo "         (start web with: npm run dev --workspace @sc-roi/web  OR docker compose)"
  if command -v open >/dev/null 2>&1; then
    open "$url" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" || true
  else
    echo "Open $url in your browser."
  fi
  if [[ -n "${API_PID}" ]]; then
    wait "$API_PID"
  fi
}

start_api
# Give API a moment
sleep 1
open_ui
