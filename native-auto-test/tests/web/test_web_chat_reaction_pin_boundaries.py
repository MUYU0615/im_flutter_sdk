"""Web ChatManager reaction and pinned message boundary regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text, now_ms


pytestmark = [pytest.mark.web, pytest.mark.chat]


def _import_message(primary_device, assert_api, from_user: str, to_user: str, content: str, ts: int) -> dict:
    message = build_text(from_user, to_user, content)
    message["msgId"] = f"web-react-pin-{uuid.uuid4().hex[:8]}"
    message["localTime"] = ts
    message["serverTime"] = ts
    imported = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [message]},
    )
    assert_api.assert_result_equals(imported, True)
    return message


def _message_ids(items: list[dict]) -> list[str]:
    return [item["msgId"] for item in items]


def test_web_chat_reactions_and_pinned_messages_keep_independent_state(
    primary_device,
    assert_api,
    user_a,
    user_b,
    user_c,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.removeReaction,
        Cmd.fetchReactionList,
        Cmd.fetchReactionDetail,
        Cmd.pinMessage,
        Cmd.unpinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.fetchPinnedMessages,
    ):
        require_capability("ChatManager", cmd.value)
    require_capability("ConversationManager", Cmd.getReactionList.value)

    base = now_ms() - 10_000
    first = _import_message(primary_device, assert_api, user_a, user_b, "reaction first", base)
    second = _import_message(primary_device, assert_api, user_a, user_b, "reaction second", base + 1_000)
    other = _import_message(primary_device, assert_api, user_a, user_c, "reaction other conv", base + 2_000)

    for reaction in ("like", "fire"):
        added = primary_device.call(
            "ChatManager",
            Cmd.addReaction.value,
            info={"msgId": first["msgId"], "reaction": reaction},
        )
        assert_api.assert_result_equals(added, True)

    second_reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": second["msgId"], "reaction": "like"},
    )
    assert_api.assert_result_equals(second_reaction, True)

    reaction_list = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [first["msgId"], second["msgId"], other["msgId"]]},
    )
    reaction_map = assert_api.get_result(reaction_list)
    assert {item["reaction"] for item in reaction_map[first["msgId"]]} == {"like", "fire"}
    assert reaction_map[second["msgId"]] == [{"reaction": "like", "count": 1}]
    assert reaction_map[other["msgId"]] == []

    message_reactions = primary_device.call(
        "MessageManager",
        Cmd.getReactionList.value,
        info={"msgId": first["msgId"]},
    )
    assert {
        (item["reaction"], item["count"], item["isAddedBySelf"], tuple(item["userList"]))
        for item in assert_api.get_result(message_reactions)
    } == {
        ("like", 1, True, ("web-user",)),
        ("fire", 1, True, ("web-user",)),
    }

    like_detail = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionDetail.value,
        info={"msgId": first["msgId"], "reaction": "like", "cursor": "", "pageSize": 10},
    )
    like_detail_result = assert_api.get_result(like_detail)
    assert like_detail_result["cursor"] == ""
    assert like_detail_result["list"] == [{"reaction": "like", "userId": "web-user", "count": 1}]

    remove = primary_device.call(
        "ChatManager",
        Cmd.removeReaction.value,
        info={"msgId": first["msgId"], "reaction": "like"},
    )
    assert_api.assert_result_equals(remove, True)

    after_remove = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [first["msgId"]]},
    )
    assert assert_api.get_result(after_remove)[first["msgId"]] == [{"reaction": "fire", "count": 1}]

    for message in (first, second, other):
        pinned = primary_device.call(
            "ChatManager",
            Cmd.pinMessage.value,
            info={"msgId": message["msgId"]},
        )
        assert_api.assert_result_equals(pinned, True)

    first_pin = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": first["msgId"]})
    assert_api.assert_result_matches(first_pin, msgId=first["msgId"], convId=user_b, operatorId=user_a)

    pinned_in_conv = primary_device.call(
        "ChatManager",
        Cmd.pinnedMessages.value,
        info={"convId": user_b},
    )
    assert _message_ids(assert_api.get_result(pinned_in_conv)) == [first["msgId"], second["msgId"]]

    pinned_page = primary_device.call(
        "ChatManager",
        Cmd.fetchPinnedMessages.value,
        info={"convId": user_b, "cursor": "", "pageSize": 1},
    )
    pinned_page_result = assert_api.get_result(pinned_page)
    assert pinned_page_result["cursor"] == "1"
    assert _message_ids(pinned_page_result["list"]) == [first["msgId"]]

    pinned_next = primary_device.call(
        "ChatManager",
        Cmd.fetchPinnedMessages.value,
        info={"convId": user_b, "cursor": pinned_page_result["cursor"], "pageSize": 2},
    )
    pinned_next_result = assert_api.get_result(pinned_next)
    assert pinned_next_result["cursor"] == ""
    assert _message_ids(pinned_next_result["list"]) == [second["msgId"]]

    unpin = primary_device.call(
        "ChatManager",
        Cmd.unpinMessage.value,
        info={"msgId": first["msgId"]},
    )
    assert_api.assert_result_equals(unpin, True)

    after_unpin = primary_device.call(
        "ChatManager",
        Cmd.pinnedMessages.value,
        info={"convId": user_b},
    )
    assert _message_ids(assert_api.get_result(after_unpin)) == [second["msgId"]]
