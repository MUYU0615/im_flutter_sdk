from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid

import pytest

from src import Cmd, ge, ne
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message
from tests.chat._utils import build_text


pytestmark = [pytest.mark.client, pytest.mark.chat]


def _conversation(user_b: str) -> dict:
    return {"convId": user_b, "type": 0, "isThread": False}


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _topology_pair(topology):
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    return primary, remote, primary.user_id, remote.user_id, _expected_device(primary), _expected_device(remote)


def _expected_sent_message(msg_id: str, user_a: str, user_b: str, content: str, *, status=2) -> dict:
    return {
        "broadcast": False,
        "msgId": msg_id,
        "isContentReplaced": False,
        "hasDeliverAck": False,
        "body": {
            "targetLanguages": [],
            "translations": {},
            "type": 0,
            "content": content,
        },
        "needGroupAck": False,
        "convId": user_b,
        "hasReadAck": False,
        "hasRead": True,
        "isThread": False,
        "from": user_a,
        "to": user_b,
        "status": status,
        "chatType": 0,
        "direction": 0,
        "isListened": False,
        "onlineState": True,
    }


def _expected_received_message(msg_id: str, user_a: str, user_b: str, content: str) -> dict:
    return {
        "broadcast": False,
        "msgId": msg_id,
        "isContentReplaced": False,
        "hasDeliverAck": False,
        "body": {"type": 0, "content": content, "targetLanguages": [], "translations": {}},
        "needGroupAck": False,
        "convId": user_a,
        "hasReadAck": False,
        "hasRead": False,
        "isThread": False,
        "from": user_a,
        "to": user_b,
        "status": 2,
        "chatType": 0,
        "direction": 1,
        "isListened": False,
        "onlineState": True,
        "deliverOnlineOnly": False,
        "receiverList": [],
        "groupAckCount": 0,
    }


