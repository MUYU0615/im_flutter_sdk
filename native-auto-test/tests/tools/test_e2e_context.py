from pathlib import Path

import pytest
import yaml

from src.tools.e2e_context import (
    ClientContext,
    RunContext,
    SdkVersionCheck,
    build_run_id,
    context_to_dict,
    write_context,
)


pytestmark = pytest.mark.no_global_login


def test_build_run_id_contains_platforms_and_timestamp():
    run_id = build_run_id(["android", "ios"], now_text="20260706-153000")
    assert run_id == "android-ios-20260706-153000"


def test_context_yaml_does_not_include_requested_sdk_version_source(tmp_path: Path):
    ctx = RunContext(
        run_id="android-20260706-153000",
        status="ready",
        matrix_mode="pair",
        device_mode="existing",
        install_mode="clean",
        account_mode="fresh",
        sdk_initialized=True,
        sdk_options_summary={
            "source": "config.yaml",
            "profile": "default",
            "app_key_present": True,
            "dns_config_enabled": True,
            "custom_server_present": False,
            "debug_enabled": True,
            "auto_login_enabled": False,
            "resolved": True,
            "resolved_platforms": ["android"],
        },
        clients={
            "a": ClientContext(
                platform="android",
                device_id="emulator-5554",
                device_source="existing",
                topic="im-auto-android-20260706-153000-a",
                requested_sdk_version="4.23.0",
                actual_sdk_version=None,
                version_required=True,
                version_check=SdkVersionCheck(status="not_checked", source="prepare_context"),
            )
        },
        accounts={
            "a": {
                "mode": "fresh",
                "status": "planned",
                "credential_ref": "config.accounts.default_password",
            }
        },
        artifacts={
            "context_path": "out/run/android-20260706-153000/context.yaml",
            "case_results_json": "out/test-results/android-20260706-153000-case-results.json",
        },
    )
    path = tmp_path / "context.yaml"
    write_context(ctx, path)
    data = yaml.safe_load(path.read_text())
    assert data["clients"]["a"]["requested_sdk_version"] == "4.23.0"
    assert data["environment"]["sdk_options_summary"]["app_key_present"] is True
    assert "requested_sdk_version_source" not in data["clients"]["a"]


def test_context_to_dict_has_required_top_level_sections():
    ctx = RunContext.empty_for_test(run_id="r1")
    data = context_to_dict(ctx)
    assert set(data) >= {"run_id", "status", "environment", "run_plan", "clients", "accounts", "artifacts"}
