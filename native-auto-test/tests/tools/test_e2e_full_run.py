import pytest

from src.tools.e2e_full_run import build_android_runner_commands, build_stage_commands


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


def test_full_run_android_matrix_delegates_to_real_android_runner():
    commands = build_android_runner_commands(
        client_args=["android:a@4.23.0", "android:b@4.23.0"],
        sdk_version_args=[],
        run_id="android-20260706-153000",
        output_root="out",
        platform_matrix="android-android",
        pytest_args=["tests", "--target-platform", "android", "-m", "real_e2e and not web", "-q"],
    )

    assert [command[2] for command in commands] == [
        "src.tools.android_e2e_runner",
        "src.tools.e2e_api_coverage",
    ]
    assert commands[0][:4] == [
        pytest.importorskip("sys").executable,
        "-m",
        "src.tools.android_e2e_runner",
        "--run-id",
    ]
    assert "android-20260706-153000" in commands[0]
    assert "--" in commands[0]
    assert commands[0][-6:] == ["tests", "--target-platform", "android", "-m", "real_e2e and not web", "-q"]
    assert commands[1][-6:] == [
        "--pytest-report",
        "out/log/android/android-20260706-153000-android-pytest.html",
        "--platform",
        "android",
        "--sdk-version",
        "4.23.0",
    ]
    assert "out/api-coverage/android-20260706-153000-gap-backlog.csv" in commands[1]


def test_full_run_android_matrix_requires_android_clients():
    with pytest.raises(ValueError, match="android-android"):
        build_android_runner_commands(
            client_args=["android:a@4.23.0", "ios:b@4.23.0"],
            sdk_version_args=[],
            run_id="android-20260706-153000",
            output_root="out",
            platform_matrix="android-android",
            pytest_args=[],
        )