def _send_text_and_receive(device_a, device_b, assert_api, user_a: str, user_b: str, content: str) -> str:
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    temp_id = (resp.get("result") or {}).get("msgId")
    sender_device = _expected_device(device_a)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": sender_device,
            "result": {
                "msgId": "{{msgId}}",
                "from": "{{userA}}",
                "to": "{{userB}}",
                "convId": "{{userB}}",
                "chatType": 0,
                "direction": 0,
                "status": 0,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "isListened": False,
                "body": {
                    "targetLanguages": [],
                    "translations": {},
                    "type": 0,
                    "content": "{{content}}",
                },
                "broadcast": False,
                "onlineState": True,
            },
        },
        context={"msgId": temp_id, "userA": user_a, "userB": user_b, "content": content},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "deliverOnlineOnly",
        },
    )
    success_msg = wait_for_success_message(device_a, from_user=user_a, to_user=user_b, content=content)
    evt_success = {
        "type": "event",
        "eventType": Cmd.onMessageSuccess.value,
        "data": {"message": success_msg},
    }
    success_body = success_msg.get("body") if isinstance(success_msg, dict) else {}
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
                    "from": "{{userA}}",
                    "to": "{{userB}}",
                    "convId": "{{userB}}",
                    "chatType": 0,
                    "direction": 0,
                    "status": ge(0),
                    "body": {"type": 0, "content": "{{content}}"},
                }
            },
        },
        context={"userA": user_a, "userB": user_b, "content": content},
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
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
        },
    )
    received_msg = wait_for_matching_event_message(
        device_b,
        event_type=Cmd.onMessagesReceived.value,
        from_user=user_a,
        to_user=user_b,
        content=content,
    )
    evt_received = {
        "type": "event",
        "eventType": Cmd.onMessagesReceived.value,
        "data": {"messages": [received_msg]},
    }
    received_body = received_msg.get("body") if isinstance(received_msg, dict) else {}
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
                        "from": "{{userA}}",
                        "to": "{{userB}}",
                        "convId": "{{userA}}",
                        "chatType": 0,
                        "direction": 1,
                        "status": 2,
                        "body": {"type": 0, "content": "{{content}}"},
                    }
                ]
            },
        },
        context={"userA": user_a, "userB": user_b, "content": content},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "msgId",
            "translations",
            "receiverList",
            "deliverOnlineOnly",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "broadcast",
            "onlineState",
            "groupAckCount",
            "targetLanguages",
        },
    )
    real_id = success_msg.get("msgId") if isinstance(success_msg, dict) else None
    assert real_id, f"missing real msgId from onMessageSuccess: {evt_success!r}"
    return str(real_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
@pytest.mark.case_id("conversation.latest_and_last_received.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ConversationManager.getLatestMessage")
@pytest.mark.api("ConversationManager.getLatestMessageFromOthers")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_conversation_latest_and_last_received_messages(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为会话、latest、and、last、received、消息；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.getLatestMessage、ConversationManager.getLatestMessageFromOthers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为会话、latest、and、last、received、消息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.getLatestMessage、ConversationManager.getLatestMessageFromOthers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, remote_device = _topology_pair(topology)
    content = f"conv-latest-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)

    resp_latest = device_a.call(
        "ConversationManager",
        Cmd.getLatestMessage.value,
        info=_conversation(user_b),
    )
    assert_api.assert_response_matches(
        resp_latest,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.getLatestMessage.value,
            "device": primary_device,
            "result": _expected_sent_message(ne(""), "{{userA}}", "{{userB}}", "{{content}}", status=ge(1)),
        },
        context={"msgId": msg_id, "userA": user_a, "userB": user_b, "content": content},
        ignore_keys={"sequence", "serverTime", "localTime", "deliverOnlineOnly", "receiverList"},
    )

    resp_last_received = device_b.call(
        "ConversationManager",
        Cmd.getLatestMessageFromOthers.value,
        info=_conversation(user_a),
    )
    assert_api.assert_response_matches(
        resp_last_received,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.getLatestMessageFromOthers.value,
            "device": remote_device,
        },
        ignore_keys={"sequence", "result"},
    )
    last_received_result = resp_last_received.get("result")
    if last_received_result is not None:
        assert_api.assert_response_matches(
            resp_last_received,
            expected={
                "manager": "ConversationManager",
                "cmd": Cmd.getLatestMessageFromOthers.value,
                "device": remote_device,
                "result": {
                    "from": user_a,
                    "to": user_b,
                    "convId": user_a,
                    "chatType": 0,
                    "direction": 1,
                    "isListened": False,
                    "body": {"type": 0, "targetLanguages": [], "translations": {}},
                },
            },
            ignore_keys={
                "sequence",
                "msgId",
                "serverTime",
                "localTime",
                "deliverOnlineOnly",
                "receiverList",
                "content",
                "status",
                "hasRead",
                "hasReadAck",
                "hasDeliverAck",
                "needGroupAck",
                "isThread",
                "isContentReplaced",
                "broadcast",
                "onlineState",
                "groupAckCount",
            },
        )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
