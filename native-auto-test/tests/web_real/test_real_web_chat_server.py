"""Real Web SDK/service ChatManager server-side query E2E cases."""

from __future__ import annotations

import contextlib
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from src import Cmd
from src.rest_api.user_api import get_user_access_token
from tests.chat._utils import build_text


pytestmark = [pytest.mark.web, pytest.mark.chat, pytest.mark.real_web]


@contextlib.contextmanager
def _download_server(content: bytes):
    hits: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, format, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server, hits
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _send_real_text(primary_device, secondary_device, assert_api, user_a, user_b) -> tuple[str, str]:
    content, msg_id, _ = _send_real_text_with_delivery(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    return content, msg_id


def _send_real_text_with_delivery(primary_device, secondary_device, assert_api, user_a, user_b) -> tuple[str, str, dict]:
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    content = f"real-web-server-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    sent_message = assert_api.get_result(sent)
    assert sent_message["body"] == {"type": 0, "content": content}

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    assert success is not None
    success_message = (success.get("data") or {}).get("msg")
    assert isinstance(success_message, dict)
    msg_id = success_message.get("msgId")
    assert isinstance(msg_id, str) and msg_id

    received = secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=30.0,
    )
    assert received is not None
    return content, msg_id, received


def _wait_event_with_operation(device, event_type: str, operation: str, timeout: float = 20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        remaining = max(0.1, deadline - time.time())
        event = device.receive_message(
            match_event_type=event_type,
            timeout=remaining,
        )
        if event is None:
            return None
        data = event.get("data")
        if isinstance(data, dict) and data.get("operation") == operation:
            return event
    return None


@contextlib.contextmanager
def _secondary_logged_in_as_primary(secondary_device, user_a: str, user_b: str):
    token_a = get_user_access_token(user_a, "1")
    token_b = get_user_access_token(user_b, "1")
    secondary_device.call("Client", Cmd.logout.value, info={})
    secondary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token_a},
    )
    try:
        yield
    finally:
        secondary_device.call("Client", Cmd.logout.value, info={})
        secondary_device.call(
            "Client",
            Cmd.loginWithAgoraToken.value,
            info={"userId": user_b, "agoraToken": token_b},
        )


def test_real_web_chat_server_conversation_and_history(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    conversations = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServer.value,
        info={},
    )
    conversations_result = assert_api.get_result(conversations)
    assert isinstance(conversations_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in conversations_result
    ), conversations_result

    conversation = primary_device.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": False},
    )
    conversation_result = assert_api.get_result(conversation)
    assert isinstance(conversation_result, dict)
    assert conversation_result.get("convId") == user_b
    assert conversation_result.get("type") == 0
    latest_message = conversation_result.get("latestMessage") or {}
    assert isinstance(latest_message, dict)
    assert latest_message.get("msgId") == msg_id
    assert (latest_message.get("body") or {}).get("content") == content

    fetched_message = primary_device.call(
        "ChatManager",
        Cmd.getMessage.value,
        info={"msgId": msg_id, "convId": user_b, "type": 0},
    )
    fetched_message_result = assert_api.get_result(fetched_message)
    assert isinstance(fetched_message_result, dict)
    assert fetched_message_result.get("msgId") == msg_id
    assert fetched_message_result.get("convId") == user_b
    assert (fetched_message_result.get("body") or {}).get("content") == content

    loaded_by_ids = primary_device.call(
        "ChatManager",
        Cmd.loadMessagesWithIds.value,
        info={"msgIds": [msg_id], "convId": user_b, "type": 0},
    )
    loaded_by_ids_result = assert_api.get_result(loaded_by_ids)
    assert isinstance(loaded_by_ids_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and (item.get("body") or {}).get("content") == content
        for item in loaded_by_ids_result
    ), loaded_by_ids_result

    message_count = primary_device.call(
        "ChatManager",
        Cmd.getMessageCount.value,
        info={},
    )
    message_count_result = assert_api.get_result(message_count)
    assert isinstance(message_count_result, int)
    assert message_count_result >= 1

    conversation_count = primary_device.call(
        "ChatManager",
        Cmd.conversationGetLocalMessageCount.value,
        info={"convId": user_b, "type": 0},
    )
    conversation_count_result = assert_api.get_result(conversation_count)
    assert isinstance(conversation_count_result, int)
    assert conversation_count_result >= 1

    unread_before = secondary_device.call(
        "ConversationManager",
        Cmd.getUnreadMsgCount.value,
        info={"convId": user_a, "type": 0},
    )
    unread_before_result = assert_api.get_result(unread_before)
    assert isinstance(unread_before_result, int)
    assert unread_before_result >= 1

    marked = secondary_device.call(
        "ChatManager",
        Cmd.ackConversationRead.value,
        info={"convId": user_a, "type": 0},
    )
    marked_result = assert_api.get_result(marked)
    assert marked_result == 1

    unread_after = secondary_device.call(
        "ConversationManager",
        Cmd.getUnreadMsgCount.value,
        info={"convId": user_a, "type": 0},
    )
    unread_after_result = assert_api.get_result(unread_after)
    assert unread_after_result == 0

    keyword_messages = primary_device.call(
        "ChatManager",
        Cmd.loadConversationMessagesWithKeyword.value,
        info={"convId": user_b, "type": 0, "keywords": content},
    )
    keyword_messages_result = assert_api.get_result(keyword_messages)
    assert isinstance(keyword_messages_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and (item.get("body") or {}).get("content") == content
        for item in keyword_messages_result
    ), keyword_messages_result

    conversation_search = primary_device.call(
        "ChatManager",
        Cmd.searchMsgsByOptions.value,
        info={"convId": user_b, "type": 0, "keywords": content},
    )
    conversation_search_result = assert_api.get_result(conversation_search)
    assert isinstance(conversation_search_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and (item.get("body") or {}).get("content") == content
        for item in conversation_search_result
    ), conversation_search_result

    conversation_search_alias = primary_device.call(
        "ChatManager",
        Cmd.conversationSearchMsgsByOptions.value,
        info={"convId": user_b, "type": 0, "keywords": content},
    )
    conversation_search_alias_result = assert_api.get_result(conversation_search_alias)
    assert isinstance(conversation_search_alias_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and (item.get("body") or {}).get("content") == content
        for item in conversation_search_alias_result
    ), conversation_search_alias_result

    global_search = primary_device.call(
        "ChatManager",
        Cmd.searchChatMsgFromDB.value,
        info={"keywords": content},
    )
    global_search_result = assert_api.get_result(global_search)
    assert isinstance(global_search_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and (item.get("body") or {}).get("content") == content
        for item in global_search_result
    ), global_search_result

    sorted_conversations = primary_device.call(
        "ChatManager",
        Cmd.getAllConversationsBySort.value,
        info={},
    )
    sorted_conversations_result = assert_api.get_result(sorted_conversations)
    assert isinstance(sorted_conversations_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in sorted_conversations_result
    ), sorted_conversations_result

    loaded_all = primary_device.call(
        "ChatManager",
        Cmd.loadAllConversations.value,
        info={},
    )
    loaded_all_result = assert_api.get_result(loaded_all)
    assert isinstance(loaded_all_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in loaded_all_result
    ), loaded_all_result

    page_conversations = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    page_result = assert_api.get_result(page_conversations)
    assert isinstance(page_result, dict)
    assert isinstance(page_result.get("list"), list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in page_result["list"]
    ), page_result

    cursor_page = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServerWithCursor.value,
        info={"cursor": "", "pageSize": 20},
    )
    cursor_result = assert_api.get_result(cursor_page)
    assert isinstance(cursor_result, dict)
    assert isinstance(cursor_result.get("list"), list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in cursor_result["list"]
    ), cursor_result

    option_page = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsByOptions.value,
        info={"cursor": "", "pageSize": 20},
    )
    option_result = assert_api.get_result(option_page)
    assert isinstance(option_result, dict)
    assert isinstance(option_result.get("list"), list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in option_result["list"]
    ), option_result

    unread = secondary_device.call(
        "ChatManager",
        Cmd.getUnreadMessageCount.value,
        info={},
    )
    unread_result = assert_api.get_result(unread)
    assert isinstance(unread_result, int)
    assert unread_result == 0

    history = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": user_b, "type": 0, "pageSize": 20, "cursor": ""},
    )
    history_result = assert_api.get_result(history)
    assert isinstance(history_result, dict)
    messages = history_result.get("list")
    assert isinstance(messages, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and item.get("convId") == user_b
        and (item.get("body") or {}).get("content") == content
        for item in messages
    ), history_result

    legacy_history = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info={"convId": user_b, "type": 0, "pageSize": 20, "startMsgId": "", "direction": 0},
    )
    legacy_result = assert_api.get_result(legacy_history)
    assert isinstance(legacy_result, dict)
    legacy_messages = legacy_result.get("list")
    assert isinstance(legacy_messages, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and item.get("convId") == user_b
        and (item.get("body") or {}).get("content") == content
        for item in legacy_messages
    ), legacy_result


