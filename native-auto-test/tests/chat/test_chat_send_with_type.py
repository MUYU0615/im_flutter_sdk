from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid
import pytest

from src import Cmd, ne, gt, ge
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message

pytestmark = [
    pytest.mark.client,
    pytest.mark.chat,
    pytest.mark.agorachat1_4_0,
    pytest.mark.real_e2e,
]

_BODY_TYPE_BY_SEND_TYPE = {
    "txt": 0,
    "image": 1,
    "location": 3,
    "video": 2,
    "voice": 4,
    "file": 5,
    "cmd": 6,
}


def _body_matches_payload(body: dict, *, type_key: str, payload: dict) -> bool:
    if not isinstance(body, dict):
        return False
    expected_type = _BODY_TYPE_BY_SEND_TYPE.get(type_key)
    if expected_type is not None and body.get("type") != expected_type:
        return False
    if type_key in {"file", "image", "video", "voice"}:
        display_name = payload.get("displayName")
        return not display_name or body.get("displayName") == display_name
    if type_key == "location":
        return (
            body.get("address") == payload.get("address")
            and body.get("buildingName") == payload.get("buildingName")
            and body.get("latitude") == payload.get("latitude")
            and body.get("longitude") == payload.get("longitude")
        )
    return True


def _wait_received_payload_message(device, *, real_id: str, from_user: str, to_user: str, type_key: str, payload: dict, timeout: float = 25.0) -> tuple[dict | None, dict | None]:
    deadline = time.monotonic() + timeout
    last_event = None
    while time.monotonic() < deadline:
        evt = device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=min(2.0, max(0.1, deadline - time.monotonic())),
        )
        if not evt:
            continue
        last_event = evt
        msgs = ((evt.get("data") or {}).get("messages") or [])
        matched = next(
            (
                m
                for m in msgs
                if isinstance(m, dict)
                and m.get("from") == from_user
                and m.get("to") == to_user
                and _body_matches_payload(m.get("body") or {}, type_key=type_key, payload=payload)
            ),
            None,
        )
        if matched:
            return matched, last_event
    return None, last_event


def _assert_send_success_and_events(device_a, device_b, assert_api, user_a, user_b, *, content: str, target_languages: list[str] | None = None):
    info = {
        "type": "txt",
        "payload": {
            "targetId": user_b,
            "content": content,
        },
        "chatType": 0,
    }
    if target_languages:
        info["payload"]["targetLanguages"] = list(target_languages)

    resp = device_a.call("ChatManager", Cmd.sendMessageWithType.value, info=info)
    # 端未实现时返回 MissingPluginException；直接跳过
    if resp.get("success") is False and "MissingPluginException" in str((resp.get("error") or {}).get("description", "")):
        pytest.skip("MissingPlugin: sendMessageWithType 未在当前集成端实现")
    temp_id = ((resp.get("result") or {}).get("msgId")) or resp.get("msgId")
    success_msg = wait_for_success_message(device_a, from_user=user_a, to_user=user_b, content=content)
    real_id = success_msg.get("msgId")
    # A 侧 onMessageSuccess 事件收紧
    # 若传了 targetLanguages，事件里可能出现 translations/targetLanguages，统一忽略这两个键
    ignore_extra = {"timestamp", "sequence", "serverTime", "localTime", "broadcast", "onlineState", "translations", "targetLanguages", "isListened"}
    assert_api.assert_response_matches(
        {
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {"operation": "message_success", "msg": success_msg},
        },
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
                    "body": {"type": 0, "content": "{{content}}"},
                    "direction": 0,
                    "chatType": 0,
                    "status": ge(1),
                    "deliverOnlineOnly": False,
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
        ignore_keys=ignore_extra,
    )
    # 同步响应最小断言 + 关键字段
    resp_expected = {
        "msgId": "{{tempId}}",
        "from": "{{fromUser}}",
        "to": "{{toUser}}",
        "convId": "{{toUser}}",
        "chatType": 0,
        "direction": 0,
        "status": 1,
        "deliverOnlineOnly": False,
        "hasRead": True,
        "hasReadAck": False,
        "hasDeliverAck": False,
        "needGroupAck": False,
        "isThread": False,
        "isContentReplaced": False,
        "body": {"type": 0, "content": "{{content}}"},
    }
    expected = (
        {
            "manager": "ChatManager",
            "cmd": Cmd.sendMessageWithType.value,
            "device": "deviceA",
            "result": resp_expected,
        }
        if "result" in resp
        else resp_expected
    )
    assert_api.assert_response_matches(
        resp,
        expected=expected,
        context={"tempId": temp_id, "fromUser": user_a, "toUser": user_b, "content": content},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "targetLanguages",
            "translations",
            "isListened",
            # 仅忽略不稳定字段：路径/secret
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
        },
    )
    received_msg = wait_for_matching_event_message(
        device_b,
        event_type=Cmd.onMessagesReceived.value,
        from_user=user_a,
        to_user=user_b,
        content=content,
    )
    assert received_msg.get("msgId"), f"onMessagesReceived 目标消息缺少 msgId: {received_msg}"
    return real_id


