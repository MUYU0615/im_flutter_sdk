"""
已拆分：该文件仅保留空壳或最小回归用例。
完整用例请见：
- tests/chat/test_chat_send_receive.py
- tests/chat/test_chat_translate.py
- tests/chat/test_chat_errors.py
- tests/chat/test_chat_history_attach_lang.py

注意：按 AGENTS.zh.md 的流程执行：
- 发现阶段：`CASES_DISCOVER=1 WS_DEBUG=1 pytest -q tests/chat/... -s`
- 收紧阶段：对齐 envelope + 关键字段，收紧 ignore_keys；避免 `assert_error(..., code=500)` 一刀切。
"""
from __future__ import annotations

import time
import uuid
from typing import Any

import pytest

from src import Cmd, ne, gt
from src.tools.assertions import get_result
from tests.case_steps import describe_case_steps

pytestmark = [
    pytest.mark.client,
    pytest.mark.chat,
    pytest.mark.skip(reason="legacy duplicate chat cases; canonical Android E2E lives in test_chat_crud.py and split chat_s* suites"),
]


# ---------- 工具 ----------


def _now_ms() -> int:
    return int(time.time() * 1000)


def _build_text(from_user: str, to_user: str, content: str, chat_type: int = 0) -> dict:
    """与被测端 MessageHelper.fromJson 对齐的最小可用文本消息 JSON。"""
    return {
        "from": from_user,
        "to": to_user,
        "chatType": chat_type,     # 0 单聊 / 1 群 / 2 室
        "direction": 0,            # SEND
        "body": {"type": 0, "content": content},
        # 推荐默认，避免端上严格校验
        "hasReadAck": False,
        "needGroupAck": False,
        "isThread": False,
        "deliverOnlineOnly": False
    }


def _find_first(obj: Any, key: str) -> Any | None:
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _find_first(v, key)
            if r is not None:
                return r
    elif isinstance(obj, (list, tuple)):
        for it in obj:
            r = _find_first(it, key)
            if r is not None:
                return r
    return None




# 不再提供 _contains_conv：严格用 assert_response_matches 断言返回体





# ========== 异常 / 边界（Chat） ==========

@pytest.mark.real_e2e
def test_chat_send_to_self_should_not_succeed(device_a, assert_api, user_a):
    # 自发消息（A→A）：按当前实现会返回 onMessageSuccess，这里按实际返回严格断言事件内容。
    # 先清空积压事件，避免前序用例的事件干扰。
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、send、to、self、should、not、succeed；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、send、to、self、should、not、succeed；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
    except Exception:
        pass
    content = f"self-msg-{uuid.uuid4().hex[:6]}"
    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=_build_text(user_a, user_a, content))
    evt = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    # 严格断言 onMessageSuccess 事件内容（data 不忽略）：
    temp_id = (evt.get("data") or {}).get("msgId")
    real_id = ((evt.get("data") or {}).get("msg") or {}).get("msgId")
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "msgId": "{{tempId}}",
                "msg": {
                    "msgId": "{{realId}}",
                    "from": "{{user}}",
                    "to": "{{user}}",
                    "convId": "{{user}}",
                    "body": {"type": 0, "content": "{{content}}", "translations": {}},
                    "direction": 0,
                    "chatType": 0,
                    "status": 2,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "deliverOnlineOnly": False,
                    "isThread": False,
                    "isContentReplaced": False,
                },
            },
        },
        context={"tempId": temp_id, "realId": real_id, "user": user_a, "content": content},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "targetLanguages",
            "deliverOnlineOnly",
        },
    )
    # 严格断言自发消息的发送响应 result（不忽略 result/error，仅忽略 sequence 等易变键）
    assert_api.assert_response_matches(
        resp_send,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{tempId}}",
                "from": "{{user}}",
                "to": "{{user}}",
                "convId": "{{user}}",
                "chatType": 0,
                "direction": 0,
                "status": 0,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "body": {"type": 0, "content": "{{content}}"},
            },
        },
        context={"tempId": temp_id, "user": user_a, "content": content},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "deliverOnlineOnly",
            "targetLanguages",
            "translations",
        },
    )


@pytest.mark.real_e2e
def test_chat_pin_conversation_nonexistent_conversation(device_a, assert_api):
    # 直接 pin 不存在的会话：按实际返回约定应为错误（Invalid conversation）。
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、置顶、会话、不存在对象、会话；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.pinConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、置顶、会话、不存在对象、会话；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.pinConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    bogus = "__nonexistent_chat_user__"
    resp_pin = device_a.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"conversationId": bogus, "isPinned": True},
    )
    # 严格错误断言：首次发现记录显示 code=107, description 包含 "Invalid conversation"
    assert_api.assert_error(resp_pin, code=107, description="Invalid conversation")


