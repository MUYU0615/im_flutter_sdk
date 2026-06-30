"""Real Web SDK Client session E2E cases."""

from __future__ import annotations

import pytest

from src import Cmd
from src.rest_api.user_api import get_user_access_token


pytestmark = [pytest.mark.web, pytest.mark.client, pytest.mark.real_web]


def test_real_web_client_session_imsdk_runtime_status(primary_device, assert_api):
    status = primary_device.call("Client", "getRealSdkStatus", info={})
    result = assert_api.get_result(status)
    assert isinstance(result, dict)
    assert result["available"] is True
    assert result["sdkMode"] == "real_sdk"
    assert result["globalName"] in ("IMSDK", "WebIM", "EasemobChat", "Easemob")

    debug = primary_device.call("Client", "getRealSdkDebug", info={})
    events = assert_api.get_result(debug)
    assert isinstance(events, list)


def test_real_web_client_session_imsdk_runtime_token_login(
    primary_device,
    assert_api,
    user_a,
):
    token = get_user_access_token(user_a, "1")

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    login = primary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token},
    )
    assert_api.assert_result_equals(login, user_a)

    connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(connected, True)

    debug = primary_device.call("Client", "getRealSdkDebug", info={})
    events = assert_api.get_result(debug)
    assert isinstance(events, list)
    assert any(event.get("type") == "imsdk_init_success" for event in events)
    assert any(
        event.get("type") == "login_success" and event.get("runtime") == "imsdk"
        for event in events
    )


def test_real_web_client_session_state_and_logout_restore(
    primary_device,
    assert_api,
    user_a,
):
    current = primary_device.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(current, user_a)

    token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(token, "1")

    connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(connected, True)

    logged = primary_device.call("Client", Cmd.isLoggedInBefore.value, info={})
    assert_api.assert_result_equals(logged, True)

    device = primary_device.call("Client", Cmd.getCurrentDeviceId.value, info={})
    device_result = assert_api.get_result(device)
    assert isinstance(device_result, dict)
    assert isinstance(device_result.get("deviceUUID"), str)
    assert device_result["deviceUUID"]

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    logged_out_connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(logged_out_connected, False)

    logged_out_user = primary_device.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(logged_out_user, None)

    logged_out_token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(logged_out_token, None)

    restore = primary_device.call(
        "Client",
        Cmd.login.value,
        info={"userId": user_a, "pwdOrToken": "1", "isPassword": True},
    )
    assert_api.assert_result_equals(restore, user_a)

    restored_connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(restored_connected, True)


def test_real_web_client_login_and_renew_with_user_access_token(
    primary_device,
    assert_api,
    user_a,
):
    token = get_user_access_token(user_a, "1")

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    login = primary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token},
    )
    assert_api.assert_result_equals(login, user_a)

    current_token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(current_token, token)

    connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(connected, True)

    fresh_token = get_user_access_token(user_a, "1")
    renew = primary_device.call(
        "Client",
        Cmd.renewToken.value,
        info={"agora_token": fresh_token},
    )
    assert_api.assert_result_equals(renew, True)

    renewed_token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(renewed_token, fresh_token)

    debug = primary_device.call("Client", "getRealSdkDebug", info={})
    events = assert_api.get_result(debug)
    assert isinstance(events, list)
    assert any(event.get("type") == "renewToken_success" for event in events)


def test_real_web_client_connected_event_imsdk_runtime(
    primary_device,
    assert_api,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})

    event = primary_device.receive_message(
        match_event_type=Cmd.onConnected.value,
        timeout=10.0,
    )
    assert event is not None
    assert event.get("eventType") == Cmd.onConnected.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("connected") is True


def test_real_web_client_disconnected_event_imsdk_runtime(
    primary_device,
    assert_api,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    event = primary_device.receive_message(
        match_event_type=Cmd.onDisconnected.value,
        timeout=10.0,
    )
    assert event is not None
    assert event.get("eventType") == Cmd.onDisconnected.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("connected") is False