def test_send_message_with_type_text_basic(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、text、basic；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、text、basic，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、text、basic；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、text、basic，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    content = f"txt-{uuid.uuid4().hex[:6]}"
    _assert_send_success_and_events(device_a, device_b, assert_api, user_a, user_b, content=content)


def test_send_message_with_type_text_with_languages(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、text、with、languages；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、text、with、languages，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、text、with、languages；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、text、with、languages，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    content = f"txttr-{uuid.uuid4().hex[:6]}"
    _assert_send_success_and_events(device_a, device_b, assert_api, user_a, user_b, content=content, target_languages=["zh-Hans"])


def test_send_message_with_type_cmd_received_by_cmd_callback(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为send、消息、with、type、cmd、received、by、cmd；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessageWithType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为send、消息、with、type、cmd、received、by、cmd；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessageWithType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    action = f"cmd-action-{uuid.uuid4().hex[:8]}"
    info = {
        "type": "cmd",
        "payload": {
            "targetId": user_b,
            "action": action,
            "deliverOnlineOnly": False,
        },
        "chatType": 0,
    }

    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp = device_a.call("ChatManager", Cmd.sendMessageWithType.value, info=info)
    if resp.get("success") is False and "MissingPluginException" in str((resp.get("error") or {}).get("description", "")):
        pytest.skip("MissingPlugin: sendMessageWithType 未在当前集成端实现")
    temp_id = ((resp.get("result") or {}).get("msgId")) or resp.get("msgId")
    assert temp_id, f"sendMessageWithType(cmd) 未返回临时 msgId: {resp}"
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessageWithType.value,
            "device": "deviceA",
            "result": {
                "msgId": temp_id,
                "from": user_a,
                "to": user_b,
                "convId": user_b,
                "chatType": 0,
                "direction": 0,
                "status": 1,
                "deliverOnlineOnly": False,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "body": {"type": 6, "action": action, "deliverOnlineOnly": False},
            },
        },
        ignore_keys={"sequence", "serverTime", "localTime", "broadcast", "onlineState", "isListened"},
    )

    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    real_id = (((evt_success or {}).get("data") or {}).get("msg") or {}).get("msgId")
    assert real_id, f"onMessageSuccess 未返回 CMD 消息服务器 msgId: {evt_success}"
    assert_api.assert_response_matches(
        evt_success,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "operation": "message_success",
                "msg": {
                    "msgId": real_id,
                    "from": user_a,
                    "to": user_b,
                    "convId": user_b,
                    "chatType": 0,
                    "direction": 0,
                    "status": ge(1),
                    "deliverOnlineOnly": False,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "body": {"type": 6, "action": action, "deliverOnlineOnly": False},
                },
            },
        },
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "broadcast", "onlineState", "isListened"},
    )

    evt_cmd = device_b.receive_message(match_event_type=Cmd.onCmdMessagesReceived.value, timeout=20.0)
    cmd_messages = (((evt_cmd or {}).get("data") or {}).get("messages") or [])
    cmd_msg = next(
        (
            msg
            for msg in cmd_messages
            if isinstance(msg, dict)
            and msg.get("from") == user_a
            and msg.get("to") == user_b
            and msg.get("convId") == user_a
            and ((msg.get("body") or {}).get("type") == 6)
            and ((msg.get("body") or {}).get("action") == action)
        ),
        {},
    )
    cmd_msg_id = cmd_msg.get("msgId")
    assert cmd_msg_id, f"onCmdMessagesReceived 未返回目标 CMD 消息: {evt_cmd}"
    assert_api.assert_response_matches(
        evt_cmd,
        expected={
            "type": "event",
            "eventType": Cmd.onCmdMessagesReceived.value,
            "data": {
                "messages": [
                    {
                        "msgId": cmd_msg_id,
                        "from": user_a,
                        "to": user_b,
                        "convId": user_a,
                        "chatType": 0,
                        "direction": 1,
                        "status": ge(1),
                        "deliverOnlineOnly": False,
                        "hasRead": False,
                        "hasReadAck": False,
                        "hasDeliverAck": False,
                        "needGroupAck": False,
                        "isThread": False,
                        "isContentReplaced": False,
                        "body": {"type": 6, "action": action, "deliverOnlineOnly": False},
                    },
                ],
            },
        },
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "isListened", "operation", "receiverList"},
    )


