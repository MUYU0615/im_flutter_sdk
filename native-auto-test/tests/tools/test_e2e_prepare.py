from pathlib import Path

import pytest
import yaml

from src.tools import e2e_prepare


pytestmark = pytest.mark.no_global_login


def _config() -> dict:
    return {
        "accounts": {
            "users": {
                "a": {"username": "du001"},
                "b": {"username": "du002"},
            }
        }
    }


def test_prepare_builds_topology_context(tmp_path: Path):
    context = e2e_prepare.build_prepare_context(
        topology="config/topologies/android-primary-dual-remote.yaml",
        output_root=tmp_path,
        device_args=[
            "primary_a=emulator-5554",
            "primary_b=emulator-5556",
            "remote_c=emulator-5560",
        ],
        install_mode="clean",
        run_id="android-topology-001",
        available_devices=["emulator-5554", "emulator-5556", "emulator-5560"],
        config=_config(),
    )

    assert context["run_id"] == "android-topology-001"
    assert context["topology"]["name"] == "android_primary_dual_remote"
    assert context["clients"]["primary_a"]["device"]["id"] == "emulator-5554"
    assert context["clients"]["primary_b"]["device"]["id"] == "emulator-5556"
    assert context["artifacts"]["case_results_json"].endswith("-case-results.json")


def test_prepare_parser_rejects_removed_client_args():
    with pytest.raises(SystemExit):
        e2e_prepare.build_parser().parse_args(
            [
                "--topology",
                "config/topologies/android-primary-dual-remote.yaml",
                "--client",
                "android:a@4.23.0",
            ]
        )


def test_prepare_main_writes_topology_context(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(e2e_prepare, "load_config", _config)
    monkeypatch.setattr(
        "src.tools.android_e2e_runner._connected_android_devices",
        lambda: ["emulator-5554", "emulator-5556", "emulator-5560"],
    )

    code = e2e_prepare.main(
        [
            "--topology",
            "config/topologies/android-primary-dual-remote.yaml",
            "--device",
            "primary_a=emulator-5554",
            "--device",
            "primary_b=emulator-5556",
            "--device",
            "remote_c=emulator-5560",
            "--output-root",
            str(tmp_path),
            "--run-id",
            "android-topology-001",
        ]
    )

    assert code == 0
    path = tmp_path / "run" / "android-topology-001" / "context.yaml"
    data = yaml.safe_load(path.read_text())
    assert data["run_id"] == "android-topology-001"
    assert data["clients"]["remote_c"]["user_id"] == "du002"
