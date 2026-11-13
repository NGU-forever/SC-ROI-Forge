"""Entry point for PyInstaller → sc-roi-api.exe (Windows user pack sidecar)."""

from __future__ import annotations

import os


def main() -> None:
    os.environ.setdefault("SC_ROI_AGENT_ENABLED", "1")
    import uvicorn
    from sc_roi_api.main import app

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")


if __name__ == "__main__":
    main()
