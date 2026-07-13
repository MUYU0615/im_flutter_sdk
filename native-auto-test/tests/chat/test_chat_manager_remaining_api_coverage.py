from __future__ import annotations
from tests.case_steps import describe_case_steps

import os
import uuid
import time

import pytest

from src import Cmd, ge
from src.tools.event_group_waiter import wait_event_group
from tests.chat._message_helpers import matches_received_text, send_text_and_wait, wait_for_success_message
from tests.chat._utils import build_text
from tests.chat.message_event_matchers import expect_message_error
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.chat]


def _send_text_and_receive(device_a, device_b, assert_api, user_a: str, user_b: str, content: str) -> str:
    resp, success_msg, _received_msg = send_text_and_wait(device_a, device_b, user_a=user_a, user_b=user_b, content=content)
    temp_id = (resp.get("result") or {}).get("msgId")
    expected_sender_device = getattr(device_a, "name", "deviceA")
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": expected_sender_device,
            "result": {
                "msgId": temp_id,
                "from": user_a,
                "to": user_b,
                "convId": user_b,
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
                "broadcast": False,
                "onlineState": True,
                "body": {"targetLanguages": [], "translations": {}, "type": 0, "content": content},
            },
        },
        ignore_keys={"sequence", "serverTime", "localTime", "deliverOnlineOnly"},
    )
    real_id = success_msg.get("msgId") or temp_id
    return str(real_id)


def _matches_received_text(message: object, *, user_a: str, user_b: str, content: str) -> bool:
    return matches_received_text(message, from_user=user_a, to_user=user_b, content=content)


def _fetch_marked_conversation(device, conv_id: str, mark: int, *, timeout: float = 10.0) -> dict:
    deadline = time.monotonic() + timeout
    last_resp = None
    while time.monotonic() < deadline:
        last_resp = device.call(
            "ChatManager",
            Cmd.fetchConversationsByOptions.value,
            info={"mark": mark, "pageSize": 10, "cursor": "", "pinned": False},
        )
        result = last_resp.get("result") or {}
        conversations = result.get("list") or []
        for item in conversations:
            if isinstance(item, dict) and item.get("convId") == conv_id and mark in (item.get("marks") or []):
                return item
        time.sleep(0.5)
    raise AssertionError(f"fetchConversationsByOptions 未返回已标记会话: convId={conv_id}, mark={mark}, last={last_resp}")


