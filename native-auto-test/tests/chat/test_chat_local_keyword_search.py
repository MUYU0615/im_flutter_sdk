from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
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


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.load_conversation_messages_with_keyword.after_send.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.loadConversationMessagesWithKeyword")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_load_conversation_messages_with_keyword_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、会话、消息、with、keyword、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadConversationMessagesWithKeyword，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、会话、消息、with、keyword、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadConversationMessagesWithKeyword，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    keyword = f"kw_{uuid.uuid4().hex[:10]}"
    content = f"s4-keyword-{keyword}"
    real_id = _send_text_and_get_real_id(device_a, device_b, assert_api, user_a, user_b, content)

    # 当前 Android 真实语义下，需要按时间顺序（direction=1）检索才能命中刚发送消息。
    resp = None
    deadline = time.monotonic() + 8.0
    while time.monotonic() < deadline:
        resp = device_a.call(
            "ChatManager",
            Cmd.loadConversationMessagesWithKeyword.value,
            info={
                "keyword": keyword,
                "timestamp": -1,
                "sender": user_a,
                "direction": 1,
                "scope": 2,
            },
        )
        result = resp.get("result") or {}
        if real_id in (result.get(user_b) or []):
            break
        time.sleep(0.5)

    assert resp is not None
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadConversationMessagesWithKeyword.value,
            "device": "deviceA",
            "result": {
                user_b: [real_id],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.load_conversation_messages_with_keyword.no_hit.success")
@pytest.mark.api("ChatManager.loadConversationMessagesWithKeyword")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_load_conversation_messages_with_keyword_no_hit(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、会话、消息、with、keyword、no、hit；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.loadConversationMessagesWithKeyword，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、load、会话、消息、with、keyword、no、hit；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.loadConversationMessagesWithKeyword，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    keyword = f"kw_no_hit_{uuid.uuid4().hex[:10]}"
    resp = device_a.call(
        "ChatManager",
        Cmd.loadConversationMessagesWithKeyword.value,
        info={
            "keyword": keyword,
            "timestamp": -1,
            "sender": user_a,
            "direction": 0,
            "scope": 2,
        },
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadConversationMessagesWithKeyword.value,
            "device": "deviceA",
            "result": {},
        },
        ignore_keys={"sequence"},
    )
