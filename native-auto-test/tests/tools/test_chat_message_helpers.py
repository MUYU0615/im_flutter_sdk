from __future__ import annotations

import pytest

from tests.chat._message_helpers import (
    extract_success_message,
    matches_received_text,
    received_messages,
    wait_for_matching_event_message,
    wait_for_success_message,
)


pytestmark = pytest.mark.no_global_login


class _FakeDevice:
    def __init__(self, events):
        self.events = list(events)

    def receive_message(self, *, match_event_type=None, timeout=10.0):
        return self.events.pop(0) if self.events else None


def test_extract_success_message_uses_final_message_event():
    event = {
        "type": "event",
        "eventType": "onMessageSuccess",
        "data": {
            "msg": {
                "msgId": "server-id",
                "from": "user_a",
                "to": "user_b",
                "convId": "user_b",
                "chatType": 0,
                "status": 2,
                "body": {"type": 0, "content": "hello"},
            }
        },
    }

    assert extract_success_message(event, from_user="user_a", to_user="user_b", content="hello")["msgId"] == "server-id"


def test_matches_received_text_does_not_require_sender_temp_msg_id():
    assert matches_received_text(
        {
            "msgId": "receiver-server-id",
            "from": "user_a",
            "to": "user_b",
            "convId": "user_a",
            "chatType": 0,
            "body": {"type": 0, "content": "hello"},
        },
        from_user="user_a",
        to_user="user_b",
        content="hello",
    )


def test_matches_received_text_uses_group_conversation_id_for_group_chat():
    assert matches_received_text(
        {
            "msgId": "group-message-id",
            "from": "user_b",
            "to": "group_id",
            "convId": "group_id",
            "chatType": 1,
            "body": {"type": 0, "content": "group hello"},
        },
        from_user="user_b",
        to_user="group_id",
        content="group hello",
        chat_type=1,
    )


def test_received_message_match_can_return_receiver_side_msg_id():
    event = {
        "type": "event",
        "eventType": "onMessagesReceived",
        "data": {
            "messages": [
                {
                    "msgId": "receiver-side-id",
                    "from": "user_a",
                    "to": "user_b",
                    "convId": "user_a",
                    "chatType": 0,
                    "body": {"type": 0, "content": "same-content"},
                }
            ]
        },
    }

    matched = next(
        msg
        for msg in received_messages(event)
        if matches_received_text(msg, from_user="user_a", to_user="user_b", content="same-content")
    )

    assert matched["msgId"] == "receiver-side-id"


def test_wait_for_matching_event_message_skips_unrelated_events():
    device = _FakeDevice(
        [
            {
                "type": "event",
                "eventType": "onMessagesReceived",
                "data": {
                    "messages": [
                        {
                            "from": "other",
                            "to": "user_b",
                            "convId": "other",
                            "chatType": 0,
                            "body": {"type": 0, "content": "noise"},
                        }
                    ]
                },
            },
            {
                "type": "event",
                "eventType": "onMessagesReceived",
                "data": {
                    "messages": [
                        {
                            "from": "user_a",
                            "to": "user_b",
                            "convId": "user_a",
                            "chatType": 0,
                            "body": {"type": 0, "content": "target"},
                        }
                    ]
                },
            },
        ]
    )

    msg = wait_for_matching_event_message(
        device,
        event_type="onMessagesReceived",
        from_user="user_a",
        to_user="user_b",
        content="target",
        attempts=2,
        timeout=0.01,
    )

    assert msg["body"]["content"] == "target"


def test_wait_for_success_message_skips_local_status_zero_event():
    device = _FakeDevice(
        [
            {
                "type": "event",
                "eventType": "onMessageSuccess",
                "data": {
                    "msg": {
                        "msgId": "temp-id",
                        "from": "user_a",
                        "to": "user_b",
                        "convId": "user_b",
                        "chatType": 0,
                        "status": 0,
                        "body": {"type": 0, "content": "target"},
                    }
                },
            },
            {
                "type": "event",
                "eventType": "onMessageSuccess",
                "data": {
                    "msg": {
                        "msgId": "server-id",
                        "from": "user_a",
                        "to": "user_b",
                        "convId": "user_b",
                        "chatType": 0,
                        "status": 2,
                        "body": {"type": 0, "content": "target"},
                    }
                },
            },
        ]
    )

    msg = wait_for_success_message(device, from_user="user_a", to_user="user_b", content="target", attempts=2, timeout=0.01)

    assert msg["msgId"] == "server-id"
