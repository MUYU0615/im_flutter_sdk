"""Web ChatManager local message/conversation foundation API regression cases."""

from __future__ import annotations

import time
import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text


pytestmark = [pytest.mark.web, pytest.mark.chat]


def test_web_chat_local_message_and_conversation_store(primary_device, assert_api, user_a, user_b, require_capability):
    for cmd in (
        Cmd.sendMessage,
        Cmd.sendMessageWithType,
        Cmd.resendMessage,
        Cmd.ackMessageRead,
        Cmd.ackGroupMessageRead,
        Cmd.ackConversationRead,
        Cmd.recallMessage,
        Cmd.getMessage,
        Cmd.updateChatMessage,
        Cmd.importMessages,
        Cmd.getConversation,
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
        Cmd.deleteConversation,
        Cmd.fetchHistoryMessages,
        Cmd.markAllChatMsgAsRead,
        Cmd.getUnreadMessageCount,
        Cmd.searchChatMsgFromDB,
        Cmd.searchMsgsByOptions,
        Cmd.conversationSearchMsgsByOptions,
        Cmd.deleteRemoteConversation,
        Cmd.removeMessagesFromServerWithMsgIds,
        Cmd.removeMessagesFromServerWithTs,
        Cmd.deleteAllMessageAndConversation,
        Cmd.modifyMessage,
        Cmd.translateMessage,
        Cmd.addReaction,
        Cmd.removeReaction,
        Cmd.fetchReactionList,
        Cmd.fetchReactionDetail,
        Cmd.reportMessage,
        Cmd.getPinInfo,
        Cmd.pinnedMessages,
        Cmd.pinMessage,
        Cmd.unpinMessage,
        Cmd.fetchPinnedMessages,
        Cmd.conversationRemindType,
        Cmd.conversationGetLocalMessageCount,
        Cmd.conversationDeleteServerMessageWithIds,
        Cmd.conversationDeleteServerMessageWithTime,
        Cmd.syncSilentModels,
        Cmd.loadConversationMessagesWithKeyword,
        Cmd.deleteMessagesBeforeTimestamp,
        Cmd.fetchHistoryMessagesByOptions,
        Cmd.fetchSupportLanguages,
        Cmd.loadMessagesWithIds,
        Cmd.getMessageCount,
        Cmd.asyncFetchGroupAcks,
    ):
        require_capability("ChatManager", cmd.value)
    require_capability("ConversationManager", Cmd.groupAckCount.value)

    content = f"web-local-{uuid.uuid4().hex[:8]}"
    send = primary_device.call(
        "ChatManager",
        Cmd.sendMessageWithType.value,
        info=build_text(user_a, user_b, content),
    )
    message = assert_api.get_result(send)
    msg_id = message["msgId"]

    resent = primary_device.call(
        "ChatManager",
        Cmd.resendMessage.value,
        info={"message": message},
    )
    assert_api.assert_result_matches(resent, msgId=msg_id, status=2)

    ack = primary_device.call(
        "ChatManager",
        Cmd.ackMessageRead.value,
        info={"msgId": msg_id, "to": user_b},
    )
    assert_api.assert_result_equals(ack, 1)

    group_ack = primary_device.call(
        "ChatManager",
        Cmd.ackGroupMessageRead.value,
        info={"msgId": msg_id, "groupId": "web-group", "content": "read"},
    )
    assert_api.assert_result_equals(group_ack, 1)

    group_acks = primary_device.call(
        "ChatManager",
        Cmd.asyncFetchGroupAcks.value,
        info={"msgId": msg_id, "group_id": "web-group", "pageSize": 20},
    )
    group_ack_result = assert_api.get_result(group_acks)
    assert group_ack_result["cursor"] == ""
    assert group_ack_result["list"][0]["msgId"] == msg_id
    assert group_ack_result["list"][0]["content"] == "read"
    assert group_ack_result["list"][0]["count"] == 1

    group_ack_count = primary_device.call(
        "MessageManager",
        Cmd.groupAckCount.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_equals(group_ack_count, 1)

    conversation_ack = primary_device.call(
        "ChatManager",
        Cmd.ackConversationRead.value,
        info={"convId": user_b},
    )
    assert_api.assert_result_equals(conversation_ack, 1)

    fetched = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
    assert_api.assert_result_equals(fetched, message)

    updated = dict(message)
    updated["body"] = {"type": 0, "content": f"{content}-updated"}
    update = primary_device.call(
        "ChatManager",
        Cmd.updateChatMessage.value,
        info={"message": updated},
    )
    assert_api.assert_result_equals(update, updated)

    modify = primary_device.call(
        "ChatManager",
        Cmd.modifyMessage.value,
        info={"msgId": msg_id, "body": {"type": 0, "content": f"{content}-modified"}},
    )
    modified = assert_api.get_result(modify)
    assert modified["msgId"] == msg_id
    assert modified["body"]["content"] == f"{content}-modified"

    translate = primary_device.call(
        "ChatManager",
        Cmd.translateMessage.value,
        info={"message": modified, "targetLanguages": ["zh-Hans"]},
    )
    translated = assert_api.get_result(translate)
    assert translated["msgId"] == msg_id
    assert translated["translations"]["zh-Hans"] == f"{content}-modified"

    conv = primary_device.call(
        "ChatManager",
        Cmd.getConversation.value,
        info={"convId": user_b, "type": 0, "createIfNeed": False},
    )
    assert_api.assert_result_matches(conv, convId=user_b, type=0, unreadCount=0)

    conversations = primary_device.call("ChatManager", Cmd.loadAllConversations.value, info={})
    result = assert_api.get_result(conversations)
    assert any(item.get("convId") == user_b for item in result)

    sorted_conversations = primary_device.call("ChatManager", Cmd.getAllConversationsBySort.value, info={})
    sorted_result = assert_api.get_result(sorted_conversations)
    assert sorted_result[0]["convId"] == user_b

    server_conversations = primary_device.call("ChatManager", Cmd.getConversationsFromServer.value, info={})
    assert any(item.get("convId") == user_b for item in assert_api.get_result(server_conversations))

    server_page = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsFromServerWithPage.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    assert any(item.get("convId") == user_b for item in assert_api.get_result(server_page))

    server_cursor = primary_device.call(
        "ChatManager",
        Cmd.getConversationsFromServerWithCursor.value,
        info={"cursor": "", "pageSize": 20},
    )
    cursor_result = assert_api.get_result(server_cursor)
    assert cursor_result["cursor"] == ""
    assert any(item.get("convId") == user_b for item in cursor_result["list"])

    option_conversations = primary_device.call(
        "ChatManager",
        Cmd.fetchConversationsByOptions.value,
        info={"cursor": "", "pageSize": 20},
    )
    option_result = assert_api.get_result(option_conversations)
    assert option_result["cursor"] == ""
    assert any(item.get("convId") == user_b for item in option_result["list"])

    pin = primary_device.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"convId": user_b, "isPinned": True},
    )
    assert_api.assert_result_equals(pin, True)

    pinned = primary_device.call("ChatManager", Cmd.getAllConversationsBySort.value, info={})
    assert any(item.get("convId") == user_b and item.get("isPinned") is True for item in assert_api.get_result(pinned))

    pinned_cursor = primary_device.call(
        "ChatManager",
        Cmd.getPinnedConversationsFromServerWithCursor.value,
        info={"cursor": "", "pageSize": 20},
    )
    pinned_cursor_result = assert_api.get_result(pinned_cursor)
    assert pinned_cursor_result["cursor"] == ""
    assert any(item.get("convId") == user_b for item in pinned_cursor_result["list"])

    add_mark = primary_device.call(
        "ChatManager",
        Cmd.addRemoteAndLocalConversationsMark.value,
        info={"convIds": [user_b], "mark": 1},
    )
    assert_api.assert_result_equals(add_mark, True)

    marked = primary_device.call("ChatManager", Cmd.getConversation.value, info={"convId": user_b})
    assert 1 in assert_api.get_result(marked)["marks"]

    delete_mark = primary_device.call(
        "ChatManager",
        Cmd.deleteRemoteAndLocalConversationsMark.value,
        info={"convIds": [user_b], "mark": 1},
    )
    assert_api.assert_result_equals(delete_mark, True)

    unread = primary_device.call("ChatManager", Cmd.getUnreadMessageCount.value, info={})
    assert_api.assert_result_equals(unread, 0)

    mark = primary_device.call("ChatManager", Cmd.markAllChatMsgAsRead.value, info={})
    assert_api.assert_result_equals(mark, 1)

    history_basic = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessages.value,
        info={"convId": user_b, "type": 0, "pageSize": 20, "startMsgId": "", "direction": 0},
    )
    basic_result = assert_api.get_result(history_basic)
    assert basic_result["cursor"] == ""
    assert any(item.get("msgId") == msg_id for item in basic_result["list"])

    history = primary_device.call(
        "ChatManager",
        Cmd.fetchHistoryMessagesByOptions.value,
        info={"convId": user_b, "type": 0, "pageSize": 20, "cursor": ""},
    )
    history_result = assert_api.get_result(history)
    assert history_result["cursor"] == ""
    assert any(item.get("msgId") == msg_id for item in history_result["list"])

    by_ids = primary_device.call(
        "ChatManager",
        Cmd.loadMessagesWithIds.value,
        info={"msgIds": [msg_id]},
    )
    by_ids_result = assert_api.get_result(by_ids)
    assert by_ids_result[0]["msgId"] == msg_id
    assert by_ids_result[0]["body"]["content"] == f"{content}-modified"

    search = primary_device.call(
        "ChatManager",
        Cmd.searchChatMsgFromDB.value,
        info={"keywords": "modified"},
    )
    search_result = assert_api.get_result(search)
    assert any(item.get("msgId") == msg_id for item in search_result)

    search_options = primary_device.call(
        "ChatManager",
        Cmd.searchMsgsByOptions.value,
        info={"keywords": "modified", "convId": user_b},
    )
    assert any(item.get("msgId") == msg_id for item in assert_api.get_result(search_options))

    conversation_search = primary_device.call(
        "ChatManager",
        Cmd.conversationSearchMsgsByOptions.value,
        info={"keywords": "modified", "convId": user_b},
    )
    assert any(item.get("msgId") == msg_id for item in assert_api.get_result(conversation_search))

    reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": msg_id, "reaction": "web-like"},
    )
    assert_api.assert_result_equals(reaction, True)

    reaction_list = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionList.value,
        info={"msgIds": [msg_id]},
    )
    reaction_map = assert_api.get_result(reaction_list)
    assert reaction_map[msg_id][0]["reaction"] == "web-like"

    reaction_detail = primary_device.call(
        "ChatManager",
        Cmd.fetchReactionDetail.value,
        info={"msgId": msg_id, "reaction": "web-like", "cursor": "", "pageSize": 20},
    )
    detail_result = assert_api.get_result(reaction_detail)
    assert detail_result["cursor"] == ""
    assert detail_result["list"][0]["reaction"] == "web-like"

    remove_reaction = primary_device.call(
        "ChatManager",
        Cmd.removeReaction.value,
        info={"msgId": msg_id, "reaction": "web-like"},
    )
    assert_api.assert_result_equals(remove_reaction, True)

    report = primary_device.call(
        "ChatManager",
        Cmd.reportMessage.value,
        info={"msgId": msg_id, "tag": "web-test", "reason": "coverage"},
    )
    assert_api.assert_result_equals(report, True)

    pin_message = primary_device.call(
        "ChatManager",
        Cmd.pinMessage.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_equals(pin_message, True)

    pin_info = primary_device.call("ChatManager", Cmd.getPinInfo.value, info={"msgId": msg_id})
    assert_api.assert_result_matches(pin_info, msgId=msg_id)

    pinned_messages = primary_device.call(
        "ChatManager",
        Cmd.pinnedMessages.value,
        info={"convId": user_b},
    )
    assert any(item.get("msgId") == msg_id for item in assert_api.get_result(pinned_messages))

    fetch_pinned = primary_device.call(
        "ChatManager",
        Cmd.fetchPinnedMessages.value,
        info={"convId": user_b, "cursor": "", "pageSize": 20},
    )
    fetch_pinned_result = assert_api.get_result(fetch_pinned)
    assert fetch_pinned_result["cursor"] == ""
    assert any(item.get("msgId") == msg_id for item in fetch_pinned_result["list"])

    unpin_message = primary_device.call(
        "ChatManager",
        Cmd.unpinMessage.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_equals(unpin_message, True)

    count = primary_device.call("ChatManager", Cmd.getMessageCount.value, info={})
    assert_api.assert_result_equals(count, 1)

    conv_count = primary_device.call(
        "ChatManager",
        Cmd.conversationGetLocalMessageCount.value,
        info={"convId": user_b},
    )
    assert_api.assert_result_equals(conv_count, 1)

    remind = primary_device.call(
        "ChatManager",
        Cmd.conversationRemindType.value,
        info={"convId": user_b},
    )
    assert_api.assert_result_equals(remind, 0)

    sync_silent = primary_device.call("ChatManager", Cmd.syncSilentModels.value, info={})
    assert_api.assert_result_equals(sync_silent, True)

    keyword_messages = primary_device.call(
        "ChatManager",
        Cmd.loadConversationMessagesWithKeyword.value,
        info={"convId": user_b, "keywords": "modified"},
    )
    assert any(item.get("msgId") == msg_id for item in assert_api.get_result(keyword_messages))

    languages = primary_device.call("ChatManager", Cmd.fetchSupportLanguages.value, info={})
    assert isinstance(assert_api.get_result(languages), list)

    recall = primary_device.call("ChatManager", Cmd.recallMessage.value, info={"msgId": msg_id})
    assert_api.assert_result_equals(recall, True)

    recalled = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
    assert_api.assert_result_equals(recalled, None)

    reimported = dict(updated)
    reimported["msgId"] = msg_id
    reimported_resp = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [reimported]},
    )
    assert_api.assert_result_equals(reimported_resp, True)

    remove_server_ids = primary_device.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithMsgIds.value,
        info={"convId": user_b, "msgIds": [msg_id]},
    )
    assert_api.assert_result_equals(remove_server_ids, None)

    removed_by_id = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
    assert_api.assert_result_equals(removed_by_id, None)

    ts_message = build_text(user_a, user_b, f"web-ts-{uuid.uuid4().hex[:8]}")
    ts_message["msgId"] = f"web-ts-{uuid.uuid4().hex[:8]}"
    ts_message["localTime"] = int(time.time() * 1000) - 1000
    ts_message["serverTime"] = ts_message["localTime"]
    ts_import = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [ts_message]},
    )
    assert_api.assert_result_equals(ts_import, True)

    conv_delete_ids = primary_device.call(
        "ChatManager",
        Cmd.conversationDeleteServerMessageWithIds.value,
        info={"convId": user_b, "msgIds": [ts_message["msgId"]]},
    )
    assert_api.assert_result_equals(conv_delete_ids, None)

    conv_deleted_by_id = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": ts_message["msgId"]})
    assert_api.assert_result_equals(conv_deleted_by_id, None)

    ts_message_2 = build_text(user_a, user_b, f"web-ts2-{uuid.uuid4().hex[:8]}")
    ts_message_2["msgId"] = f"web-ts2-{uuid.uuid4().hex[:8]}"
    ts_message_2["localTime"] = int(time.time() * 1000) - 1000
    ts_message_2["serverTime"] = ts_message_2["localTime"]
    ts_import_2 = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [ts_message_2]},
    )
    assert_api.assert_result_equals(ts_import_2, True)

    conv_delete_time = primary_device.call(
        "ChatManager",
        Cmd.conversationDeleteServerMessageWithTime.value,
        info={"convId": user_b, "timestamp": int(time.time() * 1000)},
    )
    assert_api.assert_result_equals(conv_delete_time, None)

    conv_deleted_by_time = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": ts_message_2["msgId"]})
    assert_api.assert_result_equals(conv_deleted_by_time, None)

    ts_message = build_text(user_a, user_b, f"web-ts-{uuid.uuid4().hex[:8]}")
    ts_message["msgId"] = f"web-ts-{uuid.uuid4().hex[:8]}"
    ts_message["localTime"] = int(time.time() * 1000) - 1000
    ts_message["serverTime"] = ts_message["localTime"]
    ts_import = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [ts_message]},
    )
    assert_api.assert_result_equals(ts_import, True)

    remove_server_ts = primary_device.call(
        "ChatManager",
        Cmd.removeMessagesFromServerWithTs.value,
        info={"convId": user_b, "timestamp": int(time.time() * 1000)},
    )
    assert_api.assert_result_equals(remove_server_ts, None)

    removed_by_ts = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": ts_message["msgId"]})
    assert_api.assert_result_equals(removed_by_ts, None)

    delete_remote = primary_device.call(
        "ChatManager",
        Cmd.deleteRemoteConversation.value,
        info={"convId": user_b, "conversationType": 0, "isDeleteRemoteMessage": False},
    )
    assert_api.assert_result_equals(delete_remote, None)

    delete_before = primary_device.call(
        "ChatManager",
        Cmd.deleteMessagesBeforeTimestamp.value,
        info={"timestamp": int(time.time() * 1000) + 1000},
    )
    assert_api.assert_result_equals(delete_before, None)

    missing = primary_device.call("ChatManager", Cmd.getMessage.value, info={"msgId": msg_id})
    assert_api.assert_result_equals(missing, None)

    imported = build_text(user_a, user_b, f"web-import-{uuid.uuid4().hex[:8]}")
    imported["msgId"] = f"web-imported-{uuid.uuid4().hex[:8]}"
    imported_resp = primary_device.call(
        "ChatManager",
        Cmd.importMessages.value,
        info={"messages": [imported]},
    )
    assert_api.assert_result_equals(imported_resp, True)

    imported_get = primary_device.call(
        "ChatManager",
        Cmd.getMessage.value,
        info={"msgId": imported["msgId"]},
    )
    assert_api.assert_result_matches(imported_get, msgId=imported["msgId"])

    delete_conv = primary_device.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    assert_api.assert_result_equals(delete_conv, True)

    clear_all = primary_device.call("ChatManager", Cmd.deleteAllMessageAndConversation.value, info={})
    assert_api.assert_result_equals(clear_all, True)

    empty_convs = primary_device.call("ChatManager", Cmd.loadAllConversations.value, info={})
    assert_api.assert_result_equals(empty_convs, [])
