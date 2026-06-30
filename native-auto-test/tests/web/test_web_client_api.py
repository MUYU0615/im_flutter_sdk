"""Web Client foundation API regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


def test_web_client_session_state(primary_device, assert_api, require_capability):
    for cmd in (
        Cmd.startCallback,
        Cmd.isLoggedInBefore,
        Cmd.getToken,
        Cmd.getCurrentDeviceId,
        Cmd.uploadLog,
        Cmd.compressLogs,
        Cmd.getLoggedInDevicesFromServer,
        Cmd.kickDevice,
        Cmd.kickAllDevices,
    ):
        require_capability("Client", cmd.value)

    start = primary_device.call("Client", Cmd.startCallback.value, info={})
    assert_api.assert_result_equals(start, True)

    logged = primary_device.call("Client", Cmd.isLoggedInBefore.value, info={})
    assert_api.assert_result_equals(logged, True)

    token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert isinstance(assert_api.get_result(token), str)

    device = primary_device.call("Client", Cmd.getCurrentDeviceId.value, info={})
    assert_api.assert_result_matches(device, deviceUUID="web-device")

    upload = primary_device.call("Client", Cmd.uploadLog.value, info={})
    assert_api.assert_result_equals(upload, True)

    compressed = primary_device.call("Client", Cmd.compressLogs.value, info={})
    assert isinstance(assert_api.get_result(compressed), str)

    devices = primary_device.call(
        "Client",
        Cmd.getLoggedInDevicesFromServer.value,
        info={"userId": "web-user-a", "pwdOrToken": "token-a"},
    )
    assert_api.assert_result_equals(devices, [])

    kick_device = primary_device.call(
        "Client",
        Cmd.kickDevice.value,
        info={"userId": "web-user-a", "pwdOrToken": "token-a", "resource": "web"},
    )
    assert_api.assert_result_equals(kick_device, True)

    kick_all = primary_device.call(
        "Client",
        Cmd.kickAllDevices.value,
        info={"userId": "web-user-a", "pwdOrToken": "token-a"},
    )
    assert_api.assert_result_equals(kick_all, True)


def test_web_client_create_account(primary_device, assert_api, require_capability):
    require_capability("Client", Cmd.createAccount.value)

    resp = primary_device.call(
        "Client",
        Cmd.createAccount.value,
        info={"userId": "web-created-user", "password": "web-password"},
    )

    assert_api.assert_result_equals(resp, "web-created-user")


def test_web_client_exposes_sdk_mode(primary_device, assert_api):
    resp = primary_device.call("Client", "getSdkMode", info={})

    assert_api.assert_result_equals(resp, "real_sdk")


def test_web_client_reports_loaded_real_web_sdk(primary_device, assert_api):
    resp = primary_device.call("Client", "getRealSdkStatus", info={})

    result = assert_api.get_result(resp)
    assert result["available"] is True
    assert result["globalName"] == "WebIM"
    assert result["sdkMode"] == "real_sdk"


def test_web_client_renew_token(primary_device, assert_api, require_capability):
    require_capability("Client", Cmd.renewToken.value)

    resp = primary_device.call(
        "Client",
        Cmd.renewToken.value,
        info={"agora_token": "web-renew-token"},
    )

    assert_api.assert_result_equals(resp, True)


def test_web_client_login_with_agora_token(
    web_api,
    assert_api,
    user_a,
    user_c,
    require_capability,
):
    require_capability("Client", Cmd.loginWithAgoraToken.value)

    login = web_api.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_c, "agoraToken": "web-agora-token"},
    )
    assert_api.assert_result_equals(login, user_c)

    current = web_api.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(current, user_c)

    logout = web_api.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    restore = web_api.call(
        "Client",
        Cmd.login.value,
        info={"userId": user_a, "pwdOrToken": "1", "isPassword": True},
    )
    assert_api.assert_result_equals(restore, user_a)
