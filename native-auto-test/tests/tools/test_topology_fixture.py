import pytest

from src.tools.topology_fixture import Topology


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
                "device": {"id": "emulator-5558"},
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
