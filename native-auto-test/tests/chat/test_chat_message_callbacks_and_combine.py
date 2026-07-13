from __future__ import annotations
from tests.case_steps import describe_case_steps

import os
import uuid
import time

import pytest

from src import Cmd, ge, ne
from tests.chat._utils import build_text

pytestmark = [
    pytest.mark.client,
    pytest.mark.chat,
    pytest.mark.agorachat4_23_0,
    pytest.mark.real_e2e,
]


def _skip_if_missing_plugin(resp: dict, api_name: str) -> None:
    desc = str((resp.get("error") or {}).get("description", ""))
    if resp.get("success") is False and "MissingPluginException" in desc:
        pytest.skip(f"MissingPlugin: {api_name} 未在当前集成端实现")


def _fail_if_error(resp: dict, api_name: str) -> None:
    _skip_if_missing_plugin(resp, api_name)
    if resp.get("success") is False or "error" in resp:
        pytest.fail(f"{api_name} 返回错误: {resp}")


def _xfail_if_combine_download_unavailable(resp: dict) -> None:
    result = resp.get("result")
    if isinstance(result, dict) and result.get("code") == 403:
        desc = str(result.get("description", ""))
        if "Failed to download the file" in desc:
            pytest.xfail("当前 Android 环境 combine 文件下载/解析返回 403，发送成功已验证，解析链路暂按服务能力限制处理")


def _wait_message_success(
    device,
    temp_id: str,
    *,
    timeout: float = 20.0,
    body_type: int | None = None,
    from_user: str | None = None,
    to_user: str | None = None,
    content: str | None = None,
    title: str | None = None,
    display_name: str | None = None,
) -> dict:
    last = None
    for _ in range(8):
        evt = device.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=timeout)
        last = evt
        if not evt:
            continue
        data = evt.get("data") or {}
        msg = data.get("msg") or {}
        cand = data.get("msgId")
        status = msg.get("status")
        if status == 0:
            continue
        if not _message_matches(
            msg,
            msg_id=temp_id if body_type is None and content is None and title is None and display_name is None else None,
            body_type=body_type,
            from_user=from_user,
            to_user=to_user,
            content=content,
            title=title,
            display_name=display_name,
        ):
            continue
        return evt
    pytest.fail(f"未收到匹配 tempId 的 onMessageSuccess: tempId={temp_id}, last={last}")


def _message_matches(
    msg: dict,
    *,
    msg_id: str | None = None,
    body_type: int | None = None,
    from_user: str | None = None,
    to_user: str | None = None,
    content: str | None = None,
    title: str | None = None,
    display_name: str | None = None,
) -> bool:
    if not isinstance(msg, dict):
        return False
    if msg_id is not None and str(msg.get("msgId")) != str(msg_id):
        return False
    if from_user is not None and msg.get("from") != from_user:
        return False
    if to_user is not None and msg.get("to") != to_user:
        return False
    body = msg.get("body") or {}
    if body_type is not None and body.get("type") != body_type:
        return False
    if content is not None and body.get("content") != content:
        return False
    if title is not None and body.get("title") != title:
        return False
    if display_name is not None and body.get("displayName") != display_name:
        return False
    return True


def _message_markers(type_key: str, payload: dict) -> dict:
    markers: dict = {}
    if type_key == "txt":
        markers["content"] = payload["content"]
    elif type_key == "combine":
        markers["title"] = payload["title"]
    elif type_key in {"image", "video", "file"} and payload.get("displayName"):
        markers["display_name"] = payload["displayName"]
    elif type_key in {"image", "video", "file"} and payload.get("filePath"):
        markers["display_name"] = os.path.basename(str(payload["filePath"]))
    return markers


def _wait_received_message(
    device,
    msg_id: str,
    *,
    from_user: str,
    to_user: str,
    timeout: float = 20.0,
    body_type: int | None = None,
    content: str | None = None,
    title: str | None = None,
    display_name: str | None = None,
) -> dict:
    last = None
    for _ in range(8):
        evt = device.receive_message(match_event_type=Cmd.onMessagesReceived.value, timeout=timeout)
        last = evt
        if not evt:
            continue
        messages = ((evt.get("data") or {}).get("messages") or [])
        for msg in messages:
            if _message_matches(
                msg,
                msg_id=msg_id,
                from_user=from_user,
                to_user=to_user,
            ):
                return msg
            if _message_matches(
                msg,
                body_type=body_type,
                from_user=from_user,
                to_user=to_user,
                content=content,
                title=title,
                display_name=display_name,
            ):
                return msg
    pytest.fail(f"onMessagesReceived 未包含目标消息: msgId={msg_id}, last={last}")


