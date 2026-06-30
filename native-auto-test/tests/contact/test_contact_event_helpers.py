from __future__ import annotations

from src.sdk_api.event_keys import ContactChangeEvent
from src.test_flow.model_test_flow import receive_contact_changed_event


class _FakeDevice:
    def __init__(self, events: list[dict]) -> None:
        self._events = events
        self.received_filters: list[str | None] = []

    def receive_message(self, *, match_event_type=None, timeout=10.0):
        self.received_filters.append(match_event_type)
        if not self._events:
            return None
        return self._events.pop(0)


def test_receive_contact_changed_event_matches_inner_contact_type():
    target = {
        "type": "event",
        "eventType": "onContactChanged",
        "data": {"type": ContactChangeEvent.INVITED.value, "userId": "user-a"},
    }
    device = _FakeDevice(
        [
            {
                "type": "event",
                "eventType": "onContactChanged",
                "data": {"type": ContactChangeEvent.CONTACT_ADD.value, "userId": "user-b"},
            },
            target,
        ]
    )

    event = receive_contact_changed_event(
        device,
        ContactChangeEvent.INVITED.value,
        timeout=1.0,
    )

    assert event == target
    assert device.received_filters == ["onContactChanged", "onContactChanged"]