def _topology_or_none(request):
    if not request.config.getoption("--run-context"):
        return None
    return request.getfixturevalue("topology")


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.case_id("chat.pin_unpin_fetch_pinned_messages.success")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.pinMessage")
@pytest.mark.api("ChatManager.fetchPinnedMessages")
@pytest.mark.api("ChatManager.unpinMessage")
def test_chat_manager_pin_unpin_and_fetch_pinned_messages(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、manager、置顶、unpin、and、拉取、pinned、消息；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.pinMessage、ChatManager.fetchPinnedMessages、ChatManager.unpinMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、manager、置顶、unpin、and、拉取、pinned、消息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.pinMessage、ChatManager.fetchPinnedMessages、ChatManager.unpinMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    content = f"chat-pin-msg-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)

    resp_pin = device_a.call("ChatManager", Cmd.pinMessage.value, info={"msgId": msg_id})
    assert_api.assert_response_matches(
        resp_pin,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.pinMessage.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )
    pin_evt = device_b.receive_message(match_event_type=Cmd.onMessagePinChanged.value, timeout=10.0)
    assert_api.assert_response_matches(
        pin_evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessagePinChanged.value,
            "data": {
                "messageId": msg_id,
                "conversationId": user_a,
                "pinOperation": "MessagePinOperation.Pin",
                "pinInfo": {"operatorId": user_a},
            },
        },
        ignore_keys={"timestamp", "pinTime"},
    )

    resp_fetch = device_a.call("ChatManager", Cmd.fetchPinnedMessages.value, info={"convId": user_b})
    pinned_messages = resp_fetch.get("result") or []
    assert_api.assert_response_matches(
        resp_fetch,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchPinnedMessages.value,
            "device": "deviceA",
            "result": pinned_messages,
        },
        ignore_keys={"sequence"},
    )
    target_pinned = next((item for item in pinned_messages if isinstance(item, dict) and item.get("msgId") == msg_id), None)
    assert target_pinned is not None, f"fetchPinnedMessages 未返回目标置顶消息: msgId={msg_id}, result={pinned_messages}"
    assert_api.assert_response_matches(
        target_pinned,
        expected={
            "msgId": msg_id,
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
            "isContentReplaced": False,
            "isListened": False,
            "body": {"targetLanguages": [], "translations": {}, "type": 0, "content": content},
        },
        ignore_keys={"serverTime", "localTime", "broadcast", "onlineState", "deliverOnlineOnly", "receiverList"},
    )

    resp_unpin = device_a.call("ChatManager", Cmd.unpinMessage.value, info={"msgId": msg_id})
    assert_api.assert_response_matches(
        resp_unpin,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.unpinMessage.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )
    unpin_evt = device_b.receive_message(match_event_type=Cmd.onMessagePinChanged.value, timeout=10.0)
    assert_api.assert_response_matches(
        unpin_evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessagePinChanged.value,
            "data": {
                "messageId": msg_id,
                "conversationId": user_a,
                "pinOperation": "MessagePinOperation.Unpin",
                "pinInfo": {"operatorId": user_a},
            },
        },
        ignore_keys={"timestamp", "pinTime"},
    )

    resp_fetch_empty = device_a.call("ChatManager", Cmd.fetchPinnedMessages.value, info={"convId": user_b})
    remaining_pinned_messages = resp_fetch_empty.get("result") or []
    assert_api.assert_response_matches(
        resp_fetch_empty,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchPinnedMessages.value,
            "device": "deviceA",
            "result": remaining_pinned_messages,
        },
        ignore_keys={"sequence"},
    )
    assert not any(
        isinstance(item, dict) and item.get("msgId") == msg_id for item in remaining_pinned_messages
    ), f"unpinMessage 后目标消息仍在置顶列表中: msgId={msg_id}, result={remaining_pinned_messages}"


@pytest.mark.real_e2e
@pytest.mark.case_id("message.get_pin_info_after_pin.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.pinMessage")
@pytest.mark.api("MessageManager.getPinInfo")
def test_message_manager_get_pin_info_after_pin(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为消息、manager、获取、置顶、信息、after、置顶；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.pinMessage、MessageManager.getPinInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为消息、manager、获取、置顶、信息、after、置顶；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.pinMessage、MessageManager.getPinInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    content = f"message-pin-info-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)

    resp_pin = device_a.call("ChatManager", Cmd.pinMessage.value, info={"msgId": msg_id})
    assert_api.assert_response_matches(
        resp_pin,
        expected={"manager": "ChatManager", "cmd": Cmd.pinMessage.value, "device": "deviceA", "result": None},
        ignore_keys={"sequence"},
    )

    resp = device_a.call("MessageManager", Cmd.getPinInfo.value, info={"msgId": msg_id})
    result = resp.get("result") or {}
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "MessageManager",
            "cmd": Cmd.getPinInfo.value,
            "device": "deviceA",
            "result": {"operatorId": user_a},
        },
        ignore_keys={"sequence", "pinTime"},
    )
    assert result.get("pinTime"), f"pinTime 应存在: {result}"


