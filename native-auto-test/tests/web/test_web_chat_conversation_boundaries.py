"""Web ChatManager conversation list and state boundary regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text, now_ms


pytestmark = [pytest.mark.web, pytest.mark.chat]


def _conv_ids(items: list[dict]) -> list[str]:
    return [item["convId"] for item in items]


def _import_conversation_message(primary_device, assert_api, from_user: str, to_user: str, content: str, ts: int) -> dict:
    message = build_text(from_user, to_user, content)
    message["msgId"] = f"web-conv-{uuid.uuid4().hex[:8]}"
    message["localTime"] = ts
    message["serverTime"] = ts
    imported = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [message]},
    )
    assert_api.assert_result_equals(imported, True)
    return message


def test_web_chat_conversation_lists_page_pin_and_marks(
    primary_device,
    assert_api,
    user_a,
    user_b,
    user_c,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.loadAllConversations,
        Cmd.getAllConversationsBySort,
        Cmd.getConversationsFromServer,
        Cmd.fetchConversationsFromServerWithPage,
        Cmd.getConversationsFromServerWithCursor,
        Cmd.fetchConversationsByOptions,
        Cmd.getPinnedConversationsFromServerWithCursor,
        Cmd.pinConversation,
        Cmd.addRemoteAndLocalConversationsMark,
        Cmd.deleteRemoteAndLocalConversationsMark,
        Cmd.getConversation,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    conv_old = f"{user_a}-old-conv"
    conv_middle = user_b
    conv_new = user_c

    _import_conversation_message(primary_device, assert_api, user_a, conv_old, "old conversation", base)
    _import_conversation_message(primary_device, assert_api, user_a, conv_middle, "middle conversation", base + 1_000)
    _import_conversation_message(primary_device, assert_api, user_a, conv_new, "new conversation", base + 2_000)

    alphabetical = primary_device.call("ChatManager", Cmd.loadAllConversations.value, info={})
    assert _conv_ids(assert_api.get_result(alphabetical)) == sorted([conv_old, conv_middle, conv_new])

    sorted_conversations = primary_device.call("ChatManager", Cmd.getAllConversationsBySort.value, info={})
    assert _conv_ids(assert_api.get_result(sorted_conversations)) == [conv_new, conv_middle, conv_old]

    server_conversations = primary_device.call("ChatManager", Cmd.getConversationsFromServer.value, info={})
    assert _conv_ids(assert_api.get_result(server_conversations)) == [conv_new, conv_middle, conv_old]

    first_page = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 1, "pageSize": 2},
    )
    assert _conv_ids(assert_api.get_result(first_page)) == [conv_new, conv_middle]

    second_page = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 2, "pageSize": 2},
    )
    assert _conv_ids(assert_api.get_result(second_page)) == [conv_old]

    cursor_page = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServerWithCursor.value,
        info={"cursor": "", "pageSize": 2},
    )
    cursor_result = assert_api.get_result(cursor_page)
    assert cursor_result["cursor"] == "2"
    assert _conv_ids(cursor_result["list"]) == [conv_new, conv_middle]

    cursor_next = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsByOptions.value,
        info={"cursor": cursor_result["cursor"], "pageSize": 2},
    )
    cursor_next_result = assert_api.get_result(cursor_next)
    assert cursor_next_result["cursor"] == ""
    assert _conv_ids(cursor_next_result["list"]) == [conv_old]

    pin_old = primary_device.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"convId": conv_old, "isPinned": True},
    )
    assert_api.assert_result_equals(pin_old, True)

    pin_new = primary_device.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"convId": conv_new, "isPinned": True},
    )
    assert_api.assert_result_equals(pin_new, True)

    pinned_page = primary_device.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info={"cursor": "", "pageSize": 1},
    )
    pinned_result = assert_api.get_result(pinned_page)
    assert pinned_result["cursor"] == "1"
    assert _conv_ids(pinned_result["list"]) == [conv_new]

    pinned_next = primary_device.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info={"cursor": pinned_result["cursor"], "pageSize": 2},
    )
    pinned_next_result = assert_api.get_result(pinned_next)
    assert pinned_next_result["cursor"] == ""
    assert _conv_ids(pinned_next_result["list"]) == [conv_old]

    add_mark = primary_device.call(
        "ChatManager",
        Cmd.addRemoteAndLocalConversationsMark.value,
        info={"convIds": [conv_new, conv_old], "mark": 2},
    )
    assert_api.assert_result_equals(add_mark, True)

    marked = primary_device.call("ChatManager", Cmd.getConversation.value, info={"convId": conv_new})
    assert assert_api.get_result(marked)["marks"] == [2]

    delete_mark = primary_device.call(
        "ChatManager",
        Cmd.deleteRemoteAndLocalConversationsMark.value,
        info={"convIds": [conv_new], "mark": 2},
    )
    assert_api.assert_result_equals(delete_mark, True)

    unmarked = primary_device.call("ChatManager", Cmd.getConversation.value, info={"convId": conv_new})
    assert assert_api.get_result(unmarked)["marks"] == []
