from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid

import pytest

from src import Cmd
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message
from tests.chat._utils import build_text, now_ms


def _assert_chat_response(assert_api, resp: dict, cmd: str, device: str, result_expected) -> None:
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
    body = send_result.get("body") if isinstance(send_result, dict) else None
    assert isinstance(send_result, dict), f"sendMessage result 非 dict: {resp_send}"
    assert send_result.get("from") == user_a, f"sendMessage from 不匹配: {resp_send}"
    assert send_result.get("to") == user_b, f"sendMessage to 不匹配: {resp_send}"
    assert send_result.get("convId") == user_b, f"sendMessage convId 不匹配: {resp_send}"
    assert isinstance(body, dict), f"sendMessage body 非 dict: {resp_send}"
    assert body.get("type") == 0, f"sendMessage body.type 不匹配: {resp_send}"
    assert body.get("content") == content, f"sendMessage body.content 不匹配: {resp_send}"

    success_msg = wait_for_success_message(
        device_a,
        from_user=user_a,
        to_user=user_b,
        content=content,
        attempts=5,
        timeout=20.0,
    )
    evt_success = {
        "type": "event",
        "eventType": Cmd.onMessageSuccess.value,
        "data": {"msg": success_msg},
    }
    received_msg = wait_for_matching_event_message(
        device_b,
        event_type=Cmd.onMessagesReceived.value,
        from_user=user_a,
        to_user=user_b,
        content=content,
        attempts=5,
        timeout=20.0,
    )
    evt_received = {
        "type": "event",
        "eventType": Cmd.onMessagesReceived.value,
        "data": {"operation": "messages_received", "messages": [received_msg]},
    }
    success_data = evt_success.get("data") if isinstance(evt_success, dict) else {}
    success_msg = (success_data or {}).get("msg") or (success_data or {}).get("message")
    success_body = success_msg.get("body") if isinstance(success_msg, dict) else None
    assert_api.assert_response_matches(
        {
            "type": evt_success.get("type") if isinstance(evt_success, dict) else None,
            "eventType": evt_success.get("eventType") if isinstance(evt_success, dict) else None,
            "data": {
                "message": {
                    "from": success_msg.get("from") if isinstance(success_msg, dict) else None,
                    "to": success_msg.get("to") if isinstance(success_msg, dict) else None,
                    "convId": success_msg.get("convId") if isinstance(success_msg, dict) else None,
                    "chatType": success_msg.get("chatType") if isinstance(success_msg, dict) else None,
                    "direction": success_msg.get("direction") if isinstance(success_msg, dict) else None,
                    "status": success_msg.get("status") if isinstance(success_msg, dict) else None,
                    "hasRead": success_msg.get("hasRead") if isinstance(success_msg, dict) else None,
                    "hasReadAck": success_msg.get("hasReadAck") if isinstance(success_msg, dict) else None,
                    "hasDeliverAck": success_msg.get("hasDeliverAck") if isinstance(success_msg, dict) else None,
                    "needGroupAck": success_msg.get("needGroupAck") if isinstance(success_msg, dict) else None,
                    "isThread": success_msg.get("isThread") if isinstance(success_msg, dict) else None,
                    "isContentReplaced": success_msg.get("isContentReplaced") if isinstance(success_msg, dict) else None,
                    "body": {
                        "type": success_body.get("type") if isinstance(success_body, dict) else None,
                        "content": success_body.get("content") if isinstance(success_body, dict) else None,
                    },
                }
            },
        },
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "message": {
                    "from": "{{fromUser}}",
                    "to": "{{toUser}}",
                    "convId": "{{toUser}}",
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
                }
            },
        },
        context={"fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "msgId",
            "translations",
            "broadcast",
            "onlineState",
            "targetLanguages",
            "status",
            "isListened",
            "deliverOnlineOnly",
        },
    )
    received_data = evt_received.get("data") if isinstance(evt_received, dict) else {}
    received_messages = (received_data or {}).get("messages") or (received_data or {}).get("value") or []
    received_msg = received_messages[0] if received_messages and isinstance(received_messages[0], dict) else {}
    received_body = received_msg.get("body") if isinstance(received_msg, dict) else None
    assert_api.assert_response_matches(
        {
            "type": evt_received.get("type") if isinstance(evt_received, dict) else None,
            "eventType": evt_received.get("eventType") if isinstance(evt_received, dict) else None,
            "data": {
                "messages": [
                    {
                        "from": received_msg.get("from"),
                        "to": received_msg.get("to"),
                        "convId": received_msg.get("convId"),
                        "chatType": received_msg.get("chatType"),
                        "direction": received_msg.get("direction"),
                        "status": received_msg.get("status"),
                        "hasRead": received_msg.get("hasRead"),
                        "hasReadAck": received_msg.get("hasReadAck"),
                        "hasDeliverAck": received_msg.get("hasDeliverAck"),
                        "needGroupAck": received_msg.get("needGroupAck"),
                        "isThread": received_msg.get("isThread"),
                        "isContentReplaced": received_msg.get("isContentReplaced"),
                        "body": {
                            "type": received_body.get("type") if isinstance(received_body, dict) else None,
                            "content": received_body.get("content") if isinstance(received_body, dict) else None,
                        },
                    }
                ]
            },
        },
        expected={
            "type": "event",
            "eventType": Cmd.onMessagesReceived.value,
            "data": {
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
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "msgId", "translations", "receiverList"},
    )

    real_id = (success_msg or {}).get("msgId")
    assert real_id, f"missing real msgId from onMessageSuccess: {evt_success!r}"
    return str(real_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.get_conversation.local_after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.getConversation")
def test_chat_get_conversation_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、会话、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、会话、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s1-get-conv-{uuid.uuid4().hex[:6]}")
    resp = device_a.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": True},
    )
    result = resp.get("result") or {}
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getConversation.value,
            "device": "deviceA",
            "result": {
                "convId": result.get("convId"),
                "type": result.get("type"),
            },
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversation.value,
            "device": "deviceA",
            "result": {"convId": "{{convId}}", "type": 0},
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chat_get_conversation_not_exist_without_create(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、会话、not、exist、without、创建；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、会话、not、exist、without、创建；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": "__nonexistent_conv__", "type": 0, "createIfNeed": False},
    )
    _assert_chat_response(assert_api, resp, Cmd.getConversation.value, _expected_device(client), None)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_get_conversation_empty_conv_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、会话、空值参数、conv、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、会话、空值参数、conv、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": "", "type": 0, "createIfNeed": False},
    )
    _assert_chat_response(assert_api, resp, Cmd.getConversation.value, _expected_device(client), None)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.unread_count.mark_all_read.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.getUnreadMessageCount")
