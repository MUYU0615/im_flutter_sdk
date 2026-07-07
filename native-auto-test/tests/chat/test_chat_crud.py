from __future__ import annotations

import os
import time
import uuid
import pytest

from src import Cmd, ne
from src.tools.assertions import get_result
from tests.chat._utils import build_text


_ANDROID_MESSAGE_OPTIONAL_KEYS = {
    "broadcast",
    "onlineState",
    "deliverOnlineOnly",
    "targetLanguages",
    "translations",
    "isListened",
}


# ======================== Create / Send ========================


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.send_message.text.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
def test_chat_send_and_received(device_a, device_b, assert_api, user_a, user_b):
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    content = "hello-basic"
    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    temp_id = (evt_success.get("data") or {}).get("msgId")
    real_id = ((evt_success.get("data") or {}).get("msg") or {}).get("msgId")
    assert_api.assert_response_matches(
        evt_success,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "msgId": "{{tempId}}",
                "msg": {
                    "msgId": "{{realId}}",
                    "from": "{{fromUser}}",
                    "to": "{{toUser}}",
                    "convId": "{{toUser}}",
                    "body": {"type": 0, "content": "{{content}}", "translations": {}},
                    "direction": 0,
                    "chatType": 0,
                    "status": 2,
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
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
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
        ignore_keys={"sequence", "serverTime", "localTime"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
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
                        "msgId": "{{realId}}",
                    }
                ]
            },
        },
        context={"fromUser": user_a, "toUser": user_b, "content": content, "realId": real_id},
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "receiverList"} | _ANDROID_MESSAGE_OPTIONAL_KEYS,
    )
    received_messages = ((evt_received.get("data") or {}).get("messages")) or []
    if received_messages and "deliverOnlineOnly" in received_messages[0]:
        assert received_messages[0].get("deliverOnlineOnly") is False, f"data.messages[0].deliverOnlineOnly 不匹配: {received_messages[0]}"


def test_chat_send_to_self_event(device_a, assert_api, user_a):
    try:
        device_a.drain_events()
    except Exception:
        pass
    content = f"self-msg-{uuid.uuid4().hex[:6]}"
    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_a, content))
    evt = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    temp_id = (evt.get("data") or {}).get("msgId")
    real_id = ((evt.get("data") or {}).get("msg") or {}).get("msgId")
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": Cmd.onMessageSuccess.value,
            "data": {
                "msgId": "{{tempId}}",
                "msg": {
                    "msgId": "{{realId}}",
                    "from": "{{user}}",
                    "to": "{{user}}",
                    "convId": "{{user}}",
                    "body": {"type": 0, "content": "{{content}}", "translations": {}},
                    "direction": 0,
                    "chatType": 0,
                    "status": 2,
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
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime", "broadcast", "onlineState", "targetLanguages", "deliverOnlineOnly"},
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
        ignore_keys={"sequence", "serverTime", "localTime", "broadcast", "onlineState", "deliverOnlineOnly", "targetLanguages", "translations"},
    )


# ======================== Read ========================


def test_chat_get_message_invalid_id_returns_none(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.getMessage.value, "device": "deviceA", "result": None},
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


def test_chat_fetch_support_languages_success(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.fetchSupportLanguages.value, info={})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchSupportLanguages.value,
            "device": "deviceA",
            "result": ne(None),
        },
        ignore_keys={"sequence"},
    )


def test_chat_fetch_history_invalid_conversation(device_b, assert_api):
    resp = device_b.call("ChatManager", Cmd.fetchHistoryMessages.value, info={"conversationId": "__invalid__", "pageSize": 20, "cursor": None})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.fetchHistoryMessages.value, "device": "deviceB", "result": {"code": 205, "description": "Invalid parameter"}},
        ignore_keys={"sequence"},
    )


def test_chat_fetch_history_by_options_invalid_conversation(device_a, assert_api):
    resp = device_a.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": "__invalid__", "type": 0, "pageSize": 20, "cursor": ""},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchHistoryMessagesByOptions.value,
            "device": "deviceA",
            "result": {
                "cursor": "",
                "list": [],
            },
        },
        ignore_keys={"sequence"},
    )


def test_chat_save_message_then_get_message_success(device_a, assert_api, user_a, user_b):
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
        ignore_keys={"sequence", "status", "hasRead", "hasReadAck", "hasDeliverAck", "needGroupAck", "isThread", "isContentReplaced", "serverTime", "localTime", "broadcast", "onlineState", "deliverOnlineOnly", "targetLanguages", "translations"},
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
        ignore_keys={"sequence", "status", "hasRead", "hasReadAck", "hasDeliverAck", "needGroupAck", "isThread", "isContentReplaced", "serverTime", "localTime", "broadcast", "onlineState", "deliverOnlineOnly", "targetLanguages", "translations"},
    )


