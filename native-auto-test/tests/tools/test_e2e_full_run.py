import pytest
import yaml

from src.tools.e2e_full_run import build_parser, build_topology_runner_commands, main


pytestmark = pytest.mark.no_global_login


def test_full_run_topology_builds_prepare_runner_coverage_stages():
    commands = build_topology_runner_commands(
        topology="config/topologies/android-primary-dual-remote.yaml",
        run_id="android-topology-001",
        output_root="out",
        device_args=[
            "primary_a=emulator-5554",
            "primary_b=emulator-5556",
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
    assert "--client" not in commands[0]
    assert "--platform-matrix" not in commands[0]
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


def test_full_run_parser_requires_topology():
    with pytest.raises(SystemExit):
        build_parser().parse_args(["--run-id", "android-topology-002"])


def test_full_run_parser_rejects_removed_client_args():
    with pytest.raises(SystemExit):
        build_parser().parse_args(
            [
                "--topology",
                "config/topologies/android-primary-dual-remote.yaml",
                "--run-id",
                "android-topology-002",
                "--client",
                "android:a@4.23.0",
            ]
        )


def test_full_run_requires_topology_in_main():
    with pytest.raises(SystemExit, match="2"):
        main(["--run-id", "android-topology-003"])
