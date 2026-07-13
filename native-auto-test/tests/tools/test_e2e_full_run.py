import pytest
import yaml

from src.tools.e2e_full_run import (
    build_android_runner_commands,
    build_parser,
    build_stage_commands,
    build_topology_runner_commands,
    main,
)


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


def test_full_run_android_matrix_uses_runner_default_real_e2e_scope_when_no_pytest_args():
    commands = build_android_runner_commands(
        client_args=["android:a@4.23.0", "android:b@4.23.0"],
        sdk_version_args=[],
        run_id="android-20260708-complete",
        output_root="out",
        platform_matrix="android-android",
        pytest_args=[],
    )

    assert commands[0][2] == "src.tools.android_e2e_runner"
    assert commands[0][-1] == "--"


def test_full_run_topology_builds_prepare_runner_coverage_stages():
    commands = build_topology_runner_commands(
        topology="config/topologies/android-primary-dual-remote.yaml",
        run_id="android-topology-001",
        output_root="out",
        device_args=[
            "primary_a=emulator-5554",
            "primary_b=emulator-5558",
            "remote_c=emulator-5560",
        ],
        install_mode="clean",
        pytest_args=[
            "tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event",
            "-q",
        ],
    )

    assert [command[2] for command in commands] == [
        "src.tools.e2e_prepare",
        "src.tools.android_e2e_runner",
        "src.tools.e2e_api_coverage",
    ]
    assert "--topology" in commands[0]
    assert "--run-context" in commands[1]
    assert "out/run/android-topology-001/context.yaml" in commands[1]
    assert commands[1][-2:] == [
        "tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event",
        "-q",
    ]
    assert commands[2][-6:] == [
        "--pytest-report",
        "out/log/android/android-topology-001-android-pytest.html",
        "--platform",
        "android",
        "--sdk-version",
        "4.23.0",
    ]


def test_full_run_topology_requires_single_subject_sdk_version(tmp_path):
    topology = tmp_path / "mixed-topology.yaml"
    topology.write_text(
        yaml.safe_dump(
            {
                "schema_version": 1,
                "name": "mixed",
                "description": "mixed subject versions",
                "platforms_under_test": ["android"],
                "accounts": {"primary": {"user_ref": "a"}},
                "clients": {
                    "primary_a": {
                        "platform": "android",
                        "sdk_version": "4.23.0",
                        "account": "primary",
                        "roles": ["primary"],
                    },
                    "primary_b": {
                        "platform": "android",
                        "sdk_version": "4.24.0",
                        "account": "primary",
                        "roles": ["primary"],
                    },
                },
                "requirements": {"accounts": {"primary": {"min_clients": 2}}},
                "coverage": {"subject_clients": ["primary_a", "primary_b"], "helper_clients": []},
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="同一个 sdk_version"):
        build_topology_runner_commands(
            topology=str(topology),
            run_id="android-topology-mixed",
            output_root="out",
            device_args=[],
            install_mode="clean",
            pytest_args=[],
        )


def test_topology_command_does_not_require_client_args():
    commands = build_topology_runner_commands(
        topology="config/topologies/android-primary-dual-remote.yaml",
        run_id="android-topology-002",
        output_root="out",
        device_args=[],
        install_mode="clean",
        pytest_args=[],
    )

    assert "--client" not in commands[0]
    assert "--topology" in commands[0]


def test_full_run_parser_accepts_topology_without_client():
    args = build_parser().parse_args(
        [
            "--topology",
            "config/topologies/android-primary-dual-remote.yaml",
            "--run-id",
            "android-topology-002",
        ]
    )

    assert args.client == []
    assert args.topology == "config/topologies/android-primary-dual-remote.yaml"


def test_full_run_requires_topology_or_legacy_client_args():
    with pytest.raises(SystemExit, match="2"):
        main(["--run-id", "android-topology-003"])


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
