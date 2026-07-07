"""Real Web SDK/service ChatRoomManager E2E cases."""

from __future__ import annotations

import uuid

import pytest

from src import ChatRoomEvent, Cmd
from tests.chatroom.chatroom_helpers import create_chatroom_or_skip, safe_delete_chatroom


pytestmark = [pytest.mark.web, pytest.mark.chatroom, pytest.mark.real_web]


def _room_ids(items) -> set[str]:
    assert isinstance(items, list)
    return {
        str(item.get("roomId") or item.get("id") or item.get("chatRoomId"))
        for item in items
        if isinstance(item, dict)
    }


def test_real_web_chat_room_join_get_all_and_leave(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    room_id, room_name = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_room_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_room",
    )
    try:
        join = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        join_result = assert_api.get_result(join)
        assert isinstance(join_result, dict)
        assert join_result.get("roomId") == room_id
        assert join_result.get("name") == room_name

        detail = secondary_device.call(
            "ChatRoomManager",
            Cmd.getChatRoom.value,
            info={"roomId": room_id},
        )
        detail_result = assert_api.get_result(detail)
        assert isinstance(detail_result, dict)
        assert detail_result.get("roomId") == room_id
        assert detail_result.get("name") == room_name

        server_detail = secondary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        server_detail_result = assert_api.get_result(server_detail)
        assert isinstance(server_detail_result, dict)
        assert server_detail_result.get("roomId") == room_id
        assert server_detail_result.get("name") == room_name

        public_rooms = secondary_device.call(
            "ChatRoomManager",
            Cmd.fetchPublicChatRoomsFromServer.value,
            info={"pageNum": 1, "pageSize": 50},
        )
        public_rooms_result = assert_api.get_result(public_rooms)
        assert isinstance(public_rooms_result, dict)
        public_room_list = public_rooms_result.get("list")
        assert isinstance(public_room_list, list)
        if room_id not in _room_ids(public_room_list):
            debug_after_public = secondary_device.call("Client", "getRealSdkDebug", info={})
            pytest.fail(
                f"public chat room list did not include created room: "
                f"room_id={room_id}; result={public_rooms_result!r}; "
                f"debug={assert_api.get_result(debug_after_public)!r}"
            )

        joined = secondary_device.call(
            "ChatRoomManager",
            Cmd.getAllChatRooms.value,
            info={},
        )
        joined_result = assert_api.get_result(joined)
        assert room_id in _room_ids(joined_result)

        leave = secondary_device.call(
            "ChatRoomManager",
            Cmd.leaveChatRoom.value,
            info={"roomId": room_id},
        )
        assert_api.assert_success(leave)

        joined_after_leave = secondary_device.call(
            "ChatRoomManager",
            Cmd.getAllChatRooms.value,
            info={},
        )
        joined_after_leave_result = assert_api.get_result(joined_after_leave)
        assert room_id not in _room_ids(joined_after_leave_result)
    finally:
        safe_delete_chatroom(room_id)


def test_real_web_chat_room_announcement_changed_event_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.5)
    secondary_device.drain_events(timeout=0.5)

    room_id = ""
    try:
        room_id, _ = create_chatroom_or_skip(
            owner=user_a,
            name_prefix=f"web_real_room_ann_{uuid.uuid4().hex[:8]}",
            desc_prefix="real_web_room_ann",
        )
        join = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        assert_api.assert_success(join)
        joined_event = primary_device.receive_message(
            match_event_type=Cmd.chatRoomChange.value,
            timeout=10.0,
        )
        if joined_event is not None:
            joined_data = joined_event.get("data")
            if (
                isinstance(joined_data, dict)
                and joined_data.get("type") == ChatRoomEvent.ON_MEMBER_JOINED.value
                and joined_data.get("roomId") == room_id
            ):
                return
        primary_device.drain_events(timeout=0.5)
        secondary_device.drain_events(timeout=0.5)

        announcement = f"real-room-ann-{uuid.uuid4().hex[:8]}"
        update = primary_device.call(
            "ChatRoomManager",
            Cmd.updateChatRoomAnnouncement.value,
            info={"roomId": room_id, "announcement": announcement},
        )
        assert_api.assert_success(update)
        assert_api.assert_result_equals(update, None)

        event = secondary_device.receive_message(
            match_event_type=Cmd.chatRoomChange.value,
            timeout=10.0,
        )
        if event is None:
            debug_b = assert_api.get_result(
                secondary_device.call("Client", "getRealSdkDebug", info={})
            )
            pytest.fail(f"missing onChatRoomChanged event; debug={debug_b!r}")
        assert event.get("eventType") == Cmd.chatRoomChange.value
        data = event.get("data")
        assert isinstance(data, dict)
        assert data.get("type") == ChatRoomEvent.ON_ANNOUNCEMENT_CHANGED.value
        assert data.get("roomId") == room_id
        assert data.get("announcement") == announcement
        assert data.get("operation") == "announcement"
    finally:
        if room_id:
            safe_delete_chatroom(room_id)


