from __future__ import annotations

import re
from typing import Any

TIER_HEIGHTS = {"1k": 1080, "2k": 1440, "4k": 2160}
_ASPECT_RE = re.compile(r"^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$")


def parse_aspect_ratio(s: str) -> float:
    m = _ASPECT_RE.match(s.strip())
    if not m:
        raise ValueError(f"Invalid aspect ratio: {s}")
    a, b = float(m.group(1)), float(m.group(2))
    if a <= 0 or b <= 0:
        raise ValueError(f"Invalid aspect ratio: {s}")
    return a / b


def tier_resolutions(aspect: str) -> dict[str, dict[str, int]]:
    r = parse_aspect_ratio(aspect)
    return {
        tier: {"w": round(h * r), "h": h}
        for tier, h in TIER_HEIGHTS.items()
    }


def norm_to_px(norm: dict[str, float], width: int, height: int) -> dict[str, int]:
    def clamp(v: int, max_v: int) -> int:
        return max(0, min(max_v, v))

    x = clamp(round(norm["x"] * width), width - 1)
    y = clamp(round(norm["y"] * height), height - 1)
    w = clamp(round(norm["w"] * width), width - x)
    h = clamp(round(norm["h"] * height), height - y)
    return {"x": x, "y": y, "w": w, "h": h}


def build_export_pack(aspect_ratio: str, rois: list[dict[str, Any]]) -> dict[str, Any]:
    resolutions = tier_resolutions(aspect_ratio)
    out_rois = []
    for roi in rois:
        px = {
            tier: norm_to_px(roi["norm"], res["w"], res["h"])
            for tier, res in resolutions.items()
        }
        out_rois.append({**roi, "px": px})
    return {
        "schema_version": "1.0",
        "aspect_ratio": aspect_ratio,
        "compliance": "vision_only",
        "resolutions": resolutions,
        "rois": out_rois,
    }
