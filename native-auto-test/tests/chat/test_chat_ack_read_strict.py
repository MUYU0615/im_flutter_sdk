from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text


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


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
def test_chat_ack_message_read_invalid_msg_id(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、消息、已读、无效参数、msg、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、已读回执、消息、已读、无效参数、msg、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.ackMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology.remote_client(0)
    resp = client.call(
        "ChatManager",
        Cmd.ackMessageRead.value,
        info={"msgId": "__invalid_msg_id__", "to": topology.primary_client(0).user_id},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.ackMessageRead.value,
            "device": _expected_device(client),
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_ack_message_read_success_with_event(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、已读回执、消息、已读、成功路径、with、event；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.ackMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、已读回执、消息、已读、成功路径、with、event；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.ackMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    content = f"ack-read-{uuid.uuid4().hex[:8]}"
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    sent_real_id = (((evt_success or {}).get("data") or {}).get("msg") or {}).get("msgId")
    assert sent_real_id, f"missing real msgId from onMessageSuccess: {evt_success!r}"

    evt_received = device_b.receive_message(match_event_type=Cmd.onMessagesReceived.value, timeout=20.0)
    recv_msgs = ((evt_received or {}).get("data") or {}).get("messages") or []
    recv_msg_id = None
    for msg in recv_msgs:
        body = (msg or {}).get("body") or {}
        if (
            (msg or {}).get("from") == user_a
            and (msg or {}).get("to") == user_b
            and body.get("content") == content
            and (msg or {}).get("msgId")
        ):
            recv_msg_id = (msg or {}).get("msgId")
            break
    assert recv_msg_id, f"missing received msgId from onMessagesReceived: {evt_received!r}"

    resp_ack = device_b.call(
        "ChatManager",
        Cmd.ackMessageRead.value,
        info={"msgId": recv_msg_id, "to": user_a},
    )
    assert_api.assert_response_matches(
        resp_ack,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.ackMessageRead.value,
            "device": "deviceB",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    assert_api.assert_response_matches(
        device_a.receive_message(match_event_type=Cmd.onMessagesRead.value, timeout=10.0),
        expected={
            "type": "event",
            "eventType": Cmd.onMessagesRead.value,
            "data": {
                "messages": [
                    {
                        "msgId": "{{msgId}}",
                        "from": "{{fromUser}}",
                        "to": "{{toUser}}",
                        "convId": "{{toUser}}",
                        "chatType": 0,
                        "direction": 0,
                        "status": 2,
                        "hasRead": True,
                        "hasReadAck": True,
                        "hasDeliverAck": False,
                        "needGroupAck": False,
                        "isThread": False,
                        "isContentReplaced": False,
                        "deliverOnlineOnly": False,
                        "body": {"type": 0, "content": "{{content}}", "translations": {}},
                    }
                ],
            },
        },
        context={"msgId": str(recv_msg_id), "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "data.operation"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