def test_real_web_chat_room_modify_and_destroy_server_state(
    primary_device,
    assert_api,
    user_a,
):
    room_id, _ = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_manage_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_manage",
    )
    updated_name = f"real_web_subject_{uuid.uuid4().hex[:8]}"
    updated_desc = f"real_web_desc_{uuid.uuid4().hex[:8]}"
    try:
        subject = primary_device.call(
            "ChatRoomManager",
            Cmd.changeChatRoomSubject.value,
            info={"roomId": room_id, "subject": updated_name},
        )
        assert_api.assert_success(subject)

        desc = primary_device.call(
            "ChatRoomManager",
            Cmd.changeChatRoomDescription.value,
            info={"roomId": room_id, "description": updated_desc},
        )
        assert_api.assert_success(desc)

        detail = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        detail_result = assert_api.get_result(detail)
        assert isinstance(detail_result, dict)
        assert detail_result.get("roomId") == room_id
        assert detail_result.get("name") == updated_name
        assert detail_result.get("desc") == updated_desc

        debug = primary_device.call("Client", "getRealSdkDebug", info={})
        debug_result = assert_api.get_result(debug)
        assert sum(
            1
            for item in debug_result
            if isinstance(item, dict) and item.get("type") == "modifyChatRoom_success"
        ) >= 2, debug_result

        destroy = primary_device.call(
            "ChatRoomManager",
            Cmd.destroyChatRoom.value,
            info={"roomId": room_id},
        )
        assert_api.assert_success(destroy)
        room_id = ""

        destroy_debug = primary_device.call("Client", "getRealSdkDebug", info={})
        destroy_debug_result = assert_api.get_result(destroy_debug)
        assert any(
            isinstance(item, dict) and item.get("type") == "destroyChatRoom_success"
            for item in destroy_debug_result
        ), destroy_debug_result
    finally:
        if room_id:
            safe_delete_chatroom(room_id)


def test_real_web_chat_room_members_and_mute_list_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    room_id, _ = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_members_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_members",
    )
    try:
        join = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        join_result = assert_api.get_result(join)
        assert isinstance(join_result, dict)
        assert join_result.get("roomId") == room_id

        members = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMembers.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        members_result = assert_api.get_result(members)
        assert isinstance(members_result, dict)
        member_list = members_result.get("list")
        assert isinstance(member_list, list)
        assert user_a in member_list
        assert user_b in member_list

        mute = primary_device.call(
            "ChatRoomManager",
            Cmd.muteChatRoomMembers.value,
            info={
                "roomId": room_id,
                "muteMembers": [user_b],
                "duration": 60_000,
            },
        )
        assert_api.assert_success(mute)

        mute_list = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMuteList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list_result = assert_api.get_result(mute_list)
        assert isinstance(mute_list_result, dict)
        muted_members = mute_list_result.get("list")
        assert isinstance(muted_members, list)
        assert user_b in muted_members

        unmute = primary_device.call(
            "ChatRoomManager",
            Cmd.unMuteChatRoomMembers.value,
            info={"roomId": room_id, "unMuteMembers": [user_b]},
        )
        assert_api.assert_success(unmute)

        mute_list_after = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMuteList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list_after_result = assert_api.get_result(mute_list_after)
        assert isinstance(mute_list_after_result, dict)
        muted_members_after = mute_list_after_result.get("list")
        assert isinstance(muted_members_after, list)
        assert user_b not in muted_members_after
    finally:
        safe_delete_chatroom(room_id)