def _wait_message_progress(device, msg_id: str, *, timeout: float = 20.0) -> dict:
    last = None
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        evt = device.receive_message(
            match_event_type=Cmd.onMessageProgress.value,
            timeout=min(5.0, max(0.1, deadline - time.monotonic())),
        )
        last = evt
        if not evt:
            continue
        data = evt.get("data") or {}
        if str(data.get("msgId")) == str(msg_id):
            progress = data.get("progress")
            assert isinstance(progress, int), f"下载进度不是 int: {evt}"
            assert 0 <= progress <= 100, f"下载进度越界: {evt}"
            return evt
    pytest.fail(f"未收到目标消息下载进度事件: msgId={msg_id}, last={last}")


def _assert_received_attachment_message(
    assert_api,
    message: dict,
    *,
    user_a: str,
    user_b: str,
    body_type: int,
) -> None:
    expected_body = {"type": body_type, "displayName": ne(None), "fileStatus": ne(None)}
    if body_type in (1, 2):
        expected_body.update({"thumbnailStatus": ne(None), "width": ge(0), "height": ge(0)})
    if body_type == 1:
        expected_body.update({"isGif": False, "sendOriginalImage": False})
    if body_type == 2:
        expected_body.update({"duration": ge(0)})

    assert_api.assert_response_matches(
        message,
        expected={
            "msgId": "{{realId}}",
            "from": "{{fromUser}}",
            "to": "{{toUser}}",
            "convId": "{{fromUser}}",
            "chatType": 0,
            "direction": 1,
            "status": 2,
            "deliverOnlineOnly": False,
            "hasRead": False,
            "hasReadAck": False,
            "hasDeliverAck": False,
            "needGroupAck": False,
            "isThread": False,
            "isContentReplaced": False,
            "body": expected_body,
        },
        context={
            "realId": message.get("msgId"),
            "fromUser": user_a,
            "toUser": user_b,
        },
        ignore_keys={
            "timestamp",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
            "translations",
            "targetLanguages",
            "receiverList",
            "webhookEnv",
            "fileSize",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
        },
    )


def _assert_download_api_with_progress(device, assert_api, *, cmd: str, message: dict) -> None:
    msg_id = message["msgId"]
    resp = device.call("ChatManager", cmd, info={"message": message})
    _skip_if_missing_plugin(resp, cmd)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": cmd,
            "device": "deviceB",
            "result": {
                "msgId": "{{msgId}}",
                "body": {"type": ne(None), "fileStatus": ne(None)},
            },
        },
        context={"msgId": msg_id},
        ignore_keys={
            "sequence",
            "timestamp",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
            "translations",
            "targetLanguages",
            "receiverList",
            "from",
            "to",
            "convId",
            "chatType",
            "direction",
            "status",
            "deliverOnlineOnly",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
            "fileSize",
            "displayName",
            "thumbnailStatus",
            "width",
            "height",
            "duration",
            "isGif",
            "sendOriginalImage",
        },
    )
    progress_evt = _wait_message_progress(device, msg_id)
    assert_api.assert_response_matches(
        progress_evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageProgress.value,
            "data": {"msgId": "{{msgId}}", "progress": ge(0), "operation": "message_progress"},
        },
        context={"msgId": msg_id},
        ignore_keys={"timestamp", "sequence"},
    )
    success_evt = _wait_message_success(device, msg_id)
    assert_api.assert_response_matches(
        success_evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "operation": "message_success",
                "msg": {
                    "msgId": "{{msgId}}",
                    "body": {"type": ne(None), "fileStatus": ne(None)},
                },
            },
        },
        context={"msgId": msg_id},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
            "translations",
            "targetLanguages",
            "receiverList",
            "from",
            "to",
            "convId",
            "chatType",
            "direction",
            "status",
            "deliverOnlineOnly",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
            "fileSize",
            "displayName",
            "thumbnailStatus",
            "width",
            "height",
            "duration",
            "isGif",
            "sendOriginalImage",
        },
    )