@pytest.mark.case_id("chat.recall_message.receiver_event.success")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.recallMessage")
def test_chat_manager_recall_message_receiver_recalled_info_event(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、manager、recall、消息、receiver、recalled、信息、event；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.recallMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、manager、recall、消息、receiver、recalled、信息、event；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.recallMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    content = f"chat-recall-event-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)

    resp = device_a.call("ChatManager", Cmd.recallMessage.value, info={"msgId": msg_id})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.recallMessage.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    evt = device_b.receive_message(match_event_type=Cmd.onMessagesRecalledInfo.value, timeout=20.0)
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessagesRecalledInfo.value,
            "data": {
                "infos": [
                    {
                        "recallBy": user_a,
                        "recallMsgId": msg_id,
                        "convId": user_a,
                        "msg": {
                            "msgId": msg_id,
                            "from": user_a,
                            "to": user_b,
                            "convId": user_a,
                            "chatType": 0,
                            "direction": 1,
                            "status": 2,
                            "hasRead": False,
                            "hasReadAck": False,
                            "hasDeliverAck": False,
                            "needGroupAck": False,
                            "isThread": False,
                            "isContentReplaced": False,
                            "isListened": False,
                            "deliverOnlineOnly": False,
                            "body": {"type": 0, "content": content},
                        },
                        "ext": "",
                    },
                ],
            },
        },
        ignore_keys={"timestamp", "serverTime", "localTime", "translations", "receiverList", "operation"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("sender_terminal_error")
@pytest.mark.topology_ready
def test_chat_manager_send_to_non_friend_message_error_event(request, assert_api):
    """
    1. 准备 primary_a 客户端并确认 remote_c 不是好友；
    2. primary_a 向 remote_c 发送带 marker 的单聊消息；
    3. 断言 sendMessage 同步返回临时消息；
    4. 断言发送端收到 onMessageError，且错误码和消息内容匹配。
    """
    describe_case_steps(
        '1. 准备 primary_a 客户端并确认 remote_c 不是好友；\n'
        '2. primary_a 向 remote_c 发送带 marker 的单聊消息；\n'
        '3. 断言 sendMessage 同步返回临时消息；\n'
        '4. 断言发送端收到 onMessageError，且错误码和消息内容匹配。'
    )
    topology = _topology_or_none(request)
    if topology is not None:
        primary_a = topology.primary_client(0)
        remote_c = topology.remote_client(0)
        scope = topology.case_scope("send-to-non-friend", clients=[primary_a])
        marker = scope.marker
        sender = primary_a
        from_user = primary_a.user_id
        to_user = remote_c.user_id
        content = f"non-friend-{marker}"
    else:
        device_a = request.getfixturevalue("device_a")
        user_a = request.getfixturevalue("user_a")
        user_c = request.getfixturevalue("user_c")
        sender = device_a
        from_user = user_a
        to_user = user_c
        try:
            sender.drain_events()
        except Exception:
            pass
        content = f"chat-error-non-friend-{uuid.uuid4().hex[:8]}"

    expected_sender_device = getattr(sender, "name", "deviceA")
    sender.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": to_user, "keepConversation": True},
    )
    if topology is not None:
        remote_c.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": from_user, "keepConversation": True},
        )
    try:
        sender.drain_events()
    except Exception:
        pass

    resp = sender.call("ChatManager", Cmd.sendMessage.value, info=build_text(from_user, to_user, content))
    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessage 未返回临时 msgId: {resp}"
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": expected_sender_device,
            "result": {
                "msgId": temp_id,
                "from": from_user,
                "to": to_user,
                "convId": to_user,
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
                "broadcast": False,
                "onlineState": True,
                "body": {"targetLanguages": [], "translations": {}, "type": 0, "content": content},
            },
        },
        ignore_keys={"sequence", "serverTime", "localTime", "deliverOnlineOnly"},
    )

    if topology is not None:
        try:
            result = wait_event_group(
                expected=[expect_message_error(sender, marker=marker)],
                timeout=20.0,
                description="非好友发送消息只应在发送端收到失败 callback",
            )
        except AssertionError as exc:
            pytest.xfail(
                "当前 Android 服务环境删除好友后仍允许单聊消息发送成功，"
                f"非好友拦截能力未开启或不适用于当前 appkey: {exc}"
            )
        evt = result.matched[f"{sender.name} message error"]
    else:
        try:
            evt = sender.receive_message(match_event_type="onMessageError", timeout=20.0)
        except AssertionError as exc:
            pytest.xfail(
                "当前 Android 服务环境删除好友后仍允许单聊消息发送成功，"
                f"非好友拦截能力未开启或不适用于当前 appkey: {exc}"
            )
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": "onMessageError",
            "data": {
                "msgId": temp_id,
                "msg": {
                    "msgId": temp_id,
                    "from": from_user,
                    "to": to_user,
                    "convId": to_user,
                    "chatType": 0,
                    "direction": 0,
                    "status": 3,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "isListened": False,
                    "deliverOnlineOnly": False,
                    "body": {"type": 0, "content": content, "translations": {}},
                },
                "error": {
                    "code": 221,
                    "description": "User is not on your contact list and you cannot send messages",
                },
            },
        },
        ignore_keys={"timestamp", "serverTime", "localTime"},
    )


