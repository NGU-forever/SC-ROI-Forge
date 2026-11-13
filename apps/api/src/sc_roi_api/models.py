from pydantic import BaseModel, Field


class RectNorm(BaseModel):
    x: float
    y: float
    w: float
    h: float


class RoiIn(BaseModel):
    id: str
    label: str
    category: str
    norm: RectNorm


class ExportPreviewRequest(BaseModel):
    aspect_ratio: str = Field(examples=["16:9"])
    rois: list[RoiIn]
