"""Web ChatManager event forwarding regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text


pytestmark = [pytest.mark.web, pytest.mark.chat]


def test_web_chat_send_and_recall_emit_message_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatManager", Cmd.sendMessage.value)
    require_capability("ChatManager", Cmd.recallMessage.value)
    require_capability("MessageManager", Cmd.onMessagesReceived.value)
    require_capability("MessageManager", Cmd.onMessageSuccess.value)
    require_capability("MessageManager", Cmd.onMessagesRecalled.value)
    require_capability("MessageManager", Cmd.onMessagesRecalledInfo.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    content = f"web-chat-event-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]

    received_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=5.0,
    )
    assert received_event is not None
    assert received_event.get("type") == "event"
    assert received_event.get("eventType") == Cmd.onMessagesReceived.value
    received_data = received_event.get("data")
    assert isinstance(received_data, dict)
    assert received_data.get("operation") == "messages_received"
    messages = received_data.get("messages")
    assert isinstance(messages, list)
    assert messages[0]["msgId"] == msg_id
    assert messages[0]["from"] == user_a
    assert messages[0]["to"] == user_b
    assert messages[0]["body"] == {"type": 0, "content": content}

    success_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=5.0,
    )
    assert success_event is not None
    assert success_event.get("type") == "event"
    assert success_event.get("eventType") == Cmd.onMessageSuccess.value
    success_data = success_event.get("data")
    assert isinstance(success_data, dict)
    assert success_data.get("operation") == "message_success"
    assert success_data.get("msg", {}).get("msgId") == msg_id
    assert success_data.get("msg", {}).get("from") == user_a
    assert success_data.get("msg", {}).get("to") == user_b

    recall = primary_device.call(
        "ChatManager",
        Cmd.recallMessage.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_equals(recall, True)

    recall_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesRecalled.value,
        timeout=5.0,
    )
    assert recall_event is not None
    assert recall_event.get("type") == "event"
    assert recall_event.get("eventType") == Cmd.onMessagesRecalled.value
    recall_data = recall_event.get("data")
    assert isinstance(recall_data, dict)
    assert recall_data.get("operation") == "messages_recalled"
    recalled = recall_data.get("messages")
    assert isinstance(recalled, list)
    assert recalled[0]["msgId"] == msg_id

    recall_info_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesRecalledInfo.value,
        timeout=5.0,
    )
    assert recall_info_event is not None
    assert recall_info_event.get("type") == "event"
    assert recall_info_event.get("eventType") == Cmd.onMessagesRecalledInfo.value
    recall_info_data = recall_info_event.get("data")
    assert isinstance(recall_info_data, dict)
    assert recall_info_data.get("operation") == "messages_recalled_info"
    infos = recall_info_data.get("infos")
    assert isinstance(infos, list)
    assert infos[0]["recallMsgId"] == msg_id
    assert infos[0]["recallBy"] == user_a
    assert infos[0]["convId"] == user_b
    assert infos[0]["msg"]["msgId"] == msg_id


def test_web_chat_cmd_message_emits_cmd_received_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatManager", Cmd.sendMessage.value)
    require_capability("MessageManager", Cmd.onCmdMessagesReceived.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    action = f"web-cmd-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info={
            "from": user_a,
            "to": user_b,
            "chatType": 0,
            "direction": 0,
            "body": {
                "type": 6,
                "action": action,
                "deliverOnlineOnly": True,
            },
            "hasReadAck": False,
            "needGroupAck": False,
            "isThread": False,
            "deliverOnlineOnly": True,
        },
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]

    cmd_event = primary_device.receive_message(
        match_event_type=Cmd.onCmdMessagesReceived.value,
        timeout=5.0,
    )
    assert cmd_event is not None
    assert cmd_event.get("type") == "event"
    assert cmd_event.get("eventType") == Cmd.onCmdMessagesReceived.value
    cmd_data = cmd_event.get("data")
    assert isinstance(cmd_data, dict)
    assert cmd_data.get("operation") == "cmd_messages_received"
    messages = cmd_data.get("messages")
    assert isinstance(messages, list)
    assert messages[0]["msgId"] == msg_id
    assert messages[0]["from"] == user_a
    assert messages[0]["to"] == user_b
    assert messages[0]["body"] == {
        "type": 6,
        "action": action,
        "deliverOnlineOnly": True,
    }


def test_web_chat_stream_message_emits_stream_received_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatManager", Cmd.sendMessage.value)
    require_capability("MessageManager", Cmd.onStreamMessagesReceived.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    content = f"web-stream-{uuid.uuid4().hex[:8]}"
    stream_chunk = {
        "status": 1,
        "errorCode": 0,
        "finishReason": 0,
        "text": content,
        "customType": "web-e2e",
    }
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info={
            **build_text(user_a, user_b, content),
            "streamChunk": stream_chunk,
        },
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]

    stream_event = primary_device.receive_message(
        match_event_type=Cmd.onStreamMessagesReceived.value,
        timeout=5.0,
    )
    assert stream_event is not None
    assert stream_event.get("type") == "event"
    assert stream_event.get("eventType") == Cmd.onStreamMessagesReceived.value
    stream_data = stream_event.get("data")
    assert isinstance(stream_data, dict)
    assert stream_data.get("operation") == "stream_messages_received"
    messages = stream_data.get("messages")
    assert isinstance(messages, list)
    assert messages[0]["msgId"] == msg_id
    assert messages[0]["from"] == user_a
    assert messages[0]["to"] == user_b
    assert messages[0]["body"] == {"type": 0, "content": content}
    assert messages[0]["streamChunk"] == stream_chunk


def test_web_chat_modify_reaction_and_pin_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    for cmd in (
        Cmd.sendMessage,
        Cmd.modifyMessage,
        Cmd.addReaction,
        Cmd.removeReaction,
        Cmd.pinMessage,
        Cmd.unpinMessage,
        Cmd.onMessageChanged,
        Cmd.onMessageContentChanged,
        Cmd.onMessageReactionDidChange,
        Cmd.onMessagePinChanged,
    ):
        manager = "MessageManager" if cmd.name.startswith("on") else "ChatManager"
        require_capability(manager, cmd.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, f"web-chat-before-{uuid.uuid4().hex[:8]}"),
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]
    primary_device.drain_events(timeout=0.2)

    modified_body = {"type": 0, "content": f"web-chat-after-{uuid.uuid4().hex[:8]}"}
    modified = primary_device.call(
        "ChatManager",
        Cmd.modifyMessage.value,
        info={"msgId": msg_id, "body": modified_body},
    )
    assert assert_api.get_result(modified)["body"] == modified_body

    content_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageContentChanged.value,
        timeout=5.0,
    )
    assert content_event is not None
    assert content_event.get("type") == "event"
    assert content_event.get("eventType") == Cmd.onMessageContentChanged.value
    content_data = content_event.get("data")
    assert isinstance(content_data, dict)
    assert content_data.get("operation") == "message_content_changed"
    assert content_data.get("message", {}).get("msgId") == msg_id
    assert content_data.get("message", {}).get("body") == modified_body
    assert content_data.get("operatorId") == user_a

    changed_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageChanged.value,
        timeout=5.0,
    )
    assert changed_event is not None
    assert changed_event.get("type") == "event"
    assert changed_event.get("eventType") == Cmd.onMessageChanged.value
    changed_data = changed_event.get("data")
    assert isinstance(changed_data, dict)
    assert changed_data.get("operation") == "message_changed"
    assert changed_data.get("msg", {}).get("msgId") == msg_id
    assert changed_data.get("msg", {}).get("body") == modified_body

    add_reaction = primary_device.call(
        "ChatManager",
        Cmd.addReaction.value,
        info={"msgId": msg_id, "reaction": "like"},
    )
    assert_api.assert_result_equals(add_reaction, True)

    reaction_add_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageReactionDidChange.value,
        timeout=5.0,
    )
    assert reaction_add_event is not None
    assert reaction_add_event.get("eventType") == Cmd.onMessageReactionDidChange.value
    reaction_add_data = reaction_add_event.get("data")
    assert isinstance(reaction_add_data, dict)
    assert reaction_add_data.get("operation") == "reaction_added"
    assert reaction_add_data.get("msgId") == msg_id
    assert reaction_add_data.get("reaction") == "like"
    assert reaction_add_data.get("userId") == user_a

    remove_reaction = primary_device.call(
        "ChatManager",
        Cmd.removeReaction.value,
        info={"msgId": msg_id, "reaction": "like"},
    )
    assert_api.assert_result_equals(remove_reaction, True)

    reaction_remove_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageReactionDidChange.value,
        timeout=5.0,
    )
    assert reaction_remove_event is not None
    reaction_remove_data = reaction_remove_event.get("data")
    assert isinstance(reaction_remove_data, dict)
    assert reaction_remove_data.get("operation") == "reaction_removed"
    assert reaction_remove_data.get("msgId") == msg_id
    assert reaction_remove_data.get("reaction") == "like"
    assert reaction_remove_data.get("userId") == user_a

    pin = primary_device.call(
        "ChatManager",
        Cmd.pinMessage.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_equals(pin, True)

    pin_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagePinChanged.value,
        timeout=5.0,
    )
    assert pin_event is not None
    assert pin_event.get("type") == "event"
    assert pin_event.get("eventType") == Cmd.onMessagePinChanged.value
    pin_data = pin_event.get("data")
    assert isinstance(pin_data, dict)
    assert pin_data.get("operation") == "message_pinned"
    assert pin_data.get("msgId") == msg_id
    assert pin_data.get("convId") == user_b
    assert pin_data.get("operatorId") == user_a

    unpin = primary_device.call(
        "ChatManager",
        Cmd.unpinMessage.value,
        info={"msgId": msg_id},
    )
    assert_api.assert_result_equals(unpin, True)

    unpin_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagePinChanged.value,
        timeout=5.0,
    )
    assert unpin_event is not None
    unpin_data = unpin_event.get("data")
    assert isinstance(unpin_data, dict)
    assert unpin_data.get("operation") == "message_unpinned"
    assert unpin_data.get("msgId") == msg_id
    assert unpin_data.get("convId") == user_b
    assert unpin_data.get("operatorId") == user_a


def test_web_chat_resend_and_conversation_updates_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    for cmd in (
        Cmd.sendMessage,
        Cmd.resendMessage,
        Cmd.pinConversation,
        Cmd.deleteConversation,
        Cmd.onMessagesDelivered,
        Cmd.onMessageDeliveryAck,
        Cmd.onConversationUpdate,
    ):
        manager = "MessageManager" if cmd.name.startswith("on") else "ChatManager"
        require_capability(manager, cmd.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, f"web-delivery-{uuid.uuid4().hex[:8]}"),
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]
    primary_device.drain_events(timeout=0.2)

    resent = primary_device.call(
        "ChatManager",
        Cmd.resendMessage.value,
        info={"message": message},
    )
    resent_message = assert_api.get_result(resent)
    assert resent_message["msgId"] == msg_id

    delivered_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesDelivered.value,
        timeout=5.0,
    )
    assert delivered_event is not None
    assert delivered_event.get("type") == "event"
    assert delivered_event.get("eventType") == Cmd.onMessagesDelivered.value
    delivered_data = delivered_event.get("data")
    assert isinstance(delivered_data, dict)
    assert delivered_data.get("operation") == "messages_delivered"
    delivered = delivered_data.get("messages")
    assert isinstance(delivered, list)
    assert delivered[0]["msgId"] == msg_id
    assert delivered[0]["status"] == 2

    delivery_ack_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageDeliveryAck.value,
        timeout=5.0,
    )
    assert delivery_ack_event is not None
    assert delivery_ack_event.get("type") == "event"
    assert delivery_ack_event.get("eventType") == Cmd.onMessageDeliveryAck.value
    delivery_ack_data = delivery_ack_event.get("data")
    assert isinstance(delivery_ack_data, dict)
    assert delivery_ack_data.get("operation") == "message_delivery_ack"
    assert delivery_ack_data.get("msg", {}).get("msgId") == msg_id
    assert delivery_ack_data.get("msg", {}).get("status") == 2

    pin_conv = primary_device.call(
        "ChatManager",
        Cmd.pinConversation.value,
        info={"convId": user_b, "isPinned": True},
    )
    assert_api.assert_result_equals(pin_conv, True)

    pin_conv_event = primary_device.receive_message(
        match_event_type=Cmd.onConversationUpdate.value,
        timeout=5.0,
    )
    assert pin_conv_event is not None
    assert pin_conv_event.get("type") == "event"
    assert pin_conv_event.get("eventType") == Cmd.onConversationUpdate.value
    pin_conv_data = pin_conv_event.get("data")
    assert isinstance(pin_conv_data, dict)
    assert pin_conv_data.get("operation") == "conversation_pinned"
    assert pin_conv_data.get("convId") == user_b
    assert pin_conv_data.get("isPinned") is True

    delete_conv = primary_device.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": user_b, "deleteMessages": True},
    )
    assert_api.assert_result_equals(delete_conv, True)

    delete_conv_event = primary_device.receive_message(
        match_event_type=Cmd.onConversationUpdate.value,
        timeout=5.0,
    )
    assert delete_conv_event is not None
    delete_conv_data = delete_conv_event.get("data")
    assert isinstance(delete_conv_data, dict)
    assert delete_conv_data.get("operation") == "conversation_deleted"
    assert delete_conv_data.get("convId") == user_b
    assert delete_conv_data.get("deleteMessages") is True


def test_web_chat_read_ack_emit_read_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    for cmd in (
        Cmd.sendMessage,
        Cmd.ackMessageRead,
        Cmd.ackConversationRead,
        Cmd.onMessagesRead,
        Cmd.onMessageReadAck,
        Cmd.onConversationHasRead,
    ):
        manager = "MessageManager" if cmd.name.startswith("on") else "ChatManager"
        require_capability(manager, cmd.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, f"web-read-{uuid.uuid4().hex[:8]}"),
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]
    primary_device.drain_events(timeout=0.2)

    ack = primary_device.call(
        "ChatManager",
        Cmd.ackMessageRead.value,
        info={"msgId": msg_id, "to": user_b},
    )
    assert_api.assert_result_equals(ack, 1)

    read_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesRead.value,
        timeout=5.0,
    )
    assert read_event is not None
    assert read_event.get("type") == "event"
    assert read_event.get("eventType") == Cmd.onMessagesRead.value
    read_data = read_event.get("data")
    assert isinstance(read_data, dict)
    assert read_data.get("operation") == "messages_read"
    messages = read_data.get("messages")
    assert isinstance(messages, list)
    assert messages[0]["msgId"] == msg_id
    assert messages[0]["hasReadAck"] is True

    read_ack_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageReadAck.value,
        timeout=5.0,
    )
    assert read_ack_event is not None
    assert read_ack_event.get("type") == "event"
    assert read_ack_event.get("eventType") == Cmd.onMessageReadAck.value
    read_ack_data = read_ack_event.get("data")
    assert isinstance(read_ack_data, dict)
    assert read_ack_data.get("operation") == "message_read_ack"
    assert read_ack_data.get("msg", {}).get("msgId") == msg_id
    assert read_ack_data.get("msg", {}).get("hasReadAck") is True

    conversation_ack = primary_device.call(
        "ChatManager",
        Cmd.ackConversationRead.value,
        info={"convId": user_b},
    )
    assert_api.assert_result_equals(conversation_ack, 1)

    conversation_read_event = primary_device.receive_message(
        match_event_type=Cmd.onConversationHasRead.value,
        timeout=5.0,
    )
    assert conversation_read_event is not None
    assert conversation_read_event.get("type") == "event"
    assert conversation_read_event.get("eventType") == Cmd.onConversationHasRead.value
    conversation_read_data = conversation_read_event.get("data")
    assert isinstance(conversation_read_data, dict)
    assert conversation_read_data.get("operation") == "conversation_has_read"
    assert conversation_read_data.get("convId") == user_b


def test_web_chat_group_read_ack_emits_group_ack_updated_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatManager", Cmd.sendMessage.value)
    require_capability("ChatManager", Cmd.ackGroupMessageRead.value)
    require_capability("MessageManager", Cmd.onGroupMessageRead.value)
    require_capability("MessageManager", Cmd.onReadAckForGroupMessageUpdated.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info={
            **build_text(
                user_a,
                user_b,
                f"web-group-read-ack-{uuid.uuid4().hex[:8]}",
                chat_type=1,
            ),
            "needGroupAck": True,
        },
    )
    message = assert_api.get_result(sent)
    msg_id = message["msgId"]
    primary_device.drain_events(timeout=0.2)

    ack = primary_device.call(
        "ChatManager",
        Cmd.ackGroupMessageRead.value,
        info={"msgId": msg_id, "groupId": user_b, "content": "web-read"},
    )
    assert_api.assert_result_equals(ack, 1)

    group_read_event = primary_device.receive_message(
        match_event_type=Cmd.onGroupMessageRead.value,
        timeout=5.0,
    )
    assert group_read_event is not None
    assert group_read_event.get("type") == "event"
    assert group_read_event.get("eventType") == Cmd.onGroupMessageRead.value
    group_read_data = group_read_event.get("data")
    assert isinstance(group_read_data, dict)
    assert group_read_data.get("operation") == "group_message_read"
    acks = group_read_data.get("acks")
    assert isinstance(acks, list)
    assert acks[0]["msgId"] == msg_id
    assert acks[0]["from"] == user_a
    assert acks[0]["content"] == "web-read"
    assert acks[0]["count"] == 1

    ack_event = primary_device.receive_message(
        match_event_type=Cmd.onReadAckForGroupMessageUpdated.value,
        timeout=5.0,
    )
    assert ack_event is not None
    assert ack_event.get("type") == "event"
    assert ack_event.get("eventType") == Cmd.onReadAckForGroupMessageUpdated.value
    ack_data = ack_event.get("data")
    assert isinstance(ack_data, dict)
    assert ack_data.get("operation") == "group_message_read_ack_updated"
    assert ack_data.get("msgId") == msg_id
    assert ack_data.get("groupId") == user_b
