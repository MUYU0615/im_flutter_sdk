from __future__ import annotations

import pytest

from src import Cmd
from tests.chat._message_helpers import send_text_and_wait


pytestmark = pytest.mark.no_global_login


class _NoopAssertApi:
    def assert_response_matches(self, *_args, **_kwargs):
        return None


class _FakeDevice:
    def __init__(self, *, responses=None, events=None):
        self.responses = list(responses or [])
        self.events = list(events or [])

    def drain_events(self, timeout=2.0):
        return None

    def call(self, *_args, **_kwargs):
        return self.responses.pop(0)

    def receive_message(self, *, match_event_type=None, timeout=10.0):
        return self.events.pop(0) if self.events else None


def test_send_text_and_receive_returns_success_message_id_when_receiver_id_differs():
    content = "chat-mark-helper"
    device_a = _FakeDevice(
        responses=[
            {
                "manager": "ChatManager",
                "cmd": Cmd.sendMessage.value,
                "device": "deviceA",
                "result": {
                    "msgId": "temp-msg-id",
                    "from": "user_a",
                    "to": "user_b",
                    "convId": "user_b",
                    "chatType": 0,
                    "direction": 0,
                    "status": 0,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "isListened": False,
                    "broadcast": False,
                    "onlineState": True,
                    "body": {"targetLanguages": [], "translations": {}, "type": 0, "content": content},
                },
            }
        ],
        events=[
            {
                "type": "event",
                "eventType": Cmd.onMessageSuccess.value,
                "data": {
                    "msg": {
                        "msgId": "success-msg-id",
                        "from": "user_a",
                        "to": "user_b",
                        "convId": "user_b",
                        "chatType": 0,
                        "status": 2,
                        "body": {"type": 0, "content": content},
                    }
                },
            }
        ],
    )
    device_b = _FakeDevice(
        events=[
            {
                "type": "event",
                "eventType": Cmd.onMessagesReceived.value,
                "data": {
                    "messages": [
                        {
                            "msgId": "receiver-msg-id",
                            "from": "user_a",
                            "to": "user_b",
                            "convId": "user_a",
                            "chatType": 0,
                            "body": {"type": 0, "content": content},
                        }
                    ]
                },
            }
        ],
    )

    _resp, success_msg, _received_msg = send_text_and_wait(
        device_a,
        device_b,
        user_a="user_a",
        user_b="user_b",
        content=content,
    )
    assert success_msg["msgId"] == "success-msg-id"
