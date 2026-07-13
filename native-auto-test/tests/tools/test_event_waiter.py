from __future__ import annotations

import pytest

from src.tools.event_waiter import summarize_event, wait_event_matching


pytestmark = pytest.mark.no_global_login


class _FakeDevice:
    def __init__(self, events):
        self.events = list(events)
        self.calls = []

    def receive_message(self, *, match_event_type=None, timeout=10.0):
        self.calls.append({"match_event_type": match_event_type, "timeout": timeout})
        return self.events.pop(0) if self.events else None


def _event(content: str, *, from_user: str = "user_a", status: int = 2) -> dict:
    return {
        "type": "event",
        "eventType": "onMessageSuccess",
        "data": {
            "msg": {
                "msgId": f"id-{content}",
                "from": from_user,
                "to": "user_b",
                "convId": "user_b",
                "chatType": 0,
                "status": status,
                "body": {"type": 0, "content": content},
            }
        },
    }


def test_wait_event_matching_skips_unrelated_events_until_predicate_matches():
    device = _FakeDevice([_event("old"), _event("target")])

    matched = wait_event_matching(
        device,
        event_type="onMessageSuccess",
        predicate=lambda event: event["data"]["msg"]["body"]["content"] == "target",
        timeout=1.0,
        poll_timeout=0.01,
        description="target message",
    )

    assert matched["data"]["msg"]["msgId"] == "id-target"
    assert [call["match_event_type"] for call in device.calls] == ["onMessageSuccess", "onMessageSuccess"]


def test_wait_event_matching_timeout_reports_ignored_event_summary():
    device = _FakeDevice([_event("s3-pin-c16bf2", from_user="other")])

    with pytest.raises(AssertionError) as exc_info:
        wait_event_matching(
            device,
            event_type="onMessageSuccess",
            predicate=lambda event: event["data"]["msg"]["body"]["content"] == "s3-history-099585",
            timeout=0.01,
            poll_timeout=0.01,
            description="history message",
        )

    msg = str(exc_info.value)
    assert "history message" in msg
    assert "ignored_events=1" in msg
    assert "s3-pin-c16bf2" in msg
    assert "other" in msg


def test_summarize_event_extracts_message_fields_for_debugging():
    summary = summarize_event(_event("target", status=0))

    assert summary == {
        "eventType": "onMessageSuccess",
        "from": "user_a",
        "to": "user_b",
        "convId": "user_b",
        "chatType": 0,
        "msgId": "id-target",
        "status": 0,
        "body.type": 0,
        "body.content": "target",
        "operation": None,
    }
