import os

os.environ["SC_ROI_AGENT_ENABLED"] = "0"

from fastapi.testclient import TestClient
from sc_roi_api.main import app

client = TestClient(app)


def test_suggest_disabled():
    r = client.post(
        "/v1/agent/suggest-rois",
        files={"file": ("x.png", b"fakepng", "image/png")},
        data={"prompt": "find hud", "aspect_ratio": "16:9"},
    )
    assert r.status_code == 400
    detail = r.json()["detail"].lower()
    assert "disabled" in detail or "not enabled" in detail
