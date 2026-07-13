from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

import pytest

from src import Cmd
from tests.chat._message_helpers import send_text_and_wait


pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.agorachat1_4_0]

_ANDROID_MESSAGE_OPTIONAL_KEYS = {
    "broadcast",
    "onlineState",
    "deliverOnlineOnly",
    "targetLanguages",
    "translations",
    "isListened",
}


def _send_text_and_get_real_id(device_a, device_b, assert_api, user_a: str, user_b: str, content: str) -> str:
    resp_send, success_msg, _received_msg = send_text_and_wait(
        device_a,
        device_b,
        user_a=user_a,
        user_b=user_b,
        content=content,
    )
    send_result = resp_send.get("result") or {}
    send_msg_id = send_result.get("msgId")
    assert isinstance(send_msg_id, str) and send_msg_id, f"sendMessage 未返回有效 msgId: {resp_send}"
    real_id = send_msg_id

    assert_api.assert_response_matches(
        resp_send,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": real_id,
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
                "body": {"type": 0, "content": content},
            },
        },
        ignore_keys={"sequence", "serverTime", "localTime", "broadcast", "onlineState", "targetLanguages", "translations", "isListened"},
    )

    assert_api.assert_response_matches(
        {
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {"msg": success_msg},
        },
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "msg": {
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
                    "body": {"type": 0, "content": content},
                }
            },
        },
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "receiverList",
            "msgId",
            "data.msgId",
            "data.msg.msgId",
        } | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    real_id = str(success_msg.get("msgId") or real_id)

    return real_id


def _assert_loaded_messages_contains_ids(resp: dict, expected_ids: list[str], user_a: str, user_b: str) -> None:
    result = resp.get("result")
    assert isinstance(result, list), f"loadMessagesWithIds result 预期为 list: {resp}"

    id_set = set(expected_ids)
    hit: dict[str, dict] = {}
    for item in result:
        if not isinstance(item, dict):
            continue
        msg_id = item.get("msgId")
        if isinstance(msg_id, str) and msg_id in id_set:
            hit[msg_id] = item

    missing = [mid for mid in expected_ids if mid not in hit]
    assert not missing, f"loadMessagesWithIds 未命中预期消息: missing={missing}, resp={resp}"

    for mid in expected_ids:
        msg = hit[mid]
        assert msg.get("from") == user_a, f"msg.from 不匹配: expected={user_a}, msg={msg}"
        assert msg.get("to") == user_b, f"msg.to 不匹配: expected={user_b}, msg={msg}"
        assert msg.get("chatType") == 0, f"msg.chatType 不匹配: {msg}"
        assert msg.get("convId") == user_b, f"msg.convId 不匹配: expected={user_b}, msg={msg}"
        assert msg.get("direction") == 0, f"msg.direction 不匹配: {msg}"
        assert msg.get("status") == 2, f"msg.status 不匹配: {msg}"
        assert msg.get("hasRead") is True, f"msg.hasRead 不匹配: {msg}"
        assert msg.get("hasReadAck") is False, f"msg.hasReadAck 不匹配: {msg}"
        assert msg.get("hasDeliverAck") is False, f"msg.hasDeliverAck 不匹配: {msg}"
        assert msg.get("needGroupAck") is False, f"msg.needGroupAck 不匹配: {msg}"
        assert msg.get("isThread") is False, f"msg.isThread 不匹配: {msg}"
        assert msg.get("isContentReplaced") is False, f"msg.isContentReplaced 不匹配: {msg}"
        if "deliverOnlineOnly" in msg:
            assert msg.get("deliverOnlineOnly") is False, f"msg.deliverOnlineOnly 不匹配: {msg}"


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.load_messages_with_ids.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.loadMessagesWithIds")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_load_messages_with_ids_single_and_multi_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、消息、with、ids、single、and、multi；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadMessagesWithIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、消息、with、ids、single、and、multi；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadMessagesWithIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    content_1 = f"s4-load-by-ids-{uuid.uuid4().hex[:8]}-1"
    content_2 = f"s4-load-by-ids-{uuid.uuid4().hex[:8]}-2"
    msg_id_1 = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, content_1)
    msg_id_2 = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, content_2)

    # 单 ID
    resp_single = device_a.call(
        "ChatManager",
        Cmd.loadMessagesWithIds.value,
        info={
            "messageIds": [msg_id_1],
            "conversationId": user_b,
        },
    )
    assert_api.assert_response_matches(
        resp_single,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadMessagesWithIds.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    _assert_loaded_messages_contains_ids(resp_single, [msg_id_1], user_a, user_b)

    # 多 ID（含不存在 ID，验证稳定忽略语义）
    resp_multi = device_a.call(
        "ChatManager",
        Cmd.loadMessagesWithIds.value,
        info={
            "messageIds": [msg_id_1, msg_id_2, "__not_exists_msg_id__"],
            "conversationId": user_b,
        },
    )
    assert_api.assert_response_matches(
        resp_multi,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadMessagesWithIds.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    _assert_loaded_messages_contains_ids(resp_multi, [msg_id_1, msg_id_2], user_a, user_b)


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.load_messages_with_ids.empty_ids.error")
@pytest.mark.api("ChatManager.loadMessagesWithIds")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_load_messages_with_ids_empty_ids(device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、load、消息、with、ids、空值参数、ids；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.loadMessagesWithIds，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、load、消息、with、ids、空值参数、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.loadMessagesWithIds，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatManager",
        Cmd.loadMessagesWithIds.value,
        info={
            "messageIds": [],
            "conversationId": user_b,
        },
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadMessagesWithIds.value,
            "device": "deviceA",
            "result": {"code": 110, "description": "Invalid parameter"},
        },
        ignore_keys={"sequence"},
    )