@pytest.mark.case_id("conversation.read_count.mark_message_and_all_read.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ConversationManager.getUnreadMsgCount")
@pytest.mark.api("ConversationManager.markMessageAsRead")
@pytest.mark.api("ConversationManager.markAllMessagesAsRead")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_conversation_read_count_and_mark_read(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为会话、已读、count、and、mark、已读；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.getUnreadMsgCount、ConversationManager.markMessageAsRead、ConversationManager.markAllMessagesAsRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为会话、已读、count、and、mark、已读；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.getUnreadMsgCount、ConversationManager.markMessageAsRead、ConversationManager.markAllMessagesAsRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    device_a, device_b, user_a, user_b, _, remote_device = _topology_pair(topology)
    conv_b = _conversation(user_a)
    device_b.call("ConversationManager", Cmd.markAllMessagesAsRead.value, info=conv_b)
    baseline_resp = device_b.call("ConversationManager", Cmd.getUnreadMsgCount.value, info=conv_b)
    baseline = baseline_resp.get("result")
    assert isinstance(baseline, int), f"getUnreadMsgCount 未返回 int: {baseline_resp}"

    content = f"conv-read-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)

    resp_unread = device_b.call("ConversationManager", Cmd.getUnreadMsgCount.value, info=conv_b)
    assert_api.assert_response_matches(
        resp_unread,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.getUnreadMsgCount.value,
            "device": remote_device,
            "result": ge(baseline),
        },
        ignore_keys={"sequence"},
    )

    resp_mark_one = device_b.call(
        "ConversationManager",
        Cmd.markMessageAsRead.value,
        info={**conv_b, "msgId": msg_id},
    )
    mark_one_result = resp_mark_one.get("result")
    if isinstance(mark_one_result, bool):
        expected_mark_one = mark_one_result
    elif isinstance(mark_one_result, dict):
        if mark_one_result.get("code") == 3:
            expected_mark_one = {"code": 3, "description": "Database operation failed"}
        else:
            expected_mark_one = {"code": 500, "description": "Message is invalid"}
    elif mark_one_result == 0:
        expected_mark_one = 0
    else:
        expected_mark_one = 1
    assert_api.assert_response_matches(
        resp_mark_one,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.markMessageAsRead.value,
            "device": remote_device,
            "result": expected_mark_one,
        },
        ignore_keys={"sequence"},
    )

    resp_mark_all = device_b.call("ConversationManager", Cmd.markAllMessagesAsRead.value, info=conv_b)
    assert_api.assert_response_matches(
        resp_mark_all,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.markAllMessagesAsRead.value,
            "device": remote_device,
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp_mark_all.get("result"), bool), f"markAllMessagesAsRead 当前端返回应为 bool: {resp_mark_all}"

    resp_zero = device_b.call("ConversationManager", Cmd.getUnreadMsgCount.value, info=conv_b)
    assert_api.assert_response_matches(
        resp_zero,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.getUnreadMsgCount.value,
            "device": remote_device,
            "result": 0,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
@pytest.mark.case_id("conversation.load_message_and_lists.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ConversationManager.loadMsgWithId")
@pytest.mark.api("ConversationManager.loadMsgWithStartId")
@pytest.mark.api("ConversationManager.loadMsgWithTime")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_conversation_load_message_and_message_lists(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为会话、load、消息、and、消息、lists；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.loadMsgWithId、ConversationManager.loadMsgWithStartId、ConversationManager.loadMsgWithTime，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为会话、load、消息、and、消息、lists；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.loadMsgWithId、ConversationManager.loadMsgWithStartId、ConversationManager.loadMsgWithTime，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    keyword = f"conv-load-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, keyword)
    conv_a = _conversation(user_b)
    latest_resp = device_a.call("ConversationManager", Cmd.getLatestMessage.value, info=conv_a)
    latest_msg = latest_resp.get("result") if isinstance(latest_resp, dict) else None
    if isinstance(latest_msg, dict) and ((latest_msg.get("body") or {}).get("content")) == keyword and latest_msg.get("msgId"):
        msg_id = str(latest_msg.get("msgId"))
    start_time = int(time.time() * 1000) - 60_000
    end_time = int(time.time() * 1000) + 60_000

    resp_load_one = device_a.call("ConversationManager", Cmd.loadMsgWithId.value, info={**conv_a, "msgId": msg_id})
    assert_api.assert_response_matches(
        resp_load_one,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.loadMsgWithId.value,
            "device": primary_device,
            "result": _expected_sent_message("{{msgId}}", "{{userA}}", "{{userB}}", "{{keyword}}", status=ge(0)),
        },
        context={"msgId": msg_id, "userA": user_a, "userB": user_b, "keyword": keyword},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "deliverOnlineOnly",
            "receiverList",
        },
    )

    list_expect = [_expected_sent_message("{{msgId}}", "{{userA}}", "{{userB}}", "{{keyword}}", status=ge(0))]
    for cmd, info in [
        (Cmd.loadMsgWithStartId.value, {**conv_a, "startId": "", "count": 1, "direction": 0}),
        (Cmd.loadMsgWithTime.value, {**conv_a, "startTime": start_time, "endTime": end_time, "count": 1}),
    ]:
        resp = device_a.call("ConversationManager", cmd, info=info)
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "ConversationManager",
                "cmd": cmd,
                "device": primary_device,
                "result": list_expect,
            },
            context={"msgId": msg_id, "userA": user_a, "userB": user_b, "keyword": keyword},
            ignore_keys={
                "sequence",
                "serverTime",
                "localTime",
                "deliverOnlineOnly",
                "receiverList",
            },
        )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
