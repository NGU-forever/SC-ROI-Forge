from fastapi.testclient import TestClient
from sc_roi_api.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_export_preview():
    r = client.post(
        "/v1/calibrations/export-preview",
        json={
            "aspect_ratio": "16:9",
            "rois": [
                {
                    "id": "a",
                    "label": "speed",
                    "category": "telemetry",
                    "norm": {"x": 0.02, "y": 0.85, "w": 0.12, "h": 0.08},
                }
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["compliance"] == "vision_only"
    assert body["rois"][0]["px"]["1k"]["x"] == 38
