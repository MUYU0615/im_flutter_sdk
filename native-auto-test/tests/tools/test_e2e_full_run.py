import pytest

from src.tools.e2e_full_run import build_stage_commands


pytestmark = pytest.mark.no_global_login


def test_full_run_builds_prepare_run_coverage_stages():
    commands = build_stage_commands(
        client_args=["android:a@4.23.0", "android:b@4.23.0"],
        sdk_version_args=[],
        run_id="android-20260706-153000",
        output_root="out",
        matrix_mode="pair",
        install_mode="clean",
        account_mode="fresh",
        device_mode="existing",
        platform_matrix="android-android",
        pytest_args=[],
    )
    assert [command[2] for command in commands] == [
        "src.tools.e2e_prepare",
        "src.tools.e2e_run",
        "src.tools.e2e_api_coverage",
    ]
    assert "--run-context" in commands[1]
