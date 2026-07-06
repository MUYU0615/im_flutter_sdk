"""Single-device client smoke checks for platform launch diagnostics."""
from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.client, pytest.mark.real_e2e]


def test_single_device_login_and_get_current_user(device_a, user_a, assert_api):
    """Verify one launched native test app can log in and answer Client calls."""
    current_before = device_a.call("Client", Cmd.getCurrentUser.value, info={})
    current_result = assert_api.get_result(current_before)
    if current_result == user_a:
        assert_api.assert_success(current_before)
        return

    try:
        device_a.call(
            "Client",
            Cmd.createAccount.value,
            info={"userId": user_a, "password": "1"},
            timeout=15.0,
        )
    except Exception:
        # The account may already exist or REST setup may have created it.
        pass

    login_resp = device_a.call(
        "Client",
        Cmd.login.value,
        info={"userId": user_a, "pwdOrToken": "1", "isPassword": True},
        timeout=30.0,
    )
    assert_api.assert_success(login_resp)
    login_result = assert_api.get_result(login_resp)
    assert not (
        isinstance(login_result, dict)
        and ("code" in login_result or "description" in login_result)
    ), f"login returned SDK error body: {login_result!r}"

    current_resp = device_a.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_success(current_resp)
    result = assert_api.get_result(current_resp)
    assert result == user_a

    device_a.call("Client", Cmd.logout.value, info={"unbindToken": False})
