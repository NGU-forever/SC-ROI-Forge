"""Vision-only tools. No process/memory/filesystem beyond the request image."""
from __future__ import annotations

from typing import Any, Callable

from langchain_core.tools import tool


def build_tools(get_image_bytes: Callable[[], bytes], draft_box: dict[str, list]) -> list:
    @tool
    def ocr_region(x: float, y: float, w: float, h: float) -> str:
        """OCR a normalized crop [0..1] of the uploaded screenshot. Returns plain text."""
        _ = get_image_bytes()
        return f"ocr_stub region=({x:.3f},{y:.3f},{w:.3f},{h:.3f})"

    @tool
    def propose_rois(rois_json: str) -> str:
        """Replace draft ROI list. Argument: JSON array of {id,label,category,norm{x,y,w,h}}."""
        import json

        try:
            rois = json.loads(rois_json)
        except json.JSONDecodeError:
            return "error: rois_json must be valid JSON"
        if not isinstance(rois, list):
            return "error: rois must be a JSON array"
        draft_box["rois"] = rois
        return f"ok: stored {len(rois)} rois"

    return [ocr_region, propose_rois]
