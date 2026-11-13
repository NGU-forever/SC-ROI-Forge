from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sc_roi_api.geometry import build_export_pack
from sc_roi_api.models import ExportPreviewRequest

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
