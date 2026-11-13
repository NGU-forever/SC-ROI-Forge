import json
import os

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from sc_roi_api.agent.runner import agent_enabled, run_chat_rois, run_suggest_rois
from sc_roi_api.geometry import build_export_pack, parse_aspect_ratio
from sc_roi_api.models import ExportPreviewRequest, RoiIn

app = FastAPI(title="SC-ROI-Forge API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/v1/calibrations/export-preview")
def export_preview(body: ExportPreviewRequest):
    return build_export_pack(
        body.aspect_ratio,
        [r.model_dump() for r in body.rois],
    )


@app.post("/v1/agent/suggest-rois")
async def suggest_rois(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    aspect_ratio: str = Form(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    try:
        parse_aspect_ratio(aspect_ratio)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    api_key = x_api_key or os.getenv("SC_ROI_LLM_API_KEY") or ""

    if not agent_enabled():
        raise HTTPException(status_code=400, detail="Agent is disabled")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required; agent not enabled without key")

    image_bytes = await file.read()
    try:
        rois = await run_suggest_rois(
            image_bytes=image_bytes,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            api_key=api_key,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {"rois": [RoiIn.model_validate(r).model_dump() for r in rois]}


@app.post("/v1/agent/chat-rois")
async def chat_rois(
    file: UploadFile = File(...),
    aspect_ratio: str = Form(...),
    messages: str = Form(...),
    rois: str = Form(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    try:
        parse_aspect_ratio(aspect_ratio)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        messages_data = json.loads(messages)
        rois_data = json.loads(rois)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail="messages and rois must be JSON") from e

    if not isinstance(messages_data, list) or not isinstance(rois_data, list):
        raise HTTPException(status_code=422, detail="messages and rois must be JSON arrays")

    api_key = x_api_key or os.getenv("SC_ROI_LLM_API_KEY") or ""

    if not agent_enabled():
        raise HTTPException(status_code=400, detail="Agent is disabled")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required; agent not enabled without key")

    image_bytes = await file.read()
    try:
        result = await run_chat_rois(
            image_bytes=image_bytes,
            messages=messages_data,
            rois=rois_data,
            aspect_ratio=aspect_ratio,
            api_key=api_key,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return result
