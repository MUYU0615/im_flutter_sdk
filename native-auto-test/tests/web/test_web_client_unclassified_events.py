"""Web Client callback event forwarding regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


CLIENT_EVENT_CASES = (
    (Cmd.onMultiDeviceGroupEvent, {"operation": "group", "groupId": "web-group"}),
    (Cmd.onMultiDeviceContactEvent, {"operation": "contact", "userId": "web-user"}),
    (Cmd.onMultiDeviceThreadEvent, {"operation": "thread", "threadId": "web-thread"}),
    (
        Cmd.onMultiDeviceRemoveMessagesEvent,
        {"operation": "remove_messages", "convId": "web-conv", "msgIds": ["web-msg"]},
    ),
    (
        Cmd.onMultiDevicesConversationEvent,
        {"operation": "conversation", "convId": "web-conv"},
    ),
    (
        Cmd.onUserDidLoginFromOtherDevice,
        {"operation": "login_other_device", "deviceName": "web-other"},
    ),
    (Cmd.onUserDidRemoveFromServer, {"operation": "removed_from_server"}),
    (Cmd.onUserDidForbidByServer, {"operation": "forbid_by_server"}),
    (Cmd.onUserDidChangePassword, {"operation": "change_password"}),
    (Cmd.onUserDidLoginTooManyDevice, {"operation": "too_many_device"}),
    (Cmd.onUserKickedByOtherDevice, {"operation": "kicked_by_other_device"}),
    (Cmd.onUserAuthenticationFailed, {"operation": "authentication_failed"}),
    (Cmd.onSendDataToFlutter, {"operation": "send_data", "payload": {"k": "v"}}),
    (Cmd.onTokenWillExpire, {"operation": "token_will_expire"}),
    (Cmd.onTokenDidExpire, {"operation": "token_did_expire"}),
    (Cmd.onAppActiveNumberReachLimit, {"operation": "app_active_number_reach_limit"}),
)


@pytest.mark.parametrize(("event_cmd", "payload"), CLIENT_EVENT_CASES)
def test_web_client_unclassified_events_are_forwarded(
    primary_device,
    assert_api,
    require_capability,
    event_cmd,
    payload,
):
    require_capability("Client", Cmd.startCallback.value)
    require_capability("Unclassified", event_cmd.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    resp = primary_device.call(
        "Client",
        "emitTestEvent",
        info={"eventType": event_cmd.value, "data": payload},
    )
    assert_api.assert_result_equals(resp, True)

    event = primary_device.receive_message(
        match_event_type=event_cmd.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == event_cmd.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("operation") == payload["operation"]
    assert data.get("device") == "webA"
