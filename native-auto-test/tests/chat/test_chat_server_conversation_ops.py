from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid

import pytest

from src import Cmd, ne
from src.tools.assertions import assert_error
from tests.chat._message_helpers import send_text_and_wait
from tests.chat._utils import build_text, now_ms


def _assert_chat_response(assert_api, resp: dict, cmd: str, device: str = "deviceA", result_expected=ne(None)) -> None:
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": cmd,
            "device": device,
            "result": result_expected,
        },
        ignore_keys={"sequence"},
    )


def _send_text_and_get_real_id(device_a, device_b, assert_api, user_a: str, user_b: str, content: str) -> str:
    resp_send, success_msg, _received_msg = send_text_and_wait(
        device_a,
        device_b,
        user_a=user_a,
        user_b=user_b,
        content=content,
    )
    _assert_chat_response(assert_api, resp_send, Cmd.sendMessage.value, "deviceA", ne(None))
    send_result = resp_send.get("result") or {}
    assert str(send_result.get("from")) == str(user_a)
    assert str(send_result.get("to")) == str(user_b)
    assert str(((send_result.get("body") or {}).get("content"))) == str(content)

    real_id = success_msg.get("msgId")
    assert real_id, f"missing real msgId from onMessageSuccess: {success_msg!r}"
    return str(real_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.get_conversations_from_server.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.getConversationsFromServer")
def test_chat_get_conversations_from_server_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、conversations、from、服务端、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getConversationsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、conversations、from、服务端、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getConversationsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"server-conversation-{uuid.uuid4().hex[:6]}")
    time.sleep(2)
    resp = device_a.call("ChatManager", Cmd.getConversationsFromServer.value, info={})
    result = resp.get("result")
    projected: list[dict] = []
    if isinstance(result, list):
        projected = [
            {"convId": item.get("convId"), "type": item.get("type")}
            for item in result
            if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
        ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsFromServer.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsFromServer.value,
            "device": "deviceA",
            "result": [{"convId": "{{convId}}", "type": 0}],
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_get_conversations_from_server_with_cursor_success(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、conversations、from、服务端、with、cursor、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、conversations、from、服务端、with、cursor、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    info = {"cursor": "", "pageSize": 20}
    resp = device_a.call(
        "ChatManager",
        Cmd.getConversationsFromServerWithCursor.value,
        info=info,
    )
    result = resp.get("result")
    assert isinstance(result, dict), f"getConversationsFromServerWithCursor result 非 dict: {resp}"
    assert isinstance(result.get("cursor"), str), f"cursor 非 str: {resp}"
    assert isinstance(result.get("list"), list), f"list 非 list: {resp}"
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsFromServerWithCursor.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )


@pytest.mark.real_e2e
def test_chat_get_conversations_from_server_with_cursor_invalid_page_size_zero(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、conversations、from、服务端、with、cursor、无效参数；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、conversations、from、服务端、with、cursor、无效参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"cursor": "", "pageSize": 0}
    resp = device_a.call(
        "ChatManager",
        Cmd.getConversationsFromServerWithCursor.value,
        info=info,
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsFromServerWithCursor.value,
            "device": "deviceA",
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_get_conversations_from_server_with_cursor_invalid_page_size_negative(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、conversations、from、服务端、with、cursor、无效参数；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、conversations、from、服务端、with、cursor、无效参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"cursor": "", "pageSize": -1}
    resp = device_a.call(
        "ChatManager",
        Cmd.getConversationsFromServerWithCursor.value,
        info=info,
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsFromServerWithCursor.value,
            "device": "deviceA",
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.fetch_conversations_from_server_with_page.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.fetchConversationsFromServerWithPage")
def test_chat_fetch_conversations_from_server_with_page_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、conversations、from、服务端、with、page、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchConversationsFromServerWithPage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、conversations、from、服务端、with、page、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchConversationsFromServerWithPage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s2-fetch-page-{uuid.uuid4().hex[:6]}")
    time.sleep(2)
    resp = device_a.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    result = resp.get("result")
    projected: list[dict] = []
    if isinstance(result, list):
        projected = [
            {"convId": item.get("convId"), "type": item.get("type")}
            for item in result
            if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
        ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.fetchConversationsFromServerWithPage.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchConversationsFromServerWithPage.value,
            "device": "deviceA",
            "result": [{"convId": "{{convId}}", "type": 0}],
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_fetch_conversations_from_server_with_page_invalid_page_num_zero(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、conversations、from、服务端、with、page、无效参数；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchConversationsFromServerWithPage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、conversations、from、服务端、with、page、无效参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchConversationsFromServerWithPage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s2-fetch-page-num0-{uuid.uuid4().hex[:6]}")
    time.sleep(2)
    resp = device_a.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 0, "pageSize": 20},
    )
    result = resp.get("result")
    projected: list[dict] = []
    if isinstance(result, list):
        projected = [
            {"convId": item.get("convId"), "type": item.get("type")}
            for item in result
            if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
        ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.fetchConversationsFromServerWithPage.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchConversationsFromServerWithPage.value,
            "device": "deviceA",
            "result": [{"convId": "{{convId}}", "type": 0}],
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_fetch_conversations_from_server_with_page_invalid_page_size_zero(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、conversations、from、服务端、with、page、无效参数；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchConversationsFromServerWithPage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、conversations、from、服务端、with、page、无效参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchConversationsFromServerWithPage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s2-fetch-page-size0-{uuid.uuid4().hex[:6]}")
    time.sleep(2)
    resp = device_a.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 1, "pageSize": 0},
    )
    result = resp.get("result")
    projected: list[dict] = []
    if isinstance(result, list):
        projected = [
            {"convId": item.get("convId"), "type": item.get("type")}
            for item in result
            if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
        ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.fetchConversationsFromServerWithPage.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchConversationsFromServerWithPage.value,
            "device": "deviceA",
            "result": [{"convId": "{{convId}}", "type": 0}],
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_get_pinned_conversations_from_server_with_cursor_success(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、pinned、conversations、from、服务端、with、cursor；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getPinnedConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、pinned、conversations、from、服务端、with、cursor；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getPinnedConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    info = {"cursor": "", "pageSize": 20}
    resp = device_a.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info=info,
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getPinnedConversationsFromServerWithCursor.value,
            "device": "deviceA",
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_get_pinned_conversations_from_server_with_cursor_invalid_page_size_zero(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、pinned、conversations、from、服务端、with、cursor；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getPinnedConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、pinned、conversations、from、服务端、with、cursor；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getPinnedConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"cursor": "", "pageSize": 0}
    resp = device_a.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info=info,
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getPinnedConversationsFromServerWithCursor.value,
            "device": "deviceA",
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_get_pinned_conversations_from_server_with_cursor_invalid_page_size_negative(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、pinned、conversations、from、服务端、with、cursor；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getPinnedConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、pinned、conversations、from、服务端、with、cursor；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getPinnedConversationsFromServerWithCursor，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"cursor": "", "pageSize": -1}
    resp = device_a.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info=info,
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getPinnedConversationsFromServerWithCursor.value,
            "device": "deviceA",
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.delete_remote_conversation.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.deleteRemoteConversation")
def test_chat_delete_remote_conversation_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、删除、remote、会话、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteRemoteConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、删除、remote、会话、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteRemoteConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s2-del-remote-{uuid.uuid4().hex[:6]}")
    resp = device_a.call(
        "ChatManager",
        Cmd.deleteRemoteConversation.value,
        info={"convId": user_b, "conversationType": 0, "isDeleteRemoteMessage": False},
    )
    _assert_chat_response(assert_api, resp, Cmd.deleteRemoteConversation.value, "deviceA", None)


@pytest.mark.real_e2e
def test_chat_delete_remote_conversation_empty_conv_id(device_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、remote、会话、空值参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteRemoteConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、remote、会话、空值参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteRemoteConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.deleteRemoteConversation.value,
        info={"convId": "", "conversationType": 0, "isDeleteRemoteMessage": False},
    )
    assert_error(resp, code=303, description="field channel cannot be null or empty")


@pytest.mark.real_e2e
def test_chat_delete_remote_conversation_invalid_type(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、remote、会话、无效参数、type；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteRemoteConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、remote、会话、无效参数、type；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteRemoteConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.deleteRemoteConversation.value,
        info={"convId": "__invalid_conv__", "conversationType": 2, "isDeleteRemoteMessage": False},
    )
    _assert_chat_response(assert_api, resp, Cmd.deleteRemoteConversation.value, "deviceA", None)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.remove_messages_from_server_with_msg_ids.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.removeMessagesFromServerWithMsgIds")
def test_chat_remove_messages_from_server_with_msg_ids_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s2-rm-server-ids-{uuid.uuid4().hex[:6]}")
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"convId": user_b, "type": 0, "msgIds": [real_id]},
    )
    _assert_chat_response(assert_api, resp, Cmd.removeMessagesFromServerWithMsgIds.value, "deviceA", None)


@pytest.mark.real_e2e
@pytest.mark.skip(reason="必填缺失类 case 暂缓；当前端易返回 MissingPlugin 非被测端语义")
def test_chat_remove_messages_from_server_with_msg_ids_missing_msg_ids(device_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"convId": user_b, "type": 0},
    )
    assert_error(resp, code=-1, description="MissingPluginException")


@pytest.mark.real_e2e
def test_chat_remove_messages_from_server_with_msg_ids_empty_msg_ids(device_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"convId": user_b, "type": 0, "msgIds": []},
    )
    assert_error(resp, code=110, description="Invalid parameter")


@pytest.mark.real_e2e
@pytest.mark.skip(reason="必填缺失类 case 暂缓；当前端易返回 MissingPlugin 非被测端语义")
def test_chat_remove_messages_from_server_with_msg_ids_missing_conv_id(device_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、msg、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithMsgIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"type": 0, "msgIds": ["__invalid_msg_id__"]},
    )
    assert_error(resp, code=-1, description="MissingPluginException")


