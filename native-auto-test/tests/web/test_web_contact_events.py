"""Web ContactManager event forwarding regression cases."""

from __future__ import annotations

import pytest

from src import Cmd
from src.sdk_api.event_keys import ContactChangeEvent


pytestmark = [pytest.mark.web, pytest.mark.contact]


def test_web_contact_add_emits_contact_added_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ContactManager", Cmd.addContact.value)
    require_capability("ContactManager", Cmd.onContactChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    resp = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "web-contact-event"},
    )
    assert_api.assert_result_equals(resp, user_b)

    event = primary_device.receive_message(
        match_event_type=ContactChangeEvent.CONTACT_ADD.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == ContactChangeEvent.CONTACT_ADD.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("userId") == user_b
    assert data.get("operation") == "add"


def test_web_contact_delete_emits_contact_deleted_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ContactManager", Cmd.addContact.value)
    require_capability("ContactManager", Cmd.deleteContact.value)
    require_capability("ContactManager", Cmd.onContactChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "web-contact-delete-event"},
    )
    assert_api.assert_result_equals(add, user_b)
    primary_device.drain_events(timeout=0.2)

    delete = primary_device.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": user_b, "keepConversation": True},
    )
    assert_api.assert_result_equals(delete, user_b)

    event = primary_device.receive_message(
        match_event_type=ContactChangeEvent.CONTACT_DELETE.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == ContactChangeEvent.CONTACT_DELETE.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("userId") == user_b
    assert data.get("operation") == "delete"