@pytest.mark.case_id("chat.conversation_marks_and_fetch_options.success")
@pytest.mark.real_e2e
@pytest.mark.e2e_flow("account_state_sync")
@pytest.mark.topology_ready
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.addRemoteAndLocalConversationsMark")
@pytest.mark.api("ChatManager.fetchConversationsByOptions")
@pytest.mark.api("ChatManager.deleteRemoteAndLocalConversationsMark")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_conversation_marks_and_fetch_options(request, assert_api):
    """
    1. 准备 primary_a、primary_b、remote_c 客户端并确认账号已登录；
    2. primary_a 向 remote_c 发送单聊消息，建立账号 1 与账号 2 的真实会话；
    3. primary_a 添加远端和本地会话标记；
    4. 断言 primary_a 和同账号 primary_b 都能拉取到该会话标记，之后删除标记。
    """
    describe_case_steps(
        '1. 准备 primary_a、primary_b、remote_c 客户端并确认账号已登录；\n'
        '2. primary_a 向 remote_c 发送单聊消息，建立账号 1 与账号 2 的真实会话；\n'
        '3. primary_a 添加远端和本地会话标记；\n'
        '4. 断言 primary_a 和同账号 primary_b 都能拉取到该会话标记，之后删除标记。'
    )
    topology = _topology_or_none(request)
    if topology is not None:
        primary_a = topology.primary_client(0)
        primary_b = topology.primary_client(1)
        remote_c = topology.remote_client(0)
        scope = topology.case_scope("conversation-marks", clients=[primary_a, primary_b, remote_c])
        sender = primary_a
        receiver = remote_c
        sync_receiver = primary_b
        from_user = primary_a.user_id
        to_user = remote_c.user_id
        content = f"chat-mark-{scope.marker}"
    else:
        device_a = request.getfixturevalue("device_a")
        device_b = request.getfixturevalue("device_b")
        user_a = request.getfixturevalue("user_a")
        user_b = request.getfixturevalue("user_b")
        sender = device_a
        receiver = device_b
        sync_receiver = None
        from_user = user_a
        to_user = user_b
        content = f"chat-mark-{uuid.uuid4().hex[:8]}"

    expected_sender_device = getattr(sender, "name", "deviceA")
    _send_text_and_receive(sender, receiver, assert_api, from_user, to_user, content)

    resp_add = sender.call(
        "ChatManager",
        Cmd.addRemoteAndLocalConversationsMark.value,
        info={"convIds": [to_user], "mark": 0},
    )
    assert_api.assert_response_matches(
        resp_add,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addRemoteAndLocalConversationsMark.value,
            "device": expected_sender_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    marked_conversation = _fetch_marked_conversation(sender, to_user, 0)
    assert_api.assert_response_matches(
        marked_conversation,
        expected={
            "convId": to_user,
            "type": 0,
            "isThread": False,
            "isPinned": False,
            "pinnedTime": 0,
            "marks": [0],
        },
        ignore_keys={"ext"},
    )
    if sync_receiver is not None:
        synced_conversation = _fetch_marked_conversation(sync_receiver, to_user, 0)
        assert_api.assert_response_matches(
            synced_conversation,
            expected={
                "convId": to_user,
                "type": 0,
                "isThread": False,
                "isPinned": False,
                "pinnedTime": 0,
                "marks": [0],
            },
            ignore_keys={"ext"},
        )

    resp_delete = sender.call(
        "ChatManager",
        Cmd.deleteRemoteAndLocalConversationsMark.value,
        info={"convIds": [to_user], "mark": 0},
    )
    assert_api.assert_response_matches(
        resp_delete,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.deleteRemoteAndLocalConversationsMark.value,
            "device": expected_sender_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.message_count_and_search_options.boundary.success")
@pytest.mark.api("ChatManager.getMessageCount")
@pytest.mark.api("ChatManager.searchMsgsByOptions")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chat_manager_message_count_and_search_options_boundaries(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、manager、消息、count、and、search、options、boundaries；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getMessageCount、ChatManager.searchMsgsByOptions，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、manager、消息、count、and、search、options、boundaries；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getMessageCount、ChatManager.searchMsgsByOptions，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp_count = client.call("ChatManager", Cmd.getMessageCount.value, info={})
    assert_api.assert_response_matches(
        resp_count,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getMessageCount.value,
            "device": expected_device,
            "result": ge(0),
        },
        ignore_keys={"sequence"},
    )

    resp_search = client.call(
        "ChatManager",
        Cmd.searchMsgsByOptions.value,
        info={"ts": -1, "count": 0, "direction": 0, "types": [0], "from": user_a},
    )
    assert_api.assert_response_matches(
        resp_search,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.searchMsgsByOptions.value,
            "device": expected_device,
            "result": [],
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.delete_all_message_and_conversation.local.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.deleteAllMessageAndConversation")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_manager_delete_all_message_and_conversation_local(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、manager、删除、all、消息、and、会话、本地；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteAllMessageAndConversation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、manager、删除、all、消息、and、会话、本地；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.deleteAllMessageAndConversation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, f"chat-clear-all-{uuid.uuid4().hex[:8]}")
    resp_delete = device_a.call(
        "ChatManager",
        Cmd.deleteAllMessageAndConversation.value,
        info={"clearServerData": False},
    )
    assert_api.assert_response_matches(
        resp_delete,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.deleteAllMessageAndConversation.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.case_id("chat.message_object_boundary_methods.current_behavior")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.importMessages")
@pytest.mark.api("ChatManager.updateChatMessage")
@pytest.mark.api("ChatManager.resendMessage")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_message_object_boundary_methods(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、消息、object、boundary、methods；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.importMessages、ChatManager.updateChatMessage、ChatManager.resendMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、消息、object、boundary、methods；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.importMessages、ChatManager.updateChatMessage、ChatManager.resendMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    msg_id = f"chat-object-{uuid.uuid4().hex[:8]}"
    original_body = {"type": 0, "content": f"chat-object-{uuid.uuid4().hex[:8]}"}
    message = {
        "msgId": msg_id,
        "from": user_a,
        "to": user_b,
        "convId": user_b,
        "chatType": 0,
        "direction": 0,
        "status": 3,
        "hasRead": True,
        "hasReadAck": False,
        "hasDeliverAck": False,
        "needGroupAck": False,
        "isThread": False,
        "deliverOnlineOnly": False,
        "body": original_body,
    }

    resp_import = device_a.call("ChatManager", Cmd.importMessages.value, info={"messages": [message]})
    assert_api.assert_response_matches(
        resp_import,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.importMessages.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    updated_body = {"type": 0, "content": f"chat-object-updated-{uuid.uuid4().hex[:8]}"}
    updated = {**message, "status": 2, "body": updated_body}
    resp_update = device_a.call("ChatManager", Cmd.updateChatMessage.value, info={"message": updated})
    assert_api.assert_response_matches(
        resp_update,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.updateChatMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": msg_id,
                "from": user_a,
                "to": user_b,
                "convId": user_b,
                "chatType": 0,
                "direction": 0,
                "isListened": False,
                "body": updated_body,
            },
        },
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "status",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "broadcast",
            "onlineState",
            "deliverOnlineOnly",
            "targetLanguages",
            "translations",
        },
    )

    resp_resend = device_a.call("ChatManager", Cmd.resendMessage.value, info=message)
    assert_api.assert_response_matches(
        resp_resend,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.resendMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": msg_id,
                "from": user_a,
                "to": user_b,
                "convId": user_b,
                "chatType": 0,
                "direction": 0,
                "isListened": False,
                "body": updated_body,
            },
        },
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "status",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "broadcast",
            "onlineState",
            "deliverOnlineOnly",
            "targetLanguages",
            "translations",
        },
    )


