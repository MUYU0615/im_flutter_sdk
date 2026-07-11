import pytest

from src.tools.event_group_waiter import EventExpectation, ForbiddenEvent, _redact_sensitive, wait_event_group


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


class BrokenClient:
    name = "broken_a"

    def receive_message(self, *, match_event_type=None, timeout=0.5):
        raise RuntimeError("socket closed")


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


def test_wait_event_group_records_optional_event_when_it_arrives():
    primary = FakeClient(
        "primary_a",
        [
            {"eventType": "onMessageSuccess", "data": {"content": "marker-1"}},
            {"eventType": "onMessagesRead", "data": {"content": "marker-1"}},
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
                name="read ack",
                client=primary,
                event_type="onMessagesRead",
                predicate=lambda event: event["data"]["content"] == "marker-1",
                required=False,
            ),
        ],
        timeout=0.1,
        poll_timeout=0.01,
    )

    assert result.ok is True
    assert sorted(result.matched) == ["read ack", "send success"]
    assert result.missing == []


def test_wait_event_group_does_not_require_absent_optional_event():
    primary = FakeClient(
        "primary_a",
        [
            {"eventType": "onMessageSuccess", "data": {"content": "marker-1"}},
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
                name="read ack",
                client=primary,
                event_type="onMessagesRead",
                predicate=lambda event: event["data"]["content"] == "marker-1",
                required=False,
            ),
        ],
        timeout=0.01,
        poll_timeout=0.01,
    )

    assert result.ok is True
    assert sorted(result.matched) == ["send success"]
    assert result.missing == []


def test_wait_event_group_fails_distinctly_on_unexpected_receive_error():
    with pytest.raises(AssertionError, match="事件接收异常: broken_a: socket closed"):
        wait_event_group(
            expected=[
                EventExpectation(
                    name="send success",
                    client=BrokenClient(),
                    event_type="onMessageSuccess",
                    predicate=lambda event: event["data"]["content"] == "marker-1",
                ),
            ],
            timeout=0.01,
            poll_timeout=0.01,
        )


def test_wait_event_group_missing_failure_names_partial_matches_and_ignored():
    primary = FakeClient(
        "primary_a",
        [
            {"eventType": "onMessagesReceived", "data": {"content": "external"}},
            {"eventType": "onMessageSuccess", "data": {"content": "marker-1"}},
        ],
    )
    remote = FakeClient("remote_c", [])

    with pytest.raises(AssertionError) as exc_info:
        wait_event_group(
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
            timeout=0.01,
            poll_timeout=0.01,
        )

    message = str(exc_info.value)
    assert "缺失事件: remote receive" in message
    assert "已匹配事件: send success" in message
    assert "ignored=primary_a:1" in message


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


def test_redact_sensitive_handles_normalized_token_and_secret_keys():
    payload = {
        "auth_token": "auth-value",
        "access_token": "access-value",
        "refresh_token": "refresh-value",
        "agoraToken": "agora-value",
        "agora_token": "agora-snake-value",
        "clientSecret": "client-secret-value",
        "Authorization": "bearer-value",
        "nested": {
            "private-key": "private-key-value",
            "normal": "visible",
            "items": [{"PASSWORD": "password-value"}],
        },
    }

    redacted = _redact_sensitive(payload)

    assert redacted["auth_token"] == "***REDACTED***"
    assert redacted["access_token"] == "***REDACTED***"
    assert redacted["refresh_token"] == "***REDACTED***"
    assert redacted["agoraToken"] == "***REDACTED***"
    assert redacted["agora_token"] == "***REDACTED***"
    assert redacted["clientSecret"] == "***REDACTED***"
    assert redacted["Authorization"] == "***REDACTED***"
    assert redacted["nested"]["private-key"] == "***REDACTED***"
    assert redacted["nested"]["items"][0]["PASSWORD"] == "***REDACTED***"
    assert redacted["nested"]["normal"] == "visible"
    assert payload["auth_token"] == "auth-value"
