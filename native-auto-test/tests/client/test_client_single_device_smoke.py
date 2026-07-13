"""Single-device client smoke checks for platform launch diagnostics."""
from __future__ import annotations

import pytest

from src import Cmd
from tests.case_steps import describe_case_steps


pytestmark = [pytest.mark.client, pytest.mark.session_lifecycle]


@pytest.mark.case_id("client.login.current_user.success")
@pytest.mark.api("Client.login")
@pytest.mark.api("Client.getCurrentUser")
def test_single_device_login_and_get_current_user(device_a, user_a, assert_api):
    """
    1. 在 session lifecycle 单设备 smoke 中，先调用 Client.getCurrentUser 判断 deviceA 是否已登录；
    2. 若未登录，则按需创建测试账号并调用 Client.login 登录 deviceA；
    3. 再次调用 Client.getCurrentUser 校验当前用户为 userA，最后执行 Client.logout 清理登录态。
    """
    describe_case_steps(
        "1. 在 session lifecycle 单设备 smoke 中，先调用 Client.getCurrentUser 判断 deviceA 是否已登录；\n"
        "2. 若未登录，则按需创建测试账号并调用 Client.login 登录 deviceA；\n"
        "3. 再次调用 Client.getCurrentUser 校验当前用户为 userA，最后执行 Client.logout 清理登录态。"
    )
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