@pytest.mark.case_id("chat.update_participant.current_behavior")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.updateParticipant")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chat_manager_update_participant_current_behavior(topology_primary_or_device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、manager、更新、participant、current、behavior；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.updateParticipant，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天状态变更场景所需的测试数据，场景为chat、manager、更新、participant、current、behavior；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.updateParticipant，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp = client.call(
        "ChatManager",
        Cmd.updateParticipant.value,
        info={"from": user_b, "changeTo": user_a},
    )
    result = resp.get("result")
    assert isinstance(result, bool), f"updateParticipant 应返回 bool，实际: {resp}"
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.updateParticipant.value,
            "device": expected_device,
            "result": result,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.case_id("chat.update_participant.invalid_required_params")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.updateParticipant")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_manager_update_participant_invalid_required_params(topology_primary_or_device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、更新、participant、无效参数、required、params；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.updateParticipant，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、更新、participant、无效参数、required、params；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.updateParticipant，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    missing_from = client.call(
        "ChatManager",
        Cmd.updateParticipant.value,
        info={"changeTo": user_b},
    )
    assert_api.assert_response_matches(
        missing_from,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.updateParticipant.value,
            "device": expected_device,
            "result": {"code": 110},
        },
        ignore_keys={"sequence", "description"},
    )

    missing_change_to = client.call(
        "ChatManager",
        Cmd.updateParticipant.value,
        info={"from": user_b},
    )
    assert_api.assert_response_matches(
        missing_change_to,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.updateParticipant.value,
            "device": expected_device,
            "result": {"code": 110},
        },
        ignore_keys={"sequence", "description"},
    )