def test_real_web_chat_ack_message_read_a_to_b(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _, sent_msg_id, received = _send_real_text_with_delivery(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    received_messages = (received.get("data") or {}).get("messages")
    assert isinstance(received_messages, list) and received_messages
    received_msg_id = received_messages[0].get("msgId")
    assert isinstance(received_msg_id, str) and received_msg_id == sent_msg_id

    ack = secondary_device.call(
        "ChatManager",
        Cmd.ackMessageRead.value,
        info={"msgId": received_msg_id, "to": user_a},
    )
    assert_api.assert_result_equals(ack, 1)

    read_ack = primary_device.receive_message(
        match_event_type=Cmd.onMessageReadAck.value,
        timeout=20.0,
    )
    assert read_ack is not None
    assert read_ack.get("eventType") == Cmd.onMessageReadAck.value
    data = read_ack.get("data")
    assert isinstance(data, dict)
    assert data.get("operation") == "message_read_ack"
    msg = data.get("msg")
    assert isinstance(msg, dict)
    assert msg.get("msgId") == sent_msg_id
    assert msg.get("from") == user_a
    assert msg.get("to") == user_b
    assert msg.get("hasReadAck") is True


def test_real_web_chat_fetch_support_languages(
    primary_device,
    assert_api,
):
    resp = primary_device.call(
        "ChatManager",
        Cmd.fetchSupportLanguages.value,
        info={},
    )
    result = assert_api.get_result(resp)
    assert isinstance(result, list)
    assert result, result
    assert all(isinstance(item, str) and item for item in result), result


def test_real_web_chat_translate_message(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    content = f"real-web-translate-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    message = assert_api.get_result(sent)
    assert isinstance(message, dict)
    secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=30.0,
    )
    translated = primary_device.call(
        "ChatManager",
        Cmd.translateMessage.value,
        info={
            "message": message,
            "targetLanguages": ["zh-Hans"],
        },
    )
    result = assert_api.get_result(translated)
    assert isinstance(result, dict)
    body = result.get("body")
    assert isinstance(body, dict)
    assert body.get("content") == content
    translations = body.get("translations")
    assert isinstance(translations, dict)
    assert "zh-Hans" in translations


def test_real_web_chat_pin_conversation_and_query_pinned(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    pin = primary_device.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"convId": user_b, "type": 0, "isPinned": True},
    )
    pin_result = assert_api.get_result(pin)
    assert isinstance(pin_result, dict)
    assert pin_result.get("isPinned") is True

    pinned = primary_device.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info={"cursor": "", "pageSize": 20},
    )
    pinned_result = assert_api.get_result(pinned)
    assert isinstance(pinned_result, dict)
    pinned_list = pinned_result.get("list")
    assert isinstance(pinned_list, list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        and item.get("isPinned") is True
        for item in pinned_list
    ), pinned_result

    unpin = primary_device.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"convId": user_b, "type": 0, "isPinned": False},
    )
    unpin_result = assert_api.get_result(unpin)
    assert isinstance(unpin_result, dict)
    assert unpin_result.get("isPinned") is False


