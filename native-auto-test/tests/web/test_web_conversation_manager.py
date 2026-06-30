"""Web ConversationManager local state regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text, now_ms


pytestmark = [pytest.mark.web, pytest.mark.chat]


def _import_message(
    primary_device,
    assert_api,
    *,
    conv_id: str,
    from_user: str,
    to_user: str,
    content: str,
    ts: int,
    direction: int = 0,
    has_read: bool = True,
) -> dict:
    message = build_text(from_user, to_user, content)
    message.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-{uuid.uuid4().hex}",
            "localTime": ts,
            "serverTime": ts,
            "direction": direction,
            "hasRead": has_read,
        }
    )
    imported = primary_device.call("ChatManager", Cmd.importMessages.value, info={"messages": [message]})
    assert_api.assert_result_equals(imported, True)
    return message


def test_web_conversation_manager_get_unread_count_uses_chat_conversation_state(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    require_capability("ChatManager", Cmd.sendMessageWithType.value)
    require_capability("ChatManager", Cmd.getConversation.value)
    require_capability("ConversationManager", Cmd.getUnreadMsgCount.value)

    content = f"web-conversation-unread-{uuid.uuid4().hex[:8]}"
    send = primary_device.call(
        "ChatManager",
        Cmd.sendMessageWithType.value,
        info=build_text(user_a, user_b, content),
    )
    message = assert_api.get_result(send)

    conversation = primary_device.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": False},
    )
    assert_api.assert_result_matches(conversation, convId=user_b, unreadCount=0)

    unread = primary_device.call(
        "ConversationManager",
        Cmd.getUnreadMsgCount.value,
        info={"convId": user_b, "type": 0, "latestMessage": message},
    )
    assert_api.assert_result_equals(unread, 0)


def test_web_conversation_manager_local_message_state_operations(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.getMessage,
        Cmd.getConversation,
        Cmd.conversationGetLocalMessageCount,
        Cmd.getLatestMessage,
        Cmd.getLatestMessageFromOthers,
        Cmd.markMessageAsRead,
        Cmd.markAllMessagesAsRead,
        Cmd.removeMessage,
        Cmd.clearAllMessages,
    ):
        manager = "ConversationManager" if cmd.name in {
            "getLatestMessage",
            "getLatestMessageFromOthers",
            "markMessageAsRead",
            "markAllMessagesAsRead",
            "removeMessage",
            "clearAllMessages",
        } else "ChatManager"
        require_capability(manager, cmd.value)

    conv_id = f"web-conv-local-{uuid.uuid4().hex[:8]}"
    base = now_ms()
    own = _import_message(
        primary_device,
        assert_api,
        conv_id=conv_id,
        from_user=user_a,
        to_user=user_b,
        content="conversation own",
        ts=base,
        direction=0,
    )
    other = _import_message(
        primary_device,
        assert_api,
        conv_id=conv_id,
        from_user=user_b,
        to_user=user_a,
        content="conversation other",
        ts=base + 1_000,
        direction=1,
        has_read=False,
    )

    latest = primary_device.call(
        "ConversationManager",
        Cmd.getLatestMessage.value,
        info={"convId": conv_id, "type": 0},
    )
    assert assert_api.get_result(latest)["msgId"] == other["msgId"]

    latest_from_others = primary_device.call(
        "ConversationManager",
        Cmd.getLatestMessageFromOthers.value,
        info={"convId": conv_id, "type": 0},
    )
    assert assert_api.get_result(latest_from_others)["msgId"] == other["msgId"]

    mark_one = primary_device.call(
        "ConversationManager",
        Cmd.markMessageAsRead.value,
        info={"convId": conv_id, "type": 0, "msgId": other["msgId"]},
    )
    assert_api.assert_result_equals(mark_one, None)
    marked = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": other["msgId"]})
    assert assert_api.get_result(marked)["hasRead"] is True

    mark_all = primary_device.call(
        "ConversationManager",
        Cmd.markAllMessagesAsRead.value,
        info={"convId": conv_id, "type": 0},
    )
    assert_api.assert_result_equals(mark_all, None)

    remove = primary_device.call(
        "ConversationManager",
        Cmd.removeMessage.value,
        info={"convId": conv_id, "type": 0, "msgId": other["msgId"]},
    )
    assert_api.assert_result_equals(remove, None)
    removed = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": other["msgId"]})
    assert_api.assert_result_equals(removed, None)

    latest_after_remove = primary_device.call(
        "ConversationManager",
        Cmd.getLatestMessage.value,
        info={"convId": conv_id, "type": 0},
    )
    assert assert_api.get_result(latest_after_remove)["msgId"] == own["msgId"]

    clear = primary_device.call(
        "ConversationManager",
        Cmd.clearAllMessages.value,
        info={"convId": conv_id, "type": 0},
    )
    assert_api.assert_result_equals(clear, None)
    count = primary_device.call(
        "ChatManager",
        Cmd.conversationGetLocalMessageCount.value,
        info={"convId": conv_id, "type": 0},
    )
    assert_api.assert_result_equals(count, 0)


def test_web_conversation_manager_local_crud_count_and_time_delete(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.getMessage,
        Cmd.conversationGetLocalMessageCount,
        Cmd.insertMessage,
        Cmd.appendMessage,
        Cmd.updateConversationMessage,
        Cmd.loadMsgWithId,
        Cmd.deleteMessageByIds,
        Cmd.messageCount,
        Cmd.deleteMessagesWithTs,
    ):
        manager = "ConversationManager" if cmd.name in {
            "insertMessage",
            "appendMessage",
            "updateConversationMessage",
            "loadMsgWithId",
            "deleteMessageByIds",
            "messageCount",
            "deleteMessagesWithTs",
        } else "ChatManager"
        require_capability(manager, cmd.value)

    conv_id = f"web-conv-crud-{uuid.uuid4().hex[:8]}"
    base = now_ms()
    inserted = build_text(user_a, user_b, "conversation inserted")
    inserted.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-insert-{uuid.uuid4().hex}",
            "localTime": base,
            "serverTime": base,
        }
    )
    insert = primary_device.call(
        "ConversationManager",
        Cmd.insertMessage.value,
        info={"convId": conv_id, "type": 0, "msg": inserted},
    )
    assert_api.assert_result_equals(insert, None)

    appended = build_text(user_a, user_b, "conversation appended")
    appended.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-append-{uuid.uuid4().hex}",
            "localTime": base + 1_000,
            "serverTime": base + 1_000,
        }
    )
    append = primary_device.call(
        "ConversationManager",
        Cmd.appendMessage.value,
        info={"convId": conv_id, "type": 0, "msg": appended},
    )
    assert_api.assert_result_equals(append, None)

    count = primary_device.call(
        "ConversationManager",
        Cmd.messageCount.value,
        info={"convId": conv_id, "type": 0},
    )
    assert_api.assert_result_equals(count, 2)

    loaded = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithId.value,
        info={"convId": conv_id, "type": 0, "msgId": inserted["msgId"]},
    )
    assert assert_api.get_result(loaded)["msgId"] == inserted["msgId"]

    updated = dict(inserted)
    updated["body"] = {"type": 0, "content": "conversation inserted updated"}
    update = primary_device.call(
        "ConversationManager",
        Cmd.updateConversationMessage.value,
        info={"convId": conv_id, "type": 0, "msg": updated},
    )
    assert_api.assert_result_equals(update, None)
    updated_loaded = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithId.value,
        info={"convId": conv_id, "type": 0, "msgId": inserted["msgId"]},
    )
    assert assert_api.get_result(updated_loaded)["body"]["content"] == "conversation inserted updated"

    delete_by_ids = primary_device.call(
        "ConversationManager",
        Cmd.deleteMessageByIds.value,
        info={"convId": conv_id, "type": 0, "messageIds": [inserted["msgId"]]},
    )
    assert_api.assert_result_equals(delete_by_ids, None)
    deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": inserted["msgId"]})
    assert_api.assert_result_equals(deleted, None)

    delete_by_time = primary_device.call(
        "ConversationManager",
        Cmd.deleteMessagesWithTs.value,
        info={"convId": conv_id, "type": 0, "startTs": base + 500, "endTs": base + 1_500},
    )
    assert_api.assert_result_equals(delete_by_time, None)
    deleted_by_time = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": appended["msgId"]})
    assert_api.assert_result_equals(deleted_by_time, None)

    final_count = primary_device.call(
        "ConversationManager",
        Cmd.messageCount.value,
        info={"convId": conv_id, "type": 0},
    )
    assert_api.assert_result_equals(final_count, 0)


def test_web_conversation_manager_local_message_load_filters(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.insertMessage,
        Cmd.loadMsgWithStartId,
        Cmd.loadMsgWithKeywords,
        Cmd.loadMsgWithMsgType,
        Cmd.loadMsgWithTime,
    ):
        require_capability("ConversationManager", cmd.value)

    conv_id = f"web-conv-filter-{uuid.uuid4().hex[:8]}"
    base = now_ms()
    first = build_text(user_a, user_b, "alpha first")
    first.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-filter-first-{uuid.uuid4().hex}",
            "localTime": base,
            "serverTime": base,
        }
    )
    second = build_text(user_b, user_a, "beta keyword hit")
    second.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-filter-second-{uuid.uuid4().hex}",
            "localTime": base + 1_000,
            "serverTime": base + 1_000,
            "direction": 1,
        }
    )
    third = build_text(user_a, user_b, "gamma keyword hit")
    third.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-filter-third-{uuid.uuid4().hex}",
            "localTime": base + 2_000,
            "serverTime": base + 2_000,
        }
    )
    for message in (first, second, third):
        inserted = primary_device.call(
            "ConversationManager",
            Cmd.insertMessage.value,
            info={"convId": conv_id, "type": 0, "msg": message},
        )
        assert_api.assert_result_equals(inserted, None)

    with_start = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithStartId.value,
        info={"convId": conv_id, "type": 0, "startId": third["msgId"], "count": 2, "direction": 0},
    )
    with_start_ids = [item["msgId"] for item in assert_api.get_result(with_start)]
    assert with_start_ids == [second["msgId"], first["msgId"]]

    keyword = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithKeywords.value,
        info={"convId": conv_id, "type": 0, "keywords": "keyword", "count": 10},
    )
    keyword_ids = [item["msgId"] for item in assert_api.get_result(keyword)]
    assert keyword_ids == [second["msgId"], third["msgId"]]

    msg_type = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithMsgType.value,
        info={"convId": conv_id, "type": 0, "msgType": 0, "count": 10},
    )
    assert [item["msgId"] for item in assert_api.get_result(msg_type)] == [
        first["msgId"],
        second["msgId"],
        third["msgId"],
    ]

    with_time = primary_device.call(
        "ConversationManager",
        Cmd.loadMsgWithTime.value,
        info={"convId": conv_id, "type": 0, "startTime": base + 500, "endTime": base + 2_500, "count": 10},
    )
    assert [item["msgId"] for item in assert_api.get_result(with_time)] == [
        second["msgId"],
        third["msgId"],
    ]


def test_web_conversation_manager_ext_and_server_timestamp_delete_alias(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.insertMessage,
        Cmd.getConversation,
        Cmd.getMessage,
        Cmd.syncConversationExt,
        Cmd.removeMsgFromServerWithTimeStamp,
        Cmd.messageCount,
    ):
        manager = "ConversationManager" if cmd.name in {
            "insertMessage",
            "syncConversationExt",
            "removeMsgFromServerWithTimeStamp",
            "messageCount",
        } else "ChatManager"
        require_capability(manager, cmd.value)

    conv_id = f"web-conv-ext-{uuid.uuid4().hex[:8]}"
    base = now_ms()
    old = build_text(user_a, user_b, "conversation ext old")
    old.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-ext-old-{uuid.uuid4().hex}",
            "localTime": base,
            "serverTime": base,
        }
    )
    new = build_text(user_a, user_b, "conversation ext new")
    new.update(
        {
            "convId": conv_id,
            "msgId": f"web-conv-ext-new-{uuid.uuid4().hex}",
            "localTime": base + 1_000,
            "serverTime": base + 1_000,
        }
    )
    for message in (old, new):
        inserted = primary_device.call(
            "ConversationManager",
            Cmd.insertMessage.value,
            info={"convId": conv_id, "type": 0, "msg": message},
        )
        assert_api.assert_result_equals(inserted, None)

    sync_ext = primary_device.call(
        "ConversationManager",
        Cmd.syncConversationExt.value,
        info={"convId": conv_id, "type": 0, "ext": {"scope": "web", "stage": "json_bridge"}},
    )
    assert_api.assert_result_equals(sync_ext, None)

    conversation = primary_device.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": conv_id, "type": 0, "createIfNeed": False},
    )
    assert assert_api.get_result(conversation)["ext"] == {"scope": "web", "stage": "json_bridge"}

    remove_before = primary_device.call(
        "ConversationManager",
        Cmd.removeMsgFromServerWithTimeStamp.value,
        info={"convId": conv_id, "type": 0, "timestamp": base + 500},
    )
    assert_api.assert_result_equals(remove_before, None)

    old_deleted = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": old["msgId"]})
    assert_api.assert_result_equals(old_deleted, None)
    new_kept = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": new["msgId"]})
    assert assert_api.get_result(new_kept)["msgId"] == new["msgId"]

    count = primary_device.call(
        "ConversationManager",
        Cmd.messageCount.value,
        info={"convId": conv_id, "type": 0},
    )
    assert_api.assert_result_equals(count, 1)
