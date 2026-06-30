"""Web Client event forwarding regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


def test_web_client_start_callback_emits_connected_event(
    primary_device,
    assert_api,
    require_capability,
):
    require_capability("Client", Cmd.startCallback.value)
    require_capability("Unclassified", Cmd.onConnected.value)

    primary_device.drain_events(timeout=0.2)

    resp = primary_device.call("Client", Cmd.startCallback.value, info={})
    assert_api.assert_result_equals(resp, True)

    event = primary_device.receive_message(
        match_event_type=Cmd.onConnected.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == Cmd.onConnected.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("device") == "webA"
    assert data.get("connected") is True


def test_web_client_logout_emits_disconnected_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
):
    require_capability("Client", Cmd.logout.value)
    require_capability("Client", Cmd.login.value)
    require_capability("Unclassified", Cmd.onDisconnected.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    resp = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(resp, True)

    event = primary_device.receive_message(
        match_event_type=Cmd.onDisconnected.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == Cmd.onDisconnected.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("device") == "webA"
    assert data.get("connected") is False

    restore = primary_device.call(
        "Client",
        Cmd.login.value,
        info={"userId": user_a, "pwdOrToken": "1", "isPassword": True},
    )
    assert_api.assert_result_equals(restore, user_a)
