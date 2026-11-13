from __future__ import annotations

import asyncio
import os
from typing import Any

from langchain_core.messages import HumanMessage

from sc_roi_api.agent.graph import build_suggest_graph


def agent_enabled() -> bool:
    return os.getenv("SC_ROI_AGENT_ENABLED", "1") not in {"0", "false", "False"}


def validate_rois(rois: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rois:
        n = r.get("norm") or {}
        if not all(k in n for k in ("x", "y", "w", "h")):
            continue
        if not all(0.0 <= float(n[k]) <= 1.0 for k in ("x", "y", "w", "h")):
            continue
        out.append(
            {
                "id": str(r.get("id") or f"roi_{len(out)}"),
                "label": str(r.get("label") or "unknown"),
                "category": str(r.get("category") or "ui"),
                "norm": {
                    "x": float(n["x"]),
                    "y": float(n["y"]),
                    "w": float(n["w"]),
                    "h": float(n["h"]),
                },
            }
        )
    return out


async def run_suggest_rois(
    *,
    image_bytes: bytes,
    prompt: str,
    aspect_ratio: str,
    api_key: str,
) -> list[dict[str, Any]]:
    if not agent_enabled():
        raise RuntimeError("Agent is disabled")
    if not api_key:
        raise RuntimeError("API key required")
    import base64

    base_url = (os.getenv("SC_ROI_LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("SC_ROI_LLM_MODEL") or "gpt-4o-mini"
    draft_box: dict[str, list] = {"rois": []}
    graph = build_suggest_graph(
        api_key=api_key,
        base_url=base_url,
        model=model,
        get_image_bytes=lambda: image_bytes,
        draft_box=draft_box,
    )
    b64 = base64.b64encode(image_bytes).decode("ascii")
    user = HumanMessage(
        content=[
            {"type": "text", "text": f"aspect={aspect_ratio}\n{prompt}"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]
    )
    await asyncio.to_thread(
        graph.invoke,
        {"messages": [user], "aspect_ratio": aspect_ratio, "draft_rois": []},
        config={"recursion_limit": 8},
    )
    return validate_rois(draft_box["rois"])
