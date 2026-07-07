"""Real Web SDK/service ConversationManager E2E cases."""

from __future__ import annotations

import contextlib
import json
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from src import Cmd, GroupChangeEvent
from src.tools.config import (
    get_rest_authorization_header,
    get_rest_base_url,
    get_rest_verify_ssl,
)
from tests.chat._utils import build_text
from tests.web_real.test_real_web_chat_server import (
    _history_contains_message,
    _send_real_text,
)


pytestmark = [pytest.mark.web, pytest.mark.chat, pytest.mark.real_web]


@contextlib.contextmanager
def _download_server(content: bytes):
    hits: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "text/plain")
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


def _send_real_text_content(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
    content: str,
) -> str:
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

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
    return msg_id


def _build_group_text(from_user: str, group_id: str, content: str) -> dict:
    return {
        "from": from_user,
        "to": group_id,
        "chatType": 1,
        "body": {
            "type": 0,
            "content": content,
        },
        "hasDeliverAck": False,
        "hasReadAck": False,
    }


def _fetch_group_detail_rest_raw(group_id: str) -> dict:
    base_url = get_rest_base_url().rstrip("/")
    auth = get_rest_authorization_header()
    if not base_url or not auth:
        return {"error": "rest_api base_url/auth not configured"}
    group_enc = urllib.parse.quote(group_id, safe="")
    url = f"{base_url}/chatgroups/{group_enc}?joined_time=true&version=v3"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": auth,
        },
    )
    try:
        if get_rest_verify_ssl():
            response = urllib.request.urlopen(req, timeout=30)
        else:
            response = urllib.request.urlopen(
                req,
                timeout=30,
                context=ssl._create_unverified_context(),
            )
        with response:
            raw = response.read().decode()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else ""
        return {"error": f"HTTP {exc.code}", "body": body}


def test_real_web_conversation_manager_server_reads(
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

    latest = primary_device.call(
        "ConversationManager",
        Cmd.getLatestMessage.value,
        info={"convId": user_b, "type": 0},
    )
    latest_result = assert_api.get_result(latest)
    assert isinstance(latest_result, dict)
    assert latest_result.get("msgId") == msg_id
    assert latest_result.get("convId") == user_b
    assert (latest_result.get("body") or {}).get("content") == content

    latest_from_others = secondary_device.call(
        "ConversationManager",
        Cmd.getLatestMessageFromOthers.value,
        info={"convId": user_a, "type": 0},
    )
    latest_from_others_result = assert_api.get_result(latest_from_others)
    assert isinstance(latest_from_others_result, dict)
    assert latest_from_others_result.get("msgId") == msg_id
    assert latest_from_others_result.get("direction") == 1
    assert (latest_from_others_result.get("body") or {}).get("content") == content

    loaded = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithId.value,
        info={"convId": user_b, "type": 0, "msgId": msg_id},
    )
    loaded_result = assert_api.get_result(loaded)
    assert isinstance(loaded_result, dict)
    assert loaded_result.get("msgId") == msg_id
    assert (loaded_result.get("body") or {}).get("content") == content

    count = primary_device.call(
        "ConversationManager",
        Cmd.messageCount.value,
        info={"convId": user_b, "type": 0},
    )
    count_result = assert_api.get_result(count)
    assert isinstance(count_result, int)
    assert count_result >= 1

    unread = secondary_device.call(
        "ConversationManager",
        Cmd.getUnreadMsgCount.value,
        info={"convId": user_a, "type": 0},
    )
    unread_result = assert_api.get_result(unread)
    assert isinstance(unread_result, int)
    assert unread_result >= 1


def test_real_web_conversation_manager_server_history_filters(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    marker = uuid.uuid4().hex[:8]
    first_content = f"real-web-conv-filter-alpha-{marker}"
    second_content = f"real-web-conv-filter-beta-{marker}"
    first_msg_id = _send_real_text_content(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
        first_content,
    )
    time.sleep(1)
    second_msg_id = _send_real_text_content(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
        second_content,
    )
    time.sleep(2)

    history = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": user_b, "type": 0, "pageSize": 20, "cursor": ""},
    )
    history_result = assert_api.get_result(history)
    assert isinstance(history_result, dict)
    history_messages = history_result.get("list")
    assert isinstance(history_messages, list)
    history_ids = {item.get("msgId") for item in history_messages}
    assert {first_msg_id, second_msg_id}.issubset(history_ids), history_result

    with_start = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithStartId.value,
        info={
            "convId": user_b,
            "type": 0,
            "startId": second_msg_id,
            "count": 20,
            "direction": 0,
        },
    )
    with_start_result = assert_api.get_result(with_start)
    assert isinstance(with_start_result, list)
    assert any(item.get("msgId") == first_msg_id for item in with_start_result)
    assert all(item.get("msgId") != second_msg_id for item in with_start_result)

    keyword = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithKeywords.value,
        info={"convId": user_b, "type": 0, "keywords": marker, "count": 20},
    )
    keyword_result = assert_api.get_result(keyword)
    assert isinstance(keyword_result, list)
    keyword_ids = {item.get("msgId") for item in keyword_result}
    assert {first_msg_id, second_msg_id}.issubset(keyword_ids)

    msg_type = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithMsgType.value,
        info={"convId": user_b, "type": 0, "msgType": 0, "count": 20},
    )
    msg_type_result = assert_api.get_result(msg_type)
    assert isinstance(msg_type_result, list)
    type_ids = {item.get("msgId") for item in msg_type_result}
    assert {first_msg_id, second_msg_id}.issubset(type_ids)

    with_time = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithTime.value,
        info={
            "convId": user_b,
            "type": 0,
            "startTime": 0,
            "endTime": int(time.time() * 1000) + 60_000,
            "count": 20,
        },
    )
    with_time_result = assert_api.get_result(with_time)
    assert isinstance(with_time_result, list)
    time_ids = {item.get("msgId") for item in with_time_result}
    assert {first_msg_id, second_msg_id}.issubset(time_ids)


def test_real_web_conversation_manager_server_delete_messages(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    content_by_id, msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, msg_id, content_by_id)

    delete_by_id = primary_device.call(
        "ConversationManager",
        Cmd.deleteMessageByIds.value,
        info={"convId": user_b, "type": 0, "messageIds": [msg_id]},
    )
    assert_api.assert_result_equals(delete_by_id, None)
    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, msg_id, content_by_id)

    content_by_ts, ts_msg_id = _send_real_text(
        primary_device,
        secondary_device,
        assert_api,
        user_a,
        user_b,
    )
    time.sleep(2)
    assert _history_contains_message(primary_device, assert_api, user_b, ts_msg_id, content_by_ts)

    remove_before = primary_device.call(
        "ConversationManager",
        Cmd.removeMsgFromServerWithTimeStamp.value,
        info={
            "convId": user_b,
            "type": 0,
            "timestamp": int(time.time() * 1000) + 1000,
        },
    )
    assert_api.assert_result_equals(remove_before, None)
    time.sleep(2)
    assert not _history_contains_message(primary_device, assert_api, user_b, ts_msg_id, content_by_ts)


def test_real_web_message_reaction_list_reads_server_state(
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
    reaction = f"msg-reaction-{uuid.uuid4().hex[:6]}"

    add = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": msg_id, "reaction": reaction},
    )
    assert_api.assert_result_equals(add, True)
    time.sleep(2)

    message_reactions = primary_device.call(
        "MessageManager",
        Cmd.getReactionList.value,
        info={"msgId": msg_id, "chatType": 0},
    )
    reaction_result = assert_api.get_result(message_reactions)
    assert isinstance(reaction_result, list)
    assert any(
        isinstance(item, dict)
        and item.get("reaction") == reaction
        and item.get("count", 0) >= 1
        for item in reaction_result
    ), reaction_result