def test_real_web_multi_device_conversation_event_for_pin(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    with _secondary_logged_in_as_primary(secondary_device, user_a, user_b):
        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        pin = primary_device.call(
            "ChatManager",
            Cmd.pinConversation.value,
            info={"convId": user_b, "type": 0, "isPinned": True},
        )
        pin_result = assert_api.get_result(pin)
        assert isinstance(pin_result, dict)
        assert pin_result.get("isPinned") is True

        event = secondary_device.receive_message(
            match_event_type=Cmd.onMultiDevicesConversationEvent.value,
            timeout=20.0,
        )
        if event is None:
            debug = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(f"missing multi-device conversation event; debug={debug!r}")
        assert event.get("eventType") == Cmd.onMultiDevicesConversationEvent.value
        data = event.get("data")
        assert isinstance(data, dict)
        assert data.get("convId") == user_b
        assert data.get("convType") == 0


def test_real_web_multi_device_contact_event_for_blocklist(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    with _secondary_logged_in_as_primary(secondary_device, user_a, user_b):
        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        block = primary_device.call(
            "ContactManager",
            Cmd.addUserToBlockList.value,
            info={"userId": user_b},
        )
        assert_api.assert_result_equals(block, user_b)

        event = secondary_device.receive_message(
            match_event_type=Cmd.onMultiDeviceContactEvent.value,
            timeout=20.0,
        )
        if event is None:
            debug = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(f"missing multi-device contact event; debug={debug!r}")
        assert event.get("eventType") == Cmd.onMultiDeviceContactEvent.value
        data = event.get("data")
        assert isinstance(data, dict)
        assert data.get("target") == user_a
        assert data.get("category") == "contact"
        assert data.get("operation") == "CONTACT_BAN"

        unblock = primary_device.call(
            "ContactManager",
            Cmd.removeUserFromBlockList.value,
            info={"userId": user_b},
        )
        assert_api.assert_result_equals(unblock, user_b)


@pytest.mark.xfail(
    reason=(
        "real WebSDK2 receives the normal group member callback for createGroup, "
        "but does not emit onMultiDeviceGroup to the second same-user web client"
    ),
    strict=False,
)
def test_real_web_multi_device_group_event_for_create(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    with _secondary_logged_in_as_primary(secondary_device, user_a, user_b):
        try:
            primary_device.call("Client", Cmd.startCallback.value, info={})
            secondary_device.call("Client", Cmd.startCallback.value, info={})
            primary_device.drain_events(timeout=0.2)
            secondary_device.drain_events(timeout=0.2)

            created_group = primary_device.call(
                "GroupManager",
                Cmd.createGroup.value,
                info={
                    "groupName": f"real-web-md-group-{uuid.uuid4().hex[:8]}",
                    "desc": "real web multi-device group",
                    "inviteMembers": [user_b],
                    "options": {
                        "style": 1,
                        "maxCount": 20,
                        "inviteNeedConfirm": False,
                    },
                },
            )
            group = assert_api.get_result(created_group)
            assert isinstance(group, dict)
            group_id = group.get("groupId") or ""
            assert isinstance(group_id, str) and group_id

            event = secondary_device.receive_message(
                match_event_type=Cmd.onMultiDeviceGroupEvent.value,
                timeout=20.0,
            )
            if event is None:
                debug = assert_api.get_result(
                    secondary_device.call("Client", "getRealSdkDebug", info={})
                )
                pytest.fail(f"missing multi-device group event; debug={debug!r}")
            assert event.get("eventType") == Cmd.onMultiDeviceGroupEvent.value
            data = event.get("data")
            assert isinstance(data, dict)
            assert data.get("target") == group_id
            assert data.get("category") == "group"
            assert data.get("operation") == "GROUP_CREATE"
        finally:
            if group_id:
                primary_device.call(
                    "GroupManager",
                    Cmd.destroyGroup.value,
                    info={"groupId": group_id},
                )


@pytest.mark.xfail(
    reason=(
        "real WebSDK2 removeHistoryMessages succeeds, but the second same-user "
        "web client receives conversation list updates instead of "
        "onMultiDeviceMessageRemoved"
    ),
    strict=False,
)
def test_real_web_multi_device_remove_messages_event_for_msg_ids(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    assert content
    time.sleep(2)

    with _secondary_logged_in_as_primary(secondary_device, user_a, user_b):
        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        removed = primary_device.call(
            "ChatManager",
            Cmd.removeMessagesFromServerWithMsgIds.value,
            info={"convId": user_b, "type": 0, "msgIds": [msg_id]},
        )
        assert_api.assert_result_equals(removed, None)

        event = secondary_device.receive_message(
            match_event_type=Cmd.onMultiDeviceRemoveMessagesEvent.value,
            timeout=20.0,
        )
        if event is None:
            debug = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(f"missing multi-device removed-message event; debug={debug!r}")
        assert event.get("eventType") == Cmd.onMultiDeviceRemoveMessagesEvent.value
        data = event.get("data")
        assert isinstance(data, dict)
        assert data.get("convId") == user_b
        assert data.get("convType") == 0
        assert msg_id in (data.get("msgIds") or [])
        assert data.get("category") == "messageRemoved"


def test_real_web_multi_device_thread_event_for_create(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    thread_id = ""
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": f"real-web-md-thread-group-{uuid.uuid4().hex[:8]}",
                "desc": "real web multi-device thread",
                "inviteMembers": [user_b],
                "options": {
                    "style": 1,
                    "maxCount": 20,
                    "inviteNeedConfirm": False,
                },
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        content = f"real-web-md-thread-parent-{uuid.uuid4().hex[:8]}"
        sent_parent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, content, chat_type=1),
        )
        sent_parent_message = assert_api.get_result(sent_parent)
        assert isinstance(sent_parent_message, dict)
        parent_msg_id = sent_parent_message.get("msgId")
        assert isinstance(parent_msg_id, str) and parent_msg_id

        success = primary_device.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        assert success is not None
        secondary_device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=30.0,
        )

        with _secondary_logged_in_as_primary(secondary_device, user_a, user_b):
            primary_device.call("Client", Cmd.startCallback.value, info={})
            secondary_device.call("Client", Cmd.startCallback.value, info={})
            primary_device.drain_events(timeout=0.2)
            secondary_device.drain_events(timeout=0.2)

            created_thread = primary_device.call(
                "ChatThreadManager",
                Cmd.createChatThread.value,
                info={
                    "name": f"real-web-md-thread-{uuid.uuid4().hex[:8]}",
                    "msgId": parent_msg_id,
                    "parentId": group_id,
                },
            )
            thread = assert_api.get_result(created_thread)
            assert isinstance(thread, dict)
            thread_id = thread.get("threadId") or ""
            assert isinstance(thread_id, str) and thread_id

            event = secondary_device.receive_message(
                match_event_type=Cmd.onMultiDeviceThreadEvent.value,
                timeout=20.0,
            )
            if event is None:
                debug = assert_api.get_result(
                    secondary_device.call("Client", "getRealSdkDebug", info={})
                )
                pytest.fail(f"missing multi-device thread event; debug={debug!r}")
            assert event.get("eventType") == Cmd.onMultiDeviceThreadEvent.value
            data = event.get("data")
            assert isinstance(data, dict)
            assert data.get("target") == thread_id
            assert data.get("category") == "thread"
            assert data.get("operation") == "THREAD_CREATE"
    finally:
        if thread_id:
            primary_device.call(
                "ChatThreadManager",
                Cmd.destroyChatThread.value,
                info={"threadId": thread_id},
            )
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_chat_pin_message_query_and_event(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    pin = primary_device.call(
        "ChatManager",
        Cmd.pinMessage.value,
        info={"convId": user_b, "type": 0, "msgId": msg_id},
    )
    assert_api.assert_result_equals(pin, True)

    pin_event = secondary_device.receive_message(
        match_event_type=Cmd.onMessagePinChanged.value,
        timeout=20.0,
    )
    assert pin_event is not None
    assert pin_event.get("eventType") == Cmd.onMessagePinChanged.value
    pin_data = pin_event.get("data")
    assert isinstance(pin_data, dict)
    assert pin_data.get("operation") == "message_pinned"
    assert pin_data.get("msgId") == msg_id
    assert pin_data.get("convId") == user_a
    assert pin_data.get("operatorId") == user_a

    pin_info = primary_device.call(
        "ChatManager",
        Cmd.getPinInfo.value,
        info={"convId": user_b, "type": 0, "msgId": msg_id},
    )
    pin_info_result = assert_api.get_result(pin_info)
    assert isinstance(pin_info_result, dict)
    assert pin_info_result.get("msgId") == msg_id
    assert pin_info_result.get("convId") == user_b
    assert pin_info_result.get("operatorId") == user_a
    assert isinstance(pin_info_result.get("pinTime"), int)

    pinned = primary_device.call(
        "ChatManager",
        Cmd.pinnedMessages.value,
        info={"convId": user_b, "type": 0},
    )
    pinned_result = assert_api.get_result(pinned)
    assert isinstance(pinned_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and item.get("convId") == user_b
        for item in pinned_result
    ), pinned_result

    pinned_page = primary_device.call(
        "ChatManager",
        Cmd.fetchPinnedMessages.value,
        info={"convId": user_b, "type": 0, "cursor": "", "pageSize": 20},
    )
    pinned_page_result = assert_api.get_result(pinned_page)
    assert isinstance(pinned_page_result, dict)
    pinned_page_list = pinned_page_result.get("list")
    assert isinstance(pinned_page_list, list)
    assert any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and item.get("convId") == user_b
        for item in pinned_page_list
    ), pinned_page_result

    unpin = primary_device.call(
        "ChatManager",
        Cmd.unpinMessage.value,
        info={"convId": user_b, "type": 0, "msgId": msg_id},
    )
    assert_api.assert_result_equals(unpin, True)

    unpin_event = secondary_device.receive_message(
        match_event_type=Cmd.onMessagePinChanged.value,
        timeout=20.0,
    )
    assert unpin_event is not None
    assert unpin_event.get("eventType") == Cmd.onMessagePinChanged.value
    unpin_data = unpin_event.get("data")
    assert isinstance(unpin_data, dict)
    assert unpin_data.get("operation") == "message_unpinned"
    assert unpin_data.get("msgId") == msg_id
    assert unpin_data.get("convId") == user_a
    assert unpin_data.get("operatorId") == user_a

    pin_info_after = primary_device.call(
        "ChatManager",
        Cmd.getPinInfo.value,
        info={"convId": user_b, "type": 0, "msgId": msg_id},
    )
    assert_api.assert_result_equals(pin_info_after, None)


def _assert_server_conversation_absent(primary_device, assert_api, user_b):
    conversations = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServer.value,
        info={},
    )
    conversations_result = assert_api.get_result(conversations)
    assert isinstance(conversations_result, list)
    assert not any(
        isinstance(item, dict) and item.get("convId") == user_b
        for item in conversations_result
    ), conversations_result


def _history_contains_message(primary_device, assert_api, user_b, msg_id, content) -> bool:
    history = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": user_b, "type": 0, "pageSize": 20, "cursor": ""},
    )
    history_result = assert_api.get_result(history)
    assert isinstance(history_result, dict)
    messages = history_result.get("list")
    assert isinstance(messages, list)
    return any(
        isinstance(item, dict)
        and item.get("msgId") == msg_id
        and (item.get("body") or {}).get("content") == content
        for item in messages
    )