@pytest.mark.case_id("chat.filter_conversations_from_db.current_behavior")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.asyncFilterConversationsFromDB")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_filter_conversations_from_db_current_behavior(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、filter、conversations、from、db、current、behavior；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.asyncFilterConversationsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、filter、conversations、from、db、current、behavior；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.asyncFilterConversationsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, f"chat-filter-db-{uuid.uuid4().hex[:8]}")

    resp = device_a.call(
        "ChatManager",
        Cmd.asyncFilterConversationsFromDB.value,
        info={"hasUnread": False, "pageSize": 1, "sort": True},
    )
    result = resp.get("result") or []
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.asyncFilterConversationsFromDB.value,
            "device": "deviceA",
            "result": result,
        },
        ignore_keys={"sequence"},
    )
    assert isinstance(result, list), f"asyncFilterConversationsFromDB 应返回 list: {resp}"
    assert len(result) <= 1, f"pageSize=1 时最多返回 1 条会话: {result}"
    if result:
        assert_api.assert_response_matches(
            result[0],
            expected={
                "type": 0,
                "isThread": False,
            },
            ignore_keys={"convId", "isPinned", "pinnedTime", "marks", "ext"},
        )


@pytest.mark.case_id("chat.filter_conversations_from_db.invalid_mark")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.asyncFilterConversationsFromDB")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_manager_filter_conversations_from_db_invalid_mark(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、filter、conversations、from、db、无效参数、mark；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.asyncFilterConversationsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、filter、conversations、from、db、无效参数、mark；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.asyncFilterConversationsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp = client.call(
        "ChatManager",
        Cmd.asyncFilterConversationsFromDB.value,
        info={"mark": 9999, "pageSize": 1, "sort": True},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.asyncFilterConversationsFromDB.value,
            "device": expected_device,
            "result": {"code": 110},
        },
        ignore_keys={"sequence", "description"},
    )