def _send_with_payload_and_assert(device_a, device_b, assert_api, user_a, user_b, *, type_key: str, payload: dict):
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    info = {"type": type_key, "payload": payload, "chatType": 0}
    resp = device_a.call("ChatManager", Cmd.sendMessageWithType.value, info=info)
    # 若未实现，提前跳过
    if resp.get("success") is False and "MissingPluginException" in str((resp.get("error") or {}).get("description", "")):
        pytest.skip("MissingPlugin: sendMessageWithType 未在当前集成端实现")

    # 收紧同步响应：信封 + 关键字段 + 临时ID
    temp_id = ((resp.get("result") or {}).get("msgId")) or resp.get("msgId")
    # 按消息类型收紧媒体字段（除路径/secret 外都校验存在或取值范围）
    body_resp = {"type": ne(None)}
    if type_key == "file":
        body_resp.update({
            "displayName": ne(None),
            "fileStatus": ne(None),
        })
    elif type_key == "image":
        body_resp.update({
            "displayName": ne(None),
            "fileStatus": ne(None),
            "thumbnailStatus": ne(None),
            "width": ge(0),
            "height": ge(0),
            "isGif": payload.get("isGif", False),
            "sendOriginalImage": payload.get("sendOriginalImage", False),
        })
    elif type_key == "video":
        body_resp.update({
            "displayName": ne(None),
            "fileStatus": ne(None),
            "thumbnailStatus": ne(None),
            "width": ge(0),
            "height": ge(0),
            "duration": ge(0),
        })
    elif type_key == "location":
        body_resp.update({
            "address": payload.get("address"),
            "buildingName": payload.get("buildingName"),
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
        })
    # 事件体在响应体基础上通常还会包含文件远端信息、大小等
    body_evt = dict(body_resp)
    if type_key in ("file", "video"):
        body_evt.update({"fileSize": ge(0)})
    if type_key == "video":
        body_evt.update({"duration": ge(0)})
    resp_expected = {
        "msgId": "{{tempId}}",
        "from": "{{fromUser}}",
        "to": "{{toUser}}",
        "convId": "{{toUser}}",
        "chatType": 0,
        "direction": 0,
        "status": 1,
        "deliverOnlineOnly": False,
        "hasRead": True,
        "hasReadAck": False,
        "hasDeliverAck": False,
        "needGroupAck": False,
        "isThread": False,
        "isContentReplaced": False,
        "body": body_resp,
    }
    expected = (
        {
            "manager": "ChatManager",
            "cmd": Cmd.sendMessageWithType.value,
            "device": "deviceA",
            "result": resp_expected,
        }
        if "result" in resp
        else resp_expected
    )
    assert_api.assert_response_matches(
        resp,
        expected=expected,
        context={"tempId": temp_id, "fromUser": user_a, "toUser": user_b},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "targetLanguages",
            "translations",
            "isListened",
            "fileSize",
            # 仅忽略不稳定字段：路径/secret
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
        },
    )

    # A 侧 onMessageSuccess：临时ID一致 + 关键字段
    # 事件可能乱序到达；循环读取直至匹配本次 tempId
    expected_body_type = _BODY_TYPE_BY_SEND_TYPE.get(type_key)
    evt_success = None
    real_id = None
    temp_id_evt = None
    evt_candidate = None
    cand_temp = None
    for _ in range(8):
        evt_candidate = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
        if not evt_candidate:
            continue
        cand_data = evt_candidate.get("data") or {}
        cand_msg = cand_data.get("msg") or {}
        cand_temp = cand_data.get("msgId")
        cand_body_type = (cand_msg.get("body") or {}).get("type")
        if (
            str(cand_temp) == str(temp_id)
            or (
                expected_body_type is not None
                and cand_body_type == expected_body_type
                and cand_msg.get("from") == user_a
                and cand_msg.get("to") == user_b
                and _body_matches_payload(cand_msg.get("body") or {}, type_key=type_key, payload=payload)
            )
        ):
            evt_success = evt_candidate
            temp_id_evt = cand_temp
            real_id = cand_msg.get("msgId")
            break
    if evt_success is None:
        pytest.fail(
            f"未收到匹配 tempId 的 onMessageSuccess: tempId={temp_id}, last={evt_candidate}"
        )
    ignore_extra = {
        "timestamp",
        "sequence",
        "serverTime",
        "localTime",
        "broadcast",
        "onlineState",
        "translations",
        "targetLanguages",
        "isListened",
        # 媒体 body 上的可变字段
        "fileSize",
        "localPath",
        "remotePath",
        "secret",
        "thumbnailLocalPath",
        "thumbnailRemotePath",
        "thumbnailSecret",
    }
    if temp_id_evt is not None:
        assert temp_id_evt == temp_id, f"tempId mismatch: resp={temp_id}, event={temp_id_evt}"
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
                    "direction": 0,
                    "chatType": 0,
                    "status": ge(1),
                    "deliverOnlineOnly": False,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "body": body_evt,
                },
            },
        },
        context={"tempId": temp_id, "realId": real_id, "fromUser": user_a, "toUser": user_b},
        ignore_keys=ignore_extra,
    )

    # B 侧 onMessagesReceived 可能有历史事件或上一条媒体消息滞后到达，必须按本次 real_id/body marker 过滤。
    matched_received, evt_received = _wait_received_payload_message(
        device_b,
        real_id=real_id,
        from_user=user_a,
        to_user=user_b,
        type_key=type_key,
        payload=payload,
    )
    assert matched_received, f"onMessagesReceived does not contain the sent message: last={evt_received}"


