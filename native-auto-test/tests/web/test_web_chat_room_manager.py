"""Web ChatRoomManager local state regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.chatroom]


def test_web_chat_room_local_lifecycle_and_metadata(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createChatRoom,
        Cmd.fetchPublicChatRoomsFromServer,
        Cmd.fetchChatRoomInfoFromServer,
        Cmd.getChatRoom,
        Cmd.getAllChatRooms,
        Cmd.joinChatRoom,
        Cmd.leaveChatRoom,
        Cmd.changeChatRoomSubject,
        Cmd.changeChatRoomDescription,
        Cmd.fetchChatRoomMembers,
        Cmd.updateChatRoomAnnouncement,
        Cmd.fetchChatRoomAnnouncement,
        Cmd.destroyChatRoom,
    ):
        require_capability("ChatRoomManager", cmd.value)

    room_name = f"web-room-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": room_name,
            "desc": "web room initial",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room = assert_api.get_result(create)
    room_id = room["roomId"]
    assert room["name"] == room_name
    assert room["desc"] == "web room initial"
    assert room["owner"] == user_a
    assert user_b in room["memberList"]

    public_rooms = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchPublicChatRoomsFromServer.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    public_page = assert_api.get_result(public_rooms)
    assert public_page["pageNum"] == 1
    assert any(item["roomId"] == room_id for item in public_page["list"])

    for cmd in (Cmd.fetchChatRoomInfoFromServer, Cmd.getChatRoom):
        fetched = primary_device.call(
            "ChatRoomManager",
            cmd.value,
            info={"roomId": room_id, "fetchMembers": True},
        )
        assert_api.assert_result_matches(fetched, roomId=room_id, name=room_name, owner=user_a)

    all_rooms = primary_device.call("ChatRoomManager", Cmd.getAllChatRooms.value, info={})
    assert room_id in [item["roomId"] for item in assert_api.get_result(all_rooms)]

    join = primary_device.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": room_id})
    assert_api.assert_result_matches(join, roomId=room_id)

    update_name = primary_device.call(
        "ChatRoomManager",
        Cmd.changeChatRoomSubject.value,
        info={"roomId": room_id, "subject": "web room renamed"},
    )
    assert_api.assert_result_equals(update_name, None)

    update_desc = primary_device.call(
        "ChatRoomManager",
        Cmd.changeChatRoomDescription.value,
        info={"roomId": room_id, "description": "web room updated desc"},
    )
    assert_api.assert_result_equals(update_desc, None)

    updated = primary_device.call("ChatRoomManager", Cmd.getChatRoom.value, info={"roomId": room_id})
    assert_api.assert_result_matches(
        updated,
        roomId=room_id,
        name="web room renamed",
        desc="web room updated desc",
    )

    members = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMembers.value,
        info={"roomId": room_id, "cursor": None, "pageSize": 20},
    )
    member_page = assert_api.get_result(members)
    assert member_page["cursor"] == ""
    assert set(member_page["list"]) == {user_a, user_b}

    announcement = f"web room announcement {uuid.uuid4().hex[:8]}"
    update_announcement = primary_device.call(
        "ChatRoomManager",
        Cmd.updateChatRoomAnnouncement.value,
        info={"roomId": room_id, "announcement": announcement},
    )
    assert_api.assert_result_equals(update_announcement, None)

    fetched_announcement = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomAnnouncement.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(fetched_announcement, announcement)

    leave = primary_device.call("ChatRoomManager", Cmd.leaveChatRoom.value, info={"roomId": room_id})
    assert_api.assert_result_equals(leave, None)

    destroy = primary_device.call("ChatRoomManager", Cmd.destroyChatRoom.value, info={"roomId": room_id})
    assert_api.assert_result_equals(destroy, None)
    removed = primary_device.call("ChatRoomManager", Cmd.getChatRoom.value, info={"roomId": room_id})
    assert_api.assert_result_equals(removed, None)