def test_real_web_chat_delete_conversation_removes_server_conversation(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    delete = primary_device.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "type": 0, "deleteMessages": False},
    )
    assert_api.assert_result_equals(delete, True)
    time.sleep(1)
    _assert_server_conversation_absent(primary_device, assert_api, user_b)


def test_real_web_chat_delete_remote_conversation_removes_server_conversation(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    delete = primary_device.call(
        "ChatManager",
        Cmd.deleteRemoteConversation.value,
        info={
            "convId": user_b,
            "conversationType": 0,
            "isDeleteRemoteMessage": False,
        },
    )
    assert_api.assert_result_equals(delete, None)
    time.sleep(1)
    _assert_server_conversation_absent(primary_device, assert_api, user_b)


def test_real_web_chat_remove_message_from_server_with_msg_id(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, content)

    remove = primary_device.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"convId": user_b, "type": 0, "msgIds": [msg_id]},
    )
    assert_api.assert_result_equals(remove, None)
    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, msg_id, content)


def test_real_web_chat_remove_messages_from_server_with_timestamp(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, content)

    remove = primary_device.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={
            "convId": user_b,
            "type": 0,
            "timestamp": int(time.time() * 1000) + 1000,
        },
    )
    assert_api.assert_result_equals(remove, None)
    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, msg_id, content)