def test_real_web_chat_room_block_unblock_and_remove_member_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    room_id, _ = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_block_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_block",
    )
    try:
        join = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        join_result = assert_api.get_result(join)
        assert isinstance(join_result, dict)
        assert join_result.get("roomId") == room_id

        block = primary_device.call(
            "ChatRoomManager",
            Cmd.blockChatRoomMembers.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        assert_api.assert_success(block)

        block_list = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomBlockList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        block_list_result = assert_api.get_result(block_list)
        assert isinstance(block_list_result, dict)
        blocked_members = block_list_result.get("list")
        assert isinstance(blocked_members, list)
        assert user_b in blocked_members

        unblock = primary_device.call(
            "ChatRoomManager",
            Cmd.unBlockChatRoomMembers.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        assert_api.assert_success(unblock)

        block_list_after = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomBlockList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        block_list_after_result = assert_api.get_result(block_list_after)
        assert isinstance(block_list_after_result, dict)
        blocked_members_after = block_list_after_result.get("list")
        assert isinstance(blocked_members_after, list)
        assert user_b not in blocked_members_after

        rejoin = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        rejoin_result = assert_api.get_result(rejoin)
        assert isinstance(rejoin_result, dict)
        assert rejoin_result.get("roomId") == room_id

        remove = primary_device.call(
            "ChatRoomManager",
            Cmd.removeChatRoomMembers.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        assert_api.assert_success(remove)

        members_after_remove = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMembers.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        members_after_remove_result = assert_api.get_result(members_after_remove)
        assert isinstance(members_after_remove_result, dict)
        members_after_remove_list = members_after_remove_result.get("list")
        assert isinstance(members_after_remove_list, list)
        assert user_b not in members_after_remove_list
    finally:
        safe_delete_chatroom(room_id)


def test_real_web_chat_room_announcement_and_whitelist_server_state(
    primary_device,
    assert_api,
    user_a,
):
    room_id, _ = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_allow_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_allow",
    )
    announcement = f"real-web-announcement-{uuid.uuid4().hex[:8]}"
    try:
        update = primary_device.call(
            "ChatRoomManager",
            Cmd.updateChatRoomAnnouncement.value,
            info={"roomId": room_id, "announcement": announcement},
        )
        assert_api.assert_success(update)

        fetched_announcement = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAnnouncement.value,
            info={"roomId": room_id},
        )
        assert_api.assert_result_equals(fetched_announcement, announcement)

        add = primary_device.call(
            "ChatRoomManager",
            Cmd.addMembersToChatRoomWhiteList.value,
            info={"roomId": room_id, "members": [user_a]},
        )
        assert_api.assert_success(add)

        white_list = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        white_list_result = assert_api.get_result(white_list)
        assert isinstance(white_list_result, list)
        assert user_a in white_list_result

        in_whitelist = primary_device.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert_api.assert_result_equals(in_whitelist, True)

        remove = primary_device.call(
            "ChatRoomManager",
            Cmd.removeMembersFromChatRoomWhiteList.value,
            info={"roomId": room_id, "members": [user_a]},
        )
        assert_api.assert_success(remove)

        white_list_after = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        white_list_after_result = assert_api.get_result(white_list_after)
        assert isinstance(white_list_after_result, list)
        assert user_a not in white_list_after_result

        in_whitelist_after = primary_device.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert_api.assert_result_equals(in_whitelist_after, False)
    finally:
        safe_delete_chatroom(room_id)


def test_real_web_chat_room_mute_all_member_check_and_attributes_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    room_id, _ = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_attrs_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_attrs",
    )
    attr_key = f"priority_{uuid.uuid4().hex[:8]}"
    attr_value = f"high_{uuid.uuid4().hex[:8]}"
    try:
        join = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        join_result = assert_api.get_result(join)
        assert isinstance(join_result, dict)
        assert join_result.get("roomId") == room_id

        mute_member = primary_device.call(
            "ChatRoomManager",
            Cmd.muteChatRoomMembers.value,
            info={
                "roomId": room_id,
                "muteMembers": [user_b],
                "duration": 60_000,
            },
        )
        assert_api.assert_success(mute_member)

        secondary_is_muted = secondary_device.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomMuteList.value,
            info={"roomId": room_id},
        )
        assert_api.assert_result_equals(secondary_is_muted, True)

        unmute_member = primary_device.call(
            "ChatRoomManager",
            Cmd.unMuteChatRoomMembers.value,
            info={"roomId": room_id, "unMuteMembers": [user_b]},
        )
        assert_api.assert_success(unmute_member)

        secondary_is_muted_after = secondary_device.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomMuteList.value,
            info={"roomId": room_id},
        )
        assert_api.assert_result_equals(secondary_is_muted_after, False)

        mute_all = primary_device.call(
            "ChatRoomManager",
            Cmd.muteAllChatRoomMembers.value,
            info={"roomId": room_id},
        )
        assert_api.assert_success(mute_all)

        detail_after_mute_all = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        detail_after_mute_all_result = assert_api.get_result(detail_after_mute_all)
        assert isinstance(detail_after_mute_all_result, dict)
        assert detail_after_mute_all_result.get("isAllMemberMuted") is True

        unmute_all = primary_device.call(
            "ChatRoomManager",
            Cmd.unMuteAllChatRoomMembers.value,
            info={"roomId": room_id},
        )
        assert_api.assert_success(unmute_all)

        detail_after_unmute_all = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        detail_after_unmute_all_result = assert_api.get_result(detail_after_unmute_all)
        assert isinstance(detail_after_unmute_all_result, dict)
        assert detail_after_unmute_all_result.get("isAllMemberMuted") is False

        set_attrs = primary_device.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: attr_value},
                "deleteWhenLeft": False,
                "overwrite": True,
            },
        )
        assert_api.assert_result_equals(set_attrs, {})

        fetch_attrs = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        fetch_attrs_result = assert_api.get_result(fetch_attrs)
        assert isinstance(fetch_attrs_result, dict)
        assert fetch_attrs_result == {attr_key: attr_value}

        remove_attrs = primary_device.call(
            "ChatRoomManager",
            Cmd.removeChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key], "force": True},
        )
        assert_api.assert_result_equals(remove_attrs, {})

        fetch_attrs_after_remove = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        fetch_attrs_after_remove_result = assert_api.get_result(fetch_attrs_after_remove)
        assert isinstance(fetch_attrs_after_remove_result, dict)
        assert attr_key not in fetch_attrs_after_remove_result
    finally:
        safe_delete_chatroom(room_id)


