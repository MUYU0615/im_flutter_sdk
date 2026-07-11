import pytest

from src.tools.event_group_waiter import EventExpectation, ForbiddenEvent, wait_event_group


pytestmark = pytest.mark.no_global_login


class FakeClient:
    def __init__(self, name, events):
        self.name = name
        self.events = list(events)

    def receive_message(self, *, match_event_type=None, timeout=0.5):
        while self.events:
            event = self.events.pop(0)
            if match_event_type is None or event.get("eventType") == match_event_type:
                return event
        raise TimeoutError("no event")


def test_wait_event_group_matches_unordered_and_records_ignored():
    primary = FakeClient(
        "primary_a",
        [
            {"eventType": "onMessagesReceived", "data": {"content": "external"}},
            {"eventType": "onMessageSuccess", "data": {"content": "marker-1"}},
        ],
    )
    remote = FakeClient(
        "remote_c",
        [
            {"eventType": "onMessagesReceived", "data": {"content": "marker-1"}},
        ],
    )

    result = wait_event_group(
        expected=[
            EventExpectation(
                name="send success",
                client=primary,
                event_type="onMessageSuccess",
                predicate=lambda event: event["data"]["content"] == "marker-1",
            ),
            EventExpectation(
                name="remote receive",
                client=remote,
                event_type="onMessagesReceived",
                predicate=lambda event: event["data"]["content"] == "marker-1",
            ),
        ],
        timeout=1.0,
        poll_timeout=0.01,
    )

    assert result.ok is True
    assert sorted(result.matched) == ["remote receive", "send success"]
    assert result.ignored["primary_a"][0]["data"]["content"] == "external"


def test_wait_event_group_fails_on_forbidden_event():
    remote = FakeClient(
        "remote_c",
        [
            {"eventType": "onConversationChanged", "data": {"operation": "pin"}},
        ],
    )

    with pytest.raises(AssertionError, match="禁止事件"):
        wait_event_group(
            expected=[],
            forbidden=[
                ForbiddenEvent(
                    name="remote account state",
                    client=remote,
                    event_type="onConversationChanged",
                    predicate=lambda event: event["data"]["operation"] == "pin",
                    window=0.01,
                )
            ],
            timeout=0.01,
            poll_timeout=0.01,
        )