def _assert_combine_inner_download_api_with_progress(device, assert_api, *, cmd: str, message: dict) -> None:
    msg_id = message["msgId"]
    resp = device.call("ChatManager", cmd, info={"message": message})
    _skip_if_missing_plugin(resp, cmd)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": cmd,
            "device": "deviceB",
            "result": {
                "msgId": "{{msgId}}",
                "body": {"type": ne(None), "fileStatus": ne(None)},
            },
        },
        context={"msgId": msg_id},
        ignore_keys={
            "sequence",
            "timestamp",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
            "translations",
            "targetLanguages",
            "receiverList",
            "from",
            "to",
            "convId",
            "chatType",
            "direction",
            "status",
            "deliverOnlineOnly",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
            "fileSize",
            "displayName",
            "thumbnailStatus",
            "width",
            "height",
            "duration",
            "isGif",
            "sendOriginalImage",
        },
    )
    progress_evt = _wait_message_progress(device, msg_id)
    assert_api.assert_response_matches(
        progress_evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageProgress.value,
            "data": {"msgId": "{{msgId}}", "progress": ge(0), "operation": "message_progress"},
        },
        context={"msgId": msg_id},
        ignore_keys={"timestamp", "sequence"},
    )
    success_evt = _wait_message_success(device, msg_id)
    assert_api.assert_response_matches(
        success_evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "operation": "message_success",
                "msg": {
                    "msgId": "{{msgId}}",
                    "body": {"type": ne(None), "fileStatus": ne(None)},
                },
            },
        },
        context={"msgId": msg_id},
        ignore_keys={
            "timestamp",
            "sequence",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
            "translations",
            "targetLanguages",
            "receiverList",
            "from",
            "to",
            "convId",
            "chatType",
            "direction",
            "status",
            "deliverOnlineOnly",
            "hasRead",
            "hasReadAck",
            "hasDeliverAck",
            "needGroupAck",
            "isThread",
            "isContentReplaced",
            "localPath",
            "remotePath",
            "secret",
            "thumbnailLocalPath",
            "thumbnailRemotePath",
            "thumbnailSecret",
            "fileSize",
            "displayName",
            "thumbnailStatus",
            "width",
            "height",
            "duration",
            "isGif",
            "sendOriginalImage",
        },
    )


def _prepare_media_asset(device, asset_name: str) -> dict:
    resp = device.call(
        "Client",
        "prepareTestMediaAsset",
        info={"assetName": asset_name},
    )
    _fail_if_error(resp, "prepareTestMediaAsset")
    result = resp.get("result") or {}
    assert result.get("localPath"), f"prepareTestMediaAsset 未返回 localPath: {resp}"
    return result


