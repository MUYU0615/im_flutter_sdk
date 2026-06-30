"""Flutter Web test app MVP smoke cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


def test_web_client_smoke(primary_device, assert_api, user_a, require_capability):
    require_capability("Client", Cmd.getCurrentUser.value)
    current_user = primary_device.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(current_user, user_a)

    require_capability("Client", Cmd.isConnected.value)
    connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(connected, True)