def test_real_web_group_ack_count_reads_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_name = f"real-web-group-ack-{uuid.uuid4().hex[:8]}"
    group_id = None
    try:
        create = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": group_name,
                "inviteMembers": [user_b],
                "options": {
                    "style": 1,
                    "maxCount": 20,
                    "inviteNeedConfirm": False,
                    "ext": group_name,
                },
            },
        )
        group = assert_api.get_result(create)
        assert isinstance(group, dict)
        group_id = group.get("groupId")
        assert isinstance(group_id, str) and group_id

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        content = f"real-web-group-ack-msg-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info={
                **build_text(user_a, group_id, content, chat_type=1),
                "needGroupAck": True,
            },
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

        ack = secondary_device.call(
            "ChatManager",
            Cmd.ackGroupMessageRead.value,
            info={"msgId": msg_id, "group_id": group_id, "content": "read"},
        )
        assert_api.assert_result_equals(ack, 1)

        group_ack_result = {}
        ack_items = []
        for _ in range(10):
            time.sleep(2)
            group_acks = primary_device.call(
                "ChatManager",
                Cmd.asyncFetchGroupAcks.value,
                info={"msgId": msg_id, "group_id": group_id, "pageSize": 20},
            )
            group_ack_result = assert_api.get_result(group_acks)
            assert isinstance(group_ack_result, dict)
            ack_items = group_ack_result.get("list")
            assert isinstance(ack_items, list)
            if any(
                isinstance(item, dict)
                and item.get("msgId") == msg_id
                and item.get("from") == user_b
                for item in ack_items
            ):
                break
        else:
            debug_resp = primary_device.call("Client", "getRealSdkDebug", info={})
            debug = assert_api.get_result(debug_resp)
            pytest.fail(f"group ack list is empty: result={group_ack_result!r}; debug={debug!r}")

        count = primary_device.call(
            "MessageManager",
            Cmd.groupAckCount.value,
            info={"msgId": msg_id, "group_id": group_id},
        )
        count_result = assert_api.get_result(count)
        assert isinstance(count_result, int)
        assert count_result >= 1
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


@pytest.mark.xfail(
    reason="imsdk runtime does not deliver a verified real onGroupChanged callback for group announcement updates",
    strict=False,
)
def test_real_web_group_announcement_changed_event_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.5)
    secondary_device.drain_events(timeout=0.5)

    group_id = ""
    try:
        create = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": f"web-real-group-ann-{uuid.uuid4().hex[:8]}",
                "desc": "real group announcement event",
                "inviteMembers": [user_b],
                "options": {"maxUserCount": 200, "style": 0},
            },
        )
        group = assert_api.get_result(create)
        group_id = group["groupId"]
        primary_device.drain_events(timeout=0.5)

        announcement = f"real-group-ann-{uuid.uuid4().hex[:8]}"
        update = primary_device.call(
            "GroupManager",
            Cmd.updateGroupAnnouncement.value,
            info={"groupId": group_id, "announcement": announcement},
        )
        assert_api.assert_success(update)
        assert_api.assert_result_equals(update, None)

        join_event = secondary_device.receive_message(
            match_event_type=Cmd.onGroupChanged.value,
            timeout=10.0,
        )
        if join_event is not None:
            join_data = join_event.get("data")
            if (
                isinstance(join_data, dict)
                and join_data.get("type") == GroupChangeEvent.ON_MEMBER_JOINED.value
                and join_data.get("groupId") == group_id
            ):
                return

        event = secondary_device.receive_message(
            match_event_type=Cmd.onGroupChanged.value,
            timeout=10.0,
        )
        if event is None:
            debug_b = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(f"missing onGroupChanged event; debug={debug_b!r}")
        assert event.get("eventType") == Cmd.onGroupChanged.value
        data = event.get("data")
        assert isinstance(data, dict)
        assert data.get("type") == GroupChangeEvent.ON_ANNOUNCEMENT_CHANGED.value
        assert data.get("groupId") == group_id
        assert data.get("announcement") == announcement
        assert data.get("operation") == "announcement"
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_message_read_events_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    try:
        create = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": f"web-real-group-read-{uuid.uuid4().hex[:8]}",
                "desc": "real group read events",
                "inviteMembers": [user_b],
                "options": {"maxUserCount": 200, "style": 0},
            },
        )
        group = assert_api.get_result(create)
        group_id = group["groupId"]

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        content = f"real-web-group-read-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info={
                **build_text(user_a, group_id, content, chat_type=1),
                "needGroupAck": True,
            },
        )
        sent_message = assert_api.get_result(sent)
        assert sent_message["body"] == {"type": 0, "content": content}

        success = primary_device.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        assert success is not None
        msg_id = ((success.get("data") or {}).get("msg") or {}).get("msgId")
        assert isinstance(msg_id, str) and msg_id

        received = secondary_device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=30.0,
        )
        assert received is not None

        ack = secondary_device.call(
            "ChatManager",
            Cmd.ackGroupMessageRead.value,
            info={"msgId": msg_id, "group_id": group_id, "content": "read"},
        )
        assert_api.assert_result_equals(ack, 1)

        group_read = primary_device.receive_message(
            match_event_type=Cmd.onGroupMessageRead.value,
            timeout=20.0,
        )
        if group_read is None:
            debug_resp = primary_device.call("Client", "getRealSdkDebug", info={})
            debug = assert_api.get_result(debug_resp)
            pytest.fail(f"missing onGroupMessageRead; debug={debug!r}")
        group_read_data = group_read.get("data")
        assert isinstance(group_read_data, dict)
        assert group_read_data.get("operation") == "group_message_read"
        acks = group_read_data.get("acks")
        assert isinstance(acks, list) and acks
        ack_item = acks[0]
        assert ack_item.get("msgId") == msg_id

        updated = primary_device.receive_message(
            match_event_type=Cmd.onReadAckForGroupMessageUpdated.value,
            timeout=5.0,
        )
        assert updated is not None
        updated_data = updated.get("data")
        assert isinstance(updated_data, dict)
        assert updated_data.get("msgId") == msg_id
        assert updated_data.get("groupId") == group_id
        assert updated_data.get("operation") == "group_message_read_ack_updated"
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_message_chat_thread_reads_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_name = f"real-web-chat-thread-{uuid.uuid4().hex[:8]}"
    group_id = None
    thread_id = None
    try:
        create_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": group_name,
                "inviteMembers": [user_b],
                "options": {
                    "style": 1,
                    "maxCount": 20,
                    "inviteNeedConfirm": False,
                    "ext": group_name,
                },
            },
        )
        group = assert_api.get_result(create_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId")
        assert isinstance(group_id, str) and group_id

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        content = f"real-web-thread-parent-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, content, chat_type=1),
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

        thread_name = f"real-web-thread-{uuid.uuid4().hex[:8]}"
        created_thread = primary_device.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={"name": thread_name, "msgId": msg_id, "parentId": group_id},
        )
        thread = assert_api.get_result(created_thread)
        assert isinstance(thread, dict)
        thread_id = thread.get("threadId")
        assert isinstance(thread_id, str) and thread_id
        assert not thread_id.startswith("web-thread-"), thread
        assert thread.get("threadName") == thread_name
        assert thread.get("msgId") == msg_id
        assert thread.get("parentId") == group_id

        debug_resp = primary_device.call("Client", "getRealSdkDebug", info={})
        debug = assert_api.get_result(debug_resp)
        assert any(
            isinstance(item, dict)
            and item.get("type") == "createChatThread_success"
            for item in debug
        ), debug

        message_thread = primary_device.call(
            "MessageManager",
            Cmd.getChatThread.value,
            info={"msgId": msg_id, "parentId": group_id},
        )
        message_thread_result = assert_api.get_result(message_thread)
        assert isinstance(message_thread_result, dict)
        assert message_thread_result.get("threadId") == thread_id
        assert message_thread_result.get("threadName") == thread_name
        assert message_thread_result.get("msgId") == msg_id
        assert message_thread_result.get("parentId") == group_id
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


