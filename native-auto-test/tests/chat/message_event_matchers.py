from __future__ import annotations

from src.tools.event_group_waiter import EventExpectation


def expect_message_error(client, *, marker: str) -> EventExpectation:
    return EventExpectation(
        name=f"{client.name} message error",
        client=client,
        event_type="onMessageError",
        predicate=lambda event: marker in str(event),
        correlation="strong",
    )


def expect_received_message(client, *, marker: str) -> EventExpectation:
    return EventExpectation(
        name=f"{client.name} received message",
        client=client,
        event_type="onMessagesReceived",
        predicate=lambda event: marker in str(event),
        correlation="strong",
    )
