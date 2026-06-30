"""Web ChatManager delete cleanup boundary regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text, now_ms


pytestmark = [pytest.mark.web, pytest.mark.chat]


def _import_message(primary_device, assert_api, from_user: str, to_user: str, content: str, ts: int) -> dict:
    message = build_text(from_user, to_user, content)
    message["msgId"] = f"web-delete-cleanup-{uuid.uuid4().hex[:8]}"
    message["localTime"] = ts
    message["serverTime"] = ts
    imported = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [message]},
    )
    assert_api.assert_result_equals(imported, True)
    return message


def _assert_deleted_message_state_is_clean(
    primary_device,
    assert_api,
    *,
    deleted_msg_id: str,
    kept_msg_id: str,
    conv_id: str,
) -> None:
    deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": deleted_msg_id})
    assert_api.assert_result_equals(deleted, None)

    kept = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": kept_msg_id})
    assert_api.assert_result_matches(kept, msgId=kept_msg_id)

    reactions = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [deleted_msg_id]},
    )
    assert assert_api.get_result(reactions)[deleted_msg_id] == []

    pin = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": deleted_msg_id})
    assert_api.assert_result_equals(pin, None)

    pinned = primary_device.call("ChatManager", Cmd.pinnedMessages.value, info={"convId": conv_id})
    assert [item["msgId"] for item in assert_api.get_result(pinned)] == [kept_msg_id]


def test_web_chat_delete_conversation_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.deleteConversation,
        Cmd.getMessage,
        Cmd.getMessageCount,
    ):
        require_capability("ChatManager", cmd.value)

    first = _import_message(primary_device, assert_api, user_a, user_b, "delete cleanup first", now_ms() - 2_000)
    second = _import_message(primary_device, assert_api, user_a, user_b, "delete cleanup second", now_ms() - 1_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": first["msgId"], "reaction": "cleanup"},
    )
    assert_api.assert_result_equals(reaction, True)

    pin = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_equals(pin, True)

    before_reactions = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [first["msgId"]]},
    )
    assert assert_api.get_result(before_reactions)[first["msgId"]] == [{"reaction": "cleanup", "count": 1}]

    before_pin = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_matches(before_pin, msgId=second["msgId"])

    delete = primary_device.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    assert_api.assert_result_equals(delete, True)

    first_deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": first["msgId"]})
    assert_api.assert_result_equals(first_deleted, None)

    second_deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_equals(second_deleted, None)

    after_reactions = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [first["msgId"]]},
    )
    assert assert_api.get_result(after_reactions)[first["msgId"]] == []

    after_pin = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_equals(after_pin, None)

    after_pinned = primary_device.call("ChatManager", Cmd.pinnedMessages.value, info={"convId": user_b})
    assert_api.assert_result_equals(after_pinned, [])

    count = primary_device.call("ChatManager", Cmd.getMessageCount.value, info={})
    assert_api.assert_result_equals(count, 0)


def test_web_chat_delete_before_timestamp_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.deleteMessagesBeforeTimestamp,
        Cmd.getMessage,
        Cmd.getMessageCount,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    old = _import_message(primary_device, assert_api, user_a, user_b, "old cleanup", base)
    kept = _import_message(primary_device, assert_api, user_a, user_b, "kept cleanup", base + 5_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": old["msgId"], "reaction": "old-cleanup"},
    )
    assert_api.assert_result_equals(reaction, True)

    pin_old = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": old["msgId"]})
    assert_api.assert_result_equals(pin_old, True)

    pin_kept = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": kept["msgId"]})
    assert_api.assert_result_equals(pin_kept, True)

    delete = primary_device.call(
        "ChatManager",
        Cmd.deleteMessagesBeforeTimestamp.value,
        info={"timestamp": base + 1_000},
    )
    assert_api.assert_result_equals(delete, None)

    old_deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": old["msgId"]})
    assert_api.assert_result_equals(old_deleted, None)

    kept_message = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": kept["msgId"]})
    assert_api.assert_result_matches(kept_message, msgId=kept["msgId"])

    old_reactions = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [old["msgId"]]},
    )
    assert assert_api.get_result(old_reactions)[old["msgId"]] == []

    old_pin = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": old["msgId"]})
    assert_api.assert_result_equals(old_pin, None)

    pinned = primary_device.call("ChatManager", Cmd.pinnedMessages.value, info={"convId": user_b})
    assert [item["msgId"] for item in assert_api.get_result(pinned)] == [kept["msgId"]]

    count = primary_device.call("ChatManager", Cmd.getMessageCount.value, info={})
    assert_api.assert_result_equals(count, 1)


def test_web_chat_remove_messages_with_timestamp_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.removeMessagesFromServerWithTs,
        Cmd.getMessage,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    old = _import_message(primary_device, assert_api, user_a, user_b, "remove ts old", base)
    kept = _import_message(primary_device, assert_api, user_a, user_b, "remove ts kept", base + 5_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": old["msgId"], "reaction": "remove-ts"},
    )
    assert_api.assert_result_equals(reaction, True)

    for message in (old, kept):
        pin = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": message["msgId"]})
        assert_api.assert_result_equals(pin, True)

    delete = primary_device.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={"convId": user_b, "timestamp": base + 1_000},
    )
    assert_api.assert_result_equals(delete, None)

    _assert_deleted_message_state_is_clean(
        primary_device,
        assert_api,
        deleted_msg_id=old["msgId"],
        kept_msg_id=kept["msgId"],
        conv_id=user_b,
    )


def test_web_chat_conversation_delete_with_time_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.conversationDeleteServerMessageWithTime,
        Cmd.getMessage,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    old = _import_message(primary_device, assert_api, user_a, user_b, "conv time old", base)
    kept = _import_message(primary_device, assert_api, user_a, user_b, "conv time kept", base + 5_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": old["msgId"], "reaction": "conv-time"},
    )
    assert_api.assert_result_equals(reaction, True)

    for message in (old, kept):
        pin = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": message["msgId"]})
        assert_api.assert_result_equals(pin, True)

    delete = primary_device.call(
        "ChatManager",
        Cmd.conversationDeleteServerMessageWithTime.value,
        info={"convId": user_b, "timestamp": base + 1_000},
    )
    assert_api.assert_result_equals(delete, None)

    _assert_deleted_message_state_is_clean(
        primary_device,
        assert_api,
        deleted_msg_id=old["msgId"],
        kept_msg_id=kept["msgId"],
        conv_id=user_b,
    )


def test_web_chat_conversation_delete_with_ids_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.conversationDeleteServerMessageWithIds,
        Cmd.getMessage,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    deleted = _import_message(primary_device, assert_api, user_a, user_b, "conv ids deleted", base)
    kept = _import_message(primary_device, assert_api, user_a, user_b, "conv ids kept", base + 5_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": deleted["msgId"], "reaction": "conv-ids"},
    )
    assert_api.assert_result_equals(reaction, True)

    for message in (deleted, kept):
        pin = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": message["msgId"]})
        assert_api.assert_result_equals(pin, True)

    delete = primary_device.call(
        "ChatManager",
        Cmd.conversationDeleteServerMessageWithIds.value,
        info={"convId": user_b, "msgIds": [deleted["msgId"]]},
    )
    assert_api.assert_result_equals(delete, None)

    _assert_deleted_message_state_is_clean(
        primary_device,
        assert_api,
        deleted_msg_id=deleted["msgId"],
        kept_msg_id=kept["msgId"],
        conv_id=user_b,
    )


def test_web_chat_recall_message_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.recallMessage,
        Cmd.getMessage,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    recalled = _import_message(primary_device, assert_api, user_a, user_b, "recall cleanup", base)
    kept = _import_message(primary_device, assert_api, user_a, user_b, "recall kept", base + 5_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": recalled["msgId"], "reaction": "recall-cleanup"},
    )
    assert_api.assert_result_equals(reaction, True)

    for message in (recalled, kept):
        pin = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": message["msgId"]})
        assert_api.assert_result_equals(pin, True)

    recall = primary_device.call(
        "ChatManager",
        Cmd.recallMessage.value,
        info={"msgId": recalled["msgId"]},
    )
    assert_api.assert_result_equals(recall, True)

    _assert_deleted_message_state_is_clean(
        primary_device,
        assert_api,
        deleted_msg_id=recalled["msgId"],
        kept_msg_id=kept["msgId"],
        conv_id=user_b,
    )


def test_web_chat_delete_remote_conversation_cleans_message_reactions_and_pins(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.addReaction,
        Cmd.fetchReactionList,
        Cmd.pinMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.deleteRemoteConversation,
        Cmd.getMessage,
        Cmd.getConversation,
    ):
        require_capability("ChatManager", cmd.value)

    base = now_ms() - 10_000
    first = _import_message(primary_device, assert_api, user_a, user_b, "remote conversation first", base)
    second = _import_message(primary_device, assert_api, user_a, user_b, "remote conversation second", base + 1_000)

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": first["msgId"], "reaction": "remote-conversation"},
    )
    assert_api.assert_result_equals(reaction, True)

    pin = primary_device.call("ChatManager", Cmd.pinMessage.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_equals(pin, True)

    delete = primary_device.call(
        "ChatManager",
        Cmd.deleteRemoteConversation.value,
        info={"convId": user_b, "conversationType": 0, "isDeleteRemoteMessage": True},
    )
    assert_api.assert_result_equals(delete, None)

    first_deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": first["msgId"]})
    assert_api.assert_result_equals(first_deleted, None)

    second_deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_equals(second_deleted, None)

    reactions = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [first["msgId"]]},
    )
    assert assert_api.get_result(reactions)[first["msgId"]] == []

    pin_info = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": second["msgId"]})
    assert_api.assert_result_equals(pin_info, None)

    pinned = primary_device.call("ChatManager", Cmd.pinnedMessages.value, info={"convId": user_b})
    assert_api.assert_result_equals(pinned, [])

    conversation = primary_device.call("ChatManager", Cmd.getConversation.value, info={"convId": user_b})
    assert_api.assert_result_equals(conversation, None)