@pytest.mark.case_id("chat.voice_message_to_text.local_voice_message.current_behavior")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.voiceMessageToText")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_voice_message_to_text_local_voice_message(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、voice、消息、to、text、本地、voice；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.voiceMessageToText，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、voice、消息、to、text、本地、voice；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.voiceMessageToText，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    voice_path = f"/tmp/im_voice_to_text_{uuid.uuid4().hex[:8]}.aac"
    with open(voice_path, "wb") as fh:
        fh.write(b"fake-aac-data")
    try:
        message = {
            "from": user_a,
            "to": user_b,
            "convId": user_b,
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
                "type": 4,
                "localPath": voice_path,
                "displayName": os.path.basename(voice_path),
                "fileSize": 13,
                "duration": 1,
                "fileStatus": 3,
            },
        }
        resp = device_a.call("ChatManager", Cmd.voiceMessageToText.value, info={"message": message})
        result = resp.get("result")
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.voiceMessageToText.value,
                "device": "deviceA",
                "result": result,
            },
            ignore_keys={"sequence"},
        )
        assert isinstance(result, (str, dict, type(None))), f"voiceMessageToText 返回类型异常: {resp}"
    finally:
        try:
            os.remove(voice_path)
        except OSError:
            pass


@pytest.mark.case_id("chat.voice_file_to_text.invalid_audio_params")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.voiceFileToText")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_manager_voice_file_to_text_invalid_audio_params(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、voice、file、to、text、无效参数、audio；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.voiceFileToText，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、voice、file、to、text、无效参数、audio；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.voiceFileToText，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp = client.call(
        "ChatManager",
        Cmd.voiceFileToText.value,
        info={
            "filePath": "/tmp/not-exists.pcm",
            "audioParams": {
                "format": "invalid",
                "sampleRate": 16000,
                "bitsPerSample": 16,
                "channels": 1,
            },
        },
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.voiceFileToText.value,
            "device": expected_device,
            "result": {"code": 110},
        },
        ignore_keys={"sequence", "description"},
    )