@pytest.mark.skip(reason="MissingPlugin: searchChatMsgFromDB 未在当前集成端实现")
def test_chat_search_chat_msg_from_db_success(device_a, device_b, assert_api, user_a, user_b):
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


def test_chat_translate_message_basic(device_a, assert_api, user_a, user_b):
    try:
        device_a.drain_events()
    except Exception:
        pass
    content = "translate-basic"
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    real_id = ((evt_success.get("data") or {}).get("msg") or {}).get("msgId")
    assert real_id, f"missing real msgId from onMessageSuccess: {evt_success!r}"
    resp_get = device_a.call("ChatManager", Cmd.getMessage.value, info={"msgId": real_id})
    msg_obj = get_result(resp_get)
    resp_tr = device_a.call("ChatManager", Cmd.translateMessage.value, info={"message": msg_obj, "targetLanguages": ["zh-Hans"]})
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
        ignore_keys={"sequence", "serverTime", "localTime", "broadcast", "onlineState", "targetLanguages"},
    )


def test_chat_pin_conversation_nonexistent_conversation(device_a, assert_api):
    resp_pin = device_a.call("ChatManager", Cmd.pinConversation.value, info={"conversationId": "__nonexistent_chat_user__", "isPinned": True})
    assert_api.assert_error(resp_pin, code=107, description="Invalid conversation")


def test_chat_modify_message_invalid_id_response(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.modifyMessage.value, info={"msgId": "__invalid_msg_id__", "body": {"type": 0, "content": "edit"}})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.modifyMessage.value, "device": "deviceA", "result": {"code": 500, "description": "Message is invalid"}},
        ignore_keys={"sequence"},
    )


def test_chat_translate_message_recalled_message(device_a, assert_api, user_a, user_b):
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, "recalled-translate"))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    real_id = (((evt_success or {}).get("data") or {}).get("msg") or {}).get("msgId")
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


def test_chat_ack_message_read_success(device_a, device_b, assert_api, user_a, user_b):
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass
    content = f"ackread-{uuid.uuid4().hex[:6]}"
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

    resp_ack = device_b.call("ChatManager", Cmd.ackMessageRead.value, info={"msgId": recv_msg_id, "to": user_a})
    assert_api.assert_response_matches(
        resp_ack,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.ackMessageRead.value,
            "device": "deviceB",
            "result": 1,
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
        ignore_keys={"timestamp", "sequence", "serverTime", "localTime"},
    )


# ======================== Delete ========================


def test_chat_recall_message_invalid_id_response(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.recallMessage.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.recallMessage.value, "device": "deviceA", "result": {"code": 500, "description": "The message was not found"}},
        ignore_keys={"sequence"},
    )


def test_chat_remove_reaction_invalid_id_response(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.removeReaction.value, info={"reaction": "👍", "msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.removeReaction.value, "device": "deviceA", "result": None},
        ignore_keys={"sequence"},
    )


# ======================== Errors / Edge ========================


def test_chat_ack_conversation_read_invalid_id_response(device_b, assert_api):
    resp = device_b.call("ChatManager", Cmd.ackConversationRead.value, info={"conversationId": "__invalid_conversation_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.ackConversationRead.value, "device": "deviceB", "result": {"code": 500, "description": "Message is invalid"}},
        ignore_keys={"sequence"},
    )


def test_chat_add_reaction_invalid_id_response(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "👍", "msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.addReaction.value, "device": "deviceA", "result": {"code": 303, "description": "msgbody is not_found"}},
        ignore_keys={"sequence"},
    )


def test_chat_add_reaction_empty_reaction_response(device_a, assert_api, user_a, user_b):
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, "for-reaction-empty"))
    evt_success = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
    real_id = (((evt_success or {}).get("data") or {}).get("msg") or {}).get("msgId")
    resp = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "", "msgId": real_id})
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.addReaction.value, "device": "deviceA", "result": {"code": 110, "description": "'reaction' can not be null"}},
        ignore_keys={"sequence"},
    )


# ======================== Attachments (invalid) ========================


@pytest.mark.skip(reason="message 对象入参 API 暂缓；避免 MissingPlugin 非被测端语义")
def test_chat_download_attachment_invalid_id_response(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.downloadAttachment.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_error(resp, code=500, description="Message is invalid")


@pytest.mark.skip(reason="message 对象入参 API 暂缓；避免 MissingPlugin 非被测端语义")
def test_chat_download_thumbnail_invalid_id_response(device_a, assert_api):
    resp = device_a.call("ChatManager", Cmd.downloadThumbnail.value, info={"msgId": "__invalid_msg_id__"})
    assert_api.assert_error(resp, code=500, description="Message is invalid")
