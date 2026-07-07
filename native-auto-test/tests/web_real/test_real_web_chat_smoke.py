"""Real Web SDK/service smoke cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text


pytestmark = [pytest.mark.web, pytest.mark.chat, pytest.mark.real_web]


def _clear_web_real_pending(primary_device, secondary_device, assert_api):
    for device in (primary_device, secondary_device):
        assert_api.assert_result_equals(
            device.call("ChatManager", "clearPendingRealTextMessages", info={}),
            True,
        )
        assert_api.assert_result_equals(
            device.call("ChatManager", "clearPendingRealSuccessMessages", info={}),
            True,
        )
        device.drain_events(timeout=0.2)


def _wait_for_received_text(device, content, timeout=30.0):
    deadline = __import__("time").time() + timeout
    while __import__("time").time() < deadline:
        event = device.receive_message(
            match_event_type=Cmd.onMessagesReceived.value,
            timeout=1.0,
        )
        if event is None:
            continue
        messages = (event.get("data") or {}).get("messages")
        if not isinstance(messages, list):
            continue
        for message in messages:
            if (
                isinstance(message, dict)
                and (message.get("body") or {}) == {"type": 0, "content": content}
            ):
                return event, message
    return None, None


def test_real_web_send_text_a_to_b(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)
    _clear_web_real_pending(primary_device, secondary_device, assert_api)

    content = f"real-web-text-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    sent_message = assert_api.get_result(sent)
    assert sent_message["from"] == user_a
    assert sent_message["to"] == user_b
    assert sent_message["body"] == {"type": 0, "content": content}
    assert sent_message["msgId"]

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    if success is None:
        primary_debug = assert_api.get_result(
            primary_device.call("Client", "getRealSdkDebug", info={})
        )
        secondary_debug = assert_api.get_result(
            secondary_device.call("Client", "getRealSdkDebug", info={})
        )
        leftovers = []
        for _ in range(5):
            event = primary_device.receive_message(timeout=1.0)
            if event is None:
                break
            leftovers.append(event)
        pytest.fail(
            "webA did not receive onMessageSuccess; "
            f"primary_debug={primary_debug!r}; secondary_debug={secondary_debug!r}; "
            f"leftover={leftovers!r}"
        )
    assert success.get("eventType") == Cmd.onMessageSuccess.value
    success_message = (success.get("data") or {}).get("msg")
    assert isinstance(success_message, dict)
    assert success_message["msgId"] == sent_message["msgId"]
    assert success_message["from"] == user_a
    assert success_message["to"] == user_b
    assert success_message["body"] == {"type": 0, "content": content}

    received, message = _wait_for_received_text(secondary_device, content, timeout=30.0)
    if received is None or message is None:
        debug_resp = secondary_device.call("Client", "getRealSdkDebug", info={})
        debug = assert_api.get_result(debug_resp)
        native_handler_state = assert_api.get_result(
            secondary_device.call("Client", "getNativeHandlerState", info={})
        )
        primary_native_handler_state = assert_api.get_result(
            primary_device.call("Client", "getNativeHandlerState", info={})
        )
        primary_debug = assert_api.get_result(
            primary_device.call("Client", "getRealSdkDebug", info={})
        )
        bridge_state = assert_api.get_result(
            secondary_device.call("Client", "getBridgeState", info={})
        )
        bridge_state_after_wait = assert_api.get_result(
            secondary_device.call("Client", "getBridgeState", info={})
        )
        leftovers = []
        for _ in range(5):
            event = secondary_device.receive_message(timeout=1.0)
            if event is None:
                break
            leftovers.append(event)
        pytest.fail(
            "webB did not receive onMessagesReceived; "
            f"primary_native_handler_state={primary_native_handler_state!r}; "
            f"native_handler_state={native_handler_state!r}; "
            f"bridge_state={bridge_state!r}; bridge_state_after_wait={bridge_state_after_wait!r}; "
            f"primary_debug={primary_debug!r}; debug={debug!r}; leftover={leftovers!r}"
        )
    assert received.get("eventType") == Cmd.onMessagesReceived.value
    assert message["from"] == user_a
    assert message["to"] == user_b
    assert message["body"] == {"type": 0, "content": content}


def test_real_web_send_message_with_type_text_a_to_b(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)
    _clear_web_real_pending(primary_device, secondary_device, assert_api)

    content = f"real-web-with-type-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessageWithType.value,
        info={
            "type": "txt",
            "payload": {
                "targetId": user_b,
                "content": content,
            },
            "chatType": 0,
        },
    )
    sent_message = assert_api.get_result(sent)
    assert sent_message["from"] == user_a
    assert sent_message["to"] == user_b
    assert sent_message["body"] == {"type": 0, "content": content}
    assert sent_message["msgId"]

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    assert success is not None
    assert success.get("eventType") == Cmd.onMessageSuccess.value
    success_message = (success.get("data") or {}).get("msg")
    assert isinstance(success_message, dict)
    assert success_message["msgId"] == sent_message["msgId"]
    assert success_message["from"] == user_a
    assert success_message["to"] == user_b
    assert success_message["body"] == {"type": 0, "content": content}

    received, _ = _wait_for_received_text(secondary_device, content, timeout=30.0)
    if received is None:
        debug_resp = secondary_device.call("Client", "getRealSdkDebug", info={})
        debug = assert_api.get_result(debug_resp)
        pytest.fail(
            "webB did not receive onMessagesReceived for sendMessageWithType; "
            f"debug={debug!r}"
        )
    assert received.get("eventType") == Cmd.onMessagesReceived.value


def test_real_web_resend_text_a_to_b(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)
    _clear_web_real_pending(primary_device, secondary_device, assert_api)

    content = f"real-web-resend-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    sent_message = assert_api.get_result(sent)
    assert sent_message["msgId"]

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    assert success is not None
    received, _ = _wait_for_received_text(secondary_device, content, timeout=30.0)
    assert received is not None

    resent = primary_device.call(
        "ChatManager",
        Cmd.resendMessage.value,
        info=sent_message,
    )
    resent_message = assert_api.get_result(resent)
    assert resent_message["from"] == user_a
    assert resent_message["to"] == user_b
    assert resent_message["body"] == {"type": 0, "content": content}
    assert resent_message["msgId"]

    success2 = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    if success2 is None:
        primary_debug = assert_api.get_result(
            primary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(
            "webA did not receive onMessageSuccess for resendMessage; "
            f"primary_debug={primary_debug!r}"
        )
    received2, _ = _wait_for_received_text(secondary_device, content, timeout=30.0)
    if received2 is None:
        secondary_debug = assert_api.get_result(
            secondary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(
            "webB did not receive onMessagesReceived for resendMessage; "
            f"secondary_debug={secondary_debug!r}"
        )


def test_real_web_send_message_with_type_combine_a_to_b(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    first = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, f"real-web-combine-a-{uuid.uuid4().hex[:8]}"),
    )
    first_message = assert_api.get_result(first)
    first_msg_id = first_message["msgId"]
    primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=30.0,
    )

    second = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, f"real-web-combine-b-{uuid.uuid4().hex[:8]}"),
    )
    second_message = assert_api.get_result(second)
    second_msg_id = second_message["msgId"]
    primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=30.0,
    )

    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessageWithType.value,
        info={
            "type": "combine",
            "payload": {
                "targetId": user_b,
                "title": f"real-web-combine-{uuid.uuid4().hex[:6]}",
                "summary": "combine summary",
                "compatibleText": "combine compatible",
                "msgIds": [first_msg_id, second_msg_id],
            },
            "chatType": 0,
        },
    )
    combine_sent = assert_api.get_result(sent)
    assert combine_sent["to"] == user_b
    assert combine_sent["body"]["type"] == 8

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=30.0,
    )
    if success is None:
        primary_debug = assert_api.get_result(
            primary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(
            "webA did not receive onMessageSuccess for combine message; "
            f"debug={primary_debug!r}"
        )

    received = secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=30.0,
    )
    if received is None:
        secondary_debug = assert_api.get_result(
            secondary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(
            "webB did not receive onMessagesReceived for combine message; "
            f"debug={secondary_debug!r}"
        )

    messages = (received.get("data") or {}).get("messages")
    assert isinstance(messages, list) and messages
    combine_received = next(
        (
            message
            for message in messages
            if isinstance(message, dict)
            and message.get("to") == user_b
            and (message.get("body") or {}).get("type") == 8
        ),
        None,
    )
    assert combine_received is not None, received

    parsed = secondary_device.call(
        "ChatManager",
        Cmd.downloadAndParseCombineMessage.value,
        info={"message": combine_received},
    )
    parsed_result = assert_api.get_result(parsed)
    assert isinstance(parsed_result, list)
    parsed_ids = {item.get("msgId") for item in parsed_result if isinstance(item, dict)}
    assert {first_msg_id, second_msg_id}.issubset(parsed_ids), parsed_result

def test_real_web_send_text_emits_delivery_ack_to_sender(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    content = f"real-web-delivery-{uuid.uuid4().hex[:8]}"
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
    received_messages = (received.get("data") or {}).get("messages")
    assert isinstance(received_messages, list) and received_messages
    assert received_messages[0].get("msgId") == msg_id

    delivered_event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesDelivered.value,
        timeout=20.0,
    )
    if delivered_event is None:
        primary_debug = assert_api.get_result(
            primary_device.call("Client", "getRealSdkDebug", info={})
        )
        secondary_debug = assert_api.get_result(
            secondary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(
            "webA did not receive real Web SDK delivery ack; "
            f"primary_debug={primary_debug!r}; secondary_debug={secondary_debug!r}"
        )
    assert delivered_event.get("eventType") == Cmd.onMessagesDelivered.value
    delivered_data = delivered_event.get("data")
    assert isinstance(delivered_data, dict)
    assert delivered_data.get("operation") == "messages_delivered"
    delivered = delivered_data.get("messages")
    assert isinstance(delivered, list) and delivered
    assert delivered[0]["msgId"] == msg_id
    assert delivered[0]["status"] == 2

    delivery_ack_event = primary_device.receive_message(
        match_event_type=Cmd.onMessageDeliveryAck.value,
        timeout=5.0,
    )
    assert delivery_ack_event is not None
    assert delivery_ack_event.get("eventType") == Cmd.onMessageDeliveryAck.value
    delivery_ack_data = delivery_ack_event.get("data")
    assert isinstance(delivery_ack_data, dict)
    assert delivery_ack_data.get("operation") == "message_delivery_ack"
    assert delivery_ack_data.get("msg", {}).get("msgId") == msg_id


def test_real_web_send_cmd_message_b_receives_cmd_event(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    action = f"typing-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessageWithType.value,
        info={
            "type": "cmd",
            "payload": {
                "targetId": user_b,
                "action": action,
            },
            "chatType": 0,
        },
    )
    sent_message = assert_api.get_result(sent)
    assert sent_message["from"] == user_a
    assert sent_message["to"] == user_b
    assert sent_message["body"] == {"type": 6, "action": action}

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    assert success is not None

    received = secondary_device.receive_message(
        match_event_type=Cmd.onCmdMessagesReceived.value,
        timeout=30.0,
    )
    if received is None:
        debug_resp = secondary_device.call("Client", "getRealSdkDebug", info={})
        debug = assert_api.get_result(debug_resp)
        pytest.fail(
            "webB did not receive onCmdMessagesReceived; "
            f"debug={debug!r}"
        )
    data = received.get("data")
    assert isinstance(data, dict)
    messages = data.get("messages")
    assert isinstance(messages, list) and messages
    message = messages[0]
    assert message["from"] == user_a
    assert message["to"] == user_b
    assert message["body"] == {"type": 6, "action": action}
    assert message.get("msgId")