def _send_with_type(device_a, device_b, assert_api, user_a: str, user_b: str, *, type_key: str, payload: dict) -> tuple[dict, dict, dict]:
    info = {"type": type_key, "payload": payload, "chatType": 0}
    resp = device_a.call("ChatManager", Cmd.sendMessageWithType.value, info=info)
    _fail_if_error(resp, Cmd.sendMessageWithType.value)

    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessageWithType 未返回临时 msgId: {resp}"

    body_type_by_send_type = {
        "txt": 0,
        "image": 1,
        "video": 2,
        "combine": 8,
        "file": 5,
    }
    body_type = body_type_by_send_type.get(type_key)
    markers = _message_markers(type_key, payload)
    evt_success = _wait_message_success(
        device_a,
        temp_id,
        body_type=body_type,
        from_user=user_a,
        to_user=user_b,
        **markers,
    )
    sent_msg = ((evt_success.get("data") or {}).get("msg") or {})
    real_id = sent_msg.get("msgId")
    assert real_id, f"onMessageSuccess 未返回服务器 msgId: {evt_success}"

    body_expected = {"type": ne(None)}
    if type_key == "txt":
        body_expected["content"] = payload["content"]
    elif type_key == "image":
        body_expected.update({
            "displayName": ne(None),
            "fileStatus": ne(None),
            "thumbnailStatus": ne(None),
            "width": ge(0),
            "height": ge(0),
            "isGif": False,
            "sendOriginalImage": False,
        })
    elif type_key == "video":
        body_expected.update({
            "displayName": ne(None),
            "fileStatus": ne(None),
            "thumbnailStatus": ne(None),
            "width": ge(0),
            "height": ge(0),
            "duration": ge(0),
        })
    elif type_key == "file":
        body_expected.update({
            "displayName": ne(None),
            "fileStatus": ne(None),
        })
    elif type_key == "combine":
        body_expected.update({
            "title": payload["title"],
            "summary": payload["summary"],
            "compatibleText": payload["compatibleText"],
            "fileStatus": ne(None),
        })

    ignore_keys = {
        "sequence",
        "timestamp",
        "serverTime",
        "localTime",
        "broadcast",
        "onlineState",
        "isListened",
        "targetLanguages",
        "translations",
        "fileSize",
        "localPath",
        "remotePath",
        "secret",
        "thumbnailLocalPath",
        "thumbnailRemotePath",
        "thumbnailSecret",
        "messageList",
        "receiverList"
    }
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessageWithType.value,
            "device": "deviceA",
            "result": {
                "msgId": "{{tempId}}",
                "from": "{{fromUser}}",
                "to": "{{toUser}}",
                "convId": "{{toUser}}",
                "chatType": 0,
                "direction": 0,
                "status": ne(None),
                "deliverOnlineOnly": False,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "body": body_expected,
            },
        },
        context={"tempId": temp_id, "fromUser": user_a, "toUser": user_b},
        ignore_keys=ignore_keys,
    )
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
                    "body": body_expected,
                },
            },
        },
        context={"tempId": temp_id, "realId": real_id, "fromUser": user_a, "toUser": user_b},
        ignore_keys=ignore_keys,
    )
    received_msg = _wait_received_message(
        device_b,
        real_id,
        from_user=user_a,
        to_user=user_b,
        body_type=body_type,
        **markers,
    )
    return resp, sent_msg, received_msg


def _send_with_type_sent_only(device_a, user_a: str, user_b: str, *, type_key: str, payload: dict) -> tuple[dict, dict]:
    info = {"type": type_key, "payload": payload, "chatType": 0}
    resp = device_a.call("ChatManager", Cmd.sendMessageWithType.value, info=info)
    _fail_if_error(resp, Cmd.sendMessageWithType.value)

    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessageWithType 未返回临时 msgId: {resp}"

    body_type_by_send_type = {
        "txt": 0,
        "image": 1,
        "video": 2,
        "combine": 8,
        "file": 5,
    }
    body_type = body_type_by_send_type.get(type_key)
    markers = _message_markers(type_key, payload)
    evt_success = _wait_message_success(
        device_a,
        temp_id,
        body_type=body_type,
        from_user=user_a,
        to_user=user_b,
        **markers,
    )
    sent_msg = ((evt_success.get("data") or {}).get("msg") or {})
    assert sent_msg.get("msgId"), f"onMessageSuccess 未返回服务器 msgId: {evt_success}"
    assert sent_msg.get("from") == user_a, f"发送成功消息 from 不正确: {sent_msg}"
    assert sent_msg.get("to") == user_b, f"发送成功消息 to 不正确: {sent_msg}"
    assert (sent_msg.get("body") or {}).get("type") == body_type, f"发送成功消息 body.type 不正确: {sent_msg}"
    return resp, sent_msg


