import pytest

from src.tools.topology_fixture import Topology
from tests.conftest import _LegacyTopologyDeviceAlias, _legacy_topology_client_name


pytestmark = pytest.mark.no_global_login


def _context():
    return {
        "run_id": "run-1",
        "accounts": {
            "primary": {"user_id": "user1", "clients": ["primary_a", "primary_b"]},
            "remote": {"user_id": "user2", "clients": ["remote_c"]},
        },
        "clients": {
            "primary_a": {
                "platform": "android",
                "account": "primary",
                "user_id": "user1",
                "sdk_version": "4.23.0",
                "device": {"id": "emulator-5554"},
                "relay": {"topic": "im-auto-run-1-primary_a"},
            },
            "primary_b": {
                "platform": "android",
                "account": "primary",
                "user_id": "user1",
                "sdk_version": "4.23.0",
                "device": {"id": "emulator-5556"},
                "relay": {"topic": "im-auto-run-1-primary_b"},
            },
            "remote_c": {
                "platform": "android",
                "account": "remote",
                "user_id": "user2",
                "sdk_version": "4.23.0",
                "device": {"id": "emulator-5560"},
                "relay": {"topic": "im-auto-run-1-remote_c"},
            },
        },
        "capabilities": {
            "primary_multi_device_sync": True,
            "remote_multi_device_sync": False,
            "server_api": True,
        },
    }


def test_topology_returns_role_clients_without_starting_connection():
    topology = Topology.from_context(_context(), start_connections=False)

    assert topology.primary_client(0).name == "primary_a"
    assert topology.primary_client(1).user_id == "user1"
    assert topology.remote_client(0).name == "remote_c"
    assert topology.supports("primary_multi_device_sync") is True
    assert topology.supports("remote_multi_device_sync") is False
    assert topology.marker("send-text").startswith("run-1-send-text-")


def test_legacy_device_aliases_prefer_primary_sender_and_remote_peer():
    assert _legacy_topology_client_name(_context(), "deviceA") == "primary_a"
    assert _legacy_topology_client_name(_context(), "deviceB") == "remote_c"
    assert _legacy_topology_client_name(_context(), "primary") == "primary_a"
    assert _legacy_topology_client_name(_context(), "secondary") == "remote_c"


def test_legacy_topology_device_alias_normalizes_response_device_field():
    class FakeClient:
        name = "primary_a"

        def call(self, *_args, **_kwargs):
            return {"device": "primary_a", "result": {"nested": {"device": "primary_a"}}}

    wrapped = _LegacyTopologyDeviceAlias(FakeClient(), "deviceA")

    assert wrapped.name == "deviceA"
    assert wrapped.call("Client", "getCurrentUser") == {
        "device": "deviceA",
        "result": {"nested": {"device": "primary_a"}},
    }


def test_topology_case_scope_creates_marker_and_drains_selected_clients():
    class FakeClient:
        def __init__(self, name):
            self.name = name
            self.drained = []

        def drain_events(self, timeout=0.5):
            self.drained.append(timeout)

    topology = Topology.from_context(_context(), start_connections=False)
    primary = FakeClient("primary_a")
    remote = FakeClient("remote_c")

    scope = topology.case_scope("send text", clients=[primary, remote])

    assert scope.marker.startswith("run-1-send-text-")
    assert scope.clients == [primary, remote]
    assert primary.drained == [0.5]
    assert remote.drained == [0.5]


def test_topology_case_scope_fails_when_pre_case_drain_fails():
    class BrokenDrainClient:
        name = "primary_a"

        def drain_events(self, timeout=0.5):
            raise RuntimeError("drain socket closed")

    topology = Topology.from_context(_context(), start_connections=False)

    with pytest.raises(RuntimeError, match="drain socket closed"):
        topology.case_scope("send text", clients=[BrokenDrainClient()])