@pytest.mark.xfail(
    reason=(
        "imsdk createChatThread succeeds, but the secondary real Web client "
        "does not receive onChatThreadCreate lifecycle notify/callback"
    ),
    strict=False,
)
def test_real_web_chat_thread_lifecycle_events_imsdk_runtime(
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
                "groupName": f"real-web-thread-events-{uuid.uuid4().hex[:8]}",
                "desc": "real web thread events",
                "inviteMembers": [user_b],
                "options": {"style": 1, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.5)
        secondary_device.drain_events(timeout=0.5)

        content = f"real-web-thread-event-parent-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, content, chat_type=1),
        )
        sent_message = assert_api.get_result(sent)
        assert isinstance(sent_message, dict)
        msg_id = sent_message.get("msgId")
        assert isinstance(msg_id, str) and msg_id
        primary_device.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        secondary_device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=30.0,
        )

        thread_name = f"real-web-thread-event-{uuid.uuid4().hex[:8]}"
        created_thread = primary_device.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={"name": thread_name, "msgId": msg_id, "parentId": group_id},
        )
        thread = assert_api.get_result(created_thread)
        assert isinstance(thread, dict)
        thread_id = thread.get("threadId") or ""
        assert isinstance(thread_id, str) and thread_id

        created_event = secondary_device.receive_message(
            match_event_type=Cmd.onChatThreadCreate.value,
            timeout=20.0,
        )
        if created_event is None:
            debug_b = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(f"missing onChatThreadCreate event; debug={debug_b!r}")
        assert created_event is not None
        created_data = created_event.get("data")
        assert isinstance(created_data, dict)
        assert created_data.get("threadId") == thread_id
        assert created_data.get("threadName") == thread_name
        assert created_data.get("parentId") == group_id
        assert created_data.get("operation") == "create"

        updated_name = f"real-web-thread-event-renamed-{uuid.uuid4().hex[:8]}"
        updated = primary_device.call(
            "ChatThreadManager",
            Cmd.updateChatThreadSubject.value,
            info={"threadId": thread_id, "name": updated_name},
        )
        assert_api.assert_success(updated)

        updated_event = secondary_device.receive_message(
            match_event_type=Cmd.onChatThreadUpdate.value,
            timeout=20.0,
        )
        assert updated_event is not None
        updated_data = updated_event.get("data")
        assert isinstance(updated_data, dict)
        assert updated_data.get("threadId") == thread_id
        assert updated_data.get("threadName") == updated_name
        assert updated_data.get("parentId") == group_id
        assert updated_data.get("operation") == "update"

        destroyed = primary_device.call(
            "ChatThreadManager",
            Cmd.destroyChatThread.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_success(destroyed)
        thread_id = ""

        destroyed_event = secondary_device.receive_message(
            match_event_type=Cmd.onChatThreadDestroy.value,
            timeout=20.0,
        )
        assert destroyed_event is not None
        destroyed_data = destroyed_event.get("data")
        assert isinstance(destroyed_data, dict)
        assert destroyed_data.get("threadId") == thread.get("threadId")
        assert destroyed_data.get("parentId") == group_id
        assert destroyed_data.get("operation") == "destroy"
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


def test_real_web_chat_thread_detail_and_list_server_state(
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
                "groupName": f"real-web-thread-list-group-{uuid.uuid4().hex[:8]}",
                "desc": "real web thread list group",
                "inviteMembers": [user_b],
                "options": {"style": 1, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        content = f"real-web-thread-list-parent-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, content, chat_type=1),
        )
        sent_message = assert_api.get_result(sent)
        assert isinstance(sent_message, dict)
        msg_id = sent_message.get("msgId")
        assert isinstance(msg_id, str) and msg_id

        thread_name = f"real-web-thread-list-{uuid.uuid4().hex[:8]}"
        created_thread = primary_device.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={"name": thread_name, "msgId": msg_id, "parentId": group_id},
        )
        thread = assert_api.get_result(created_thread)
        assert isinstance(thread, dict)
        thread_id = thread.get("threadId") or ""
        assert isinstance(thread_id, str) and thread_id

        detail = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadDetail.value,
            info={"threadId": thread_id},
        )
        detail_result = assert_api.get_result(detail)
        assert isinstance(detail_result, dict)
        assert detail_result.get("threadId") == thread_id
        assert detail_result.get("threadName") == thread_name
        assert detail_result.get("parentId") == group_id
        assert detail_result.get("msgId") == msg_id

        thread_conversation = primary_device.call(
            "ChatManager",
            Cmd.getThreadConversation.value,
            info={"convId": thread_id},
        )
        thread_conversation_result = assert_api.get_result(thread_conversation)
        assert isinstance(thread_conversation_result, dict)
        assert thread_conversation_result.get("convId") == thread_id
        assert thread_conversation_result.get("type") == 0
        assert thread_conversation_result.get("isThread") is True
        assert thread_conversation_result.get("unreadCount") == 0

        by_parent = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadsWithParentId.value,
            info={"parentId": group_id, "pageSize": 20},
        )
        by_parent_result = assert_api.get_result(by_parent)
        assert isinstance(by_parent_result, dict)
        by_parent_list = by_parent_result.get("list")
        assert isinstance(by_parent_list, list)
        assert any(
            isinstance(item, dict) and item.get("threadId") == thread_id
            for item in by_parent_list
        ), by_parent_result

        joined = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchJoinedChatThreads.value,
            info={"pageSize": 20},
        )
        joined_result = assert_api.get_result(joined)
        assert isinstance(joined_result, dict)
        joined_list = joined_result.get("list")
        assert isinstance(joined_list, list)
        assert any(
            isinstance(item, dict) and item.get("threadId") == thread_id
            for item in joined_list
        ), joined_result

        joined_by_parent = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchJoinedChatThreadsWithParentId.value,
            info={"parentId": group_id, "pageSize": 20},
        )
        joined_by_parent_result = assert_api.get_result(joined_by_parent)
        assert isinstance(joined_by_parent_result, dict)
        joined_by_parent_list = joined_by_parent_result.get("list")
        assert isinstance(joined_by_parent_list, list)
        assert any(
            isinstance(item, dict) and item.get("threadId") == thread_id
            for item in joined_by_parent_list
        ), joined_by_parent_result
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


def test_real_web_chat_thread_membership_and_update_server_state(
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
                "groupName": f"real-web-thread-member-group-{uuid.uuid4().hex[:8]}",
                "desc": "real web thread member group",
                "inviteMembers": [user_b],
                "options": {"style": 1, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        content = f"real-web-thread-member-parent-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, content, chat_type=1),
        )
        sent_message = assert_api.get_result(sent)
        assert isinstance(sent_message, dict)
        msg_id = sent_message.get("msgId")
        assert isinstance(msg_id, str) and msg_id

        thread_name = f"real-web-thread-member-{uuid.uuid4().hex[:8]}"
        created_thread = primary_device.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={"name": thread_name, "msgId": msg_id, "parentId": group_id},
        )
        thread = assert_api.get_result(created_thread)
        assert isinstance(thread, dict)
        thread_id = thread.get("threadId") or ""
        assert isinstance(thread_id, str) and thread_id

        members_before_join = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadMember.value,
            info={"threadId": thread_id, "pageSize": 20},
        )
        members_before_join_result = assert_api.get_result(members_before_join)
        assert isinstance(members_before_join_result, dict)
        members_before_join_list = members_before_join_result.get("list")
        assert isinstance(members_before_join_list, list)
        assert user_a in members_before_join_list

        joined = secondary_device.call(
            "ChatThreadManager",
            Cmd.joinChatThread.value,
            info={"threadId": thread_id},
        )
        joined_result = assert_api.get_result(joined)
        assert isinstance(joined_result, dict)
        assert joined_result.get("threadId") == thread_id

        members_after_join = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadMember.value,
            info={"threadId": thread_id, "pageSize": 20},
        )
        members_after_join_result = assert_api.get_result(members_after_join)
        assert isinstance(members_after_join_result, dict)
        members_after_join_list = members_after_join_result.get("list")
        assert isinstance(members_after_join_list, list)
        assert user_a in members_after_join_list
        assert user_b in members_after_join_list

        updated_name = f"real-web-thread-renamed-{uuid.uuid4().hex[:8]}"
        updated = primary_device.call(
            "ChatThreadManager",
            Cmd.updateChatThreadSubject.value,
            info={"threadId": thread_id, "name": updated_name},
        )
        assert_api.assert_success(updated)

        detail_after_update = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadDetail.value,
            info={"threadId": thread_id},
        )
        detail_after_update_result = assert_api.get_result(detail_after_update)
        assert isinstance(detail_after_update_result, dict)
        assert detail_after_update_result.get("threadName") == updated_name

        left = secondary_device.call(
            "ChatThreadManager",
            Cmd.leaveChatThread.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_success(left)

        members_after_leave = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadMember.value,
            info={"threadId": thread_id, "pageSize": 20},
        )
        members_after_leave_result = assert_api.get_result(members_after_leave)
        assert isinstance(members_after_leave_result, dict)
        members_after_leave_list = members_after_leave_result.get("list")
        assert isinstance(members_after_leave_list, list)
        assert user_b not in members_after_leave_list

        secondary_device.call(
            "ChatThreadManager",
            Cmd.joinChatThread.value,
            info={"threadId": thread_id},
        )

        removed = primary_device.call(
            "ChatThreadManager",
            Cmd.removeMemberFromChatThread.value,
            info={"threadId": thread_id, "memberId": user_b},
        )
        assert_api.assert_success(removed)

        members_after_remove = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadMember.value,
            info={"threadId": thread_id, "pageSize": 20},
        )
        members_after_remove_result = assert_api.get_result(members_after_remove)
        assert isinstance(members_after_remove_result, dict)
        members_after_remove_list = members_after_remove_result.get("list")
        assert isinstance(members_after_remove_list, list)
        assert user_b not in members_after_remove_list
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