@pytest.mark.api("ChatManager.markAllChatMsgAsRead")
def test_chat_get_unread_count_positive_then_zero(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、unread、count、positive、then、zero；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getUnreadMessageCount、ChatManager.markAllChatMsgAsRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、unread、count、positive、then、zero；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getUnreadMessageCount、ChatManager.markAllChatMsgAsRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp_mark = device_b.call("ChatManager", Cmd.markAllChatMsgAsRead.value, info={})
    assert_api.assert_response_matches(
        resp_mark,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.markAllChatMsgAsRead.value,
            "device": "deviceB",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s1-unread-{uuid.uuid4().hex[:6]}")

    resp_unread = device_b.call("ChatManager", Cmd.getUnreadMessageCount.value, info={})
    assert_api.assert_response_matches(
        resp_unread,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getUnreadMessageCount.value,
            "device": "deviceB",
            "result": 1,
        },
        ignore_keys={"sequence"},
    )

    resp_mark_2 = device_b.call("ChatManager", Cmd.markAllChatMsgAsRead.value, info={})
    assert_api.assert_response_matches(
        resp_mark_2,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.markAllChatMsgAsRead.value,
            "device": "deviceB",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_unread_after = device_b.call("ChatManager", Cmd.getUnreadMessageCount.value, info={})
    _assert_chat_response(assert_api, resp_unread_after, Cmd.getUnreadMessageCount.value, "deviceB", 0)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chat_mark_all_as_read_idempotent(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、mark、all、as、已读、idempotent；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.markAllChatMsgAsRead、ChatManager.getUnreadMessageCount，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、mark、all、as、已读、idempotent；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.markAllChatMsgAsRead、ChatManager.getUnreadMessageCount，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp_1 = client.call("ChatManager", Cmd.markAllChatMsgAsRead.value, info={})
    assert_api.assert_response_matches(
        resp_1,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.markAllChatMsgAsRead.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_2 = client.call("ChatManager", Cmd.markAllChatMsgAsRead.value, info={})
    assert_api.assert_response_matches(
        resp_2,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.markAllChatMsgAsRead.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_unread = client.call("ChatManager", Cmd.getUnreadMessageCount.value, info={})
    _assert_chat_response(assert_api, resp_unread, Cmd.getUnreadMessageCount.value, expected_device, 0)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.load_all_conversations.local_after_send_delete.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.loadAllConversations")
@pytest.mark.api("ChatManager.deleteConversation")
def test_chat_load_all_conversations_contains_then_not_contains(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、all、conversations、contains、then、not、contains；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadAllConversations、ChatManager.deleteConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、all、conversations、contains、then、not、contains；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadAllConversations、ChatManager.deleteConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    _ = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s1-load-all-{uuid.uuid4().hex[:6]}")
    time.sleep(2)

    resp_load = device_a.call("ChatManager", Cmd.loadAllConversations.value, info={})
    result = resp_load.get("result")
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
            "cmd": Cmd.loadAllConversations.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversations.value,
            "device": "deviceA",
            "result": projected,
        },
        ignore_keys={"sequence"},
    )
    assert isinstance(result, list), f"cleanConversationsMemoryCache 后 loadAllConversations 应返回列表: {resp_load}"

    resp_delete = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    assert_api.assert_response_matches(
        resp_delete,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.deleteConversation.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_load_after = device_a.call("ChatManager", Cmd.loadAllConversations.value, info={})
    result_after = resp_load_after.get("result")
    projected_after = [
        {"convId": item.get("convId"), "type": item.get("type")}
        for item in (result_after if isinstance(result_after, list) else [])
        if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
    ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversations.value,
            "device": "deviceA",
            "result": projected_after,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversations.value,
            "device": "deviceA",
            "result": [],
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.native_load_all_conversations.local_after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.loadAllConversationsFromDB")
@pytest.mark.api("ChatManager.getAllConversations")
def test_chat_native_get_and_load_all_conversations_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、native、获取、and、load、all、conversations、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadAllConversationsFromDB、ChatManager.getAllConversations，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、native、获取、and、load、all、conversations、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadAllConversationsFromDB、ChatManager.getAllConversations，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    _ = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    _ = _send_text_and_get_real_id(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        f"s1-native-load-all-{uuid.uuid4().hex[:6]}",
    )
    time.sleep(2)

    resp_load_db = device_a.call("ChatManager", Cmd.loadAllConversationsFromDB.value, info={})
    assert_api.assert_response_matches(
        resp_load_db,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversationsFromDB.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_all = device_a.call("ChatManager", Cmd.getAllConversations.value, info={})
    result = resp_all.get("result")
    projected = [
        {"convId": item.get("convId"), "type": item.get("type")}
        for item in (result if isinstance(result, list) else [])
        if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
    ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getAllConversations.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getAllConversations.value,
            "device": "deviceA",
            "result": [{"convId": "{{convId}}", "type": 0}],
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.get_conversations_by_type.local_after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.getConversationsByType")
def test_chat_get_conversations_by_type_after_sending(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、conversations、by、type、after、sending；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getConversationsByType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、conversations、by、type、after、sending；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getConversationsByType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    _ = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    _ = _send_text_and_get_real_id(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        f"s1-conv-type-{uuid.uuid4().hex[:6]}",
    )
    time.sleep(2)

    resp = device_a.call("ChatManager", Cmd.getConversationsByType.value, info={"type": 0})
    result = resp.get("result")
    projected = [
        {"convId": item.get("convId"), "type": item.get("type")}
        for item in (result if isinstance(result, list) else [])
        if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
    ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsByType.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsByType.value,
            "device": "deviceA",
            "result": [{"convId": "{{convId}}", "type": 0}],
        },
        context={"convId": user_b},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_get_conversations_by_type_invalid_type(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、conversations、by、type、无效参数、type；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsByType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、conversations、by、type、无效参数、type；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getConversationsByType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp = client.call("ChatManager", Cmd.getConversationsByType.value, info={"type": -1})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getConversationsByType.value,
            "device": expected_device,
            "result": {"code": 110, "description": "'type' is invalid"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_clean_conversations_memory_cache_keeps_local_conversations(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、clean、conversations、memory、cache、keeps、本地、conversations；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteConversation、ChatManager.cleanConversationsMemoryCache、ChatManager.loadAllConversations，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、clean、conversations、memory、cache、keeps、本地、conversations；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteConversation、ChatManager.cleanConversationsMemoryCache、ChatManager.loadAllConversations，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    _ = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    _ = _send_text_and_get_real_id(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        f"s1-clean-cache-{uuid.uuid4().hex[:6]}",
    )
    time.sleep(2)

    resp_clean = device_a.call("ChatManager", Cmd.cleanConversationsMemoryCache.value, info={})
    assert_api.assert_response_matches(
        resp_clean,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.cleanConversationsMemoryCache.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_load = device_a.call("ChatManager", Cmd.loadAllConversations.value, info={})
    result = resp_load.get("result")
    projected = [
        {"convId": item.get("convId"), "type": item.get("type")}
        for item in (result if isinstance(result, list) else [])
        if isinstance(item, dict) and str(item.get("convId")) == str(user_b)
    ]
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversations.value,
            "device": "deviceA",
            "result": projected,
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversations.value,
            "device": "deviceA",
            "result": projected,
        },
        ignore_keys={"sequence"},
    )
    assert isinstance(result, list), f"cleanConversationsMemoryCache 后 loadAllConversations 应返回列表: {resp_load}"


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.delete_conversation.local_existing.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.deleteConversation")
@pytest.mark.api("ChatManager.getConversation")
def test_chat_delete_conversation_existing_then_not_found(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、删除、会话、existing、then、not、found；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteConversation、ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、删除、会话、existing、then、not、found；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteConversation、ChatManager.getConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    _ = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s1-del-conv-{uuid.uuid4().hex[:6]}")

    resp_delete = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    _assert_chat_response(assert_api, resp_delete, Cmd.deleteConversation.value, "deviceA", True)

    resp_get = device_a.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": False},
    )
    _assert_chat_response(assert_api, resp_get, Cmd.getConversation.value, "deviceA", None)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chat_delete_conversation_nonexistent_returns_bool(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、会话、不存在对象、returns、bool；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、会话、不存在对象、returns、bool；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp = client.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": "__nonexistent_conv__", "deleteMessages": True},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.deleteConversation.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_delete_messages_before_timestamp_future_removes_msg(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、删除、消息、before、timestamp、future、removes、msg；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteMessagesBeforeTimestamp、ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、删除、消息、before、timestamp、future、removes、msg；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.deleteMessagesBeforeTimestamp、ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s1-del-before-future-{uuid.uuid4().hex[:6]}")
    resp_del = device_a.call(
        "ChatManager",
        Cmd.deleteMessagesBeforeTimestamp.value,
        info={"timestamp": now_ms() + 1000},
    )
    _assert_chat_response(assert_api, resp_del, Cmd.deleteMessagesBeforeTimestamp.value, "deviceA", None)

    resp_get = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": real_id})
    _assert_chat_response(assert_api, resp_get, Cmd.getMessage.value, "deviceA", None)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.delete_messages_before_timestamp.keep_recent.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.deleteMessagesBeforeTimestamp")
@pytest.mark.api("ChatManager.getMessage")
def test_chat_delete_messages_before_timestamp_zero_keeps_recent_msg(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、消息、before、timestamp、zero、keeps、recent；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteMessagesBeforeTimestamp、ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、删除、消息、before、timestamp、zero、keeps、recent；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteMessagesBeforeTimestamp、ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, f"s1-del-before-zero-{uuid.uuid4().hex[:6]}")
    resp_del = device_a.call(
        "ChatManager",
        Cmd.deleteMessagesBeforeTimestamp.value,
        info={"timestamp": 0},
    )
    _assert_chat_response(assert_api, resp_del, Cmd.deleteMessagesBeforeTimestamp.value, "deviceA", None)

    resp_get = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": real_id})
    result_get = resp_get.get("result") or {}
    assert_api.assert_response_matches(
        {
            "manager": "ChatManager",
            "cmd": Cmd.getMessage.value,
            "device": "deviceA",
            "result": {"msgId": result_get.get("msgId")},
        },
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getMessage.value,
            "device": "deviceA",
            "result": {"msgId": "{{msgId}}"},
        },
        context={"msgId": str(real_id)},
        ignore_keys={"sequence"},
    )
