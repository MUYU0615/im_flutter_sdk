"""Web ChatRoomManager local attribute regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.chatroom]


def test_web_chat_room_local_attributes(primary_device, assert_api, user_b, require_capability):
    for cmd in (
        Cmd.createChatRoom,
        Cmd.setChatRoomAttributes,
        Cmd.fetchChatRoomAttributes,
        Cmd.removeChatRoomAttributes,
    ):
        require_capability("ChatRoomManager", cmd.value)

    room_name = f"web-room-attrs-{uuid.uuid4().hex[:8]}"
    created = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": room_name,
            "desc": "web room attrs",
            "members": [user_b],
            "maxUserCount": 300,
        },
    )
    room_id = assert_api.get_result(created)["roomId"]

    set_attrs = primary_device.call(
        "ChatRoomManager",
        Cmd.setChatRoomAttributes.value,
        info={
            "roomId": room_id,
            "attributes": {
                "topic": "release",
                "priority": "high",
                "region": "web",
            },
            "autoDelete": False,
            "forced": True,
        },
    )
    assert_api.assert_result_equals(set_attrs, {})

    fetch_all = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomAttributes.value,
        info={"roomId": room_id},
    )
    assert assert_api.get_result(fetch_all) == {
        "topic": "release",
        "priority": "high",
        "region": "web",
    }

    fetch_some = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomAttributes.value,
        info={"roomId": room_id, "keys": ["priority", "missing"]},
    )
    assert assert_api.get_result(fetch_some) == {"priority": "high"}

    remove = primary_device.call(
        "ChatRoomManager",
        Cmd.removeChatRoomAttributes.value,
        info={"roomId": room_id, "keys": ["topic", "region"], "forced": True},
    )
    assert_api.assert_result_equals(remove, {})

    fetch_after_remove = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomAttributes.value,
        info={"roomId": room_id},
    )
    assert assert_api.get_result(fetch_after_remove) == {"priority": "high"}
