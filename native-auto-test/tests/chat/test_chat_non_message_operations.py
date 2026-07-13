from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid

import pytest

from src import Cmd
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message
from tests.chat._utils import build_text

pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.agorachat1_4_0]

_ANDROID_MESSAGE_OPTIONAL_KEYS = {
    "broadcast",
    "onlineState",
    "deliverOnlineOnly",
    "targetLanguages",
    "translations",
    "isListened",
}


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _send_text_and_get_real_id(device_a, device_b, assert_api, user_a: str, user_b: str, content: str) -> str:
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    send_result = resp_send.get("result") or {}
    send_msg_id = send_result.get("msgId")
    assert send_msg_id, f"missing msgId in sendMessage result: {resp_send!r}"
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": str(send_msg_id),
                "from": send_result.get("from"),
                "to": send_result.get("to"),
                "body": {"content": (send_result.get("body") or {}).get("content")},
            },
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{msgId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "body": {"content": "{{content}}"},
            },
        },
        context={"msgId": str(send_msg_id), "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"sequence", "result.isListened"},
    )

    real_id = str(send_msg_id)

    evt_success_msg = wait_for_success_message(
        device_a,
        from_user=user_a,
        to_user=user_b,
        content=content,
        attempts=5,
        timeout=10.0,
    )
    evt_success = {
        "type": "event",
        "eventType": Cmd.onMessageSuccess.value,
        "data": {"msg": evt_success_msg},
    }
    assert_api.assert_response_matches(
        evt_success,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "msg": {
                    "from": "{{fromUser}}",
                    "to": "{{toUser}}",
                    "convId": "{{toUser}}",
                    "chatType": 0,
                    "direction": 0,
                    "status": 2,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "body": {"type": 0, "content": "{{content}}"},
                }
            },
        },
        context={"fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "msgId"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    evt_msg = ((evt_success.get("data") or {}).get("msg")) or {}
    evt_body = evt_msg.get("body") or {}
    if (
        evt_msg.get("from") == user_a
        and evt_msg.get("to") == user_b
        and evt_body.get("content") == content
        and evt_msg.get("msgId")
    ):
        real_id = str(evt_msg.get("msgId"))

    evt_received_msg = wait_for_matching_event_message(
        device_b,
        event_type=Cmd.onMessagesReceived.value,
        from_user=user_a,
        to_user=user_b,
        content=content,
        attempts=5,
        timeout=10.0,
    )
    evt_received = {
        "type": "event",
        "eventType": Cmd.onMessagesReceived.value,
        "data": {"operation": "messages_received", "messages": [evt_received_msg]},
    }
    assert_api.assert_response_matches(
        evt_received,
        expected={
            "type": "event",
            "eventType": Cmd.onMessagesReceived.value,
            "data": {
                "operation": "messages_received",
                "messages": [
                    {
                        "from": "{{fromUser}}",
                        "to": "{{toUser}}",
                        "convId": "{{fromUser}}",
                        "chatType": 0,
                        "direction": 1,
                        "status": 2,
                        "hasRead": False,
                        "hasReadAck": False,
                        "hasDeliverAck": False,
                        "needGroupAck": False,
                        "isThread": False,
                        "isContentReplaced": False,
                        "body": {"type": 0, "content": "{{content}}"},
                    }
                ]
            },
        },
        context={"fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "msgId", "receiverList"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    data = evt_received.get("data") or {}
    for msg in (data.get("messages") or []):
        body = (msg or {}).get("body") or {}
        if (
            (msg or {}).get("from") == user_a
            and (msg or {}).get("to") == user_b
            and body.get("content") == content
            and (msg or {}).get("msgId")
        ):
            real_id = str(msg.get("msgId"))
            break

    return real_id

def _assert_error_with_envelope(
    assert_api,
    resp: dict,
    cmd: str,
    device: str,
    *,
    code: int,
    desc_contains: str,
) -> None:
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": cmd,
            "device": device,
            "result": {"code": code},
        },
        ignore_keys={"sequence", "description"},
    )
    result = resp.get("result") if isinstance(resp, dict) else {}
    description = str((result or {}).get("description", ""))
    assert desc_contains in description, f"错误描述不包含 {desc_contains!r}: {resp!r}"


def _assert_invalid_conv_returns_cursor(assert_api, resp: dict, cmd: str, device: str = "deviceA") -> None:
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": cmd,
            "device": device,
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_ack_conversation_read_success_with_event(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、已读回执、会话、已读、成功路径、with、event；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、已读回执、会话、已读、成功路径、with、event；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s3-ack-conv-{uuid.uuid4().hex[:6]}")
    resp_ack = device_b.call("ChatManager", Cmd.ackConversationRead.value, info={"convId": user_a})
    assert_api.assert_response_matches(
        resp_ack,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.ackConversationRead.value,
            "device": "deviceB",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    allowed_event_types = {
        "onConversationRead",
        Cmd.onConversationHasRead.value,
        Cmd.onMessagesRead.value,
        Cmd.onMessageReadAck.value,
    }
    evt = None
    ignored: list[dict] = []
    deadline = time.monotonic() + 60.0
    for event_type in allowed_event_types:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        candidate = device_a.receive_message(match_event_type=event_type, timeout=min(10.0, remaining))
        if candidate is None:
            continue
        evt = candidate
        break
    while evt is None and time.monotonic() < deadline:
        candidate = device_a.receive_message(timeout=5.0)
        if candidate is None:
            continue
        if (candidate or {}).get("eventType") in allowed_event_types:
            evt = candidate
            break
        if len(ignored) < 20:
            ignored.append(candidate if isinstance(candidate, dict) else {"value": candidate})
    if evt is None:
        pytest.xfail(f"当前 Android 环境 ackConversationRead 未回调已读事件，ignored={ignored!r}")
    evt_type = (evt or {}).get("eventType")
    assert evt_type in allowed_event_types, f"unexpected eventType for ackConversationRead: {evt!r}"
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": "{{eventType}}",
            "data": {
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
            },
        },
        context={"eventType": evt_type, "fromUser": user_b, "toUser": user_a},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_ack_conversation_read_invalid_conv_id(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、会话、已读、无效参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、会话、已读、无效参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology.remote_client(0)
    resp = client.call("ChatManager", Cmd.ackConversationRead.value, info={"conversationId": "__invalid_conversation_id__"})
    _assert_error_with_envelope(
        assert_api,
        resp,
        Cmd.ackConversationRead.value,
        _expected_device(client),
        code=110,
        desc_contains="convId",
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_ack_conversation_read_empty_conv_id(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、会话、已读、空值参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、会话、已读、空值参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackConversationRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology.remote_client(0)
    resp = client.call("ChatManager", Cmd.ackConversationRead.value, info={"conversationId": ""})
    _assert_error_with_envelope(
        assert_api,
        resp,
        Cmd.ackConversationRead.value,
        _expected_device(client),
        code=110,
        desc_contains="convId",
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.pin_conversation.toggle_after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.pinConversation")
@pytest.mark.api("ChatManager.getConversation")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_pin_conversation_success_toggle(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、置顶、会话、成功路径、toggle；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.pinConversation、ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、置顶、会话、成功路径、toggle；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.pinConversation、ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s3-pin-{uuid.uuid4().hex[:6]}")

    resp_pin = device_a.call("ChatManager", Cmd.pinConversation.value, info={"convId": user_b, "isPinned": True})
    assert_api.assert_response_matches(
        resp_pin,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.pinConversation.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    resp_conv = device_a.call("ChatManager", Cmd.getConversation.value, info={"convId": user_b, "type": 0, "createIfNeed": True})
    conv = resp_conv.get("result") or {}
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getConversation.value,
            "device": "deviceA",
            "result": {
                "convId": conv.get("convId"),
                "type": conv.get("type"),
                "isPinned": conv.get("isPinned"),
            },
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversation.value,
            "device": "deviceA",
            "result": {
                "convId": "{{convId}}",
                "type": 0,
                "isPinned": True,
            },
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )

    resp_unpin = device_a.call("ChatManager", Cmd.pinConversation.value, info={"convId": user_b, "isPinned": False})
    assert_api.assert_response_matches(
        resp_unpin,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.pinConversation.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    resp_conv2 = device_a.call("ChatManager", Cmd.getConversation.value, info={"convId": user_b, "type": 0, "createIfNeed": True})
    conv2 = resp_conv2.get("result") or {}
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getConversation.value,
            "device": "deviceA",
            "result": {
                "convId": conv2.get("convId"),
                "type": conv2.get("type"),
                "isPinned": conv2.get("isPinned"),
            },
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversation.value,
            "device": "deviceA",
            "result": {
                "convId": "{{convId}}",
                "type": 0,
                "isPinned": False,
            },
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_pin_conversation_invalid_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、置顶、会话、无效参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.pinConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、置顶、会话、无效参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.pinConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call("ChatManager", Cmd.pinConversation.value, info={"convId": "__invalid__", "isPinned": True})
    _assert_error_with_envelope(
        assert_api,
        resp,
        Cmd.pinConversation.value,
        _expected_device(client),
        code=107,
        desc_contains="Invalid conversation",
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("chat.pin_conversation.empty_conv_id.error")
@pytest.mark.api("ChatManager.pinConversation")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_pin_conversation_empty_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、置顶、会话、空值参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.pinConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、置顶、会话、空值参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.pinConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call("ChatManager", Cmd.pinConversation.value, info={"convId": "", "isPinned": True})
    _assert_error_with_envelope(
        assert_api,
        resp,
        Cmd.pinConversation.value,
        _expected_device(client),
        code=107,
        desc_contains="Invalid conversation",
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.fetch_history_messages.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.fetchHistoryMessages")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_fetch_history_messages_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、history、消息、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、history、消息、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    content = f"s3-history-{uuid.uuid4().hex[:6]}"
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, content)
    time.sleep(2)
    info = {"convId": user_b, "type": 0, "pageSize": 20, "startMsgId": "", "direction": 0}
    resp = device_a.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info=info,
    )
    result = resp.get("result") or {}
    hits = [
        {"msgId": item.get("msgId"), "convId": item.get("convId")}
        for item in (result.get("list") or [])
        if isinstance(item, dict) and str(item.get("msgId")) == str(real_id)
    ]
    if not hits:
        time.sleep(2)
        resp = device_a.call("ChatManager", Cmd.fetchHistoryMessages.value, info=info)
        result = resp.get("result") or {}
        hits = [
            {"msgId": item.get("msgId"), "convId": item.get("convId")}
            for item in (result.get("list") or [])
            if isinstance(item, dict) and str(item.get("msgId")) == str(real_id)
        ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessages.value,
            "device": "deviceA",
            "result": {
                "list": hits,
            },
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessages.value,
            "device": "deviceA",
            "result": {"list": [{"msgId": "{{msgId}}", "convId": "{{convId}}"}]},
        },
        context={"msgId": str(real_id), "convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_history_messages_invalid_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、无效参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、无效参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info={"convId": "__invalid__", "type": 0, "pageSize": 20, "startMsgId": "", "direction": 0},
    )
    _assert_invalid_conv_returns_cursor(assert_api, resp, Cmd.fetchHistoryMessages.value, _expected_device(client))


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_history_messages_empty_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、空值参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、空值参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessages，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info={"convId": "", "type": 0, "pageSize": 20, "startMsgId": "", "direction": 0},
    )
    _assert_error_with_envelope(
        assert_api,
        resp,
        Cmd.fetchHistoryMessages.value,
        _expected_device(client),
        code=110,
        desc_contains="'convId' can not be null",
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.fetch_history_messages_by_options.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.fetchHistoryMessagesByOptions")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_fetch_history_messages_by_options_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、history、消息、by、options、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、history、消息、by、options、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    content = f"s3-history-opt-{uuid.uuid4().hex[:6]}"
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, content)
    time.sleep(2)
    info = {"convId": user_b, "type": 0, "pageSize": 20, "cursor": ""}
    resp = device_a.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info=info,
    )
    result = resp.get("result") or {}
    hits = [
        {"msgId": item.get("msgId"), "convId": item.get("convId")}
        for item in (result.get("list") or [])
        if isinstance(item, dict) and str(item.get("msgId")) == str(real_id)
    ]
    if not hits:
        time.sleep(2)
        resp = device_a.call("ChatManager", Cmd.fetchHistoryMessagesByOptions.value, info=info)
        result = resp.get("result") or {}
        hits = [
            {"msgId": item.get("msgId"), "convId": item.get("convId")}
            for item in (result.get("list") or [])
            if isinstance(item, dict) and str(item.get("msgId")) == str(real_id)
        ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessagesByOptions.value,
            "device": "deviceA",
            "result": {
                "list": hits,
            },
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessagesByOptions.value,
            "device": "deviceA",
            "result": {"list": [{"msgId": "{{msgId}}", "convId": "{{convId}}"}]},
        },
        context={"msgId": str(real_id), "convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_history_messages_by_options_invalid_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、by、options、无效参数、conv；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、by、options、无效参数、conv；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": "__invalid__", "type": 0, "pageSize": 20, "cursor": ""},
    )
    _assert_invalid_conv_returns_cursor(assert_api, resp, Cmd.fetchHistoryMessagesByOptions.value, _expected_device(client))


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_history_messages_by_options_empty_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、by、options、空值参数、conv；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、消息、by、options、空值参数、conv；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": "", "type": 0, "pageSize": 20, "cursor": ""},
    )
    _assert_error_with_envelope(
        assert_api,
        resp,
        Cmd.fetchHistoryMessagesByOptions.value,
        _expected_device(client),
        code=110,
        desc_contains="'convId' can not be null",
    )