# 注意：媒体类用例仅验证 file/image/video；不传 filePath，也不传 displayName。

def _prepare_media_asset(device, asset_name: str) -> dict:
    resp = device.call(
        "Client",
        "prepareTestMediaAsset",
        info={"assetName": asset_name},
    )
    result = resp.get("result") or {}
    assert result.get("localPath"), f"prepareTestMediaAsset 未返回 localPath: {resp}"
    return result

def test_send_message_with_type_file(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、file；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、file，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、file；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、file，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    media = _prepare_media_asset(device_a, "normalGif.gif")
    payload = {
        "targetId": user_b,
        "filePath": media["localPath"],
        "displayName": "normalGif.gif",
        "fileSize": media.get("fileSize"),
    }
    _send_with_payload_and_assert(device_a, device_b, assert_api, user_a, user_b, type_key="file", payload=payload)


def test_send_message_with_type_image(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、image；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、image，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、image；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、image，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    media = _prepare_media_asset(device_a, "normalGif.gif")
    payload = {
        "targetId": user_b,
        "filePath": media["localPath"],
        "displayName": "normalGif.gif",
        "fileSize": media.get("fileSize"),
        "isGif": True,
        "sendOriginalImage": True,
    }
    _send_with_payload_and_assert(device_a, device_b, assert_api, user_a, user_b, type_key="image", payload=payload)


def test_send_message_with_type_image_heic(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、image、heic；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、image、heic，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、image、heic；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、image、heic，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    media = _prepare_media_asset(device_a, "imgHeic.HEIC")
    payload = {
        "targetId": user_b,
        "filePath": media["localPath"],
        "displayName": "imgHeic.HEIC",
        "fileSize": media.get("fileSize"),
    }
    _send_with_payload_and_assert(device_a, device_b, assert_api, user_a, user_b, type_key="image", payload=payload)


def test_send_message_with_type_video(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、video；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、video，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、video；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、video，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    media = _prepare_media_asset(device_a, "video.mov")
    thumb = _prepare_media_asset(device_a, "bigPic.jpg")
    payload = {
        "targetId": user_b,
        "filePath": media["localPath"],
        "displayName": "video.mov",
        "fileSize": media.get("fileSize"),
        "thumbnailLocalPath": thumb["localPath"],
        "duration": 1,
    }
    _send_with_payload_and_assert(device_a, device_b, assert_api, user_a, user_b, type_key="video", payload=payload)


def test_send_message_with_type_location(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、location；
    2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、location，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、消息、with、type、location；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、消息、with、type、location，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    payload = {
        "targetId": user_b,
        "latitude": 39.984154,
        "longitude": 116.30749,
        "address": "Haidian District, Beijing",
        "buildingName": "Easemob Tower",
    }
    _send_with_payload_and_assert(device_a, device_b, assert_api, user_a, user_b, type_key="location", payload=payload)


def test_send_message_with_type_voice(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为send、消息、with、type、voice；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessageWithType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为send、消息、with、type、voice；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessageWithType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    media = _prepare_media_asset(device_a, "testVoice.aac")
    payload = {
        "targetId": user_b,
        "filePath": media["localPath"],
        "displayName": "testVoice.aac",
        "fileSize": media.get("fileSize"),
        "duration": 1,
    }

    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp = device_a.call(
        "ChatManager",
        Cmd.sendMessageWithType.value,
        info={"type": "voice", "payload": payload, "chatType": 0},
    )
    if resp.get("success") is False and "MissingPluginException" in str((resp.get("error") or {}).get("description", "")):
        pytest.skip("MissingPlugin: sendMessageWithType 未在当前集成端实现")

    temp_id = ((resp.get("result") or {}).get("msgId")) or resp.get("msgId")
    assert temp_id, f"sendMessageWithType(voice) 未返回临时 msgId: {resp}"

    expected_resp = {
        "msgId": "{{tempId}}",
        "from": "{{fromUser}}",
        "to": "{{toUser}}",
        "convId": "{{toUser}}",
        "chatType": 0,
        "direction": 0,
        "status": 1,
        "deliverOnlineOnly": False,
        "hasRead": True,
        "hasReadAck": False,
        "hasDeliverAck": False,
        "needGroupAck": False,
        "isThread": False,
        "isContentReplaced": False,
        "body": {
            "type": 4,
            "displayName": "testVoice.aac",
            "fileStatus": ne(None),
            "duration": 1,
            "fileSize": ge(0),
        },
    }
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessageWithType.value,
            "device": "deviceA",
            "result": expected_resp,
        }
        if "result" in resp
        else expected_resp,
        context={"tempId": temp_id, "fromUser": user_a, "toUser": user_b},
        ignore_keys={
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
            "isListened",
        },
    )

    evt_success = None
    real_id = None
    for _ in range(5):
        evt_candidate = device_a.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        if not evt_candidate:
            continue
        cand_msg = (evt_candidate.get("data") or {}).get("msg") or {}
        if evt_candidate and cand_msg.get("body", {}).get("type") == 4:
            evt_success = evt_candidate
            real_id = cand_msg.get("msgId")
            break
    assert evt_success is not None, "未收到 voice onMessageSuccess"
    assert real_id, f"voice onMessageSuccess 未返回服务器 msgId: {evt_success}"

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
                    "direction": 0,
                    "chatType": 0,
                    "status": ge(1),
                    "deliverOnlineOnly": False,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "body": {
                        "type": 4,
                        "displayName": "testVoice.aac",
                        "fileStatus": ne(None),
                        "duration": 1,
                        "fileSize": ge(0),
                    },
                },
            },
        },
        context={"realId": real_id, "fromUser": user_a, "toUser": user_b},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
            "isListened",
        },
    )

    matched_received, evt_received = _wait_received_payload_message(
        device_b,
        real_id=real_id,
        from_user=user_a,
        to_user=user_b,
        type_key="voice",
        payload=payload,
    )
    assert matched_received, f"onMessagesReceived does not contain the sent voice message: last={evt_received}"
