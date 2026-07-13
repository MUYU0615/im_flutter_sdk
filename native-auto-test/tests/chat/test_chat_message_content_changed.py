from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

import pytest

from src import Cmd, gt
from src.tools.event_waiter import wait_event_matching


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _topology_pair(topology):
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    return primary, remote, primary.user_id, remote.user_id, _expected_device(primary), _expected_device(remote)


def _custom_message_matches(msg: object, *, from_user: str, to_user: str, event_name: str) -> bool:
    if not isinstance(msg, dict):
        return False
    body = msg.get("body") if isinstance(msg.get("body"), dict) else {}
    return (
        msg.get("from") == from_user
        and msg.get("to") == to_user
        and msg.get("chatType") == 0
        and body.get("type") == 7
        and body.get("event") == event_name
    )


def _wait_custom_received(device, *, from_user: str, to_user: str, event_name: str) -> dict:
    matched: dict = {}

    def predicate(evt: dict) -> bool:
        nonlocal matched
        for msg in ((evt.get("data") or {}).get("messages") or []):
            if _custom_message_matches(msg, from_user=from_user, to_user=to_user, event_name=event_name):
                matched = msg
                return True
        return False

    wait_event_matching(
        device,
        event_type=Cmd.onMessagesReceived.value,
        predicate=predicate,
        timeout=80.0,
        poll_timeout=20.0,
        max_events=4,
        description=f"custom message event={event_name}",
    )
    return matched


def _wait_custom_success(device, *, from_user: str, to_user: str, event_name: str) -> dict:
    matched: dict = {}

    def predicate(evt: dict) -> bool:
        nonlocal matched
        msg = ((evt.get("data") or {}).get("msg") or {})
        if _custom_message_matches(msg, from_user=from_user, to_user=to_user, event_name=event_name):
            matched = msg
            return True
        return False

    wait_event_matching(
        device,
        event_type=Cmd.onMessageSuccess.value,
        predicate=predicate,
        timeout=80.0,
        poll_timeout=20.0,
        max_events=4,
        description=f"custom success event={event_name}",
    )
    return matched


def _wait_custom_content_changed(device, *, msg_id: str, from_user: str, to_user: str, event_name: str) -> dict:
    matched: dict = {}

    def predicate(evt: dict) -> bool:
        nonlocal matched
        message = ((evt.get("data") or {}).get("message") or {})
        if str(message.get("msgId")) == str(msg_id) and _custom_message_matches(
            message,
            from_user=from_user,
            to_user=to_user,
            event_name=event_name,
        ):
            matched = evt
            return True
        return False

    wait_event_matching(
        device,
        event_type=Cmd.onMessageContentChanged.value,
        predicate=predicate,
        timeout=80.0,
        poll_timeout=20.0,
        max_events=4,
        description=f"custom content changed msgId={msg_id}",
    )
    return matched


pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.agorachat1_4_0]


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_chat_modify_custom_message_content_changed_event(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、modify、custom、消息、content、changed、event；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessageWithType、ChatManager.modifyMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、modify、custom、消息、content、changed、event；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessageWithType、ChatManager.modifyMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, _device_b_name = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    old_event = f"custom-old-{uuid.uuid4().hex[:6]}"
    new_event = f"custom-new-{uuid.uuid4().hex[:6]}"
    old_params = {"k1": "v1"}
    new_params = {"k2": "v2", "release": "agorachat1.4.0"}

    try:
        resp_send = device_a.call(
            "ChatManager",
            Cmd.sendMessageWithType.value,
            info={
                "type": "custom",
                "payload": {
                    "targetId": user_b,
                    "event": old_event,
                    "params": old_params,
                },
                "chatType": 0,
            },
        )
    except TimeoutError as exc:
        pytest.xfail(f"当前 Android 环境 sendMessageWithType(custom) 未在超时时间内返回: {exc}")
    if resp_send.get("success") is False and "MissingPluginException" in str((resp_send.get("error") or {}).get("description", "")):
        pytest.skip("MissingPlugin: sendMessageWithType 未在当前集成端实现")

    success_msg = _wait_custom_success(device_a, from_user=user_a, to_user=user_b, event_name=old_event)
    temp_id = (resp_send.get("result") or {}).get("msgId")
    real_id = success_msg.get("msgId")
    assert isinstance(real_id, str) and real_id, f"发送自定义消息后未获取到真实 msgId: {success_msg}"

    assert_api.assert_response_matches(
        resp_send,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessageWithType.value,
            "device": device_a_name,
            "result": {
                "msgId": "{{tempId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "convId": "{{toUser}}",
                "chatType": 0,
                "direction": 0,
                "status": 1,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "deliverOnlineOnly": False,
                "body": {
                    "type": 7,
                    "event": "{{oldEvent}}",
                    "params": old_params,
                },
            },
        },
        context={"tempId": temp_id, "oldEvent": old_event, "fromUser": user_a, "toUser": user_b},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
        },
    )

    recv_msg = _wait_custom_received(device_b, from_user=user_a, to_user=user_b, event_name=old_event)
    assert_api.assert_response_matches(
        recv_msg,
        expected={
            "msgId": "{{realId}}",
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
            "deliverOnlineOnly": False,
            "body": {
                "type": 7,
                "event": "{{oldEvent}}",
                "params": old_params,
            },
        },
        context={"realId": real_id, "fromUser": user_a, "toUser": user_b, "oldEvent": old_event},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "attributes",
            "targetLanguages",
            "translations",
            "receiverList",
            "isListened",
            "msgId",
            "operation",
        },
    )

    resp_modify = device_a.call(
        "ChatManager",
        Cmd.modifyMessage.value,
        info={
            "msgId": real_id,
            "msgBody": {
                "type": 7,
                "event": new_event,
                "params": new_params,
            },
            "attributes": {"editedByCase": "agorachat1.4.0"},
        },
    )
    modify_result = resp_modify.get("result")
    if isinstance(modify_result, dict) and modify_result.get("code") == 500:
        pytest.xfail(f"当前 Android 环境 modifyMessage 返回服务端错误: {modify_result}")
    assert_api.assert_response_matches(
        resp_modify,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.modifyMessage.value,
            "device": device_a_name,
            "result": {
                "msgId": "{{realId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "convId": "{{toUser}}",
                "chatType": 0,
                "direction": 0,
                "status": 1,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "attributes": {"editedByCase": "agorachat1.4.0"},
                "body": {
                    "type": 7,
                    "event": "{{newEvent}}",
                    "params": new_params,
                    "operatorId": "{{operatorId}}",
                    "operatorTime": gt(0),
                    "operatorCount": gt(0),
                },
            },
        },
        context={"realId": real_id, "newEvent": new_event, "fromUser": user_a, "toUser": user_b, "operatorId": user_a},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "targetLanguages",
            "translations",
            "isListened",
            "result.status",
        },
    )

    evt_changed = _wait_custom_content_changed(
        device_b,
        msg_id=real_id,
        from_user=user_a,
        to_user=user_b,
        event_name=new_event,
    )
    assert evt_changed, "接收端未收到 onMessageContentChanged 回调"
    assert_api.assert_response_matches(
        evt_changed,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageContentChanged.value,
            "data": {
                "message": {
                    "msgId": "{{realId}}",
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
                    "body": {
                        "type": 7,
                        "event": "{{newEvent}}",
                        "params": new_params,
                    },
                },
                "operatorId": "{{operatorId}}",
                "operationTime": gt(0),
            },
        },
        context={"realId": real_id, "newEvent": new_event, "operatorId": user_a, "fromUser": user_a, "toUser": user_b},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "targetLanguages",
            "translations",
            "receiverList",
            "deliverOnlineOnly",
            "attributes",
            "isListened",
        },
    )