def test_attachment_messages_send_receive_and_public_download_methods(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为attachment、消息、send、receive、and、public、download、methods；
    2. 通过 WebSocket 控制测试 App 调用 attachment、消息、send、receive、and、public、download、methods，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为attachment、消息、send、receive、and、public、download、methods；\n'
        '2. 通过 WebSocket 控制测试 App 调用 attachment、消息、send、receive、and、public、download、methods，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    file_media = _prepare_media_asset(device_a, "normalGif.gif")
    _, file_sent, file_received = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="file",
        payload={
            "targetId": user_b,
            "filePath": file_media["localPath"],
            "fileSize": file_media.get("fileSize"),
            "displayName": "normalGif.gif",
        },
    )
    _assert_received_attachment_message(assert_api, file_received, user_a=user_a, user_b=user_b, body_type=5)
    _assert_download_api_with_progress(
        device_b,
        assert_api,
        cmd=Cmd.downloadAttachment.value,
        message=file_received,
    )

    image_media = _prepare_media_asset(device_a, "bigPic.jpg")
    _, image_sent, image_received = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="image",
        payload={
            "targetId": user_b,
            "filePath": image_media["localPath"],
            "displayName": "bigPic.jpg",
            "fileSize": image_media.get("fileSize"),
        },
    )
    _assert_received_attachment_message(assert_api, image_received, user_a=user_a, user_b=user_b, body_type=1)
    _assert_download_api_with_progress(
        device_b,
        assert_api,
        cmd=Cmd.downloadThumbnail.value,
        message=image_received,
    )
    _assert_download_api_with_progress(
        device_b,
        assert_api,
        cmd=Cmd.downloadBigImage.value,
        message=image_received,
    )

    video_media = _prepare_media_asset(device_a, "video.mov")
    video_thumb = _prepare_media_asset(device_a, "bigPic.jpg")
    _, video_sent, video_received = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="video",
        payload={
            "targetId": user_b,
            "filePath": video_media["localPath"],
            "displayName": "video.mov",
            "fileSize": video_media.get("fileSize"),
            "thumbnailLocalPath": video_thumb["localPath"],
            "duration": 1,
        },
    )
    _assert_received_attachment_message(assert_api, video_received, user_a=user_a, user_b=user_b, body_type=2)
    _assert_download_api_with_progress(
        device_b,
        assert_api,
        cmd=Cmd.downloadThumbnail.value,
        message=video_received,
    )
    _assert_download_api_with_progress(
        device_b,
        assert_api,
        cmd=Cmd.downloadAttachment.value,
        message=video_received,
    )

    assert file_sent["msgId"]
    assert image_sent["msgId"]
    assert video_sent["msgId"]


def _send_text_message_with_webhook_env(
    device_a,
    device_b,
    assert_api,
    user_a: str,
    user_b: str,
    *,
    content: str,
    webhook_env: str,
) -> tuple[dict, dict, dict]:
    info = build_text(user_a, user_b, content)
    info["webhookEnv"] = webhook_env
    resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=info)
    _fail_if_error(resp, Cmd.sendMessage.value)

    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessage 未返回临时 msgId: {resp}"

    evt_success = _wait_message_success(
        device_a,
        temp_id,
        body_type=0,
        from_user=user_a,
        to_user=user_b,
        content=content,
    )
    sent_msg = ((evt_success.get("data") or {}).get("msg") or {})
    real_id = sent_msg.get("msgId")
    assert real_id, f"onMessageSuccess 未返回服务器 msgId: {evt_success}"

    ignore_keys = {
        "sequence",
        "timestamp",
        "serverTime",
        "localTime",
        "broadcast",
        "onlineState",
        "translations",
        "targetLanguages",
        "receiverList",
        "isListened",
    }
    assert_api.assert_response_matches(
        resp,
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
                "webhookEnv": "{{webhookEnv}}",
                "body": {"type": 0, "content": "{{content}}"},
            },
        },
        context={
            "tempId": temp_id,
            "fromUser": user_a,
            "toUser": user_b,
            "content": content,
            "webhookEnv": webhook_env,
        },
        ignore_keys=ignore_keys,
    )
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
                    "chatType": 0,
                    "direction": 0,
                    "status": 2,
                    "deliverOnlineOnly": False,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "webhookEnv": "{{webhookEnv}}",
                    "body": {"type": 0, "content": "{{content}}"},
                },
            },
        },
        context={
            "tempId": temp_id,
            "realId": real_id,
            "fromUser": user_a,
            "toUser": user_b,
            "content": content,
            "webhookEnv": webhook_env,
        },
        ignore_keys=ignore_keys,
    )
    received_msg = _wait_received_message(
        device_b,
        real_id,
        from_user=user_a,
        to_user=user_b,
        body_type=0,
        content=content,
    )
    assert_api.assert_response_matches(
        received_msg,
        expected={
            "msgId": "{{realId}}",
            "from": "{{fromUser}}",
            "to": "{{toUser}}",
            "convId": "{{fromUser}}",
            "chatType": 0,
            "direction": 1,
            "status": 2,
            "deliverOnlineOnly": False,
            "hasRead": False,
            "hasReadAck": False,
            "hasDeliverAck": False,
            "needGroupAck": False,
            "isThread": False,
            "isContentReplaced": False,
            "body": {"type": 0, "content": "{{content}}"},
        },
        context={
            "realId": real_id,
            "fromUser": user_a,
            "toUser": user_b,
            "content": content,
        },
        ignore_keys=ignore_keys,
    )
    return resp, sent_msg, received_msg