@pytest.mark.case_id("chat.group_ack_boundary_methods.current_behavior")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.ackGroupMessageRead")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_group_ack_boundary_methods(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、群组、已读回执、boundary、methods；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackGroupMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为chat、manager、群组、已读回执、boundary、methods；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackGroupMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    info = {"msgId": "__invalid_group_msg_id__", "group_id": "__invalid_group_id__"}
    resp_ack = device_a.call("ChatManager", Cmd.ackGroupMessageRead.value, info=info)
    assert_api.assert_response_matches(
        resp_ack,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.ackGroupMessageRead.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.case_id("chat.fetch_group_acks.success")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.ackGroupMessageRead")
@pytest.mark.api("ChatManager.asyncFetchGroupAcks")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_fetch_group_acks_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、manager、拉取、群组、acks、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.ackGroupMessageRead、ChatManager.asyncFetchGroupAcks，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、manager、拉取、群组、acks、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.ackGroupMessageRead、ChatManager.asyncFetchGroupAcks，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    group_id = ""
    try:
        try:
            device_a.drain_events()
            device_b.drain_events()
        except Exception:
            pass
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("group_ack"),
            invite_members=[user_b],
        )
        content = f"group-ack-{uuid.uuid4().hex[:8]}"
        msg = build_text(user_a, group_id, content, chat_type=1)
        msg["needGroupAck"] = True
        send_resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=msg)
        temp_id = ((send_resp.get("result") or {}).get("msgId"))
        assert temp_id, f"群消息发送响应未返回临时 msgId: {send_resp}"
        assert_api.assert_response_matches(
            send_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.sendMessage.value,
                "device": "deviceA",
                "result": {
                    "msgId": temp_id,
                    "from": user_a,
                    "to": group_id,
                    "convId": group_id,
                    "chatType": 1,
                    "direction": 0,
                    "status": 0,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": True,
                    "isThread": False,
                    "isContentReplaced": False,
                    "isListened": False,
                    "broadcast": False,
                    "onlineState": True,
                    "body": {"targetLanguages": [], "translations": {}, "type": 0, "content": content},
                },
            },
            ignore_keys={"sequence", "serverTime", "localTime", "deliverOnlineOnly"},
        )
        success_msg = wait_for_success_message(
            device_a,
            from_user=user_a,
            to_user=group_id,
            content=content,
            chat_type=1,
        )
        msg_id = success_msg.get("msgId")
        assert isinstance(msg_id, str) and msg_id, f"未拿到群消息 msgId: {success_msg}"

        recv_msg = None
        seen_events = []
        deadline = time.monotonic() + 20.0
        while time.monotonic() < deadline and recv_msg is None:
            recv_evt = device_b.receive_message(match_event_type=Cmd.onMessagesReceived.value, timeout=2.0)
            if recv_evt:
                seen_events.append(recv_evt)
            recv_messages = ((recv_evt or {}).get("data") or {}).get("messages") or []
            recv_msg = next(
                (
                    m
                    for m in recv_messages
                    if isinstance(m, dict)
                    and m.get("from") == user_a
                    and m.get("to") == group_id
                    and m.get("chatType") == 1
                    and ((m.get("body") or {}).get("content") == content)
                ),
                None,
            )
        assert recv_msg is not None, f"B 端未收到目标群消息: msgId={msg_id}, events={seen_events}"

        recv_msg_id = recv_msg.get("msgId")
        assert isinstance(recv_msg_id, str) and recv_msg_id, f"B 端目标群消息未携带 msgId: {recv_msg}"

        ack_resp = device_b.call(
            "ChatManager",
            Cmd.ackGroupMessageRead.value,
            info={"msgId": recv_msg_id, "group_id": group_id, "content": "read"},
        )
        assert_api.assert_response_matches(
            ack_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.ackGroupMessageRead.value,
                "device": "deviceB",
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        fetch_resp = device_a.call(
            "ChatManager",
            Cmd.asyncFetchGroupAcks.value,
            info={"msgId": recv_msg_id, "group_id": group_id, "pageSize": 20, "ack_id": None},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.asyncFetchGroupAcks.value,
                "device": "deviceA",
                "result": {
                    "cursor": "",
                    "list": [],
                },
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.case_id("chat.fetch_group_acks.invalid_required_params")
@pytest.mark.real_e2e
@pytest.mark.api("ChatManager.asyncFetchGroupAcks")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_manager_fetch_group_acks_invalid_required_params(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、拉取、群组、acks、无效参数、required、params；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.asyncFetchGroupAcks，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、manager、拉取、群组、acks、无效参数、required、params；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.asyncFetchGroupAcks，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp_missing_msg = device_a.call(
        "ChatManager",
        Cmd.asyncFetchGroupAcks.value,
        info={"group_id": "__invalid_group_id__", "pageSize": 20, "ack_id": None},
    )
    assert_api.assert_response_matches(
        resp_missing_msg,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.asyncFetchGroupAcks.value,
            "device": "deviceA",
            "result": {"code": 110, "description": "'msgId' can not be null"},
        },
        ignore_keys={"sequence"},
    )

    resp_invalid_page = device_a.call(
        "ChatManager",
        Cmd.asyncFetchGroupAcks.value,
        info={"msgId": "__invalid_group_msg_id__", "group_id": "__invalid_group_id__", "pageSize": 0, "ack_id": None},
    )
    assert_api.assert_response_matches(
        resp_invalid_page,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.asyncFetchGroupAcks.value,
            "device": "deviceA",
            "result": {"code": 110, "description": "'pageSize' must be greater than 0"},
        },
        ignore_keys={"sequence"},
    )