def test_real_web_chat_conversation_delete_server_message_with_ids(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, content)

    remove = primary_device.call(
        "ChatManager",
        Cmd.conversationDeleteServerMessageWithIds.value,
        info={"convId": user_b, "type": 0, "msgIds": [msg_id]},
    )
    assert_api.assert_result_equals(remove, None)
    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, msg_id, content)


def test_real_web_chat_conversation_delete_server_message_with_time(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, content)

    remove = primary_device.call(
        "ChatManager",
        Cmd.conversationDeleteServerMessageWithTime.value,
        info={
            "convId": user_b,
            "type": 0,
            "timestamp": int(time.time() * 1000) + 1000,
        },
    )
    assert_api.assert_result_equals(remove, None)
    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, msg_id, content)


def test_real_web_chat_modify_then_recall_message(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, content)

    modified_content = f"{content}-modified"
    modify = primary_device.call(
        "ChatManager",
        Cmd.modifyMessage.value,
        info={"msgId": msg_id, "body": {"type": 0, "content": modified_content}},
    )
    modified = assert_api.get_result(modify)
    assert isinstance(modified, dict)
    assert modified.get("msgId") == msg_id
    assert (modified.get("body") or {}).get("content") == modified_content

    updated_via_alias = primary_device.call(
        "ChatManager",
        Cmd.updateChatMessage.value,
        info={"message": {"msgId": msg_id, "body": {"type": 0, "content": modified_content}}},
    )
    updated_via_alias_result = assert_api.get_result(updated_via_alias)
    assert isinstance(updated_via_alias_result, dict)
    assert updated_via_alias_result.get("msgId") == msg_id
    assert (updated_via_alias_result.get("body") or {}).get("content") == modified_content

    content_changed = secondary_device.receive_message(
        match_event_type=Cmd.onMessageContentChanged.value,
        timeout=20.0,
    )
    assert content_changed is not None
    assert content_changed.get("eventType") == Cmd.onMessageContentChanged.value
    content_changed_data = content_changed.get("data")
    assert isinstance(content_changed_data, dict)
    assert content_changed_data.get("operation") == "message_content_changed"
    changed_message = content_changed_data.get("message")
    assert isinstance(changed_message, dict)
    assert changed_message.get("msgId") == msg_id
    assert (changed_message.get("body") or {}).get("content") == modified_content
    assert content_changed_data.get("operatorId") == user_a

    changed = secondary_device.receive_message(
        match_event_type=Cmd.onMessageChanged.value,
        timeout=5.0,
    )
    assert changed is not None
    assert changed.get("eventType") == Cmd.onMessageChanged.value
    changed_data = changed.get("data")
    assert isinstance(changed_data, dict)
    assert changed_data.get("operation") == "message_changed"
    assert (changed_data.get("msg") or {}).get("msgId") == msg_id

    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, modified_content)

    recall = primary_device.call(
        "ChatManager",
        Cmd.recallMessage.value,
        info={"msgId": msg_id, "ext": "web-real-e2e"},
    )
    assert_api.assert_result_equals(recall, True)

    recalled = secondary_device.receive_message(
        match_event_type=Cmd.onMessagesRecalled.value,
        timeout=20.0,
    )
    assert recalled is not None
    assert recalled.get("eventType") == Cmd.onMessagesRecalled.value
    recalled_data = recalled.get("data")
    assert isinstance(recalled_data, dict)
    recalled_messages = recalled_data.get("messages")
    assert isinstance(recalled_messages, list) and recalled_messages
    assert recalled_messages[0].get("msgId") == msg_id

    recalled_info = secondary_device.receive_message(
        match_event_type=Cmd.onMessagesRecalledInfo.value,
        timeout=5.0,
    )
    assert recalled_info is not None
    assert recalled_info.get("eventType") == Cmd.onMessagesRecalledInfo.value
    recalled_info_data = recalled_info.get("data")
    assert isinstance(recalled_info_data, dict)
    infos = recalled_info_data.get("infos")
    assert isinstance(infos, list) and infos
    assert infos[0].get("recallMsgId") == msg_id
    assert infos[0].get("recallBy") == user_a

    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, msg_id, modified_content)


