"""Web ChatThreadManager local state regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text


pytestmark = [pytest.mark.web]


def _require_chat_thread_capabilities(require_capability):
    for cmd in (
        Cmd.createChatThread,
        Cmd.fetchChatThreadDetail,
        Cmd.fetchJoinedChatThreads,
        Cmd.fetchChatThreadsWithParentId,
        Cmd.fetchJoinedChatThreadsWithParentId,
        Cmd.fetchChatThreadMember,
        Cmd.fetchLastMessageWithChatThreads,
        Cmd.joinChatThread,
        Cmd.leaveChatThread,
        Cmd.removeMemberFromChatThread,
        Cmd.updateChatThreadSubject,
        Cmd.destroyChatThread,
    ):
        require_capability("ChatThreadManager", cmd.value)


def test_web_chat_thread_local_lifecycle_and_members(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    _require_chat_thread_capabilities(require_capability)

    parent_id = f"web-parent-{uuid.uuid4().hex[:8]}"
    message_id = f"web-msg-{uuid.uuid4().hex[:8]}"
    thread_name = f"web-thread-{uuid.uuid4().hex[:8]}"

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
    assert thread["threadName"] == thread_name
    assert thread["owner"] == user_a
    assert thread["msgId"] == message_id
    assert thread["parentId"] == parent_id
    assert thread["memberCount"] == 1
    assert thread["messageCount"] == 0

    detail = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchChatThreadDetail.value,
        info={"threadId": thread_id},
    )
    assert_api.assert_result_matches(detail, threadId=thread_id, threadName=thread_name, owner=user_a)

    for cmd in (
        Cmd.fetchJoinedChatThreads,
        Cmd.fetchChatThreadsWithParentId,
        Cmd.fetchJoinedChatThreadsWithParentId,
    ):
        info = {"cursor": None, "pageSize": 20}
        if cmd != Cmd.fetchJoinedChatThreads:
            info["parentId"] = parent_id
        page = primary_device.call("ChatThreadManager", cmd.value, info=info)
        result = assert_api.get_result(page)
        assert result["cursor"] == ""
        assert [item["threadId"] for item in result["list"]] == [thread_id]

    members = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchChatThreadMember.value,
        info={"threadId": thread_id, "cursor": None, "pageSize": 20},
    )
    assert assert_api.get_result(members) == {"cursor": "", "list": [user_a]}

    joined = primary_device.call(
        "ChatThreadManager",
        Cmd.joinChatThread.value,
        info={"threadId": thread_id, "userId": user_b},
    )
    joined_thread = assert_api.get_result(joined)
    assert joined_thread["threadId"] == thread_id
    assert joined_thread["memberCount"] == 2

    members_after_join = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchChatThreadMember.value,
        info={"threadId": thread_id, "cursor": None, "pageSize": 20},
    )
    assert assert_api.get_result(members_after_join)["list"] == [user_a, user_b]

    update = primary_device.call(
        "ChatThreadManager",
        Cmd.updateChatThreadSubject.value,
        info={"threadId": thread_id, "name": "web-thread-renamed"},
    )
    assert_api.assert_result_equals(update, None)
    renamed = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchChatThreadDetail.value,
        info={"threadId": thread_id},
    )
    assert_api.assert_result_matches(renamed, threadId=thread_id, threadName="web-thread-renamed")

    remove = primary_device.call(
        "ChatThreadManager",
        Cmd.removeMemberFromChatThread.value,
        info={"threadId": thread_id, "memberId": user_b},
    )
    assert_api.assert_result_equals(remove, None)
    members_after_remove = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchChatThreadMember.value,
        info={"threadId": thread_id, "cursor": None, "pageSize": 20},
    )
    assert assert_api.get_result(members_after_remove)["list"] == [user_a]

    leave = primary_device.call(
        "ChatThreadManager",
        Cmd.leaveChatThread.value,
        info={"threadId": thread_id},
    )
    assert_api.assert_result_equals(leave, None)
    joined_after_leave = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchJoinedChatThreads.value,
        info={"cursor": None, "pageSize": 20},
    )
    assert assert_api.get_result(joined_after_leave) == {"cursor": "", "list": []}

    destroy = primary_device.call(
        "ChatThreadManager",
        Cmd.destroyChatThread.value,
        info={"threadId": thread_id},
    )
    assert_api.assert_result_equals(destroy, None)
    removed_detail = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchChatThreadDetail.value,
        info={"threadId": thread_id},
    )
    assert_api.assert_result_equals(removed_detail, None)


def test_web_chat_thread_fetch_last_message_with_chat_threads(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.getThreadConversation,
        Cmd.getChatThread,
        Cmd.sendMessage,
        Cmd.createChatThread,
        Cmd.fetchLastMessageWithChatThreads,
    ):
        manager = (
            "ChatManager"
            if cmd in (Cmd.getThreadConversation, Cmd.sendMessage)
            else "ConversationManager"
            if cmd == Cmd.getChatThread
            else "ChatThreadManager"
        )
        require_capability(manager, cmd.value)

    content = f"web-thread-last-message-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]

    created = primary_device.call(
        "ChatThreadManager",
        Cmd.createChatThread.value,
        info={
            "name": f"web-thread-{uuid.uuid4().hex[:8]}",
            "msgId": msg_id,
            "parentId": user_b,
        },
    )
    thread = assert_api.get_result(created)
    thread_id = thread["threadId"]

    conversation = primary_device.call(
        "ChatManager",
        Cmd.getThreadConversation.value,
        info={"convId": thread_id},
    )
    assert_api.assert_result_matches(
        conversation,
        convId=thread_id,
        type=0,
        isThread=True,
        unreadCount=0,
    )

    message_thread = primary_device.call(
        "MessageManager",
        Cmd.getChatThread.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_matches(
        message_thread,
        threadId=thread_id,
        msgId=msg_id,
        parentId=user_b,
        threadName=thread["threadName"],
    )

    latest = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchLastMessageWithChatThreads.value,
        info={"threadIds": [thread_id]},
    )
    result = assert_api.get_result(latest)
    assert set(result.keys()) == {thread_id}
    assert result[thread_id]["msgId"] == msg_id
    assert result[thread_id]["body"] == {"type": 0, "content": content}

    missing = primary_device.call(
        "ChatThreadManager",
        Cmd.fetchLastMessageWithChatThreads.value,
        info={"threadIds": ["web-thread-missing"]},
    )
    assert_api.assert_result_equals(missing, {})