@pytest.mark.xfail(
    reason=(
        "imsdk removeMemberFromChatThread succeeds, but the removed secondary "
        "real Web client may not receive onUserKickOutOfChatThread lifecycle callback"
    ),
    strict=False,
)
def test_real_web_chat_thread_user_kicked_event_imsdk_runtime(
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
                "groupName": f"real-web-thread-kick-group-{uuid.uuid4().hex[:8]}",
                "desc": "real web thread kick events",
                "inviteMembers": [user_b],
                "options": {"style": 1, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.5)
        secondary_device.drain_events(timeout=0.5)

        content = f"real-web-thread-kick-parent-{uuid.uuid4().hex[:8]}"
        sent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, content, chat_type=1),
        )
        sent_message = assert_api.get_result(sent)
        assert isinstance(sent_message, dict)
        msg_id = sent_message.get("msgId")
        assert isinstance(msg_id, str) and msg_id
        primary_device.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        secondary_device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=30.0,
        )

        thread_name = f"real-web-thread-kick-{uuid.uuid4().hex[:8]}"
        created_thread = primary_device.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={"name": thread_name, "msgId": msg_id, "parentId": group_id},
        )
        thread = assert_api.get_result(created_thread)
        assert isinstance(thread, dict)
        thread_id = thread.get("threadId") or ""
        assert isinstance(thread_id, str) and thread_id

        joined = secondary_device.call(
            "ChatThreadManager",
            Cmd.joinChatThread.value,
            info={"threadId": thread_id},
        )
        joined_result = assert_api.get_result(joined)
        assert isinstance(joined_result, dict)
        assert joined_result.get("threadId") == thread_id

        removed = primary_device.call(
            "ChatThreadManager",
            Cmd.removeMemberFromChatThread.value,
            info={"threadId": thread_id, "memberId": user_b},
        )
        assert_api.assert_success(removed)

        kicked_event = secondary_device.receive_message(
            match_event_type=Cmd.onUserKickOutOfChatThread.value,
            timeout=20.0,
        )
        if kicked_event is None:
            debug_b = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(
                "missing onUserKickOutOfChatThread event; "
                f"threadId={thread_id}, debug={debug_b!r}"
            )
        assert kicked_event is not None
        kicked_data = kicked_event.get("data")
        assert isinstance(kicked_data, dict)
        assert kicked_data.get("threadId") == thread_id
        assert kicked_data.get("threadName") == thread_name
        assert kicked_data.get("parentId") == group_id
        assert kicked_data.get("userId") == user_b
        assert kicked_data.get("operation") == "user_kicked"
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


