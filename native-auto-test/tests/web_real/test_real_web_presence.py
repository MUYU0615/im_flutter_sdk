"""Real Web SDK/service PresenceManager E2E cases."""

from __future__ import annotations

import time
import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client, pytest.mark.real_web]


def _presence_for(result, user_id):
    assert isinstance(result, list)
    for item in result:
        if isinstance(item, dict) and item.get("publisher") == user_id:
            return item
    return None


def test_real_web_presence_publish_subscribe_query_unsubscribe(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
):
    desc = f"web-presence-{uuid.uuid4().hex[:8]}"

    publish = primary_device.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": desc},
    )
    assert_api.assert_success(publish)
    assert_api.assert_result_equals(publish, None)

    subscribe = secondary_device.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": 3600},
    )
    subscribe_result = assert_api.get_result(subscribe)
    subscribed_presence = _presence_for(subscribe_result, user_a)
    assert subscribed_presence is not None

    status = secondary_device.call(
        "PresenceManager",
        Cmd.fetchPresenceStatus.value,
        info={"members": [user_a]},
    )
    status_result = assert_api.get_result(status)
    fetched_presence = _presence_for(status_result, user_a)
    assert fetched_presence is not None
    assert fetched_presence.get("statusDescription") == desc

    members = secondary_device.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    members_result = assert_api.get_result(members)
    assert isinstance(members_result, list)
    assert user_a in members_result

    unsubscribe = secondary_device.call(
        "PresenceManager",
        Cmd.presenceUnsubscribe.value,
        info={"members": [user_a]},
    )
    assert_api.assert_success(unsubscribe)
    assert_api.assert_result_equals(unsubscribe, None)

    members_after = secondary_device.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    members_after_result = assert_api.get_result(members_after)
    assert isinstance(members_after_result, list)
    assert user_a not in members_after_result


@pytest.mark.xfail(
    reason=(
        "Web SDK2 当前实测 presence publish/subscribe/query 成功，"
        "但订阅端不派发 onPresenceStatusChanged 实时事件。"
    ),
)
def test_real_web_presence_status_changed_event_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
):
    baseline = f"web-presence-baseline-{uuid.uuid4().hex[:8]}"
    reset = primary_device.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": baseline},
    )
    assert_api.assert_success(reset)

    secondary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.drain_events(timeout=0.5)

    subscribe = secondary_device.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": 3600},
    )
    assert_api.assert_success(subscribe)
    secondary_device.drain_events(timeout=0.5)
    time.sleep(1.0)

    desc = f"web-presence-event-{uuid.uuid4().hex[:8]}"
    publish = primary_device.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": desc},
    )
    assert_api.assert_success(publish)
    assert_api.assert_result_equals(publish, None)

    event = secondary_device.receive_message(
        match_event_type=Cmd.onPresenceStatusChanged.value,
        timeout=10.0,
    )
    assert event is not None
    assert event.get("eventType") == Cmd.onPresenceStatusChanged.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("operation") == "presence_status_changed"
    presences = data.get("presences")
    assert isinstance(presences, list)
    matched = None
    for item in presences:
        if isinstance(item, dict) and item.get("publisher") == user_a:
            matched = item
            break
    assert matched is not None
    assert matched.get("statusDescription") == desc
