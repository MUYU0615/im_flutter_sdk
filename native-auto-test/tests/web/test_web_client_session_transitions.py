"""Web Client session transition regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


def test_web_client_logout_renew_and_login_restore_session(
    primary_device,
    assert_api,
    user_a,
    require_capability,
):
    for cmd in (
        Cmd.login,
        Cmd.logout,
        Cmd.renewToken,
        Cmd.getCurrentUser,
        Cmd.getToken,
        Cmd.isLoggedInBefore,
        Cmd.isConnected,
        Cmd.startCallback,
    ):
        require_capability("Client", cmd.value)

    before_user = primary_device.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(before_user, user_a)

    before_connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(before_connected, True)

    renew = primary_device.call("Client", Cmd.renewToken.value, info={"agora_token": "web-transition-token"})
    assert_api.assert_result_equals(renew, True)

    token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(token, "web-transition-token")

    start = primary_device.call("Client", Cmd.startCallback.value, info={})
    assert_api.assert_result_equals(start, True)

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    logged_out_user = primary_device.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(logged_out_user, None)

    logged_out_token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(logged_out_token, None)

    logged_out_before = primary_device.call("Client", Cmd.isLoggedInBefore.value, info={})
    assert_api.assert_result_equals(logged_out_before, False)

    logged_out_connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(logged_out_connected, False)

    restore = primary_device.call(
        "Client",
        Cmd.login.value,
        info={"userId": user_a, "pwdOrToken": "web-restored-token", "isPassword": False},
    )
    assert_api.assert_result_equals(restore, user_a)

    restored_token = primary_device.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_result_equals(restored_token, "web-restored-token")

    restored_connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(restored_connected, True)
