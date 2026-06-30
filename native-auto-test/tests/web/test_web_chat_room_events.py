"""Web ChatRoomManager event forwarding regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import ChatRoomEvent, Cmd


pytestmark = [pytest.mark.web, pytest.mark.chatroom]


def test_web_chat_room_create_emits_specification_changed_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    room_name = f"web-room-event-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": room_name,
            "desc": "web room event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]

    event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_SPECIFICATION_CHANGED.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == ChatRoomEvent.ON_SPECIFICATION_CHANGED.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("roomId") == room_id
    assert data.get("name") == room_name
    assert data.get("owner") == user_a
    assert data.get("operation") == "create"


def test_web_chat_room_destroy_emits_room_destroyed_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.destroyChatRoom.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    room_name = f"web-room-destroy-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": room_name,
            "desc": "web room destroy event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    destroy = primary_device.call(
        "ChatRoomManager",
        Cmd.destroyChatRoom.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(destroy, None)

    event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_CHAT_ROOM_DESTROYED.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == ChatRoomEvent.ON_CHAT_ROOM_DESTROYED.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("roomId") == room_id
    assert data.get("name") == room_name
    assert data.get("operation") == "destroy"


def test_web_chat_room_subject_change_emits_specification_changed_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.changeChatRoomSubject.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-before-{uuid.uuid4().hex[:8]}",
            "desc": "web room update event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    updated_name = f"web-room-updated-{uuid.uuid4().hex[:8]}"
    update = primary_device.call(
        "ChatRoomManager",
        Cmd.changeChatRoomSubject.value,
        info={"roomId": room_id, "subject": updated_name},
    )
    assert_api.assert_result_equals(update, None)

    event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_SPECIFICATION_CHANGED.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == ChatRoomEvent.ON_SPECIFICATION_CHANGED.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("roomId") == room_id
    assert data.get("name") == updated_name
    assert data.get("operation") == "update"


def test_web_chat_room_announcement_update_emits_announcement_changed_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.updateChatRoomAnnouncement.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-ann-{uuid.uuid4().hex[:8]}",
            "desc": "web room announcement event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    announcement = f"web-room-announcement-{uuid.uuid4().hex[:8]}"
    update = primary_device.call(
        "ChatRoomManager",
        Cmd.updateChatRoomAnnouncement.value,
        info={"roomId": room_id, "announcement": announcement},
    )
    assert_api.assert_result_equals(update, None)

    event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ANNOUNCEMENT_CHANGED.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == ChatRoomEvent.ON_ANNOUNCEMENT_CHANGED.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("roomId") == room_id
    assert data.get("announcement") == announcement
    assert data.get("operation") == "announcement"


def test_web_chat_room_admin_changes_emit_admin_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.addChatRoomAdmin.value)
    require_capability("ChatRoomManager", Cmd.removeChatRoomAdmin.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-admin-{uuid.uuid4().hex[:8]}",
            "desc": "web room admin event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    add = primary_device.call(
        "ChatRoomManager",
        Cmd.addChatRoomAdmin.value,
        info={"roomId": room_id, "admin": user_b},
    )
    assert_api.assert_result_equals(add, None)

    add_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ADMIN_ADDED.value,
        timeout=5.0,
    )
    assert add_event is not None
    assert add_event.get("type") == "event"
    assert add_event.get("eventType") == ChatRoomEvent.ON_ADMIN_ADDED.value
    add_data = add_event.get("data")
    assert isinstance(add_data, dict)
    assert add_data.get("roomId") == room_id
    assert add_data.get("admin") == user_b
    assert add_data.get("operation") == "admin_added"

    remove = primary_device.call(
        "ChatRoomManager",
        Cmd.removeChatRoomAdmin.value,
        info={"roomId": room_id, "admin": user_b},
    )
    assert_api.assert_result_equals(remove, None)

    remove_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ADMIN_REMOVED.value,
        timeout=5.0,
    )
    assert remove_event is not None
    assert remove_event.get("type") == "event"
    assert remove_event.get("eventType") == ChatRoomEvent.ON_ADMIN_REMOVED.value
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("roomId") == room_id
    assert remove_data.get("admin") == user_b
    assert remove_data.get("operation") == "admin_removed"


def test_web_chat_room_mute_changes_emit_mute_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.muteChatRoomMembers.value)
    require_capability("ChatRoomManager", Cmd.unMuteChatRoomMembers.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-mute-{uuid.uuid4().hex[:8]}",
            "desc": "web room mute event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    mute = primary_device.call(
        "ChatRoomManager",
        Cmd.muteChatRoomMembers.value,
        info={"roomId": room_id, "muteMembers": [user_b], "duration": 60000},
    )
    assert_api.assert_result_equals(mute, None)

    mute_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_MUTE_LIST_ADDED.value,
        timeout=5.0,
    )
    assert mute_event is not None
    assert mute_event.get("type") == "event"
    assert mute_event.get("eventType") == ChatRoomEvent.ON_MUTE_LIST_ADDED.value
    mute_data = mute_event.get("data")
    assert isinstance(mute_data, dict)
    assert mute_data.get("roomId") == room_id
    assert mute_data.get("members") == [user_b]
    assert mute_data.get("operation") == "mute_added"

    unmute = primary_device.call(
        "ChatRoomManager",
        Cmd.unMuteChatRoomMembers.value,
        info={"roomId": room_id, "unMuteMembers": [user_b]},
    )
    assert_api.assert_result_equals(unmute, None)

    unmute_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_MUTE_LIST_REMOVED.value,
        timeout=5.0,
    )
    assert unmute_event is not None
    assert unmute_event.get("type") == "event"
    assert unmute_event.get("eventType") == ChatRoomEvent.ON_MUTE_LIST_REMOVED.value
    unmute_data = unmute_event.get("data")
    assert isinstance(unmute_data, dict)
    assert unmute_data.get("roomId") == room_id
    assert unmute_data.get("members") == [user_b]
    assert unmute_data.get("operation") == "mute_removed"


def test_web_chat_room_white_list_changes_emit_white_list_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.addMembersToChatRoomWhiteList.value)
    require_capability("ChatRoomManager", Cmd.removeMembersFromChatRoomWhiteList.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-white-{uuid.uuid4().hex[:8]}",
            "desc": "web room white list event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    add = primary_device.call(
        "ChatRoomManager",
        Cmd.addMembersToChatRoomWhiteList.value,
        info={"roomId": room_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(add, None)

    add_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_WHITE_LIST_ADDED.value,
        timeout=5.0,
    )
    assert add_event is not None
    assert add_event.get("type") == "event"
    assert add_event.get("eventType") == ChatRoomEvent.ON_WHITE_LIST_ADDED.value
    add_data = add_event.get("data")
    assert isinstance(add_data, dict)
    assert add_data.get("roomId") == room_id
    assert add_data.get("members") == [user_b]
    assert add_data.get("operation") == "white_list_added"

    remove = primary_device.call(
        "ChatRoomManager",
        Cmd.removeMembersFromChatRoomWhiteList.value,
        info={"roomId": room_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(remove, None)

    remove_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_WHITE_LIST_REMOVED.value,
        timeout=5.0,
    )
    assert remove_event is not None
    assert remove_event.get("type") == "event"
    assert remove_event.get("eventType") == ChatRoomEvent.ON_WHITE_LIST_REMOVED.value
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("roomId") == room_id
    assert remove_data.get("members") == [user_b]
    assert remove_data.get("operation") == "white_list_removed"


def test_web_chat_room_join_leave_emit_member_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.leaveChatRoom.value)
    require_capability("ChatRoomManager", Cmd.joinChatRoom.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-member-{uuid.uuid4().hex[:8]}",
            "desc": "web room member event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]

    leave_first = primary_device.call(
        "ChatRoomManager",
        Cmd.leaveChatRoom.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(leave_first, None)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    join = primary_device.call(
        "ChatRoomManager",
        Cmd.joinChatRoom.value,
        info={"roomId": room_id},
    )
    assert assert_api.get_result(join)["roomId"] == room_id

    join_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_MEMBER_JOINED.value,
        timeout=5.0,
    )
    assert join_event is not None
    assert join_event.get("type") == "event"
    assert join_event.get("eventType") == ChatRoomEvent.ON_MEMBER_JOINED.value
    join_data = join_event.get("data")
    assert isinstance(join_data, dict)
    assert join_data.get("roomId") == room_id
    assert join_data.get("participant") == user_a
    assert join_data.get("operation") == "member_joined"

    leave = primary_device.call(
        "ChatRoomManager",
        Cmd.leaveChatRoom.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(leave, None)

    leave_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_MEMBER_EXITED.value,
        timeout=5.0,
    )
    assert leave_event is not None
    assert leave_event.get("type") == "event"
    assert leave_event.get("eventType") == ChatRoomEvent.ON_MEMBER_EXITED.value
    leave_data = leave_event.get("data")
    assert isinstance(leave_data, dict)
    assert leave_data.get("roomId") == room_id
    assert leave_data.get("participant") == user_a
    assert leave_data.get("operation") == "member_exited"


def test_web_chat_room_owner_and_all_mute_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.changeChatRoomOwner.value)
    require_capability("ChatRoomManager", Cmd.muteAllChatRoomMembers.value)
    require_capability("ChatRoomManager", Cmd.unMuteAllChatRoomMembers.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-owner-{uuid.uuid4().hex[:8]}",
            "desc": "web room owner event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    owner = primary_device.call(
        "ChatRoomManager",
        Cmd.changeChatRoomOwner.value,
        info={"roomId": room_id, "newOwner": user_b},
    )
    assert_api.assert_result_equals(owner, None)

    owner_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_OWNER_CHANGED.value,
        timeout=5.0,
    )
    assert owner_event is not None
    assert owner_event.get("type") == "event"
    assert owner_event.get("eventType") == ChatRoomEvent.ON_OWNER_CHANGED.value
    owner_data = owner_event.get("data")
    assert isinstance(owner_data, dict)
    assert owner_data.get("roomId") == room_id
    assert owner_data.get("newOwner") == user_b
    assert owner_data.get("oldOwner") == user_a
    assert owner_data.get("operation") == "owner_changed"

    mute_all = primary_device.call(
        "ChatRoomManager",
        Cmd.muteAllChatRoomMembers.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(mute_all, None)

    mute_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
        timeout=5.0,
    )
    assert mute_event is not None
    assert mute_event.get("type") == "event"
    assert (
        mute_event.get("eventType")
        == ChatRoomEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value
    )
    mute_data = mute_event.get("data")
    assert isinstance(mute_data, dict)
    assert mute_data.get("roomId") == room_id
    assert mute_data.get("isAllMuted") is True
    assert mute_data.get("operation") == "all_member_mute_changed"

    unmute_all = primary_device.call(
        "ChatRoomManager",
        Cmd.unMuteAllChatRoomMembers.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(unmute_all, None)

    unmute_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
        timeout=5.0,
    )
    assert unmute_event is not None
    unmute_data = unmute_event.get("data")
    assert isinstance(unmute_data, dict)
    assert unmute_data.get("roomId") == room_id
    assert unmute_data.get("isAllMuted") is False
    assert unmute_data.get("operation") == "all_member_mute_changed"


def test_web_chat_room_attribute_changes_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.setChatRoomAttributes.value)
    require_capability("ChatRoomManager", Cmd.removeChatRoomAttributes.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-attrs-{uuid.uuid4().hex[:8]}",
            "desc": "web room attributes event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    primary_device.drain_events(timeout=0.2)

    attrs = {"topic": f"web-{uuid.uuid4().hex[:6]}", "level": "1"}
    set_attrs = primary_device.call(
        "ChatRoomManager",
        Cmd.setChatRoomAttributes.value,
        info={"roomId": room_id, "attributes": attrs},
    )
    assert_api.assert_result_equals(set_attrs, {})

    update_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ATTRIBUTES_UPDATED.value,
        timeout=5.0,
    )
    assert update_event is not None
    assert update_event.get("type") == "event"
    assert update_event.get("eventType") == ChatRoomEvent.ON_ATTRIBUTES_UPDATED.value
    update_data = update_event.get("data")
    assert isinstance(update_data, dict)
    assert update_data.get("roomId") == room_id
    assert update_data.get("attributes") == attrs
    assert update_data.get("operation") == "attributes_updated"

    remove_attrs = primary_device.call(
        "ChatRoomManager",
        Cmd.removeChatRoomAttributes.value,
        info={"roomId": room_id, "keys": ["topic"]},
    )
    assert_api.assert_result_equals(remove_attrs, {})

    remove_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_ATTRIBUTES_REMOVED.value,
        timeout=5.0,
    )
    assert remove_event is not None
    assert remove_event.get("type") == "event"
    assert remove_event.get("eventType") == ChatRoomEvent.ON_ATTRIBUTES_REMOVED.value
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("roomId") == room_id
    assert remove_data.get("keys") == ["topic"]
    assert remove_data.get("operation") == "attributes_removed"


def test_web_chat_room_remove_and_block_emit_removed_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatRoomManager", Cmd.createChatRoom.value)
    require_capability("ChatRoomManager", Cmd.removeChatRoomMembers.value)
    require_capability("ChatRoomManager", Cmd.blockChatRoomMembers.value)
    require_capability("ChatRoomManager", Cmd.chatRoomChange.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    remove_room = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-remove-{uuid.uuid4().hex[:8]}",
            "desc": "web room remove event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    remove_room_id = assert_api.get_result(remove_room)["roomId"]
    primary_device.drain_events(timeout=0.2)

    remove = primary_device.call(
        "ChatRoomManager",
        Cmd.removeChatRoomMembers.value,
        info={"roomId": remove_room_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(remove, None)

    remove_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_REMOVED_FROM_CHAT_ROOM.value,
        timeout=5.0,
    )
    assert remove_event is not None
    assert remove_event.get("type") == "event"
    assert remove_event.get("eventType") == ChatRoomEvent.ON_REMOVED_FROM_CHAT_ROOM.value
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("roomId") == remove_room_id
    assert remove_data.get("participants") == [user_b]
    assert remove_data.get("operator") == user_a
    assert remove_data.get("reason") == "removed"
    assert remove_data.get("operation") == "member_removed"

    block_room = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-room-block-{uuid.uuid4().hex[:8]}",
            "desc": "web room block event",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    block_room_id = assert_api.get_result(block_room)["roomId"]
    primary_device.drain_events(timeout=0.2)

    block = primary_device.call(
        "ChatRoomManager",
        Cmd.blockChatRoomMembers.value,
        info={"roomId": block_room_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(block, None)

    block_event = primary_device.receive_message(
        match_event_type=ChatRoomEvent.ON_REMOVED_FROM_CHAT_ROOM.value,
        timeout=5.0,
    )
    assert block_event is not None
    assert block_event.get("type") == "event"
    assert block_event.get("eventType") == ChatRoomEvent.ON_REMOVED_FROM_CHAT_ROOM.value
    block_data = block_event.get("data")
    assert isinstance(block_data, dict)
    assert block_data.get("roomId") == block_room_id
    assert block_data.get("participants") == [user_b]
    assert block_data.get("operator") == user_a
    assert block_data.get("reason") == "blocked"
    assert block_data.get("operation") == "member_removed"
