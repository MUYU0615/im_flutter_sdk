from src.tools.web_coverage import load_manifest, status_counts, validate_manifest
from src.tools.web_coverage_report import _markdown_report


def test_web_coverage_manifest_is_complete():
    errors = validate_manifest(load_manifest())

    assert errors == []


def test_web_coverage_manifest_has_current_supported_baseline():
    counts = status_counts(load_manifest())

    assert counts["supported"] >= 295
    assert counts["unsupported"] == 0


def test_web_coverage_report_contains_summary_and_reason_groups():
    report = _markdown_report(load_manifest())

    assert "# Web Bridge / Local Adapter API Coverage Report" in report
    assert "This report does not prove real IM service E2E delivery." in report
    assert "| pending | 0 |" in report
    assert "## Verification Layers" in report
    assert "| json_bridge |" in report
    assert "| client_instance_manager |" in report
    assert "| public_api_unverified |" in report
    assert "| ChatManager |" in report
    assert "## E2E Evidence" in report
    assert "`tests/web/test_web_unsupported_api.py`" in report
    assert "## Not Applicable Reason Groups" in report
    assert "`Client.changeAppKey`" in report


def test_web_supported_entries_record_verification_layers():
    manifest = load_manifest()
    for manager, commands in manifest["web"].items():
        for cmd, info in commands.items():
            if info.get("status") != "supported":
                continue
            assert info["verified_by"] == ["json_bridge", "client_instance_manager"], f"{manager}.{cmd}"
            assert info["public_api_verified"] is False, f"{manager}.{cmd}"
