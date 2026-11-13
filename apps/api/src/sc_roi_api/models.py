from pydantic import BaseModel, Field, field_validator


class RectNorm(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(ge=0, le=1)
    h: float = Field(ge=0, le=1)


class RoiIn(BaseModel):
    id: str
    label: str
    category: str
    color: str | None = None
    norm: RectNorm


class ExportPreviewRequest(BaseModel):
    aspect_ratio: str = Field(examples=["16:9"])
    rois: list[RoiIn]

    @field_validator("aspect_ratio")
    @classmethod
    def _aspect(cls, v: str) -> str:
        from sc_roi_api.geometry import parse_aspect_ratio

        parse_aspect_ratio(v)
        return v