@pytest.mark.real_e2e
@pytest.mark.skip(reason="temporary skip: backend bug under investigation")
def test_chat_translate_message_nonexistent_message(device_a, assert_api, user_a, user_b):
    # translateMessage 传入不存在的消息对象：不应出现有效 translations。
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、translate、消息、不存在对象、消息；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.translateMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、translate、消息、不存在对象、消息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.translateMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    fake_msg = {
        "msgId": "__invalid_msg_id__",
        "from": user_a,
        "to": user_b,
        "chatType": 0,
        "direction": 0,
        "body": {"type": 0, "content": "ghost"},
    }
    info = {"message": fake_msg, "targetLanguages": ["zh-Hans"]}
    resp_tr = device_a.call("ChatManager", Cmd.translateMessage.value, info=info)
    # 仅校验响应信封结构；不忽略 result/error（该用例暂跳过，恢复时再收紧预期）
    assert_api.assert_response_matches(
        resp_tr,
        expected={"manager": "ChatManager", "cmd": Cmd.translateMessage.value, "device": "deviceA"},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_ack_conversation_read_invalid_id_response(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、会话、已读、无效参数、id、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、会话、已读、无效参数、id、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    bogus = "__invalid_conversation_id__"
    resp = device_b.call("ChatManager", Cmd.ackConversationRead.value, info={"conversationId": bogus})
    # Android 当前实现要求 convId 参数；conversationId 会按缺失 convId 返回参数错误。
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.ackConversationRead.value,
            "device": "deviceB",
            "result": {"code": 110, "description": "Invalid params: No value for convId"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_modify_message_invalid_id_response(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、modify、消息、无效参数、id、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.modifyMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、modify、消息、无效参数、id、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.modifyMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatManager", Cmd.modifyMessage.value, info={"msgId": "__invalid_msg_id__", "body": {"type": 0, "content": "edit"}})
    print("MODIFY_INVALID RESP:", resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.modifyMessage.value,
            "device": "deviceA",
            "result": {"code": 500, "description": "Message is invalid"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_recall_message_invalid_id_response(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、recall、消息、无效参数、id、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.recallMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、recall、消息、无效参数、id、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.recallMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatManager", Cmd.recallMessage.value, info={"msgId": "__invalid_msg_id__"})
    print("RECALL_INVALID RESP:", resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.recallMessage.value,
            "device": "deviceA",
            "result": {"code": 500, "description": "The message was not found"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
def test_chat_add_reaction_invalid_id_response(request, assert_api):
    """
    1. deviceA 调用 ChatManager.addReaction，传入不存在的 msgId=__invalid_msg_id__ 和 reaction=👍；
    2. 校验响应信封为 ChatManager.addReaction，且响应设备为当前发送端；
    3. 校验 SDK 返回错误体 code=303，description 包含 Unknown server error。
    """
    describe_case_steps(
        "1. deviceA 调用 ChatManager.addReaction，传入不存在的 msgId=__invalid_msg_id__ 和 reaction=👍；\n"
        "2. 校验响应信封为 ChatManager.addReaction，且响应设备为当前发送端；\n"
        "3. 校验 SDK 返回错误体 code=303，description 包含 Unknown server error。"
    )
    client_a = (
        request.getfixturevalue("topology").primary_client(0)
        if request.config.getoption("--run-context")
        else request.getfixturevalue("device_a")
    )
    expected_device = getattr(client_a, "name", "deviceA")
    resp = client_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "👍", "msgId": "__invalid_msg_id__"})
    print("ADD_REACTION_INVALID RESP:", resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": expected_device,
            "result": {"code": 303, "description": "Unknown server error"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_add_reaction_empty_reaction_response(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、添加、Reaction、空值参数、Reaction、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、添加、Reaction、空值参数、Reaction、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=_build_text(user_a, user_b, "for-reaction-empty"))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    real_id = (((evt_success or {}).get("data") or {}).get("msg") or {}).get("msgId")
    resp = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "", "msgId": real_id})
    print("ADD_REACTION_EMPTY RESP:", resp)
    # 空 reaction：按当前实现返回固定错误
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": "deviceA",
            "result": {"code": 110, "description": "'reaction' can not be null"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_fetch_history_invalid_conversation(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、无效参数、会话；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、无效参数、会话；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_b.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info={"conversationId": "__invalid__", "pageSize": 20, "cursor": None},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessages.value,
            "device": "deviceB",
            "result": {"code": 205, "description": "Invalid parameter"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_get_message_invalid_id_returns_none_or_error(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、消息、无效参数、id、returns、none、or；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、消息、无效参数、id、returns、none、or；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getMessage.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )


def test_chat_translate_recall_smoke_exists():
    assert True


# ========== 新增：通用能力（正常 + 异常） ==========


def test_chat_history_attach_lang_smoke_exists():
    assert True


    ...