def test_real_web_chat_report_message(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    report = primary_device.call(
        "ChatManager",
        Cmd.reportMessage.value,
        info={
            "msgId": msg_id,
            "tag": "spam",
            "reason": f"web-real-e2e-{uuid.uuid4().hex[:8]}",
        },
    )
    assert_api.assert_result_equals(report, True)
    debug_resp = primary_device.call("Client", "getRealSdkDebug", info={})
    debug = assert_api.get_result(debug_resp)
    assert any(
        isinstance(item, dict) and item.get("type") == "reportMessage_success"
        for item in debug
    ), debug


def test_real_web_chat_message_reaction_add_fetch_remove(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    reaction = f"like-{uuid.uuid4().hex[:6]}"

    add = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": msg_id, "reaction": reaction},
    )
    assert_api.assert_result_equals(add, True)
    time.sleep(2)

    reaction_list = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [msg_id], "chatType": 0},
    )
    reaction_list_result = assert_api.get_result(reaction_list)
    assert isinstance(reaction_list_result, dict)
    reactions = reaction_list_result.get(msg_id)
    if reactions is None:
        debug_resp = primary_device.call("Client", "getRealSdkDebug", info={})
        debug = assert_api.get_result(debug_resp)
        pytest.fail(f"reaction list does not contain {msg_id}: result={reaction_list_result!r}; debug={debug!r}")
    assert isinstance(reactions, list)
    assert any(
        isinstance(item, dict)
        and item.get("reaction") == reaction
        and item.get("count", 0) >= 1
        for item in reactions
    ), reaction_list_result

    detail = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionDetail.value,
        info={"msgId": msg_id, "reaction": reaction, "cursor": "", "pageSize": 20},
    )
    detail_result = assert_api.get_result(detail)
    assert isinstance(detail_result, dict)
    detail_items = detail_result.get("list")
    assert isinstance(detail_items, list)
    if not detail_items:
        debug_resp = primary_device.call("Client", "getRealSdkDebug", info={})
        debug = assert_api.get_result(debug_resp)
        pytest.fail(f"reaction detail is empty: result={detail_result!r}; debug={debug!r}")
    assert any(
        isinstance(item, dict)
        and item.get("reaction") == reaction
        and (item.get("userId") == user_a or user_a in item.get("userList", []))
        for item in detail_items
    ), detail_result

    remove = primary_device.call(
        "ChatManager",
        Cmd.removeReaction.value,
        info={"msgId": msg_id, "reaction": reaction},
    )
    assert_api.assert_result_equals(remove, True)
    time.sleep(2)

    after_remove = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionDetail.value,
        info={"msgId": msg_id, "reaction": reaction, "cursor": "", "pageSize": 20},
    )
    after_remove_result = assert_api.get_result(after_remove)
    assert isinstance(after_remove_result, dict)
    after_remove_items = after_remove_result.get("list")
    assert isinstance(after_remove_items, list)
    assert not any(
        isinstance(item, dict)
        and (item.get("userId") == user_a or user_a in item.get("userList", []))
        for item in after_remove_items
    ), after_remove_result


def test_real_web_chat_message_reaction_change_event_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    reaction = "like"
    add = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": msg_id, "reaction": reaction},
    )
    assert_api.assert_result_equals(add, True)

    add_event = _wait_event_with_operation(
        primary_device,
        Cmd.onMessageReactionDidChange.value,
        "reaction_added",
        timeout=20.0,
    )
    assert add_event is not None
    add_data = add_event.get("data")
    assert isinstance(add_data, dict)
    assert add_data.get("operation") == "reaction_added"
    assert add_data.get("msgId") == msg_id
    assert add_data.get("reaction") == reaction

    remove = primary_device.call(
        "ChatManager",
        Cmd.removeReaction.value,
        info={"msgId": msg_id, "reaction": reaction},
    )
    assert_api.assert_result_equals(remove, True)

    remove_event = _wait_event_with_operation(
        primary_device,
        Cmd.onMessageReactionDidChange.value,
        "reaction_removed",
        timeout=20.0,
    )
    assert remove_event is not None
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("operation") == "reaction_removed"
    assert remove_data.get("msgId") == msg_id
    assert remove_data.get("reaction") == reaction


def test_real_web_chat_conversation_update_event_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.drain_events(timeout=0.2)

    marked = secondary_device.call(
        "ChatManager",
        Cmd.ackConversationRead.value,
        info={"convId": user_a, "type": 0},
    )
    assert_api.assert_result_equals(marked, 1)

    update_event = secondary_device.receive_message(
        match_event_type=Cmd.onConversationUpdate.value,
        timeout=20.0,
    )
    assert update_event is not None
    update_data = update_event.get("data")
    assert isinstance(update_data, dict)
    assert update_data.get("convId") == user_a
    assert update_data.get("operation") == "conversation_updated"


def test_real_web_chat_download_attachment_imsdk_runtime(
    primary_device,
    assert_api,
    user_a,
    user_b,
):
    content = b"real-web-attachment-payload"
    with _download_server(content) as (server, hits):
        base_url = f"http://127.0.0.1:{server.server_port}"
        msg_base = f"web-real-download-{uuid.uuid4().hex[:8]}"
        message = {
            "from": user_a,
            "to": user_b,
            "chatType": 0,
            "direction": 0,
            "convId": user_b,
            "msgId": msg_base,
            "msgServerId": msg_base,
            "body": {
                "type": 4,
                "displayName": "web-file.bin",
                "remotePath": f"{base_url}/attachment.bin",
                "fileSize": len(content),
                "filetype": "application/octet-stream",
            },
        }

        response = primary_device.call(
            "ChatManager",
            Cmd.downloadAttachment.value,
            info={"message": message},
        )
        assert_api.assert_result_equals(response, None)

        debug = primary_device.call("Client", "getRealSdkDebug", info={})
        debug_result = assert_api.get_result(debug)
        assert isinstance(debug_result, list)
        success_events = [
            item
            for item in debug_result
            if isinstance(item, dict) and item.get("type") == "downloadAttachment_success"
        ]
        assert success_events, debug_result
        latest = success_events[-1]
        assert latest.get("runtime") == "imsdk"
        result = latest.get("result") or {}
        assert result.get("filename") == "web-file.bin"
        assert result.get("mimeType") == "application/octet-stream"
        assert result.get("downloadUrl") == f"{base_url}/attachment.bin"
        assert result.get("dataLength") == len(content)
        assert any(path.startswith("/attachment.bin") for path in hits), hits


