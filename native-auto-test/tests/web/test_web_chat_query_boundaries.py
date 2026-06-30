"""Web ChatManager query, pagination, and delete boundary regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text, now_ms


pytestmark = [pytest.mark.web, pytest.mark.chat]


def _message_ids(items: list[dict]) -> list[str]:
    return [item["msgId"] for item in items]


def _import_text(primary_device, assert_api, from_user: str, to_user: str, content: str, created_at: int) -> dict:
    message = build_text(from_user, to_user, content)
    message["msgId"] = f"web-query-{uuid.uuid4().hex[:8]}"
    message["localTime"] = created_at
    message["serverTime"] = created_at
    imported = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [message]},
    )
    assert_api.assert_result_equals(imported, True)
    return message


def test_web_chat_query_filters_paginates_and_deletes_by_boundary(
    primary_device,
    assert_api,
    user_a,
    user_b,
    user_c,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.fetchHistoryMessages,
        Cmd.fetchHistoryMessagesByOptions,
        Cmd.searchChatMsgFromDB,
        Cmd.searchMsgsByOptions,
        Cmd.conversationSearchMsgsByOptions,
        Cmd.loadConversationMessagesWithKeyword,
        Cmd.loadMessagesWithIds,
        Cmd.getMessageCount,
        Cmd.removeMessagesFromServerWithMsgIds,
        Cmd.deleteMessagesBeforeTimestamp,
        Cmd.getMessage,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    keep_old = _import_text(primary_device, assert_api, user_a, user_b, "alpha keep old", base)
    keep_new = _import_text(primary_device, assert_api, user_a, user_b, "alpha keep new", base + 1_000)
    other_conv = _import_text(primary_device, assert_api, user_a, user_c, "alpha other conv", base + 2_000)
    other_keyword = _import_text(primary_device, assert_api, user_a, user_b, "beta keep new", base + 3_000)

    count = primary_device.call("ChatManager", Cmd.getMessageCount.value, info={})
    assert_api.assert_result_equals(count, 4)

    history_page = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info={"convId": user_b, "type": 0, "pageSize": 2, "startMsgId": "", "direction": 0},
    )
    history_items = assert_api.get_result(history_page)["list"]
    assert _message_ids(history_items) == [keep_old["msgId"], keep_new["msgId"]]

    history_options = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": user_b, "type": 0, "pageSize": 10, "cursor": ""},
    )
    history_option_ids = _message_ids(assert_api.get_result(history_options)["list"])
    assert history_option_ids == [keep_old["msgId"], keep_new["msgId"], other_keyword["msgId"]]

    global_alpha = primary_device.call(
        "ChatManager",
        Cmd.searchChatMsgFromDB.value,
        info={"keywords": "alpha"},
    )
    assert set(_message_ids(assert_api.get_result(global_alpha))) == {
        keep_old["msgId"],
        keep_new["msgId"],
        other_conv["msgId"],
    }

    conv_alpha = primary_device.call(
        "ChatManager",
        Cmd.searchMsgsByOptions.value,
        info={"convId": user_b, "keywords": "alpha"},
    )
    assert _message_ids(assert_api.get_result(conv_alpha)) == [keep_old["msgId"], keep_new["msgId"]]

    conv_alpha_alias = primary_device.call(
        "ChatManager",
        Cmd.conversationSearchMsgsByOptions.value,
        info={"convId": user_b, "keywords": "alpha"},
    )
    assert _message_ids(assert_api.get_result(conv_alpha_alias)) == [keep_old["msgId"], keep_new["msgId"]]

    keyword_loader = primary_device.call(
        "ChatManager",
        Cmd.loadConversationMessagesWithKeyword.value,
        info={"convId": user_b, "keywords": "keep"},
    )
    assert _message_ids(assert_api.get_result(keyword_loader)) == [
        keep_old["msgId"],
        keep_new["msgId"],
        other_keyword["msgId"],
    ]

    loaded_by_id = primary_device.call(
        "ChatManager",
        Cmd.loadMessagesWithIds.value,
        info={"msgIds": [keep_new["msgId"], other_conv["msgId"]]},
    )
    assert _message_ids(assert_api.get_result(loaded_by_id)) == [keep_new["msgId"], other_conv["msgId"]]

    remove_one = primary_device.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"convId": user_b, "msgIds": [keep_new["msgId"]]},
    )
    assert_api.assert_result_equals(remove_one, None)

    removed = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": keep_new["msgId"]})
    assert_api.assert_result_equals(removed, None)

    delete_before = primary_device.call(
        "ChatManager",
        Cmd.deleteMessagesBeforeTimestamp.value,
        info={"timestamp": base + 2_500},
    )
    assert_api.assert_result_equals(delete_before, None)

    old = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": keep_old["msgId"]})
    assert_api.assert_result_equals(old, None)

    still_kept = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": other_keyword["msgId"]})
    assert_api.assert_result_matches(still_kept, msgId=other_keyword["msgId"])
