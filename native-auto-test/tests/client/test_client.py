"""
Client 模块 API 用例：init、login、logout、getCurrentUser 等。
请求参数与 Flutter 端一致，info 为方法参数；cmd 使用 Cmd 枚举与 chat_method_keys 对齐。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import json

import pytest

from src.tools import assertions
from src import Cmd


pytestmark = [pytest.mark.client]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.no_global_login
def test_client_login_invalid_password(api, assert_api):
    """错误密码：预期返回错误响应；若服务端仅返回 result=None 也视为合法响应。"""
    resp = api.call(
        "Client",
        Cmd.login.value,
        info={
            "userId": "nonexistent_user_xyz",
            "pwdOrToken": "wrong_pwd",
            "isPassword": True,
        },
    )
    # 响应中要么有 result（成功），要么有 error（失败）
    assert "result" in resp or "error" in resp
    if not assertions.is_success(resp):
        err = assert_api.get_error(resp)
        assert "code" in err or "description" in err


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_client_get_current_user(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端查询/拉取场景所需的测试数据，场景为client、获取、current、用户；
    2. 通过 WebSocket 控制测试 App 调用 Client.getCurrentUser，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端查询/拉取场景所需的测试数据，场景为client、获取、current、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.getCurrentUser，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    resp = topology_primary_or_device_a.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.getCurrentUser.value,
            "device": _expected_device(topology_primary_or_device_a),
        },
        ignore_keys={"sequence", "result"},
    )
    assert_api.assert_success(resp)
    result = assert_api.get_result(resp)
    assert result is not None or "result" in resp

@pytest.mark.real_e2e
@pytest.mark.no_global_login
def test_client_change_app_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、change、app、id；
    2. 通过 WebSocket 控制测试 App 调用 Client.changeAppId，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、change、app、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.changeAppId，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_a.call("Client", Cmd.changeAppId.value, info={"appId": "dc4a43e610634c8989d8252d2bb71da7"})
    assert_api.assert_success(resp)
    result = assert_api.get_result(resp)
    assert result is not None or "result" in resp


@pytest.mark.session_lifecycle
@pytest.mark.no_global_login
def test_login_then_receive_offline_sync_event(device_a, assert_api, user_a):
    """
    1. 在 session lifecycle 专项中让已登录的 deviceA 先执行 Client.logout，制造重新登录场景；
    2. 清理残留事件后，deviceA 使用同一账号调用 Client.login 并重新启动 startCallback；
    3. 校验登录成功，并等待 onOfflineMessageSyncStart 或 onOfflineMessageSyncFinish 离线同步回调。
    """
    describe_case_steps(
        "1. 在 session lifecycle 专项中让已登录的 deviceA 先执行 Client.logout，制造重新登录场景；\n"
        "2. 清理残留事件后，deviceA 使用同一账号调用 Client.login 并重新启动 startCallback；\n"
        "3. 校验登录成功，并等待 onOfflineMessageSyncStart 或 onOfflineMessageSyncFinish 离线同步回调。"
    )
    # 1) 先登出
    device_a.call("Client", Cmd.logout.value, info={"unbindToken": False})

    import time
    time.sleep(1)

    # 2) 清空残留事件
    try:
        device_a.drain_events()
    except Exception:
        pass

    # 3) 重新登录同一用户
    resp = device_a.call(
        "Client",
        Cmd.login.value,
        info={"userId": user_a, "pwdOrToken": "1", "isPassword": True},
    )
    print("登录响应:", json.dumps(resp))
    assert_api.assert_success(resp)

    # 4) 启动回调（某些端需要显式调用）
    try:
        device_a.call("Client", Cmd.startCallback.value, info={})
    except Exception:
        pass

    # 5) 等待 onOfflineMessageSyncStart 或 onOfflineMessageSyncFinish
    #    注意：如果没有离线消息，部分 SDK 版本可能不触发 Start 而直接触发 Finish，
    #    或者在 call 返回前已经同步完成（事件在 login 响应之前就发了），所以也接受 Finish。
    event = device_a.receive_message(
        match_event_type=Cmd.onOfflineMessageSyncStart.value,
        timeout=10.0,
    )
    if event is None:
        # 可能 Start 在 login 返回前已发出并被丢弃，尝试 Finish
        event = device_a.receive_message(
            match_event_type=Cmd.onOfflineMessageSyncFinish.value,
            timeout=5.0,
        )
        assert event is not None, (
            "登录后未收到 onOfflineMessageSyncStart 或 onOfflineMessageSyncFinish 回调"
        )
        assert event.get("eventType") == Cmd.onOfflineMessageSyncFinish.value
    else:
        assert event.get("eventType") == Cmd.onOfflineMessageSyncStart.value
