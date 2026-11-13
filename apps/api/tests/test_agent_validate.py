from sc_roi_api.agent.runner import validate_rois


def test_validate_drops_oob():
    got = validate_rois(
        [
            {"id": "ok", "label": "a", "category": "ui", "norm": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}},
            {"id": "bad", "label": "b", "category": "ui", "norm": {"x": -1, "y": 0, "w": 0.2, "h": 0.2}},
        ]
    )
    assert len(got) == 1
    assert got[0]["id"] == "ok"
