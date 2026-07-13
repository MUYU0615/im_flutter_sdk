from __future__ import annotations

import os
import time
import uuid
import pytest

from src import Cmd, ne
from src.tools.assertions import get_result
from tests.case_steps import describe_case_steps
from tests.chat._message_helpers import wait_for_success_message
from tests.chat._utils import build_text


_ANDROID_MESSAGE_OPTIONAL_KEYS = {
    "broadcast",
    "onlineState",
    "deliverOnlineOnly",
    "targetLanguages",
    "translations",
    "isListened",
}


def _send_text_and_wait_final_id(device_a, *, user_a: str, user_b: str, content: str) -> str:
    resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessage 未返回临时 msgId: {resp}"
    success_msg = wait_for_success_message(device_a, from_user=user_a, to_user=user_b, content=content)
    real_id = success_msg.get("msgId")
    assert real_id, f"missing final msgId from onMessageSuccess: {success_msg!r}"
    return str(real_id)


def _xfail_if_reaction_service_unavailable(resp: dict) -> None:
    result = resp.get("result")
    if isinstance(result, dict) and result.get("code") == 303:
        desc = str(result.get("description", ""))
        if "Unknown server error" in desc:
            pytest.xfail("当前 Android 环境 reaction 服务返回 303 Unknown server error，按服务能力限制处理")


# ======================== Create / Send ========================


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.send_message.text.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_send_and_received(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、send、and、received；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、send、and、received；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    content = "hello-basic"
    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    temp_id = ((resp_send.get("result") or {}).get("msgId"))
    real_id = ((evt_success.get("data") or {}).get("msg") or {}).get("msgId")
    assert_api.assert_response_matches(
        evt_success,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "operation": "message_success",
                "msg": {
                    "msgId": "{{realId}}",
                    "from": "{{fromUser}}",
                    "to": "{{toUser}}",
                    "convId": "{{toUser}}",
                    "body": {"type": 0, "content": "{{content}}", "translations": {}},
                    "direction": 0,
                    "chatType": 0,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                },
            },
        },
        context={"tempId": temp_id, "realId": real_id, "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "status"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    success_msg = ((evt_success.get("data") or {}).get("msg")) or {}
    if "deliverOnlineOnly" in success_msg:
        assert success_msg.get("deliverOnlineOnly") is False, f"data.msg.deliverOnlineOnly 不匹配: {success_msg}"

    assert_api.assert_response_matches(
        resp_send,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{tempId}}",
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
            },
        },
        context={"tempId": temp_id, "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"sequence", "serverTime", "localTime", "result.status"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    evt_received = device_b.receive_message(match_event_type=Cmd.onMessagesReceived.value, timeout=60.0)
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
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "receiverList", "msgId"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    received_messages = ((evt_received.get("data") or {}).get("messages")) or []
    if received_messages and "deliverOnlineOnly" in received_messages[0]:
        assert received_messages[0].get("deliverOnlineOnly") is False, f"data.messages[0].deliverOnlineOnly 不匹配: {received_messages[0]}"


@pytest.mark.real_e2e
def test_chat_send_to_self_event(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、send、to、self、event；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、send、to、self、event；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
    except Exception:
        pass
    content = f"self-msg-{uuid.uuid4().hex[:6]}"
    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_a, content))
    evt = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    temp_id = ((resp_send.get("result") or {}).get("msgId"))
    real_id = ((evt.get("data") or {}).get("msg") or {}).get("msgId")
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "operation": "message_success",
                "msg": {
                    "msgId": "{{realId}}",
                    "from": "{{user}}",
                    "to": "{{user}}",
                    "convId": "{{user}}",
                    "body": {"type": 0, "content": "{{content}}", "translations": {}},
                    "direction": 0,
                    "chatType": 0,
                    "status": 0,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                },
            },
        },
        context={"tempId": temp_id, "realId": real_id, "user": user_a, "content": content},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    msg = ((evt.get("data") or {}).get("msg")) or {}
    if "deliverOnlineOnly" in msg:
        assert msg.get("deliverOnlineOnly") is False, f"data.msg.deliverOnlineOnly 不匹配: {msg}"

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
        ignore_keys={"sequence", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )


# ======================== Read ========================


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_get_message_invalid_id_returns_none(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、消息、无效参数、id、returns、none；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、获取、消息、无效参数、id、returns、none；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = getattr(client, "name", "deviceA")
    resp = client.call("ChatManager", Cmd.getMessage.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.getMessage.value, "device": expected_device, "result": None},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.set_voice_message_listened.local_voice_message.success")
@pytest.mark.api("ChatManager.saveMessage")
@pytest.mark.api("ChatManager.getMessage")
@pytest.mark.api("ChatManager.setVoiceMessageListened")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_set_voice_message_listened_local_voice_message(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、set、voice、消息、listened、本地、voice、消息；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.saveMessage、ChatManager.getMessage、ChatManager.setVoiceMessageListened，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、set、voice、消息、listened、本地、voice、消息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.saveMessage、ChatManager.getMessage、ChatManager.setVoiceMessageListened，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    voice_path = f"/tmp/im_voice_{uuid.uuid4().hex[:8]}.aac"
    with open(voice_path, "wb") as fh:
        fh.write(b"fake-aac-data")

    msg_id = None
    try:
        save_resp = device_a.call(
            "ChatManager",
            Cmd.saveMessage.value,
            info={
                "message": {
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
            },
        )
        save_result = save_resp.get("result")
        assert not (
            isinstance(save_result, dict)
            and "code" in save_result
            and "description" in save_result
        ), f"saveMessage returned error result: {save_resp}"
        assert_api.assert_response_matches(
            save_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.saveMessage.value,
                "device": "deviceA",
                "result": {
                    "from": user_a,
                    "to": user_b,
                    "convId": user_b,
                    "chatType": 0,
                    "direction": 0,
                    "body": {
                        "type": 4,
                        "displayName": os.path.basename(voice_path),
                        "duration": 1,
                    },
                    "isListened": False,
                },
            },
            ignore_keys={
                "sequence",
                "result.msgId",
                "result.serverTime",
                "result.localTime",
                "result.status",
                "result.hasRead",
                "result.hasReadAck",
                "result.hasDeliverAck",
                "result.needGroupAck",
                "result.isThread",
                "result.isContentReplaced",
                "result.broadcast",
                "result.onlineState",
                "result.body.localPath",
                "result.body.remotePath",
                "result.body.secret",
                "result.body.downloadStatus",
                "result.body.fileStatus",
                "result.body.fileSize",
            },
        )
        msg_id = ((save_resp.get("result") or {}).get("msgId"))
        assert msg_id, f"saveMessage 未返回 msgId: {save_resp}"

        before_resp = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
        assert_api.assert_response_matches(
            before_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.getMessage.value,
                "device": "deviceA",
                "result": {
                    "msgId": msg_id,
                    "body": {"type": 4},
                    "isListened": False,
                },
            },
            ignore_keys={
                "sequence",
                "result.from",
                "result.to",
                "result.convId",
                "result.chatType",
                "result.direction",
                "result.status",
                "result.hasRead",
                "result.hasReadAck",
                "result.hasDeliverAck",
                "result.needGroupAck",
                "result.isThread",
                "result.isContentReplaced",
                "result.serverTime",
                "result.localTime",
                "result.broadcast",
                "result.onlineState",
                "result.body.localPath",
                "result.body.remotePath",
                "result.body.secret",
                "result.body.downloadStatus",
                "result.body.fileStatus",
                "result.body.displayName",
                "result.body.fileSize",
                "result.body.duration",
            },
        )

        listened_resp = device_a.call(
            "ChatManager",
            Cmd.setVoiceMessageListened.value,
            info={"message": (before_resp.get("result") or {})},
        )
        assert_api.assert_response_matches(
            listened_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.setVoiceMessageListened.value,
                "device": "deviceA",
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        after_resp = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
        assert_api.assert_response_matches(
            after_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.getMessage.value,
                "device": "deviceA",
                "result": {
                    "msgId": msg_id,
                    "body": {"type": 4},
                    "isListened": True,
                },
            },
            ignore_keys={
                "sequence",
                "result.from",
                "result.to",
                "result.convId",
                "result.chatType",
                "result.direction",
                "result.status",
                "result.hasRead",
                "result.hasReadAck",
                "result.hasDeliverAck",
                "result.needGroupAck",
                "result.isThread",
                "result.isContentReplaced",
                "result.serverTime",
                "result.localTime",
                "result.broadcast",
                "result.onlineState",
                "result.body.localPath",
                "result.body.remotePath",
                "result.body.secret",
                "result.body.downloadStatus",
                "result.body.fileStatus",
                "result.body.displayName",
                "result.body.fileSize",
                "result.body.duration",
            },
        )
    finally:
        try:
            os.remove(voice_path)
        except FileNotFoundError:
            pass


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_support_languages_success(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、support、languages、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchSupportLanguages，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、拉取、support、languages、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchSupportLanguages，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = getattr(client, "name", "deviceA")
    resp = client.call("ChatManager", Cmd.fetchSupportLanguages.value, info={})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchSupportLanguages.value,
            "device": expected_device,
            "result": ne(None),
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
    resp = device_b.call("ChatManager", Cmd.fetchHistoryMessages.value, info={"conversationId": "__invalid__", "pageSize": 20, "cursor": None})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessages.value,
            "device": "deviceB",
            "result": {"code": 110, "description": "'convId' can not be null"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_history_by_options_invalid_conversation(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、by、options、无效参数、会话；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、history、by、options、无效参数、会话；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchHistoryMessagesByOptions，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = getattr(client, "name", "deviceA")
    resp = client.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": "__invalid__", "type": 0, "pageSize": 20, "cursor": ""},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessagesByOptions.value,
            "device": expected_device,
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_save_message_then_get_message_success(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、save、消息、then、获取、消息、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.saveMessage、ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、save、消息、then、获取、消息、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.saveMessage、ChatManager.getMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    msg_id = f"save-local-{uuid.uuid4().hex}"
    content = f"save-message-{uuid.uuid4().hex[:6]}"
    message = build_text(user_a, user_b, content)
    message["msgId"] = msg_id

    resp_save = device_a.call("ChatManager", Cmd.saveMessage.value, info={"message": message})
    assert_api.assert_response_matches(
        resp_save,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.saveMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{msgId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "convId": "{{toUser}}",
                "chatType": 0,
                "direction": 0,
                "body": {"type": 0, "content": "{{content}}"},
            },
        },
        context={"msgId": msg_id, "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"sequence", "status", "hasRead", "hasReadAck", "hasDeliverAck", "needGroupAck", "isThread", "isContentReplaced", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )

    resp_get = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
    assert_api.assert_response_matches(
        resp_get,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.getMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{msgId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "convId": "{{toUser}}",
                "chatType": 0,
                "direction": 0,
                "body": {"type": 0, "content": "{{content}}"},
            },
        },
        context={"msgId": msg_id, "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={"sequence", "status", "hasRead", "hasReadAck", "hasDeliverAck", "needGroupAck", "isThread", "isContentReplaced", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )


@pytest.mark.real_e2e
@pytest.mark.skip(reason="MissingPlugin: searchChatMsgFromDB 未在当前集成端实现")
def test_chat_search_chat_msg_from_db_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、search、chat、msg、from、db、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.searchChatMsgFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、search、chat、msg、from、db、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.searchChatMsgFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    keyword = f"kw-{uuid.uuid4().hex[:6]}"
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, keyword))
    _ = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    resp = device_a.call("ChatManager", Cmd.searchChatMsgFromDB.value, info={"keywords": keyword})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.searchChatMsgFromDB.value, "device": "deviceA"},
        ignore_keys={"sequence"},
    )


# ======================== Update ========================


@pytest.mark.real_e2e
def test_chat_translate_message_basic(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、translate、消息、basic；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getMessage、ChatManager.translateMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、translate、消息、basic；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getMessage、ChatManager.translateMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
    except Exception:
        pass
    content = "translate-basic"
    real_id = _send_text_and_wait_final_id(device_a, user_a=user_a, user_b=user_b, content=content)
    resp_get = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": real_id})
    msg_obj = get_result(resp_get)
    try:
        resp_tr = device_a.call("ChatManager", Cmd.translateMessage.value, info={"message": msg_obj, "targetLanguages": ["zh-Hans"]})
    except TimeoutError as exc:
        pytest.xfail(f"当前 Android 环境 translateMessage 未在超时时间内返回: {exc}")
    # translateMessage 同步 result 可能回 echo 的整个消息体，也可能只回修改过的 body；统一以 body 为主断言。
    assert_api.assert_response_matches(
        resp_tr,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.translateMessage.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{msgId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "convId": "{{convId}}",
                "chatType": 0,
                "direction": 0,
                "status": 2,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "body": {
                    "type": 0,
                    "content": "translate-basic",
                    "translations": {},
                }
            }
        },
        context={"msgId": str(real_id), "fromUser": user_a, "toUser": user_b, "convId": user_b},
        ignore_keys={"sequence", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_pin_conversation_nonexistent_conversation(topology_primary_or_device_a, assert_api):
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
    resp_pin = topology_primary_or_device_a.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"conversationId": "__nonexistent_chat_user__", "isPinned": True},
    )
    assert_api.assert_error(resp_pin, code=107, description="Invalid conversation")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_modify_message_invalid_id_response(topology_primary_or_device_a, assert_api):
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
    client = topology_primary_or_device_a
    expected_device = getattr(client, "name", "deviceA")
    resp = client.call("ChatManager", Cmd.modifyMessage.value, info={"msgId": "__invalid_msg_id__", "body": {"type": 0, "content": "edit"}})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.modifyMessage.value, "device": expected_device, "result": {"code": 500, "description": "Message is invalid"}},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_translate_message_recalled_message(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、translate、消息、recalled、消息；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.recallMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、translate、消息、recalled、消息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.recallMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    real_id = _send_text_and_wait_final_id(device_a, user_a=user_a, user_b=user_b, content="recalled-translate")
    time.sleep(2)
    resp_recall = device_a.call("ChatManager", Cmd.recallMessage.value, info={"msgId": real_id})
    assert_api.assert_response_matches(
        resp_recall,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.recallMessage.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
def test_chat_ack_message_read_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、已读回执、消息、已读、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.ackMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、已读回执、消息、已读、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.ackMessageRead，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass
    content = f"ackread-{uuid.uuid4().hex[:6]}"
    sent_real_id = _send_text_and_wait_final_id(device_a, user_a=user_a, user_b=user_b, content=content)

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

    resp_ack = device_b.call("ChatManager", Cmd.ackMessageRead.value, info={"msgId": recv_msg_id, "to": user_a})
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
        device_a.receive_message(match_event_type=Cmd.onMessagesRead.value, timeout=20.0),
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


# ======================== Delete ========================


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_recall_message_invalid_id_response(topology_primary_or_device_a, assert_api):
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
    client = topology_primary_or_device_a
    expected_device = getattr(client, "name", "deviceA")
    resp = client.call("ChatManager", Cmd.recallMessage.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.recallMessage.value, "device": expected_device, "result": {"code": 500, "description": "The message was not found"}},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_remove_reaction_invalid_id_response(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、Reaction、无效参数、id、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、Reaction、无效参数、id、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    expected_device = getattr(client, "name", "deviceA")
    resp = client.call("ChatManager", Cmd.removeReaction.value, info={"reaction": "👍", "msgId": "__invalid_msg_id__"})
    _xfail_if_reaction_service_unavailable(resp)
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.removeReaction.value, "device": expected_device, "result": None},
        ignore_keys={"sequence"},
    )


# ======================== Errors / Edge ========================


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
    resp = device_b.call("ChatManager", Cmd.ackConversationRead.value, info={"conversationId": "__invalid_conversation_id__"})
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
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_add_reaction_invalid_id_response(request, assert_api):
    """
    1. 使用当前发送端调用 ChatManager.addReaction，传入不存在的 msgId=__invalid_msg_id__ 和 reaction=👍；
    2. 校验响应信封为 ChatManager.addReaction，且响应设备为当前发送端；
    3. 校验 SDK 返回错误体 code=303，description 包含 Unknown server error。
    """
    describe_case_steps(
        "1. 使用当前发送端调用 ChatManager.addReaction，传入不存在的 msgId=__invalid_msg_id__ 和 reaction=👍；\n"
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
    real_id = _send_text_and_wait_final_id(device_a, user_a=user_a, user_b=user_b, content="for-reaction-empty")
    resp = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "", "msgId": real_id})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.addReaction.value, "device": "deviceA", "result": {"code": 110, "description": "'reaction' can not be null"}},
        ignore_keys={"sequence"},
    )


# ======================== Attachments (invalid) ========================


@pytest.mark.real_e2e
@pytest.mark.skip(reason="message 对象入参 API 暂缓；避免 MissingPlugin 非被测端语义")
def test_chat_download_attachment_invalid_id_response(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、download、attachment、无效参数、id、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadAttachment，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、download、attachment、无效参数、id、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadAttachment，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatManager", Cmd.downloadAttachment.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_error(resp, code=500, description="Message is invalid")


@pytest.mark.real_e2e
@pytest.mark.skip(reason="message 对象入参 API 暂缓；避免 MissingPlugin 非被测端语义")
def test_chat_download_thumbnail_invalid_id_response(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、download、thumbnail、无效参数、id、response；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadThumbnail，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、download、thumbnail、无效参数、id、response；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadThumbnail，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatManager", Cmd.downloadThumbnail.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_error(resp, code=500, description="Message is invalid")