@pytest.mark.real_e2e
def test_chat_remove_messages_from_server_with_ts_success(device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={"convId": user_b, "type": 0, "timestamp": now_ms()},
    )
    _assert_chat_response(assert_api, resp, Cmd.removeMessagesFromServerWithTs.value, "deviceA", None)


@pytest.mark.real_e2e
@pytest.mark.skip(reason="必填缺失类 case 暂缓；按规则不纳入 strict 批次")
def test_chat_remove_messages_from_server_with_ts_missing_timestamp(device_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、missing；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、missing；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={"convId": user_b, "type": 0},
    )
    assert_error(resp, code=110, description="Invalid parameter")


@pytest.mark.real_e2e
def test_chat_remove_messages_from_server_with_ts_timestamp_zero(device_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、timestamp；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、timestamp；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={"convId": user_b, "type": 0, "timestamp": 0},
    )
    assert_error(resp, code=110, description="Invalid parameter")


@pytest.mark.real_e2e
@pytest.mark.skip(reason="必填缺失类 case 暂缓；当前端易返回 MissingPlugin 非被测端语义")
def test_chat_remove_messages_from_server_with_ts_missing_conv_id(device_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、missing；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、消息、from、服务端、with、ts、missing；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeMessagesFromServerWithTs，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={"type": 0, "timestamp": now_ms()},
    )
    assert_error(resp, code=-1, description="MissingPluginException")


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.report_message.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.reportMessage")
def test_chat_report_message_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、report、消息、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、report、消息、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s2-report-{uuid.uuid4().hex[:6]}")
    resp = device_a.call(
        "ChatManager",
        Cmd.reportMessage.value,
        info={"msgId": real_id, "tag": "spam", "reason": "s2-report-message"},
    )
    _assert_chat_response(assert_api, resp, Cmd.reportMessage.value, "deviceA", True)


@pytest.mark.real_e2e
def test_chat_report_message_invalid_msg_id(device_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、report、消息、无效参数、msg、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、report、消息、无效参数、msg、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.reportMessage.value,
        info={"msgId": "__invalid_msg_id__", "tag": "spam", "reason": "invalid-message"},
    )
    assert_error(resp, code=500, description="message id is invalid")


@pytest.mark.real_e2e
@pytest.mark.skip(reason="必填缺失类 case 暂缓；当前端易返回 MissingPlugin 非被测端语义")
def test_chat_report_message_missing_tag(device_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、report、消息、missing、tag；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、report、消息、missing、tag；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.reportMessage.value,
        info={"msgId": "__invalid_msg_id__", "reason": "missing-tag"},
    )
    assert_error(resp, code=-1, description="MissingPluginException")


@pytest.mark.real_e2e
@pytest.mark.skip(reason="必填缺失类 case 暂缓；当前端易返回 MissingPlugin 非被测端语义")
def test_chat_report_message_missing_reason(device_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、report、消息、missing、reason；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、report、消息、missing、reason；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.reportMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.reportMessage.value,
        info={"msgId": "__invalid_msg_id__", "tag": "spam"},
    )
    assert_error(resp, code=-1, description="MissingPluginException")
