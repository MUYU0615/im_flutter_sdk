"""Web PresenceManager local state regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.presence]


def test_web_presence_local_publish_subscribe_fetch_and_unsubscribe(
    primary_device,
    assert_api,
    user_a,
    user_b,
    user_c,
    require_capability,
):
    for cmd in (
        Cmd.presenceWithDescription,
        Cmd.presenceSubscribe,
        Cmd.fetchPresenceStatus,
        Cmd.fetchSubscribedMembersWithPageNum,
        Cmd.presenceUnsubscribe,
    ):
        require_capability("PresenceManager", cmd.value)

    publish = primary_device.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": "web available"},
    )
    assert_api.assert_result_equals(publish, None)

    subscribe = primary_device.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a, user_b, user_c], "expiry": 3600},
    )
    subscribed = assert_api.get_result(subscribe)
    assert [item["publisher"] for item in subscribed] == [user_a, user_b, user_c]
    assert subscribed[0]["statusDescription"] == "web available"
    assert subscribed[1]["statusDescription"] == ""

    status = primary_device.call(
        "PresenceManager",
        Cmd.fetchPresenceStatus.value,
        info={"members": [user_a, user_b]},
    )
    statuses = assert_api.get_result(status)
    assert [item["publisher"] for item in statuses] == [user_a, user_b]
    assert statuses[0]["statusDescription"] == "web available"

    first_page = primary_device.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 2},
    )
    assert_api.assert_result_equals(first_page, [user_a, user_b])

    second_page = primary_device.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 2, "pageSize": 2},
    )
    assert_api.assert_result_equals(second_page, [user_c])

    unsubscribe = primary_device.call(
        "PresenceManager",
        Cmd.presenceUnsubscribe.value,
        info={"members": [user_b]},
    )
    assert_api.assert_result_equals(unsubscribe, None)

    after_unsubscribe = primary_device.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 10},
    )
    assert_api.assert_result_equals(after_unsubscribe, [user_a, user_c])


def test_web_presence_publish_emits_presence_status_changed_event(
    primary_device,
    assert_api,
    user_a,
    require_capability,
):
    require_capability("PresenceManager", Cmd.presenceWithDescription.value)
    require_capability("MessageManager", Cmd.onPresenceStatusChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    publish = primary_device.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": "web busy"},
    )
    assert_api.assert_result_equals(publish, None)

    presence_event = primary_device.receive_message(
        match_event_type=Cmd.onPresenceStatusChanged.value,
        timeout=5.0,
    )
    assert presence_event is not None
    assert presence_event.get("type") == "event"
    assert presence_event.get("eventType") == Cmd.onPresenceStatusChanged.value
    presence_data = presence_event.get("data")
    assert isinstance(presence_data, dict)
    assert presence_data.get("operation") == "presence_status_changed"
    presences = presence_data.get("presences")
    assert isinstance(presences, list)
    assert presences[0]["publisher"] == user_a
    assert presences[0]["statusDescription"] == "web busy"
    assert presences[0]["statusDetails"] == {"web": 1}