def test_real_web_chat_download_thumbnail_imsdk_runtime(
    primary_device,
    assert_api,
    user_a,
    user_b,
):
    content = b"real-web-thumbnail-payload"
    with _download_server(content) as (server, hits):
        base_url = f"http://127.0.0.1:{server.server_port}"
        msg_base = f"web-real-thumb-{uuid.uuid4().hex[:8]}"
        message = {
            "from": user_a,
            "to": user_b,
            "chatType": 0,
            "direction": 0,
            "convId": user_b,
            "msgId": msg_base,
            "msgServerId": msg_base,
            "body": {
                "type": 1,
                "displayName": "web-image.jpg",
                "remotePath": f"{base_url}/image.jpg",
                "thumbnailRemotePath": f"{base_url}/thumbnail.jpg",
                "fileSize": len(content),
                "filetype": "image/jpeg",
                "width": 100,
                "height": 100,
            },
        }

        response = primary_device.call(
            "ChatManager",
            Cmd.downloadThumbnail.value,
            info={"message": message},
        )
        assert_api.assert_result_equals(response, None)

        debug = primary_device.call("Client", "getRealSdkDebug", info={})
        debug_result = assert_api.get_result(debug)
        assert isinstance(debug_result, list)
        success_events = [
            item
            for item in debug_result
            if isinstance(item, dict) and item.get("type") == "downloadAttachment_success"
        ]
        assert success_events, debug_result
        latest = success_events[-1]
        assert latest.get("runtime") == "imsdk"
        result = latest.get("result") or {}
        assert result.get("filename") == "web-image.jpg"
        assert result.get("mimeType") == "image/jpeg"
        assert result.get("downloadUrl") == f"{base_url}/thumbnail.jpg"
        assert result.get("dataLength") == len(content)
        assert any(path.startswith("/thumbnail.jpg") for path in hits), hits


def test_real_web_chat_download_big_image_imsdk_runtime(
    primary_device,
    assert_api,
    user_a,
    user_b,
):
    content = b"real-web-big-image-payload"
    with _download_server(content) as (server, hits):
        base_url = f"http://127.0.0.1:{server.server_port}"
        msg_base = f"web-real-big-{uuid.uuid4().hex[:8]}"
        message = {
            "from": user_a,
            "to": user_b,
            "chatType": 0,
            "direction": 0,
            "convId": user_b,
            "msgId": msg_base,
            "msgServerId": msg_base,
            "body": {
                "type": 1,
                "displayName": "web-big-image.jpg",
                "remotePath": f"{base_url}/image.jpg",
                "bigImageUrl": f"{base_url}/image.jpg",
                "thumbnailRemotePath": f"{base_url}/thumbnail.jpg",
                "fileSize": len(content),
                "filetype": "image/jpeg",
                "width": 100,
                "height": 100,
                "isOriginalImage": False,
            },
        }

        response = primary_device.call(
            "ChatManager",
            Cmd.downloadBigImage.value,
            info={"message": message},
        )
        assert_api.assert_result_equals(response, None)

        debug = primary_device.call("Client", "getRealSdkDebug", info={})
        debug_result = assert_api.get_result(debug)
        assert isinstance(debug_result, list)
        success_events = [
            item
            for item in debug_result
            if isinstance(item, dict) and item.get("type") == "downloadAttachment_success"
        ]
        assert success_events, debug_result
        latest = success_events[-1]
        assert latest.get("runtime") == "imsdk"
        result = latest.get("result") or {}
        assert result.get("filename") == "web-big-image.jpg"
        assert result.get("mimeType") == "image/jpeg"
        assert result.get("downloadUrl") == f"{base_url}/image.jpg"
        assert result.get("dataLength") == len(content)
        assert any(path.startswith("/image.jpg") for path in hits), hits


def test_real_web_chat_combine_inner_downloads_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    file_content = b"real-web-combine-file-payload"
    thumb_content = b"real-web-combine-thumb-payload"
    with _download_server(file_content) as (file_server, file_hits):
        with _download_server(thumb_content) as (thumb_server, thumb_hits):
            file_url = f"http://127.0.0.1:{file_server.server_port}/combine-file.bin"
            thumb_url = f"http://127.0.0.1:{thumb_server.server_port}/combine-thumbnail.jpg"

            primary_device.call("Client", Cmd.startCallback.value, info={})
            secondary_device.call("Client", Cmd.startCallback.value, info={})
            primary_device.drain_events(timeout=0.2)
            secondary_device.drain_events(timeout=0.2)

            first = primary_device.call(
                "ChatManager",
                Cmd.sendMessage.value,
                info=build_text(user_a, user_b, f"real-web-combine-inner-a-{uuid.uuid4().hex[:8]}"),
            )
            first_message = assert_api.get_result(first)
            first_msg_id = first_message["msgId"]
            primary_device.receive_message(
                match_event_type=Cmd.onMessageSuccess.value,
                timeout=20.0,
            )
            secondary_device.receive_message(
                match_event_type=Cmd.onMessagesReceived.value,
                timeout=30.0,
            )

            second = primary_device.call(
                "ChatManager",
                Cmd.sendMessage.value,
                info=build_text(user_a, user_b, f"real-web-combine-inner-b-{uuid.uuid4().hex[:8]}"),
            )
            second_message = assert_api.get_result(second)
            second_msg_id = second_message["msgId"]
            primary_device.receive_message(
                match_event_type=Cmd.onMessageSuccess.value,
                timeout=20.0,
            )
            secondary_device.receive_message(
                match_event_type=Cmd.onMessagesReceived.value,
                timeout=30.0,
            )

            sent = primary_device.call(
                "ChatManager",
                Cmd.sendMessageWithType.value,
                info={
                    "type": "combine",
                    "payload": {
                        "targetId": user_b,
                        "title": f"real-web-combine-inner-{uuid.uuid4().hex[:6]}",
                        "summary": "combine inner media",
                        "compatibleText": "combine inner compatible",
                        "msgIds": [first_msg_id, second_msg_id],
                    },
                    "chatType": 0,
                },
            )
            combine_sent = assert_api.get_result(sent)
            assert combine_sent["body"]["type"] == 8

            primary_device.receive_message(
                match_event_type=Cmd.onMessageSuccess.value,
                timeout=30.0,
            )
            received = secondary_device.receive_message(
                match_event_type=Cmd.onMessagesReceived.value,
                timeout=30.0,
            )
            assert received is not None
            messages = (received.get("data") or {}).get("messages")
            assert isinstance(messages, list) and messages
            combine_received = next(
                (
                    item
                    for item in messages
                    if isinstance(item, dict)
                    and item.get("to") == user_b
                    and (item.get("body") or {}).get("type") == 8
                ),
                None,
            )
            assert combine_received is not None, received

            parsed = secondary_device.call(
                "ChatManager",
                Cmd.downloadAndParseCombineMessage.value,
                info={"message": combine_received},
            )
            parsed_result = assert_api.get_result(parsed)
            assert isinstance(parsed_result, list)
            assert len(parsed_result) == 2

            file_inner = {
                "from": user_a,
                "to": user_b,
                "chatType": 0,
                "direction": 1,
                "convId": user_b,
                "msgId": f"combine-inner-file-{uuid.uuid4().hex[:8]}",
                "msgServerId": f"combine-inner-file-{uuid.uuid4().hex[:8]}",
                "body": {
                    "type": 2,
                    "displayName": "combine-file.bin",
                    "remotePath": file_url,
                    "fileSize": len(file_content),
                    "filetype": "application/octet-stream",
                },
            }
            file_attachment = secondary_device.call(
                "ChatManager",
                Cmd.downloadMessageAttachmentInCombine.value,
                info={"message": file_inner},
            )
            assert_api.assert_result_equals(file_attachment, None)

            image_inner = {
                "from": user_a,
                "to": user_b,
                "chatType": 0,
                "direction": 1,
                "convId": user_b,
                "msgId": f"combine-inner-image-{uuid.uuid4().hex[:8]}",
                "msgServerId": f"combine-inner-image-{uuid.uuid4().hex[:8]}",
                "body": {
                    "type": 1,
                    "displayName": "combine-thumb.jpg",
                    "remotePath": thumb_url,
                    "thumbnailRemotePath": thumb_url,
                    "fileSize": len(thumb_content),
                    "filetype": "image/jpeg",
                    "width": 100,
                    "height": 100,
                },
            }
            image_thumbnail = secondary_device.call(
                "ChatManager",
                Cmd.downloadMessageThumbnailInCombine.value,
                info={"message": image_inner},
            )
            assert_api.assert_result_equals(image_thumbnail, None)

            assert any(path.startswith("/combine-file.bin") for path in file_hits), file_hits
            assert any(path.startswith("/combine-thumbnail.jpg") for path in thumb_hits), thumb_hits


