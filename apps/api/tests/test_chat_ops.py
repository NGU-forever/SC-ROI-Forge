from sc_roi_api.agent.runner import validate_chat_ops


def test_validate_chat_ops_clamps_and_skips():
    known = {"a"}
    raw = [
        {
            "op": "update",
            "id": "a",
            "label": "x",
            "norm": {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2},
        },
        {"op": "delete", "id": "missing"},
        {
            "op": "add",
            "id": "b",
            "label": "radar",
            "category": "ui",
            "norm": {"x": 1.5, "y": 0, "w": 0.1, "h": 0.1},
        },
        {
            "op": "add",
            "label": "ok",
            "norm": {"x": 0.2, "y": 0.2, "w": 0.1, "h": 0.1},
        },
    ]
    got = validate_chat_ops(raw, known)
    assert "missing" in got["skipped_ids"]
    assert any(o["op"] == "update" and o["id"] == "a" for o in got["ops"])
    assert not any(o.get("id") == "b" for o in got["ops"])
    assert got["ops"][-1]["op"] == "add"
    assert got["ops"][-1]["label"] == "ok"
