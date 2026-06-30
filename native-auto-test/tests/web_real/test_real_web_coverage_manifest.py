from src.tools.web_real_e2e_matrix import (
    load_real_manifest,
    missing_real_e2e_entries,
    validate_real_manifest,
)


def test_web_real_e2e_manifest_is_valid():
    errors = validate_real_manifest(load_real_manifest())

    assert errors == []


def test_every_bridge_api_has_real_e2e_status():
    missing = missing_real_e2e_entries()

    assert missing == []