def test_real_web_chat_thread_last_message_server_state(
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
                "groupName": f"real-web-thread-lastmsg-group-{uuid.uuid4().hex[:8]}",
                "desc": "real web thread last message group",
                "inviteMembers": [user_b],
                "options": {"style": 1, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        parent_content = f"real-web-thread-lastmsg-parent-{uuid.uuid4().hex[:8]}"
        sent_parent = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_a, group_id, parent_content, chat_type=1),
        )
        sent_parent_message = assert_api.get_result(sent_parent)
        assert isinstance(sent_parent_message, dict)
        parent_msg_id = sent_parent_message.get("msgId")
        assert isinstance(parent_msg_id, str) and parent_msg_id

        created_thread = primary_device.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={
                "name": f"real-web-thread-lastmsg-{uuid.uuid4().hex[:8]}",
                "msgId": parent_msg_id,
                "parentId": group_id,
            },
        )
        thread = assert_api.get_result(created_thread)
        assert isinstance(thread, dict)
        thread_id = thread.get("threadId") or ""
        assert isinstance(thread_id, str) and thread_id

        time.sleep(2)

        last_messages = primary_device.call(
            "ChatThreadManager",
            Cmd.fetchLastMessageWithChatThreads.value,
            info={"threadIds": [thread_id]},
        )
        last_messages_result = assert_api.get_result(last_messages)
        assert isinstance(last_messages_result, dict)
        last_message = last_messages_result.get(thread_id)
        if not isinstance(last_message, dict) or last_message == {}:
            debug_a = assert_api.get_result(
                primary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(
                "thread last-message result missing or empty: "
                f"thread_id={thread_id}; result={last_messages_result!r}; "
                f"debug={debug_a!r}"
            )
        assert last_message.get("msgId") == parent_msg_id
        assert (last_message.get("body") or {}).get("content") == parent_content
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


def test_real_web_group_lifecycle_and_server_reads(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-{uuid.uuid4().hex[:8]}"
    updated_name = f"real-web-group-renamed-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web group initial",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id
        assert group.get("name") == group_name

        local_detail = primary_device.call(
            "GroupManager",
            Cmd.getGroupWithId.value,
            info={"groupId": group_id},
        )
        local_detail_result = assert_api.get_result(local_detail)
        assert isinstance(local_detail_result, dict)
        assert local_detail_result.get("groupId") == group_id
        assert local_detail_result.get("name") == group_name

        joined = primary_device.call(
            "GroupManager",
            Cmd.getJoinedGroups.value,
            info={},
        )
        joined_result = assert_api.get_result(joined)
        assert isinstance(joined_result, list)
        assert any(
            isinstance(item, dict) and item.get("groupId") == group_id
            for item in joined_result
        ), joined_result

        joined_server = primary_device.call(
            "GroupManager",
            Cmd.getJoinedGroupsFromServer.value,
            info={"pageSize": 20, "pageNum": 0, "needMemberCount": True, "needRole": True},
        )
        joined_server_result = assert_api.get_result(joined_server)
        assert isinstance(joined_server_result, list)
        assert any(
            isinstance(item, dict) and item.get("groupId") == group_id
            for item in joined_server_result
        ), joined_server_result

        spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        spec_result = assert_api.get_result(spec)
        assert isinstance(spec_result, dict)
        assert spec_result.get("groupId") == group_id
        assert spec_result.get("owner") == user_a

        members = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 20, "cursor": ""},
        )
        members_result = assert_api.get_result(members)
        assert isinstance(members_result, dict)
        member_list = members_result.get("list")
        assert isinstance(member_list, list)
        assert user_a in member_list
        assert user_b in member_list

        count = primary_device.call(
            "GroupManager",
            Cmd.fetchJoinedGroupCount.value,
            info={},
        )
        count_result = assert_api.get_result(count)
        assert isinstance(count_result, int)
        assert count_result >= 1

        update_name = primary_device.call(
            "GroupManager",
            Cmd.updateGroupSubject.value,
            info={"groupId": group_id, "name": updated_name},
        )
        assert_api.assert_success(update_name)

        updated_spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id},
        )
        updated_spec_result = assert_api.get_result(updated_spec)
        assert isinstance(updated_spec_result, dict)
        assert updated_spec_result.get("groupId") == group_id
        # Current real Web detailed group read still returns groupId in `name`.
        assert updated_spec_result.get("name") in {group_id, updated_name}

        leave = secondary_device.call(
            "GroupManager",
            Cmd.leaveGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(leave)

        members_after_leave = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 20, "cursor": ""},
        )
        members_after_leave_result = assert_api.get_result(members_after_leave)
        assert isinstance(members_after_leave_result, dict)
        member_list_after_leave = members_after_leave_result.get("list")
        assert isinstance(member_list_after_leave, list)
        assert user_b not in member_list_after_leave
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_public_list_server_reads(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-public-group-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web public group",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        public_groups = primary_device.call(
            "GroupManager",
            Cmd.getPublicGroupsFromServer.value,
            info={"pageSize": 20, "cursor": ""},
        )
        public_result = assert_api.get_result(public_groups)
        assert isinstance(public_result, dict)
        assert isinstance(public_result.get("cursor"), str)
        public_list = public_result.get("list")
        assert isinstance(public_list, list)
        assert any(
            isinstance(item, dict)
            and item.get("groupId") == group_id
            and item.get("name") == group_name
            for item in public_list
        ), public_result
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_update_description_executes_but_desc_not_readable(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-group-desc-{uuid.uuid4().hex[:8]}"
    updated_desc = f"real-web-group-desc-value-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web desc initial",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        update_desc_call = primary_device.call(
            "GroupManager",
            Cmd.updateDescription.value,
            info={"groupId": group_id, "desc": updated_desc},
        )
        assert_api.assert_success(update_desc_call)

        local_detail = primary_device.call(
            "GroupManager",
            Cmd.getGroupWithId.value,
            info={"groupId": group_id},
        )
        local_detail_result = assert_api.get_result(local_detail)
        assert isinstance(local_detail_result, dict)
        assert local_detail_result.get("groupId") == group_id
        assert local_detail_result.get("desc") is None

        spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id},
        )
        spec_result = assert_api.get_result(spec)
        assert isinstance(spec_result, dict)
        assert spec_result.get("groupId") == group_id
        assert spec_result.get("desc") == updated_desc
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_admin_mute_white_and_announcement_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-manage-{uuid.uuid4().hex[:8]}"
    announcement = f"real-web-group-announcement-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web manage group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        add_admin = primary_device.call(
            "GroupManager",
            Cmd.addAdmin.value,
            info={"groupId": group_id, "admin": user_b},
        )
        assert_api.assert_success(add_admin)

        spec_after_add_admin = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        spec_after_add_admin_result = assert_api.get_result(spec_after_add_admin)
        assert isinstance(spec_after_add_admin_result, dict)
        spec_admin_list = spec_after_add_admin_result.get("adminList")
        assert isinstance(spec_admin_list, list)
        assert user_b in spec_admin_list

        remove_admin = primary_device.call(
            "GroupManager",
            Cmd.removeAdmin.value,
            info={"groupId": group_id, "admin": user_b},
        )
        assert_api.assert_success(remove_admin)

        spec_after_remove_admin = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        spec_after_remove_admin_result = assert_api.get_result(spec_after_remove_admin)
        assert isinstance(spec_after_remove_admin_result, dict)
        admin_list_after_remove = spec_after_remove_admin_result.get("adminList")
        assert isinstance(admin_list_after_remove, list)
        assert user_b not in admin_list_after_remove

        mute_member = primary_device.call(
            "GroupManager",
            Cmd.muteMembers.value,
            info={"groupId": group_id, "members": [user_b], "duration": 60},
        )
        assert_api.assert_success(mute_member)

        secondary_muted = secondary_device.call(
            "GroupManager",
            Cmd.isMemberInGroupMuteList.value,
            info={"groupId": group_id},
        )
        secondary_muted_result = assert_api.get_result(secondary_muted)
        assert secondary_muted_result is True

        mute_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupMuteListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list_result = assert_api.get_result(mute_list)
        assert isinstance(mute_list_result, dict)
        muted_members = mute_list_result.get("list")
        assert isinstance(muted_members, list)
        if muted_members:
          assert user_b in muted_members

        unmute_member = primary_device.call(
            "GroupManager",
            Cmd.unMuteMembers.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert_api.assert_success(unmute_member)

        secondary_muted_after = secondary_device.call(
            "GroupManager",
            Cmd.isMemberInGroupMuteList.value,
            info={"groupId": group_id},
        )
        secondary_muted_after_result = assert_api.get_result(secondary_muted_after)
        assert secondary_muted_after_result is False

        mute_list_after = primary_device.call(
            "GroupManager",
            Cmd.getGroupMuteListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list_after_result = assert_api.get_result(mute_list_after)
        assert isinstance(mute_list_after_result, dict)
        muted_members_after = mute_list_after_result.get("list")
        assert isinstance(muted_members_after, list)
        assert user_b not in muted_members_after

        add_white = primary_device.call(
            "GroupManager",
            Cmd.addWhiteList.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        add_white_result = assert_api.get_result(add_white)
        assert add_white_result is True

        white_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        white_list_result = assert_api.get_result(white_list)
        assert isinstance(white_list_result, list)
        assert user_b in white_list_result

        primary_in_white = primary_device.call(
            "GroupManager",
            Cmd.isMemberInWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        primary_in_white_result = assert_api.get_result(primary_in_white)
        assert isinstance(primary_in_white_result, bool)

        remove_white = primary_device.call(
            "GroupManager",
            Cmd.removeWhiteList.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        remove_white_result = assert_api.get_result(remove_white)
        assert remove_white_result is True

        white_list_after = primary_device.call(
            "GroupManager",
            Cmd.getGroupWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        white_list_after_result = assert_api.get_result(white_list_after)
        assert isinstance(white_list_after_result, list)
        assert user_b not in white_list_after_result

        update_announcement = primary_device.call(
            "GroupManager",
            Cmd.updateGroupAnnouncement.value,
            info={"groupId": group_id, "announcement": announcement},
        )
        assert_api.assert_success(update_announcement)

        fetched_announcement = primary_device.call(
            "GroupManager",
            Cmd.getGroupAnnouncementFromServer.value,
            info={"groupId": group_id},
        )
        fetched_announcement_result = assert_api.get_result(fetched_announcement)
        assert fetched_announcement_result == announcement
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_admin_server_state(
    primary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-admin-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web admin group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        add_admin = primary_device.call(
            "GroupManager",
            Cmd.addAdmin.value,
            info={"groupId": group_id, "admin": user_b},
        )
        assert_api.assert_success(add_admin)

        spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        spec_result = assert_api.get_result(spec)
        assert isinstance(spec_result, dict)
        assert user_b in (spec_result.get("adminList") or [])

        remove_admin = primary_device.call(
            "GroupManager",
            Cmd.removeAdmin.value,
            info={"groupId": group_id, "admin": user_b},
        )
        assert_api.assert_success(remove_admin)

        spec_after_remove = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        spec_after_remove_result = assert_api.get_result(spec_after_remove)
        assert isinstance(spec_after_remove_result, dict)
        assert user_b not in (spec_after_remove_result.get("adminList") or [])
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_white_list_and_announcement_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-white-{uuid.uuid4().hex[:8]}"
    announcement = f"real-web-group-announcement-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web white list group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        add_white = primary_device.call(
            "GroupManager",
            Cmd.addWhiteList.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(add_white) is True

        white_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        white_list_result = assert_api.get_result(white_list)
        assert isinstance(white_list_result, list)
        assert user_b in white_list_result

        remove_white = primary_device.call(
            "GroupManager",
            Cmd.removeWhiteList.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(remove_white) is True

        white_list_after = primary_device.call(
            "GroupManager",
            Cmd.getGroupWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        white_list_after_result = assert_api.get_result(white_list_after)
        assert isinstance(white_list_after_result, list)
        assert user_b not in white_list_after_result

        update_announcement = primary_device.call(
            "GroupManager",
            Cmd.updateGroupAnnouncement.value,
            info={"groupId": group_id, "announcement": announcement},
        )
        assert_api.assert_success(update_announcement)

        fetched_announcement = primary_device.call(
            "GroupManager",
            Cmd.getGroupAnnouncementFromServer.value,
            info={"groupId": group_id},
        )
        assert assert_api.get_result(fetched_announcement) == announcement
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_block_and_unblock_server_state(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-group-block-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web block group",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        blocked = primary_device.call(
            "GroupManager",
            Cmd.blockGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(blocked)

        local_after_block = primary_device.call(
            "GroupManager",
            Cmd.getGroupWithId.value,
            info={"groupId": group_id},
        )
        local_after_block_result = assert_api.get_result(local_after_block)
        assert isinstance(local_after_block_result, dict)
        assert local_after_block_result.get("groupId") == group_id
        assert local_after_block_result.get("messageBlocked") is False
        assert local_after_block_result.get("isDisabled") is False

        unblocked = primary_device.call(
            "GroupManager",
            Cmd.unblockGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(unblocked)

        local_after_unblock = primary_device.call(
            "GroupManager",
            Cmd.getGroupWithId.value,
            info={"groupId": group_id},
        )
        local_after_unblock_result = assert_api.get_result(local_after_unblock)
        assert isinstance(local_after_unblock_result, dict)
        assert local_after_unblock_result.get("groupId") == group_id
        assert local_after_unblock_result.get("messageBlocked") is False
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_block_list_server_state(
    primary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-block-list-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web block list group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        block_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupBlockListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        block_list_result = assert_api.get_result(block_list)
        assert isinstance(block_list_result, dict)
        blocked_users = block_list_result.get("list")
        assert isinstance(blocked_users, list)
        assert blocked_users == []
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_block_and_unblock_members_server_state(
    primary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-block-members-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web block members group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        block_member = primary_device.call(
            "GroupManager",
            Cmd.blockMembers.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(block_member) is True

        blocked_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupBlockListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        blocked_list_result = assert_api.get_result(blocked_list)
        assert isinstance(blocked_list_result, dict)
        blocked_users = blocked_list_result.get("list")
        assert isinstance(blocked_users, list)
        assert user_b in blocked_users

        unblock_member = primary_device.call(
            "GroupManager",
            Cmd.unblockMembers.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(unblock_member) is True

        blocked_list_after = primary_device.call(
            "GroupManager",
            Cmd.getGroupBlockListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        blocked_list_after_result = assert_api.get_result(blocked_list_after)
        assert isinstance(blocked_list_after_result, dict)
        blocked_users_after = blocked_list_after_result.get("list")
        assert isinstance(blocked_users_after, list)
        assert user_b not in blocked_users_after
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_add_and_remove_members_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-members-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web add remove group members",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        add_member = primary_device.call(
            "GroupManager",
            Cmd.addMembers.value,
            info={
                "groupId": group_id,
                "members": [user_b],
                "welcome": "welcome",
            },
        )
        assert assert_api.get_result(add_member) is True

        members_after_add = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 50},
        )
        members_after_add_result = assert_api.get_result(members_after_add)
        assert isinstance(members_after_add_result, dict)
        add_user_ids = members_after_add_result.get("list")
        assert isinstance(add_user_ids, list)
        assert user_b in add_user_ids

        remove_member = primary_device.call(
            "GroupManager",
            Cmd.removeMembers.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(remove_member) is True

        members_after_remove = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 50},
        )
        members_after_remove_result = assert_api.get_result(members_after_remove)
        assert isinstance(members_after_remove_result, dict)
        remove_user_ids = members_after_remove_result.get("list")
        assert isinstance(remove_user_ids, list)
        assert user_b not in remove_user_ids
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_inviter_and_accept_invitation_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-invite-confirm-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web invite confirm group",
                "inviteMembers": [],
                "options": {
                    "style": 2,
                    "maxCount": 200,
                    "inviteNeedConfirm": True,
                },
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        invited = primary_device.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={
                "groupId": group_id,
                "members": [user_b],
                "reason": "real web invite confirm",
            },
        )
        assert assert_api.get_result(invited) is True

        accepted = secondary_device.call(
            "GroupManager",
            Cmd.acceptInvitationFromGroup.value,
            info={"groupId": group_id, "inviter": user_a},
        )
        accepted_result = assert_api.get_result(accepted)
        assert accepted_result is None or isinstance(accepted_result, dict)

        members_after_accept = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 50},
        )
        members_after_accept_result = assert_api.get_result(members_after_accept)
        assert isinstance(members_after_accept_result, dict)
        user_ids = members_after_accept_result.get("list")
        assert isinstance(user_ids, list)
        assert user_b in user_ids
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_inviter_and_decline_invitation_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-invite-decline-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web invite decline group",
                "inviteMembers": [],
                "options": {
                    "style": 2,
                    "maxCount": 200,
                    "inviteNeedConfirm": True,
                },
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        invited = primary_device.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={
                "groupId": group_id,
                "members": [user_b],
                "reason": "real web invite decline",
            },
        )
        assert assert_api.get_result(invited) is True

        declined = secondary_device.call(
            "GroupManager",
            Cmd.declineInvitationFromGroup.value,
            info={"groupId": group_id, "reason": "decline"},
        )
        assert_api.assert_success(declined)

        members_after_decline = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 50},
        )
        members_after_decline_result = assert_api.get_result(members_after_decline)
        assert isinstance(members_after_decline_result, dict)
        user_ids = members_after_decline_result.get("list")
        assert isinstance(user_ids, list)
        assert user_b not in user_ids
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_request_join_accept_and_decline_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    accept_group_id = ""
    decline_group_id = ""
    accept_group_name = f"real-web-group-join-accept-{uuid.uuid4().hex[:8]}"
    decline_group_name = f"real-web-group-join-decline-{uuid.uuid4().hex[:8]}"
    try:
        created_accept_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": accept_group_name,
                "desc": "real web join accept group",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        accept_group = assert_api.get_result(created_accept_group)
        assert isinstance(accept_group, dict)
        accept_group_id = accept_group.get("groupId") or ""
        assert isinstance(accept_group_id, str) and accept_group_id

        requested_accept = secondary_device.call(
            "GroupManager",
            Cmd.requestToJoinPublicGroup.value,
            info={"groupId": accept_group_id, "reason": "join please"},
        )
        assert_api.assert_success(requested_accept)

        accepted = primary_device.call(
            "GroupManager",
            Cmd.acceptJoinApplication.value,
            info={"groupId": accept_group_id, "applicant": user_b},
        )
        assert_api.assert_success(accepted)

        members_after_accept = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": accept_group_id, "pageSize": 50},
        )
        members_after_accept_result = assert_api.get_result(members_after_accept)
        assert isinstance(members_after_accept_result, dict)
        accepted_user_ids = members_after_accept_result.get("list")
        assert isinstance(accepted_user_ids, list)
        assert user_b in accepted_user_ids

        created_decline_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": decline_group_name,
                "desc": "real web join decline group",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        decline_group = assert_api.get_result(created_decline_group)
        assert isinstance(decline_group, dict)
        decline_group_id = decline_group.get("groupId") or ""
        assert isinstance(decline_group_id, str) and decline_group_id

        requested_decline = secondary_device.call(
            "GroupManager",
            Cmd.requestToJoinPublicGroup.value,
            info={"groupId": decline_group_id, "reason": "join please"},
        )
        assert_api.assert_success(requested_decline)

        declined = primary_device.call(
            "GroupManager",
            Cmd.declineJoinApplication.value,
            info={
                "groupId": decline_group_id,
                "applicant": user_b,
                "reason": "decline",
            },
        )
        assert_api.assert_success(declined)

        members_after_decline = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": decline_group_id, "pageSize": 50},
        )
        members_after_decline_result = assert_api.get_result(members_after_decline)
        assert isinstance(members_after_decline_result, dict)
        declined_user_ids = members_after_decline_result.get("list")
        assert isinstance(declined_user_ids, list)
        assert user_b not in declined_user_ids
    finally:
        if accept_group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": accept_group_id},
            )
        if decline_group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": decline_group_id},
            )


def test_real_web_group_mute_list_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-mute-list-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web mute list group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        mute_member = primary_device.call(
            "GroupManager",
            Cmd.muteMembers.value,
            info={"groupId": group_id, "members": [user_b], "duration": 60},
        )
        assert_api.assert_success(mute_member)

        mute_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupMuteListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list_result = assert_api.get_result(mute_list)
        assert isinstance(mute_list_result, dict)
        muted_members = mute_list_result.get("list")
        assert isinstance(muted_members, list)
        assert user_b in muted_members

        secondary_muted = secondary_device.call(
            "GroupManager",
            Cmd.isMemberInGroupMuteList.value,
            info={"groupId": group_id},
        )
        assert assert_api.get_result(secondary_muted) is True

        unmute_member = primary_device.call(
            "GroupManager",
            Cmd.unMuteMembers.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert_api.assert_success(unmute_member)

        secondary_muted_after = secondary_device.call(
            "GroupManager",
            Cmd.isMemberInGroupMuteList.value,
            info={"groupId": group_id},
        )
        assert assert_api.get_result(secondary_muted_after) is False
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_white_list_membership_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-white-member-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web whitelist membership group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        add_white = primary_device.call(
            "GroupManager",
            Cmd.addWhiteList.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(add_white) is True

        white_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        white_list_result = assert_api.get_result(white_list)
        assert isinstance(white_list_result, list)
        assert user_b in white_list_result

        secondary_in_white = secondary_device.call(
            "GroupManager",
            Cmd.isMemberInWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        assert assert_api.get_result(secondary_in_white) is True

        remove_white = primary_device.call(
            "GroupManager",
            Cmd.removeWhiteList.value,
            info={"groupId": group_id, "members": [user_b]},
        )
        assert assert_api.get_result(remove_white) is True

        secondary_in_white_after = secondary_device.call(
            "GroupManager",
            Cmd.isMemberInWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        assert assert_api.get_result(secondary_in_white_after) is False
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_block_and_unblock_message_flow(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-block-flow-{uuid.uuid4().hex[:8]}"
    blocked_content = f"blocked-{uuid.uuid4().hex[:6]}"
    unblocked_content = f"unblocked-{uuid.uuid4().hex[:6]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web block flow group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        blocked = primary_device.call(
            "GroupManager",
            Cmd.blockGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(blocked)

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        blocked_send = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=_build_group_text(user_a, group_id, blocked_content),
        )
        blocked_message = assert_api.get_result(blocked_send)
        assert isinstance(blocked_message, dict)
        assert blocked_message.get("body") == {"type": 0, "content": blocked_content}

        blocked_success = primary_device.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        assert blocked_success is not None

        blocked_received = secondary_device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=5.0,
        )
        assert blocked_received is not None

        unblocked = primary_device.call(
            "GroupManager",
            Cmd.unblockGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(unblocked)

        primary_device.call("Client", Cmd.startCallback.value, info={})
        secondary_device.call("Client", Cmd.startCallback.value, info={})
        primary_device.drain_events(timeout=0.2)
        secondary_device.drain_events(timeout=0.2)

        unblocked_send = primary_device.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=_build_group_text(user_a, group_id, unblocked_content),
        )
        unblocked_message = assert_api.get_result(unblocked_send)
        assert isinstance(unblocked_message, dict)
        assert unblocked_message.get("body") == {"type": 0, "content": unblocked_content}

        success = primary_device.receive_message(
            match_event_type=Cmd.onMessageSuccess.value,
            timeout=20.0,
        )
        assert success is not None

        received = secondary_device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=20.0,
        )
        assert received is not None
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_update_owner_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-owner-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web update owner group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        owner_changed = primary_device.call(
            "GroupManager",
            Cmd.updateGroupOwner.value,
            info={"groupId": group_id, "owner": user_b},
        )
        owner_changed_result = assert_api.get_result(owner_changed)
        assert isinstance(owner_changed_result, dict)
        assert owner_changed_result.get("groupId") == group_id
        assert owner_changed_result.get("owner") == user_b

        spec_after_change = secondary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id},
        )
        spec_after_change_result = assert_api.get_result(spec_after_change)
        assert isinstance(spec_after_change_result, dict)
        assert spec_after_change_result.get("owner") == user_b

        owner_changed_back = secondary_device.call(
            "GroupManager",
            Cmd.updateGroupOwner.value,
            info={"groupId": group_id, "owner": user_a},
        )
        owner_changed_back_result = assert_api.get_result(owner_changed_back)
        assert isinstance(owner_changed_back_result, dict)
        assert owner_changed_back_result.get("groupId") == group_id
        assert owner_changed_back_result.get("owner") == user_a
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_file_list_server_reads(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-group-files-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web group files",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        file_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupFileListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        file_list_result = assert_api.get_result(file_list)
        assert isinstance(file_list_result, list)
        assert file_list_result == []
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_shared_file_upload_and_remove_server_state(
    primary_device,
    assert_api,
    user_a,
):
    group_id = ""
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": f"real-web-shared-file-{uuid.uuid4().hex[:8]}",
                "desc": "real web shared file",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        content = b"real-web-shared-file-content"
        with _download_server(content) as (server, _hits):
            file_name = f"real-web-shared-{uuid.uuid4().hex[:8]}.txt"
            file_path = f"http://127.0.0.1:{server.server_port}/{file_name}"

            before_file_list = primary_device.call(
                "GroupManager",
                Cmd.getGroupFileListFromServer.value,
                info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
            )
            before_file_list_result = assert_api.get_result(before_file_list)
            assert isinstance(before_file_list_result, list)
            before_ids = {
                item.get("fileId") or item.get("id")
                for item in before_file_list_result
                if isinstance(item, dict)
            }

            uploaded = primary_device.call(
                "GroupManager",
                Cmd.uploadGroupSharedFile.value,
                info={"groupId": group_id, "filePath": file_path},
            )
            assert_api.assert_result_equals(uploaded, None)
            time.sleep(3)

            file_list = primary_device.call(
                "GroupManager",
                Cmd.getGroupFileListFromServer.value,
                info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
            )
            file_list_result = assert_api.get_result(file_list)
            assert isinstance(file_list_result, list)
            shared_file = next(
                (
                    item
                    for item in file_list_result
                    if isinstance(item, dict)
                    and (item.get("fileId") or item.get("id")) not in before_ids
                ),
                None,
            )
            if shared_file is None:
                debug = assert_api.get_result(
                    primary_device.call("Client", "getRealSdkDebug", info={})
                )
                pytest.fail(
                    f"missing uploaded shared file; list={file_list_result!r}; debug={debug!r}"
                )
            assert isinstance(shared_file, dict), file_list_result
            file_id = shared_file.get("fileId") or shared_file.get("id")
            assert isinstance(file_id, str) and file_id
            assert shared_file.get("owner") == user_a

            downloaded = primary_device.call(
                "GroupManager",
                Cmd.downloadGroupSharedFile.value,
                info={"groupId": group_id, "fileId": file_id, "fileName": file_name},
            )
            assert_api.assert_result_equals(downloaded, None)

            removed = primary_device.call(
                "GroupManager",
                Cmd.removeGroupSharedFile.value,
                info={"groupId": group_id, "fileId": file_id},
            )
            assert_api.assert_result_equals(removed, None)
            time.sleep(3)

            after_remove = primary_device.call(
                "GroupManager",
                Cmd.getGroupFileListFromServer.value,
                info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
            )
            after_remove_result = assert_api.get_result(after_remove)
            assert isinstance(after_remove_result, list)
            assert not any(
                isinstance(item, dict)
                and (item.get("fileId") == file_id or item.get("id") == file_id)
                for item in after_remove_result
            ), after_remove_result
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_fetch_members_info_server_state(
    primary_device,
    assert_api,
    user_a,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-member-info-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web member info group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        time.sleep(2)

        members_info = primary_device.call(
            "GroupManager",
            Cmd.fetchGroupMembersInfo.value,
            info={"groupId": group_id, "cursor": "", "limit": 20},
        )
        result = assert_api.get_result(members_info)
        assert isinstance(result, dict)
        members = result.get("list")
        assert isinstance(members, list)
        by_user = {
            item.get("userId"): item for item in members if isinstance(item, dict)
        }
        assert {user_a, user_b}.issubset(by_user.keys()), result
        assert by_user[user_a].get("memberId") == user_a
        assert by_user[user_b].get("memberId") == user_b
        assert by_user[user_a].get("role") in (0, 1, 2)
        assert by_user[user_b].get("role") in (0, 1, 2)
        assert isinstance(by_user[user_a].get("joinTime"), int)
        assert isinstance(by_user[user_b].get("joinTime"), int)
        assert isinstance(by_user[user_a].get("namecard"), str)
        assert isinstance(by_user[user_b].get("namecard"), str)
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_member_attributes_server_state(
    primary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-group-member-attrs-{uuid.uuid4().hex[:8]}"
    attr_key = f"k_{uuid.uuid4().hex[:6]}"
    attr_value = f"v_{uuid.uuid4().hex[:6]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web member attrs group",
                "inviteMembers": [user_b],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        set_attrs = primary_device.call(
            "GroupManager",
            Cmd.setMemberAttributesFromGroup.value,
            info={
                "groupId": group_id,
                "userId": user_b,
                "attributes": {attr_key: attr_value},
            },
        )
        assert_api.assert_success(set_attrs)

        single_attrs = primary_device.call(
            "GroupManager",
            Cmd.fetchMemberAttributesFromGroup.value,
            info={"groupId": group_id, "userId": user_b, "keys": [attr_key]},
        )
        single_attrs_result = assert_api.get_result(single_attrs)
        assert isinstance(single_attrs_result, dict)
        assert single_attrs_result.get(attr_key) == attr_value

        multi_attrs = primary_device.call(
            "GroupManager",
            Cmd.fetchMembersAttributesFromGroup.value,
            info={"groupId": group_id, "userIds": [user_b], "keys": [attr_key]},
        )
        multi_attrs_result = assert_api.get_result(multi_attrs)
        assert isinstance(multi_attrs_result, dict)
        user_attrs = multi_attrs_result.get(user_b)
        assert isinstance(user_attrs, dict)
        assert user_attrs.get(attr_key) == attr_value

        removed = primary_device.call(
            "GroupManager",
            Cmd.removeMemberAttributesFromGroup.value,
            info={"groupId": group_id, "userId": user_b, "keys": [attr_key]},
        )
        assert_api.assert_success(removed)

        single_after_remove = primary_device.call(
            "GroupManager",
            Cmd.fetchMemberAttributesFromGroup.value,
            info={"groupId": group_id, "userId": user_b, "keys": [attr_key]},
        )
        single_after_remove_result = assert_api.get_result(single_after_remove)
        assert isinstance(single_after_remove_result, dict)
        assert single_after_remove_result.get(attr_key) in (None, "")

        multi_after_remove = primary_device.call(
            "GroupManager",
            Cmd.fetchMembersAttributesFromGroup.value,
            info={"groupId": group_id, "userIds": [user_b], "keys": [attr_key]},
        )
        multi_after_remove_result = assert_api.get_result(multi_after_remove)
        assert isinstance(multi_after_remove_result, dict)
        user_attrs_after_remove = multi_after_remove_result.get(user_b)
        assert isinstance(user_attrs_after_remove, dict)
        assert user_attrs_after_remove.get(attr_key) in (None, "")
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_update_ext_server_state(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-group-ext-{uuid.uuid4().hex[:8]}"
    ext_value = f"ext-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web group ext",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        updated = primary_device.call(
            "GroupManager",
            Cmd.updateGroupExt.value,
            info={"groupId": group_id, "ext": ext_value},
        )
        assert_api.assert_success(updated)

        spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id},
        )
        spec_result = assert_api.get_result(spec)
        assert isinstance(spec_result, dict)
        assert spec_result.get("ext") == ext_value, spec_result
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_mute_all_members_server_state(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-group-mute-all-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web group mute all",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        muted = primary_device.call(
            "GroupManager",
            Cmd.muteAllMembers.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(muted)

        muted_spec_result = None
        rest_raw_after_mute = {}
        for _ in range(5):
            muted_spec = primary_device.call(
                "GroupManager",
                Cmd.getGroupSpecificationFromServer.value,
                info={"groupId": group_id},
            )
            muted_spec_result = assert_api.get_result(muted_spec)
            assert isinstance(muted_spec_result, dict)
            assert muted_spec_result.get("groupId") == group_id
            rest_raw_after_mute = _fetch_group_detail_rest_raw(group_id)
            if muted_spec_result.get("isAllMemberMuted") is True:
                break
            time.sleep(2)
        assert isinstance(muted_spec_result, dict)
        if muted_spec_result.get("isAllMemberMuted") is not True:
            debug = assert_api.get_result(
                primary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(
                "mute all state did not enable: "
                f"spec={muted_spec_result!r}; "
                f"rest_raw={rest_raw_after_mute!r}; "
                f"debug={debug!r}"
            )

        unmuted = primary_device.call(
            "GroupManager",
            Cmd.unMuteAllMembers.value,
            info={"groupId": group_id},
        )
        assert_api.assert_success(unmuted)

        unmuted_spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id},
        )
        unmuted_spec_result = assert_api.get_result(unmuted_spec)
        assert isinstance(unmuted_spec_result, dict)
        assert unmuted_spec_result.get("groupId") == group_id
        assert unmuted_spec_result.get("isAllMemberMuted") is False, unmuted_spec_result
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_join_public_group_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_b,
):
    group_id = ""
    group_name = f"real-web-join-public-{uuid.uuid4().hex[:8]}"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web join public group",
                "inviteMembers": [],
                "options": {"style": 3, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        joined = secondary_device.call(
            "GroupManager",
            Cmd.joinPublicGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_result_equals(joined, None)
        time.sleep(2)

        members = primary_device.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageSize": 50, "cursor": ""},
        )
        members_result = assert_api.get_result(members)
        assert isinstance(members_result, dict)
        member_list = members_result.get("list")
        assert isinstance(member_list, list)
        assert user_b in member_list, members_result
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )


def test_real_web_group_update_avatar_server_state(
    primary_device,
    assert_api,
):
    group_id = ""
    group_name = f"real-web-group-avatar-{uuid.uuid4().hex[:8]}"
    avatar_url = f"https://example.com/group-avatar-{uuid.uuid4().hex[:8]}.png"
    try:
        created_group = primary_device.call(
            "GroupManager",
            Cmd.createGroup.value,
            info={
                "groupName": group_name,
                "desc": "real web group avatar",
                "inviteMembers": [],
                "options": {"style": 2, "maxCount": 200},
            },
        )
        group = assert_api.get_result(created_group)
        assert isinstance(group, dict)
        group_id = group.get("groupId") or ""
        assert isinstance(group_id, str) and group_id

        updated = primary_device.call(
            "GroupManager",
            Cmd.updateGroupAvatar.value,
            info={"groupId": group_id, "avatarUrl": avatar_url},
        )
        updated_result = assert_api.get_result(updated)
        assert isinstance(updated_result, dict)
        assert updated_result.get("groupId") == group_id
        assert updated_result.get("avatarUrl") == avatar_url

        spec = primary_device.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id},
        )
        spec_result = assert_api.get_result(spec)
        assert isinstance(spec_result, dict)
        assert spec_result.get("avatarUrl") == avatar_url
    finally:
        if group_id:
            primary_device.call(
                "GroupManager",
                Cmd.destroyGroup.value,
                info={"groupId": group_id},
            )
