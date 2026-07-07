import pytest

from src.tools.ws_client import DeviceConnection


pytestmark = pytest.mark.no_global_login


def test_device_connection_debug_logging_defaults_off():
    conn = DeviceConnection(topic="topic-a", device="deviceA")

    assert conn._debug_dump is False


def test_device_connection_debug_logging_can_be_enabled():
    conn = DeviceConnection(topic="topic-a", device="deviceA", debug=True)

    assert conn._debug_dump is True
