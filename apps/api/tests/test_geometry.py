from sc_roi_api.geometry import tier_resolutions, build_export_pack


def test_tier_resolutions_16_9():
    assert tier_resolutions("16:9") == {
        "1k": {"w": 1920, "h": 1080},
        "2k": {"w": 2560, "h": 1440},
        "4k": {"w": 3840, "h": 2160},
    }


def test_tier_resolutions_21_9():
    assert tier_resolutions("21:9") == {
        "1k": {"w": 2520, "h": 1080},
        "2k": {"w": 3360, "h": 1440},
        "4k": {"w": 5040, "h": 2160},
    }


def test_build_export_pack_px():
    pack = build_export_pack(
        "16:9",
        [
            {
                "id": "a",
                "label": "speed",
                "category": "telemetry",
                "norm": {"x": 0.02, "y": 0.85, "w": 0.12, "h": 0.08},
            }
        ],
    )
    assert pack["compliance"] == "vision_only"
    assert pack["rois"][0]["px"]["1k"] == {"x": 38, "y": 918, "w": 230, "h": 86}