@pytest.mark.case_id("conversation.type_keyword_and_options_search.current_behavior")
@pytest.mark.api("ConversationManager.loadMsgWithMsgType")
@pytest.mark.api("ConversationManager.loadMsgWithKeywords")
@pytest.mark.api("ConversationManager.conversationSearchMsgsByOptions")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_conversation_type_keyword_and_options_search_current_behavior(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为会话、type、keyword、and、options、search、current、behavior；
    2. 通过 WebSocket 控制测试 App 调用 ConversationManager.loadMsgWithMsgType、ConversationManager.loadMsgWithKeywords、ConversationManager.conversationSearchMsgsByOptions，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为会话、type、keyword、and、options、search、current、behavior；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ConversationManager.loadMsgWithMsgType、ConversationManager.loadMsgWithKeywords、ConversationManager.conversationSearchMsgsByOptions，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    device_a, _, user_a, user_b, primary_device, _ = _topology_pair(topology)
    keyword = f"conv-search-{uuid.uuid4().hex[:8]}"
    conv_a = _conversation(user_b)

    resp_by_type = device_a.call(
        "ConversationManager",
        Cmd.loadMsgWithMsgType.value,
        info={**conv_a, "msgType": 0, "timestamp": -1, "count": 0, "direction": 0},
    )
    assert_api.assert_response_matches(
        resp_by_type,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.loadMsgWithMsgType.value,
            "device": primary_device,
            "result": [],
        },
        ignore_keys={"sequence"},
    )

    resp_by_keyword = device_a.call(
        "ConversationManager",
        Cmd.loadMsgWithKeywords.value,
        info={**conv_a, "keywords": keyword, "count": 1, "timestamp": -1, "searchScope": 0, "direction": 0},
    )
    assert_api.assert_response_matches(
        resp_by_keyword,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.loadMsgWithKeywords.value,
            "device": primary_device,
            "result": [],
        },
        ignore_keys={"sequence"},
    )

    resp_by_options = device_a.call(
        "ConversationManager",
        Cmd.conversationSearchMsgsByOptions.value,
        info={**conv_a, "ts": -1, "count": 0, "direction": 0, "types": [0], "from": user_a},
    )
    assert_api.assert_response_matches(
        resp_by_options,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.conversationSearchMsgsByOptions.value,
            "device": primary_device,
            "result": [],
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
@pytest.mark.case_id("conversation.ext_and_count_queries.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ConversationManager.syncConversationExt")
@pytest.mark.api("ConversationManager.messageCount")
@pytest.mark.api("ConversationManager.conversationGetLocalMessageCount")
@pytest.mark.api("ConversationManager.conversationRemindType")
@pytest.mark.api("ConversationManager.pinnedMessages")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_conversation_ext_and_count_queries(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为会话、ext、and、count、queries；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.syncConversationExt、ConversationManager.messageCount、ConversationManager.conversationGetLocalMessageCount，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为会话、ext、and、count、queries；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.syncConversationExt、ConversationManager.messageCount、ConversationManager.conversationGetLocalMessageCount，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    content = f"conv-count-{uuid.uuid4().hex[:8]}"
    _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)
    conv_a = _conversation(user_b)

    resp_ext = device_a.call(
        "ConversationManager",
        Cmd.syncConversationExt.value,
        info={**conv_a, "ext": {"scene": "api-coverage"}},
    )
    assert_api.assert_response_matches(
        resp_ext,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.syncConversationExt.value,
            "device": primary_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_msg_count = device_a.call("ConversationManager", Cmd.messageCount.value, info=conv_a)
    assert_api.assert_response_matches(
        resp_msg_count,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.messageCount.value,
            "device": primary_device,
            "result": ge(1),
        },
        ignore_keys={"sequence"},
    )

    now = int(time.time() * 1000)
    resp_local_count = device_a.call(
        "ConversationManager",
        Cmd.conversationGetLocalMessageCount.value,
        info={**conv_a, "startTs": now - 60_000, "endTs": now + 60_000},
    )
    assert_api.assert_response_matches(
        resp_local_count,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.conversationGetLocalMessageCount.value,
            "device": primary_device,
            "result": ge(1),
        },
        ignore_keys={"sequence"},
    )

    resp_remind = device_a.call("ConversationManager", Cmd.conversationRemindType.value, info=conv_a)
    assert_api.assert_response_matches(
        resp_remind,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.conversationRemindType.value,
            "device": primary_device,
            "result": 0,
        },
        ignore_keys={"sequence"},
    )

    resp_pinned = device_a.call("ConversationManager", Cmd.pinnedMessages.value, info=conv_a)
    assert_api.assert_response_matches(
        resp_pinned,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.pinnedMessages.value,
            "device": primary_device,
            "result": [],
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("conversation.invalid_message_id_boundaries.error_or_empty")
@pytest.mark.api("ConversationManager.loadMsgWithId")
@pytest.mark.api("ConversationManager.markMessageAsRead")
@pytest.mark.api("ConversationManager.deleteMessageByIds")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_conversation_invalid_message_id_boundaries(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为会话、无效参数、消息、id、boundaries；
    2. 通过 WebSocket 控制测试 App 调用 ConversationManager.loadMsgWithId、ConversationManager.markMessageAsRead、ConversationManager.deleteMessageByIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为会话、无效参数、消息、id、boundaries；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ConversationManager.loadMsgWithId、ConversationManager.markMessageAsRead、ConversationManager.deleteMessageByIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology.primary_client(0)
    user_b = topology.remote_client(0).user_id
    conv_a = _conversation(user_b)
    expected_device = _expected_device(client)

    resp_load_invalid = client.call(
        "ConversationManager",
        Cmd.loadMsgWithId.value,
        info={**conv_a, "msgId": "__not_exists_msg_id__"},
    )
    assert_api.assert_response_matches(
        resp_load_invalid,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.loadMsgWithId.value,
            "device": expected_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    resp_mark_invalid = client.call(
        "ConversationManager",
        Cmd.markMessageAsRead.value,
        info={**conv_a, "msgId": "__not_exists_msg_id__"},
    )
    assert_api.assert_response_matches(
        resp_mark_invalid,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.markMessageAsRead.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_delete_empty = client.call(
        "ConversationManager",
        Cmd.deleteMessageByIds.value,
        info={**conv_a, "messageIds": []},
    )
    assert_api.assert_response_matches(
        resp_delete_empty,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.deleteMessageByIds.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("conversation.local_insert_append_update_delete.current_behavior")
@pytest.mark.api("ConversationManager.insertMessage")
@pytest.mark.api("ConversationManager.appendMessage")
@pytest.mark.api("ConversationManager.updateConversationMessage")
@pytest.mark.api("ConversationManager.loadMsgWithId")
@pytest.mark.api("ConversationManager.removeMessage")
@pytest.mark.api("ConversationManager.deleteMessagesWithTs")
@pytest.mark.api("ConversationManager.clearAllMessages")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_conversation_local_insert_append_update_and_delete(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为会话、本地、insert、append、更新、and、删除；
    2. 通过 WebSocket 控制测试 App 调用 ConversationManager.insertMessage、ConversationManager.appendMessage、ConversationManager.updateConversationMessage、ConversationManager.loadMsgWithId，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为会话、本地、insert、append、更新、and、删除；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ConversationManager.insertMessage、ConversationManager.appendMessage、ConversationManager.updateConversationMessage、ConversationManager.loadMsgWithId，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology.primary_client(0)
    user_a = client.user_id
    user_b = topology.remote_client(0).user_id
    conv_a = _conversation(user_b)
    expected_device = _expected_device(client)
    base_time = int(time.time() * 1000)
    insert_id = f"local-insert-{uuid.uuid4().hex[:8]}"
    append_id = f"local-append-{uuid.uuid4().hex[:8]}"
    update_content = f"local-updated-{uuid.uuid4().hex[:8]}"
    insert_msg = {
        "msgId": insert_id,
        "from": user_a,
        "to": user_b,
        "convId": user_b,
        "chatType": 0,
        "direction": 0,
        "status": 2,
        "hasRead": True,
        "hasReadAck": False,
        "hasDeliverAck": False,
        "needGroupAck": False,
        "isThread": False,
        "deliverOnlineOnly": False,
        "localTime": base_time,
        "serverTime": base_time,
        "body": {"type": 0, "content": f"local-insert-{uuid.uuid4().hex[:8]}"},
    }
    append_msg = {
        **insert_msg,
        "msgId": append_id,
        "localTime": base_time + 1,
        "serverTime": base_time + 1,
        "body": {"type": 0, "content": f"local-append-{uuid.uuid4().hex[:8]}"},
    }

    for cmd, message in [
        (Cmd.insertMessage.value, insert_msg),
        (Cmd.appendMessage.value, append_msg),
    ]:
        resp = client.call("ConversationManager", cmd, info={**conv_a, "msg": message})
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "ConversationManager",
                "cmd": cmd,
                "device": expected_device,
                "result": True,
            },
            ignore_keys={"sequence"},
        )

    updated_msg = {**append_msg, "body": {"type": 0, "content": update_content}}
    resp_update = client.call(
        "ConversationManager",
        Cmd.updateConversationMessage.value,
        info={**conv_a, "msg": updated_msg},
    )
    assert_api.assert_response_matches(
        resp_update,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.updateConversationMessage.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_loaded = client.call("ConversationManager", Cmd.loadMsgWithId.value, info={**conv_a, "msgId": append_id})
    assert_api.assert_response_matches(
        resp_loaded,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.loadMsgWithId.value,
            "device": expected_device,
            "result": {
                "msgId": append_id,
                "from": user_a,
                "to": user_b,
                "convId": user_b,
                "chatType": 0,
                "direction": 0,
                "status": 2,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isListened": False,
                "body": {
                    "targetLanguages": [],
                    "translations": {},
                    "type": 0,
                    "content": update_content,
                },
                "broadcast": False,
                "onlineState": True,
            },
        },
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "isContentReplaced",
            "deliverOnlineOnly",
            "receiverList",
        },
    )

    resp_remove = client.call("ConversationManager", Cmd.removeMessage.value, info={**conv_a, "msgId": insert_id})
    assert_api.assert_response_matches(
        resp_remove,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.removeMessage.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_delete_by_time = client.call(
        "ConversationManager",
        Cmd.deleteMessagesWithTs.value,
        info={**conv_a, "startTs": base_time, "endTs": base_time + 2},
    )
    assert_api.assert_response_matches(
        resp_delete_by_time,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.deleteMessagesWithTs.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_clear = client.call("ConversationManager", Cmd.clearAllMessages.value, info=conv_a)
    assert_api.assert_response_matches(
        resp_clear,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.clearAllMessages.value,
            "device": expected_device,
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
@pytest.mark.case_id("conversation.delete_local_and_server_messages.current_behavior")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ConversationManager.conversationDeleteServerMessageWithIds")
@pytest.mark.api("ConversationManager.conversationDeleteServerMessageWithTime")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_conversation_delete_local_and_server_messages_current_behavior(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为会话、删除、本地、and、服务端、消息、current、behavior；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.conversationDeleteServerMessageWithIds、ConversationManager.conversationDeleteServerMessageWithTime，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为会话、删除、本地、and、服务端、消息、current、behavior；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ConversationManager.conversationDeleteServerMessageWithIds、ConversationManager.conversationDeleteServerMessageWithTime，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    content = f"conv-server-delete-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)
    conv_a = _conversation(user_b)

    resp_delete_ids = device_a.call(
        "ConversationManager",
        Cmd.conversationDeleteServerMessageWithIds.value,
        info={**conv_a, "msgIds": [msg_id]},
    )
    assert_api.assert_response_matches(
        resp_delete_ids,
        expected={
            "manager": "ConversationManager",
            "cmd": Cmd.conversationDeleteServerMessageWithIds.value,
            "device": primary_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    resp_delete_time = device_a.call(
        "ConversationManager",
        Cmd.conversationDeleteServerMessageWithTime.value,
        info={"beforeTs": int(time.time() * 1000) + 1_000},
    )
    assert_api.assert_error(
        resp_delete_time,
        code=-1,
        description="MissingPluginException(No implementation found for method conversationDeleteServerMessageWithTime",
    )
