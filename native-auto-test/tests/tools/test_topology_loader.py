from pathlib import Path

import pytest
import yaml

from src.tools.topology_model import TopologySpec, parse_device_overrides
from src.tools.topology_loader import build_topology_context, load_topology


pytestmark = pytest.mark.no_global_login


def test_default_android_topology_declares_primary_dual_remote():
    path = Path("config/topologies/android-primary-dual-remote.yaml")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))

    spec = TopologySpec.from_dict(data, source=str(path))

    assert spec.name == "android_primary_dual_remote"
    assert spec.platforms_under_test == ("android",)
    assert spec.accounts["primary"].user_ref == "a"
    assert spec.accounts["remote"].user_ref == "b"
    assert spec.clients["primary_a"].account == "primary"
    assert spec.clients["primary_b"].account == "primary"
    assert spec.clients["remote_c"].account == "remote"
    assert spec.clients["primary_a"].platform == "android"
    assert spec.requirements.accounts["primary"].min_clients == 2
    assert spec.requirements.accounts["remote"].min_clients == 1
    assert spec.coverage.subject_clients == ("primary_a", "primary_b")
    assert spec.coverage.helper_clients == ("remote_c",)


def test_parse_device_overrides_rejects_invalid_shape():
    assert parse_device_overrides(["primary_a=emulator-5554"]) == {
        "primary_a": "emulator-5554",
    }

    with pytest.raises(ValueError, match="--device 必须是 client=device_id"):
        parse_device_overrides(["primary_a"])


def test_build_topology_context_resolves_accounts_and_devices(tmp_path):
    spec = load_topology(Path("config/topologies/android-primary-dual-remote.yaml"))
    config = {
        "accounts": {
            "users": {
                "a": {"username": "user1"},
                "b": {"username": "user2"},
            }
        },
        "rest_api": {"auth_token": "secret-token"},
    }

    context = build_topology_context(
        spec=spec,
        run_id="android-topology-001",
        output_root=tmp_path,
        config=config,
        available_devices=["emulator-5554", "emulator-5558", "emulator-5560"],
        device_overrides={},
        install_mode="clean",
    )

    assert context["run_id"] == "android-topology-001"
    assert context["topology"]["name"] == "android_primary_dual_remote"
    assert context["accounts"]["primary"]["user_id"] == "user1"
    assert context["accounts"]["remote"]["user_id"] == "user2"
    assert context["clients"]["primary_a"]["device"]["id"] == "emulator-5554"
    assert context["clients"]["primary_b"]["device"]["id"] == "emulator-5558"
    assert context["clients"]["remote_c"]["device"]["id"] == "emulator-5560"
    assert context["clients"]["primary_a"]["relay"]["topic"] == "im-auto-android-topology-001-primary_a"
    assert "secret-token" not in str(context)


def test_build_topology_context_rejects_missing_user_ref(tmp_path):
    spec = load_topology(Path("config/topologies/android-primary-dual-remote.yaml"))

    with pytest.raises(ValueError, match="user_ref a"):
        build_topology_context(
            spec=spec,
            run_id="android-topology-001",
            output_root=tmp_path,
            config={"accounts": {"users": {}}},
            available_devices=["emulator-5554", "emulator-5558", "emulator-5560"],
            device_overrides={},
            install_mode="clean",
        )
