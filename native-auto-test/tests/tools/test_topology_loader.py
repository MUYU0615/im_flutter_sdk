from pathlib import Path

import pytest
import yaml

from src.tools.topology_model import TopologySpec, parse_device_overrides


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