def test_real_web_chat_mark_all_as_read_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )

    unread_before = secondary_device.call(
        "ChatManager",
        Cmd.getUnreadMessageCount.value,
        info={},
    )
    unread_before_result = assert_api.get_result(unread_before)
    assert isinstance(unread_before_result, int)
    assert unread_before_result >= 1

    marked = secondary_device.call(
        "ChatManager",
        Cmd.markAllChatMsgAsRead.value,
        info={},
    )
    marked_result = assert_api.get_result(marked)
    assert marked_result == 1

    unread_after = secondary_device.call(
        "ChatManager",
        Cmd.getUnreadMessageCount.value,
        info={},
    )
    unread_after_result = assert_api.get_result(unread_after)
    assert unread_after_result == 0


def test_real_web_chat_conversation_marks_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    add_mark = primary_device.call(
        "ChatManager",
        Cmd.addRemoteAndLocalConversationsMark.value,
        info={"convIds": [user_b], "mark": 2},
    )
    assert_api.assert_result_equals(add_mark, True)

    marked_conversations = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsByOptions.value,
        info={"mark": 2, "pageSize": 10, "cursor": "", "pinned": False},
    )
    marked_conversations_result = assert_api.get_result(marked_conversations)
    assert isinstance(marked_conversations_result, dict)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and 2 in (item.get("marks") or [])
        for item in (marked_conversations_result.get("list") or [])
    ), marked_conversations_result

    conversation = primary_device.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": False},
    )
    conversation_result = assert_api.get_result(conversation)
    assert isinstance(conversation_result, dict)
    assert conversation_result.get("convId") == user_b
    assert conversation_result.get("convId") == user_b

    delete_mark = primary_device.call(
        "ChatManager",
        Cmd.deleteRemoteAndLocalConversationsMark.value,
        info={"convIds": [user_b], "mark": 2},
    )
    assert_api.assert_result_equals(delete_mark, True)

    marked_after_delete = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsByOptions.value,
        info={"mark": 2, "pageSize": 10, "cursor": "", "pinned": False},
    )
    marked_after_delete_result = assert_api.get_result(marked_after_delete)
    assert isinstance(marked_after_delete_result, dict)
    assert not any(
        isinstance(item, dict) and item.get("convId") == user_b
        for item in (marked_after_delete_result.get("list") or [])
    ), marked_after_delete_result

    conversation_after = primary_device.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": False},
    )
    conversation_after_result = assert_api.get_result(conversation_after)
    assert isinstance(conversation_after_result, dict)
    assert conversation_after_result.get("convId") == user_b


def test_real_web_chat_clear_all_messages_and_conversations_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)

    conversations_before = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServer.value,
        info={},
    )
    conversations_before_result = assert_api.get_result(conversations_before)
    assert isinstance(conversations_before_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in conversations_before_result
    ), conversations_before_result

    cleared = primary_device.call(
        "ChatManager",
        Cmd.deleteAllMessageAndConversation.value,
        info={},
    )
    assert_api.assert_result_equals(cleared, True)

    conversations_after = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServer.value,
        info={},
    )
    conversations_after_result = assert_api.get_result(conversations_after)
    assert isinstance(conversations_after_result, list)
    assert not any(
        isinstance(item, dict)
        and item.get("convId") == user_b
        and item.get("type") == 0
        for item in conversations_after_result
    ), conversations_after_result


def test_real_web_chat_conversation_has_read_event_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )

    ack = secondary_device.call(
        "ChatManager",
        Cmd.ackConversationRead.value,
        info={
            "convId": user_a,
            "convType": 0,
        },
    )
    assert_api.assert_result_equals(ack, 1)

    event = primary_device.receive_message(
        match_event_type=Cmd.onConversationHasRead.value,
        timeout=20.0,
    )
    assert event is not None
    assert event.get("eventType") == Cmd.onConversationHasRead.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("from") == user_b
    assert data.get("to") == user_a