def test_real_web_chat_room_admin_server_state(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    room_id, _ = create_chatroom_or_skip(
        owner=user_a,
        name_prefix=f"real_web_admin_{uuid.uuid4().hex[:8]}",
        desc_prefix="real_web_admin",
    )
    try:
        join = secondary_device.call(
            "ChatRoomManager",
            Cmd.joinChatRoom.value,
            info={"roomId": room_id, "leaveOtherRooms": False},
        )
        join_result = assert_api.get_result(join)
        assert isinstance(join_result, dict)
        assert join_result.get("roomId") == room_id

        add_admin = primary_device.call(
            "ChatRoomManager",
            Cmd.addChatRoomAdmin.value,
            info={"roomId": room_id, "admin": user_b},
        )
        assert_api.assert_success(add_admin)

        detail_with_admin = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        detail_with_admin_result = assert_api.get_result(detail_with_admin)
        assert isinstance(detail_with_admin_result, dict)
        assert user_b in (detail_with_admin_result.get("adminList") or [])

        remove_admin = primary_device.call(
            "ChatRoomManager",
            Cmd.removeChatRoomAdmin.value,
            info={"roomId": room_id, "admin": user_b},
        )
        assert_api.assert_success(remove_admin)

        detail_after_remove_admin = primary_device.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        detail_after_remove_admin_result = assert_api.get_result(
            detail_after_remove_admin
        )
        assert isinstance(detail_after_remove_admin_result, dict)
        assert user_b not in (detail_after_remove_admin_result.get("adminList") or [])
    finally:
        safe_delete_chatroom(room_id)
