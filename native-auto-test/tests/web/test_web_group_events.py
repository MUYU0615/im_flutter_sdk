"""Web GroupManager event forwarding regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd, GroupChangeEvent


pytestmark = [pytest.mark.web, pytest.mark.group]


def test_web_group_create_emits_specification_changed_event(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    group_name = f"web-group-event-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": group_name,
            "desc": "web group event",
            "inviteMembers": [user_b],
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]

    event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_SPECIFICATION_DID_UPDATE.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == GroupChangeEvent.ON_SPECIFICATION_DID_UPDATE.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("groupId") == group_id
    assert data.get("name") == group_name
    assert data.get("owner") == user_a
    assert data.get("operation") == "create"


def test_web_group_destroy_emits_group_destroyed_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.destroyGroup.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    group_name = f"web-group-destroy-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": group_name,
            "desc": "web group destroy event",
            "inviteMembers": [user_b],
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    destroy = primary_device.call(
        "GroupManager",
        Cmd.destroyGroup.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(destroy, None)

    event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_GROUP_DESTROYED.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == GroupChangeEvent.ON_GROUP_DESTROYED.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("groupId") == group_id
    assert data.get("name") == group_name
    assert data.get("operation") == "destroy"


def test_web_group_subject_update_emits_specification_changed_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.updateGroupSubject.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-before-{uuid.uuid4().hex[:8]}",
            "desc": "web group update event",
            "inviteMembers": [user_b],
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    updated_name = f"web-group-updated-{uuid.uuid4().hex[:8]}"
    update = primary_device.call(
        "GroupManager",
        Cmd.updateGroupSubject.value,
        info={"groupId": group_id, "name": updated_name},
    )
    assert_api.assert_result_equals(update, None)

    event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_SPECIFICATION_DID_UPDATE.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == GroupChangeEvent.ON_SPECIFICATION_DID_UPDATE.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("groupId") == group_id
    assert data.get("name") == updated_name
    assert data.get("operation") == "update"


def test_web_group_announcement_update_emits_announcement_changed_event(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.updateGroupAnnouncement.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-ann-{uuid.uuid4().hex[:8]}",
            "desc": "web group announcement event",
            "inviteMembers": [user_b],
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    announcement = f"web-group-announcement-{uuid.uuid4().hex[:8]}"
    update = primary_device.call(
        "GroupManager",
        Cmd.updateGroupAnnouncement.value,
        info={"groupId": group_id, "announcement": announcement},
    )
    assert_api.assert_result_equals(update, None)

    event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ANNOUNCEMENT_CHANGED.value,
        timeout=5.0,
    )
    assert event is not None
    assert event.get("type") == "event"
    assert event.get("eventType") == GroupChangeEvent.ON_ANNOUNCEMENT_CHANGED.value
    data = event.get("data")
    assert isinstance(data, dict)
    assert data.get("groupId") == group_id
    assert data.get("announcement") == announcement
    assert data.get("operation") == "announcement"


def test_web_group_admin_changes_emit_admin_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.addAdmin.value)
    require_capability("GroupManager", Cmd.removeAdmin.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-admin-{uuid.uuid4().hex[:8]}",
            "desc": "web group admin event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(member, None)
    primary_device.drain_events(timeout=0.2)

    add = primary_device.call(
        "GroupManager",
        Cmd.addAdmin.value,
        info={"groupId": group_id, "admin": user_b},
    )
    assert_api.assert_result_equals(add, None)

    add_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ADMIN_ADDED.value,
        timeout=5.0,
    )
    assert add_event is not None
    assert add_event.get("type") == "event"
    assert add_event.get("eventType") == GroupChangeEvent.ON_ADMIN_ADDED.value
    add_data = add_event.get("data")
    assert isinstance(add_data, dict)
    assert add_data.get("groupId") == group_id
    assert add_data.get("admin") == user_b
    assert add_data.get("operation") == "admin_added"

    remove = primary_device.call(
        "GroupManager",
        Cmd.removeAdmin.value,
        info={"groupId": group_id, "admin": user_b},
    )
    assert_api.assert_result_equals(remove, None)

    remove_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ADMIN_REMOVED.value,
        timeout=5.0,
    )
    assert remove_event is not None
    assert remove_event.get("type") == "event"
    assert remove_event.get("eventType") == GroupChangeEvent.ON_ADMIN_REMOVED.value
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("groupId") == group_id
    assert remove_data.get("admin") == user_b
    assert remove_data.get("operation") == "admin_removed"


def test_web_group_mute_changes_emit_mute_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.muteMembers.value)
    require_capability("GroupManager", Cmd.unMuteMembers.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-mute-{uuid.uuid4().hex[:8]}",
            "desc": "web group mute event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(member, None)
    primary_device.drain_events(timeout=0.2)

    mute = primary_device.call(
        "GroupManager",
        Cmd.muteMembers.value,
        info={"groupId": group_id, "members": [user_b], "duration": 60000},
    )
    assert_api.assert_result_equals(mute, None)

    mute_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_MUTE_LIST_ADDED.value,
        timeout=5.0,
    )
    assert mute_event is not None
    assert mute_event.get("type") == "event"
    assert mute_event.get("eventType") == GroupChangeEvent.ON_MUTE_LIST_ADDED.value
    mute_data = mute_event.get("data")
    assert isinstance(mute_data, dict)
    assert mute_data.get("groupId") == group_id
    assert mute_data.get("members") == [user_b]
    assert mute_data.get("operation") == "mute_added"

    unmute = primary_device.call(
        "GroupManager",
        Cmd.unMuteMembers.value,
        info={"groupId": group_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(unmute, None)

    unmute_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_MUTE_LIST_REMOVED.value,
        timeout=5.0,
    )
    assert unmute_event is not None
    assert unmute_event.get("type") == "event"
    assert unmute_event.get("eventType") == GroupChangeEvent.ON_MUTE_LIST_REMOVED.value
    unmute_data = unmute_event.get("data")
    assert isinstance(unmute_data, dict)
    assert unmute_data.get("groupId") == group_id
    assert unmute_data.get("members") == [user_b]
    assert unmute_data.get("operation") == "mute_removed"


def test_web_group_white_list_changes_emit_white_list_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.addWhiteList.value)
    require_capability("GroupManager", Cmd.removeWhiteList.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-white-{uuid.uuid4().hex[:8]}",
            "desc": "web group white list event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(member, None)
    primary_device.drain_events(timeout=0.2)

    add = primary_device.call(
        "GroupManager",
        Cmd.addWhiteList.value,
        info={"groupId": group_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(add, None)

    add_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_WHITE_LIST_ADDED.value,
        timeout=5.0,
    )
    assert add_event is not None
    assert add_event.get("type") == "event"
    assert add_event.get("eventType") == GroupChangeEvent.ON_WHITE_LIST_ADDED.value
    add_data = add_event.get("data")
    assert isinstance(add_data, dict)
    assert add_data.get("groupId") == group_id
    assert add_data.get("members") == [user_b]
    assert add_data.get("operation") == "white_list_added"

    remove = primary_device.call(
        "GroupManager",
        Cmd.removeWhiteList.value,
        info={"groupId": group_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(remove, None)

    remove_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_WHITE_LIST_REMOVED.value,
        timeout=5.0,
    )
    assert remove_event is not None
    assert remove_event.get("type") == "event"
    assert remove_event.get("eventType") == GroupChangeEvent.ON_WHITE_LIST_REMOVED.value
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("groupId") == group_id
    assert remove_data.get("members") == [user_b]
    assert remove_data.get("operation") == "white_list_removed"


def test_web_group_member_changes_emit_member_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.removeMembers.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-member-{uuid.uuid4().hex[:8]}",
            "desc": "web group member event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    add = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(add, None)

    join_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_MEMBER_JOINED.value,
        timeout=5.0,
    )
    assert join_event is not None
    assert join_event.get("type") == "event"
    assert join_event.get("eventType") == GroupChangeEvent.ON_MEMBER_JOINED.value
    join_data = join_event.get("data")
    assert isinstance(join_data, dict)
    assert join_data.get("groupId") == group_id
    assert join_data.get("members") == [user_b]
    assert join_data.get("operation") == "member_joined"

    remove = primary_device.call(
        "GroupManager",
        Cmd.removeMembers.value,
        info={"groupId": group_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(remove, None)

    exit_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_MEMBER_EXITED.value,
        timeout=5.0,
    )
    assert exit_event is not None
    assert exit_event.get("type") == "event"
    assert exit_event.get("eventType") == GroupChangeEvent.ON_MEMBER_EXITED.value
    exit_data = exit_event.get("data")
    assert isinstance(exit_data, dict)
    assert exit_data.get("groupId") == group_id
    assert exit_data.get("members") == [user_b]
    assert exit_data.get("operation") == "member_exited"


def test_web_group_owner_and_all_mute_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.updateGroupOwner.value)
    require_capability("GroupManager", Cmd.muteAllMembers.value)
    require_capability("GroupManager", Cmd.unMuteAllMembers.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-owner-{uuid.uuid4().hex[:8]}",
            "desc": "web group owner event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(member, None)
    primary_device.drain_events(timeout=0.2)

    owner = primary_device.call(
        "GroupManager",
        Cmd.updateGroupOwner.value,
        info={"groupId": group_id, "owner": user_b},
    )
    assert_api.assert_result_equals(owner, None)

    owner_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_OWNER_CHANGED.value,
        timeout=5.0,
    )
    assert owner_event is not None
    assert owner_event.get("type") == "event"
    assert owner_event.get("eventType") == GroupChangeEvent.ON_OWNER_CHANGED.value
    owner_data = owner_event.get("data")
    assert isinstance(owner_data, dict)
    assert owner_data.get("groupId") == group_id
    assert owner_data.get("newOwner") == user_b
    assert owner_data.get("oldOwner") == user_a
    assert owner_data.get("operation") == "owner_changed"

    mute_all = primary_device.call(
        "GroupManager",
        Cmd.muteAllMembers.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(mute_all, None)

    mute_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
        timeout=5.0,
    )
    assert mute_event is not None
    assert mute_event.get("type") == "event"
    assert (
        mute_event.get("eventType")
        == GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value
    )
    mute_data = mute_event.get("data")
    assert isinstance(mute_data, dict)
    assert mute_data.get("groupId") == group_id
    assert mute_data.get("isAllMuted") is True
    assert mute_data.get("operation") == "all_member_mute_changed"

    unmute_all = primary_device.call(
        "GroupManager",
        Cmd.unMuteAllMembers.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(unmute_all, None)

    unmute_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
        timeout=5.0,
    )
    assert unmute_event is not None
    unmute_data = unmute_event.get("data")
    assert isinstance(unmute_data, dict)
    assert unmute_data.get("groupId") == group_id
    assert unmute_data.get("isAllMuted") is False
    assert unmute_data.get("operation") == "all_member_mute_changed"


def test_web_group_member_attribute_changes_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.setMemberAttributesFromGroup.value)
    require_capability("GroupManager", Cmd.removeMemberAttributesFromGroup.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-attrs-{uuid.uuid4().hex[:8]}",
            "desc": "web group member attrs event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(member, None)
    primary_device.drain_events(timeout=0.2)

    attrs = {"role": "tester", "level": "2"}
    set_attrs = primary_device.call(
        "GroupManager",
        Cmd.setMemberAttributesFromGroup.value,
        info={"groupId": group_id, "userId": user_b, "attributes": attrs},
    )
    assert_api.assert_result_equals(set_attrs, None)

    update_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ATTRIBUTES_CHANGED_OF_MEMBER.value,
        timeout=5.0,
    )
    assert update_event is not None
    assert update_event.get("type") == "event"
    assert (
        update_event.get("eventType")
        == GroupChangeEvent.ON_ATTRIBUTES_CHANGED_OF_MEMBER.value
    )
    update_data = update_event.get("data")
    assert isinstance(update_data, dict)
    assert update_data.get("groupId") == group_id
    assert update_data.get("userId") == user_b
    assert update_data.get("attributes") == attrs
    assert update_data.get("operation") == "member_attributes_updated"

    remove_attrs = primary_device.call(
        "GroupManager",
        Cmd.removeMemberAttributesFromGroup.value,
        info={"groupId": group_id, "userId": user_b, "keys": ["role"]},
    )
    assert_api.assert_result_equals(remove_attrs, None)

    remove_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_ATTRIBUTES_CHANGED_OF_MEMBER.value,
        timeout=5.0,
    )
    assert remove_event is not None
    remove_data = remove_event.get("data")
    assert isinstance(remove_data, dict)
    assert remove_data.get("groupId") == group_id
    assert remove_data.get("userId") == user_b
    assert remove_data.get("keys") == ["role"]
    assert remove_data.get("operation") == "member_attributes_removed"


def test_web_group_block_member_and_group_state_emit_events(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    require_capability("GroupManager", Cmd.createGroup.value)
    require_capability("GroupManager", Cmd.addMembers.value)
    require_capability("GroupManager", Cmd.blockMembers.value)
    require_capability("GroupManager", Cmd.blockGroup.value)
    require_capability("GroupManager", Cmd.unblockGroup.value)
    require_capability("GroupManager", Cmd.onGroupChanged.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": f"web-group-state-{uuid.uuid4().hex[:8]}",
            "desc": "web group state event",
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    primary_device.drain_events(timeout=0.2)

    member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(member, None)
    primary_device.drain_events(timeout=0.2)

    block_member = primary_device.call(
        "GroupManager",
        Cmd.blockMembers.value,
        info={"groupId": group_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(block_member, None)

    removed_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_USER_REMOVED.value,
        timeout=5.0,
    )
    assert removed_event is not None
    assert removed_event.get("type") == "event"
    assert removed_event.get("eventType") == GroupChangeEvent.ON_USER_REMOVED.value
    removed_data = removed_event.get("data")
    assert isinstance(removed_data, dict)
    assert removed_data.get("groupId") == group_id
    assert removed_data.get("members") == [user_b]
    assert removed_data.get("operator") == user_a
    assert removed_data.get("reason") == "blocked"
    assert removed_data.get("operation") == "user_removed"

    block_group = primary_device.call(
        "GroupManager",
        Cmd.blockGroup.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(block_group, None)

    blocked_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_STATE_CHANGED.value,
        timeout=5.0,
    )
    assert blocked_event is not None
    assert blocked_event.get("type") == "event"
    assert blocked_event.get("eventType") == GroupChangeEvent.ON_STATE_CHANGED.value
    blocked_data = blocked_event.get("data")
    assert isinstance(blocked_data, dict)
    assert blocked_data.get("groupId") == group_id
    assert blocked_data.get("messageBlocked") is True
    assert blocked_data.get("operation") == "state_changed"

    unblock_group = primary_device.call(
        "GroupManager",
        Cmd.unblockGroup.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(unblock_group, None)

    unblocked_event = primary_device.receive_message(
        match_event_type=GroupChangeEvent.ON_STATE_CHANGED.value,
        timeout=5.0,
    )
    assert unblocked_event is not None
    unblocked_data = unblocked_event.get("data")
    assert isinstance(unblocked_data, dict)
    assert unblocked_data.get("groupId") == group_id
    assert unblocked_data.get("messageBlocked") is False
    assert unblocked_data.get("operation") == "state_changed"