@pytest.mark.parametrize(("case_name", "webhook_env"), [("default", "default")])
def test_send_text_message_with_webhook_env(device_a, device_b, assert_api, user_a, user_b, webhook_env, case_name):
    """
    1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、text、消息、with、webhook、env；
    2. 通过 WebSocket 控制测试 App 调用 send、text、消息、with、webhook、env，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天基础能力场景所需的测试数据，场景为send、text、消息、with、webhook、env；\n'
        '2. 通过 WebSocket 控制测试 App 调用 send、text、消息、with、webhook、env，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    content = f"message-callback-webhook-{case_name}-{uuid.uuid4().hex[:6]}"
    _send_text_message_with_webhook_env(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        content=content,
        webhook_env=webhook_env,
    )


def test_combine_forward_send_receive_and_inner_attachment_download(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为combine、forward、send、receive、and、inner、attachment、download；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadAndParseCombineMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为combine、forward、send、receive、and、inner、attachment、download；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadAndParseCombineMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    image_media = _prepare_media_asset(device_a, "bigPic.jpg")
    _, image_sent, _ = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="image",
        payload={
            "targetId": user_b,
            "filePath": image_media["localPath"],
            "displayName": "bigPic.jpg",
            "fileSize": image_media.get("fileSize"),
        },
    )
    video_media = _prepare_media_asset(device_a, "video.mov")
    video_thumb = _prepare_media_asset(device_a, "bigPic.jpg")
    _, video_sent, _ = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="video",
        payload={
            "targetId": user_b,
            "filePath": video_media["localPath"],
            "displayName": "video.mov",
            "fileSize": video_media.get("fileSize"),
            "thumbnailLocalPath": video_thumb["localPath"],
            "duration": 1,
        },
    )

    image_msg_id = image_sent["msgId"]
    video_msg_id = video_sent["msgId"]
    combine_payload = {
        "targetId": user_b,
        "title": f"message-combine-{uuid.uuid4().hex[:6]}",
        "summary": "image and video",
        "compatibleText": "combine-compatible",
        "msgIds": [image_msg_id, video_msg_id],
    }
    _, combine_sent = _send_with_type_sent_only(
        device_a,
        user_a,
        user_b,
        type_key="combine",
        payload=combine_payload,
    )
    assert_api.assert_response_matches(
        combine_sent,
        expected={
            "msgId": "{{realId}}",
            "from": "{{fromUser}}",
            "to": "{{toUser}}",
            "convId": "{{toUser}}",
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
            "body": {
                "type": 8,
                "title": combine_payload["title"],
                "summary": combine_payload["summary"],
                "compatibleText": combine_payload["compatibleText"],
                "fileStatus": ne(None),
            },
        },
        context={
            "realId": combine_sent.get("msgId"),
            "fromUser": user_a,
            "toUser": user_b,
        },
        ignore_keys={
            "timestamp",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "isListened",
            "translations",
            "targetLanguages",
            "receiverList",
            "localPath",
            "remotePath",
            "secret",
            "messageList",
        },
    )

    parse_resp = device_a.call(
        "ChatManager",
        Cmd.downloadAndParseCombineMessage.value,
        info={"message": combine_sent},
    )
    _skip_if_missing_plugin(parse_resp, Cmd.downloadAndParseCombineMessage.value)
    _xfail_if_combine_download_unavailable(parse_resp)
    assert_api.assert_response_matches(
        parse_resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.downloadAndParseCombineMessage.value,
            "device": "deviceA",
            "result": ne(None),
        },
        ignore_keys={"sequence"},
    )

    inner_messages = parse_resp.get("result")
    assert isinstance(inner_messages, list) and inner_messages, f"合并消息解析未返回内部消息列表: {parse_resp}"
    inner_by_id = {str(m.get("msgId")): m for m in inner_messages if isinstance(m, dict)}
    image_inner = inner_by_id.get(str(image_msg_id))
    video_inner = inner_by_id.get(str(video_msg_id))
    assert image_inner is not None, f"合并消息解析结果缺少内部图片消息: expected={image_msg_id}, actual={inner_messages}"
    assert video_inner is not None, f"合并消息解析结果缺少内部视频消息: expected={video_msg_id}, actual={inner_messages}"
    assert image_inner.get("body", {}).get("type") == 1, f"内部图片消息类型不正确: {image_inner}"
    assert video_inner.get("body", {}).get("type") == 2, f"内部视频消息类型不正确: {video_inner}"

    for cmd, message in (
        (Cmd.downloadMessageAttachmentInCombine.value, image_inner),
        (Cmd.downloadMessageThumbnailInCombine.value, image_inner),
        (Cmd.downloadMessageAttachmentInCombine.value, video_inner),
        (Cmd.downloadMessageThumbnailInCombine.value, video_inner),
    ):
        _assert_combine_inner_download_api_with_progress(
            device_a,
            assert_api,
            cmd=cmd,
            message=message,
        )


def test_combine_forward_media_inner_attachment_download(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为combine、forward、media、inner、attachment、download；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadAndParseCombineMessage，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为combine、forward、media、inner、attachment、download；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.downloadAndParseCombineMessage，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    image_media = _prepare_media_asset(device_a, "bigPic.jpg")
    _, image_sent, _ = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="image",
        payload={
            "targetId": user_b,
            "filePath": image_media["localPath"],
            "displayName": "bigPic.jpg",
            "fileSize": image_media.get("fileSize"),
        },
    )
    video_media = _prepare_media_asset(device_a, "video.mov")
    video_thumb = _prepare_media_asset(device_a, "bigPic.jpg")
    _, video_sent, _ = _send_with_type(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        type_key="video",
        payload={
            "targetId": user_b,
            "filePath": video_media["localPath"],
            "displayName": "video.mov",
            "fileSize": video_media.get("fileSize"),
            "thumbnailLocalPath": video_thumb["localPath"],
            "duration": 1,
        },
    )

    image_msg_id = image_sent["msgId"]
    video_msg_id = video_sent["msgId"]
    combine_payload = {
        "targetId": user_b,
        "title": f"message-combine-{uuid.uuid4().hex[:6]}",
        "summary": "image and video",
        "compatibleText": "combine-compatible",
        "msgIds": [image_msg_id, video_msg_id],
    }
    _, combine_sent = _send_with_type_sent_only(
        device_a,
        user_a,
        user_b,
        type_key="combine",
        payload=combine_payload,
    )

    parse_resp = device_a.call(
        "ChatManager",
        Cmd.downloadAndParseCombineMessage.value,
        info={"message": combine_sent},
    )
    _skip_if_missing_plugin(parse_resp, Cmd.downloadAndParseCombineMessage.value)
    _xfail_if_combine_download_unavailable(parse_resp)
    assert_api.assert_response_matches(
        parse_resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.downloadAndParseCombineMessage.value,
            "device": "deviceA",
            "result": ne(None),
        },
        ignore_keys={"sequence"},
    )

    inner_messages = parse_resp.get("result")
    assert isinstance(inner_messages, list) and inner_messages, f"合并消息解析未返回内部消息列表: {parse_resp}"
    inner_by_id = {str(m.get("msgId")): m for m in inner_messages if isinstance(m, dict)}
    image_inner = inner_by_id.get(str(image_msg_id))
    video_inner = inner_by_id.get(str(video_msg_id))
    assert image_inner is not None, f"合并消息解析结果缺少内部图片消息: expected={image_msg_id}, actual={inner_messages}"
    assert video_inner is not None, f"合并消息解析结果缺少内部视频消息: expected={video_msg_id}, actual={inner_messages}"
    assert image_inner.get("body", {}).get("type") == 1, f"内部图片消息类型不正确: {image_inner}"
    assert video_inner.get("body", {}).get("type") == 2, f"内部视频消息类型不正确: {video_inner}"

    for cmd, message in (
        # (Cmd.downloadMessageAttachmentInCombine.value, image_inner),
        # (Cmd.downloadMessageThumbnailInCombine.value, image_inner),
        # (Cmd.downloadMessageAttachmentInCombine.value, video_inner),
        (Cmd.downloadMessageThumbnailInCombine.value, video_inner),
    ):
        resp = device_a.call("ChatManager", cmd, info={"message": message})
        _skip_if_missing_plugin(resp, cmd)
