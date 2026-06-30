"""Web ChatThreadManager event forwarding regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web]


def test_web_chat_thread_create_emits_thread_create_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
):
    require_capability("ChatThreadManager", Cmd.createChatThread.value)
    require_capability("ChatThreadManager", Cmd.onChatThreadCreate.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    parent_id = f"web-parent-event-{uuid.uuid4().hex[:8]}"
    message_id = f"web-msg-event-{uuid.uuid4().hex[:8]}"
    thread_name = f"web-thread-event-{uuid.uuid4().hex[:8]}"
    created = primary_device.call(
        "ChatThreadManager",
        Cmd.createChatThread.value,
        info={
            "name": thread_name,
            "msgId": message_id,
            "parentId": parent_id,
        },
    )
    thread = assert_api.get_result(created)
    thread_id = thread["threadId"]

    event = primary_device.receive_message(
        match_event_type=Cmd.onChatThreadCreate.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == Cmd.onChatThreadCreate.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("threadId") == thread_id
    assert data.get("threadName") == thread_name
    assert data.get("parentId") == parent_id
    assert data.get("owner") == user_a
    assert data.get("operation") == "create"


def test_web_chat_thread_update_subject_emits_thread_update_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
):
    require_capability("ChatThreadManager", Cmd.createChatThread.value)
    require_capability("ChatThreadManager", Cmd.updateChatThreadSubject.value)
    require_capability("ChatThreadManager", Cmd.onChatThreadUpdate.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    parent_id = f"web-parent-update-{uuid.uuid4().hex[:8]}"
    created = primary_device.call(
        "ChatThreadManager",
        Cmd.createChatThread.value,
        info={
            "name": f"web-thread-before-{uuid.uuid4().hex[:8]}",
            "msgId": f"web-msg-update-{uuid.uuid4().hex[:8]}",
            "parentId": parent_id,
        },
    )
    thread = assert_api.get_result(created)
    thread_id = thread["threadId"]
    primary_device.drain_events(timeout=0.2)

    updated_name = f"web-thread-updated-{uuid.uuid4().hex[:8]}"
    update = primary_device.call(
        "ChatThreadManager",
        Cmd.updateChatThreadSubject.value,
        info={"threadId": thread_id, "name": updated_name},
    )
    assert_api.assert_result_equals(update, None)

    event = primary_device.receive_message(
        match_event_type=Cmd.onChatThreadUpdate.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == Cmd.onChatThreadUpdate.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("threadId") == thread_id
    assert data.get("threadName") == updated_name
    assert data.get("parentId") == parent_id
    assert data.get("owner") == user_a
    assert data.get("operation") == "update"


def test_web_chat_thread_destroy_emits_thread_destroy_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
):
    require_capability("ChatThreadManager", Cmd.createChatThread.value)
    require_capability("ChatThreadManager", Cmd.destroyChatThread.value)
    require_capability("ChatThreadManager", Cmd.onChatThreadDestroy.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    parent_id = f"web-parent-destroy-{uuid.uuid4().hex[:8]}"
    thread_name = f"web-thread-destroy-{uuid.uuid4().hex[:8]}"
    created = primary_device.call(
        "ChatThreadManager",
        Cmd.createChatThread.value,
        info={
            "name": thread_name,
            "msgId": f"web-msg-destroy-{uuid.uuid4().hex[:8]}",
            "parentId": parent_id,
        },
    )
    thread = assert_api.get_result(created)
    thread_id = thread["threadId"]
    primary_device.drain_events(timeout=0.2)

    destroy = primary_device.call(
        "ChatThreadManager",
        Cmd.destroyChatThread.value,
        info={"threadId": thread_id},
    )
    assert_api.assert_result_equals(destroy, None)

    event = primary_device.receive_message(
        match_event_type=Cmd.onChatThreadDestroy.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == Cmd.onChatThreadDestroy.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("threadId") == thread_id
    assert data.get("threadName") == thread_name
    assert data.get("parentId") == parent_id
    assert data.get("owner") == user_a
    assert data.get("operation") == "destroy"


def test_web_chat_thread_remove_current_user_emits_kick_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
):
    require_capability("ChatThreadManager", Cmd.createChatThread.value)
    require_capability("ChatThreadManager", Cmd.removeMemberFromChatThread.value)
    require_capability("ChatThreadManager", Cmd.onUserKickOutOfChatThread.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    parent_id = f"web-parent-kick-{uuid.uuid4().hex[:8]}"
    thread_name = f"web-thread-kick-{uuid.uuid4().hex[:8]}"
    created = primary_device.call(
        "ChatThreadManager",
        Cmd.createChatThread.value,
        info={
            "name": thread_name,
            "msgId": f"web-msg-kick-{uuid.uuid4().hex[:8]}",
            "parentId": parent_id,
        },
    )
    thread = assert_api.get_result(created)
    thread_id = thread["threadId"]
    primary_device.drain_events(timeout=0.2)

    removed = primary_device.call(
        "ChatThreadManager",
        Cmd.removeMemberFromChatThread.value,
        info={"threadId": thread_id, "memberId": user_a},
    )
    assert_api.assert_result_equals(removed, None)

    event = primary_device.receive_message(
        match_event_type=Cmd.onUserKickOutOfChatThread.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == Cmd.onUserKickOutOfChatThread.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("threadId") == thread_id
    assert data.get("threadName") == thread_name
    assert data.get("parentId") == parent_id
    assert data.get("owner") == user_a
    assert data.get("userId") == user_a
    assert data.get("operation") == "user_kicked"
