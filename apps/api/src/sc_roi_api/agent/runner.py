from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from sc_roi_api.agent.graph import build_suggest_graph


def agent_enabled() -> bool:
    return os.getenv("SC_ROI_AGENT_ENABLED", "1") not in {"0", "false", "False"}


def _norm_ok(n: dict[str, Any]) -> dict[str, float] | None:
    if not all(k in n for k in ("x", "y", "w", "h")):
        return None
    try:
        x, y, w, h = float(n["x"]), float(n["y"]), float(n["w"]), float(n["h"])
    except (TypeError, ValueError):
        return None
    if not all(0.0 <= v <= 1.0 for v in (x, y, w, h)):
        return None
    if w <= 0.0 or h <= 0.0:
        return None
    return {"x": x, "y": y, "w": w, "h": h}


def validate_rois(rois: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rois:
        n = _norm_ok(r.get("norm") or {})
        if n is None:
            continue
        out.append(
            {
                "id": str(r.get("id") or f"roi_{len(out)}"),
                "label": str(r.get("label") or "unknown"),
                "category": str(r.get("category") or "ui"),
                "norm": n,
            }
        )
    return out


def validate_chat_ops(
    ops: list[dict[str, Any]],
    known_ids: set[str],
) -> dict[str, Any]:
    out: list[dict[str, Any]] = []
    skipped_ids: list[str] = []
    add_i = 0
    for raw in ops:
        op = str(raw.get("op") or "")
        if op == "add":
            label = raw.get("label")
            n = _norm_ok(raw.get("norm") or {})
            if not label or n is None:
                continue
            add_i += 1
            out.append(
                {
                    "op": "add",
                    "id": str(raw.get("id") or f"roi_{add_i}"),
                    "label": str(label),
                    "category": str(raw.get("category") or "ui"),
                    "norm": n,
                }
            )
        elif op == "update":
            oid = raw.get("id")
            if not oid or str(oid) not in known_ids:
                if oid:
                    skipped_ids.append(str(oid))
                continue
            item: dict[str, Any] = {"op": "update", "id": str(oid)}
            if raw.get("label") is not None:
                item["label"] = str(raw["label"])
            if raw.get("category") is not None:
                item["category"] = str(raw["category"])
            if "norm" in raw and raw["norm"] is not None:
                n = _norm_ok(raw["norm"] or {})
                if n is None:
                    continue
                item["norm"] = n
            out.append(item)
        elif op == "delete":
            oid = raw.get("id")
            if not oid or str(oid) not in known_ids:
                if oid:
                    skipped_ids.append(str(oid))
                continue
            out.append({"op": "delete", "id": str(oid)})
    return {"ops": out, "skipped_ids": skipped_ids}


class ChatRoiOp(BaseModel):
    op: Literal["add", "update", "delete"]
    id: str | None = None
    label: str | None = None
    category: str | None = None
    norm: dict[str, float] | None = None


class ChatRoiResult(BaseModel):
    message: str = Field(description="Short explanation for the user")
    ops: list[ChatRoiOp] = Field(default_factory=list)


CHAT_SYSTEM = """You calibrate HUD ROIs from a screenshot only (vision).
You receive the current ROI list and a chat history. Reply with a short message
and ops: add / update / delete. norm x,y,w,h must be 0..1 with positive w,h.
Never discuss memory, injection, or game processes."""


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


async def run_chat_rois(
    *,
    image_bytes: bytes,
    messages: list[dict[str, Any]],
    rois: list[dict[str, Any]],
    aspect_ratio: str,
    api_key: str,
) -> dict[str, Any]:
    if not agent_enabled():
        raise RuntimeError("Agent is disabled")
    if not api_key:
        raise RuntimeError("API key required")

    base_url = (os.getenv("SC_ROI_LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("SC_ROI_LLM_MODEL") or "gpt-4o-mini"
    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0,
    ).with_structured_output(ChatRoiResult)

    b64 = base64.b64encode(image_bytes).decode("ascii")
    compact_rois = [
        {
            "id": r.get("id"),
            "label": r.get("label"),
            "category": r.get("category"),
            "norm": r.get("norm"),
        }
        for r in rois
    ]
    text = (
        f"aspect={aspect_ratio}\n"
        f"current_rois={json.dumps(compact_rois, ensure_ascii=False)}\n"
        f"messages={json.dumps(messages, ensure_ascii=False)}"
    )
    user = HumanMessage(
        content=[
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]
    )

    def _invoke() -> ChatRoiResult:
        result = llm.invoke([SystemMessage(content=CHAT_SYSTEM), user])
        if isinstance(result, ChatRoiResult):
            return result
        return ChatRoiResult.model_validate(result)

    parsed = await asyncio.to_thread(_invoke)
    known = {str(r["id"]) for r in rois if r.get("id")}
    raw_ops = [o.model_dump(exclude_none=True) for o in parsed.ops]
    validated = validate_chat_ops(raw_ops, known)
    message = parsed.message or ""
    if validated["skipped_ids"]:
        skipped = ", ".join(validated["skipped_ids"])
        note = f"Skipped unknown ROI id(s): {skipped}."
        message = f"{message} {note}".strip() if message else note
    return {"message": message, "ops": validated["ops"]}
