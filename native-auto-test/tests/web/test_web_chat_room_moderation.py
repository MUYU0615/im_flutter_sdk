"""Web ChatRoomManager local moderation regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.chatroom]


def _create_room(primary_device, assert_api, user_b, members=None):
    room_name = f"web-room-moderation-{uuid.uuid4().hex[:8]}"
    resp = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": room_name,
            "desc": "web room moderation",
            "members": members if members is not None else [user_b],
            "maxUserCount": 300,
        },
    )
    return assert_api.get_result(resp)


def _require_chat_room_moderation_capabilities(require_capability):
    for cmd in (
        Cmd.createChatRoom,
        Cmd.getChatRoom,
        Cmd.fetchChatRoomMembers,
        Cmd.muteChatRoomMembers,
        Cmd.unMuteChatRoomMembers,
        Cmd.changeChatRoomOwner,
        Cmd.addChatRoomAdmin,
        Cmd.removeChatRoomAdmin,
        Cmd.fetchChatRoomMuteList,
        Cmd.removeChatRoomMembers,
        Cmd.isMemberInChatRoomMuteList,
    ):
        require_capability("ChatRoomManager", cmd.value)


def _require_chat_room_access_capabilities(require_capability):
    for cmd in (
        Cmd.createChatRoom,
        Cmd.getChatRoom,
        Cmd.fetchChatRoomMembers,
        Cmd.blockChatRoomMembers,
        Cmd.unBlockChatRoomMembers,
        Cmd.fetchChatRoomBlockList,
        Cmd.addMembersToChatRoomWhiteList,
        Cmd.removeMembersFromChatRoomWhiteList,
        Cmd.fetchChatRoomWhiteListFromServer,
        Cmd.isMemberInChatRoomWhiteListFromServer,
        Cmd.muteAllChatRoomMembers,
        Cmd.unMuteAllChatRoomMembers,
    ):
        require_capability("ChatRoomManager", cmd.value)


def test_web_chat_room_local_owner_admin_members_and_mute(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    _require_chat_room_moderation_capabilities(require_capability)

    room = _create_room(primary_device, assert_api, user_b)
    room_id = room["roomId"]

    mute = primary_device.call(
        "ChatRoomManager",
        Cmd.muteChatRoomMembers.value,
        info={"roomId": room_id, "muteMembers": [user_b], "duration": -1},
    )
    assert_api.assert_result_equals(mute, None)

    mute_list = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMuteList.value,
        info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
    )
    assert assert_api.get_result(mute_list) == [user_b]

    is_owner_muted = primary_device.call(
        "ChatRoomManager",
        Cmd.isMemberInChatRoomMuteList.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(is_owner_muted, False)

    unmute = primary_device.call(
        "ChatRoomManager",
        Cmd.unMuteChatRoomMembers.value,
        info={"roomId": room_id, "unMuteMembers": [user_b]},
    )
    assert_api.assert_result_equals(unmute, None)

    empty_mute_list = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMuteList.value,
        info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
    )
    assert assert_api.get_result(empty_mute_list) == []

    add_admin = primary_device.call(
        "ChatRoomManager",
        Cmd.addChatRoomAdmin.value,
        info={"roomId": room_id, "admin": user_b},
    )
    assert_api.assert_result_equals(add_admin, None)
    with_admin = primary_device.call("ChatRoomManager", Cmd.getChatRoom.value, info={"roomId": room_id})
    assert user_b in assert_api.get_result(with_admin)["adminList"]

    remove_admin = primary_device.call(
        "ChatRoomManager",
        Cmd.removeChatRoomAdmin.value,
        info={"roomId": room_id, "admin": user_b},
    )
    assert_api.assert_result_equals(remove_admin, None)

    change_owner = primary_device.call(
        "ChatRoomManager",
        Cmd.changeChatRoomOwner.value,
        info={"roomId": room_id, "newOwner": user_b},
    )
    assert_api.assert_result_equals(change_owner, None)
    after_owner = primary_device.call("ChatRoomManager", Cmd.getChatRoom.value, info={"roomId": room_id})
    owner_room = assert_api.get_result(after_owner)
    assert owner_room["owner"] == user_b
    assert user_b in owner_room["memberList"]

    remove_member = primary_device.call(
        "ChatRoomManager",
        Cmd.removeChatRoomMembers.value,
        info={"roomId": room_id, "members": [user_a]},
    )
    assert_api.assert_result_equals(remove_member, None)

    members = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMembers.value,
        info={"roomId": room_id, "cursor": None, "pageSize": 20},
    )
    assert assert_api.get_result(members)["list"] == [user_b]


def test_web_chat_room_local_block_allow_list_and_all_mute(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    _require_chat_room_access_capabilities(require_capability)

    room = _create_room(primary_device, assert_api, user_b)
    room_id = room["roomId"]

    block = primary_device.call(
        "ChatRoomManager",
        Cmd.blockChatRoomMembers.value,
        info={"roomId": room_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(block, None)

    block_list = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomBlockList.value,
        info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
    )
    assert assert_api.get_result(block_list) == [user_b]

    members_after_block = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMembers.value,
        info={"roomId": room_id, "cursor": None, "pageSize": 20},
    )
    assert assert_api.get_result(members_after_block)["list"] == [user_a]

    unblock = primary_device.call(
        "ChatRoomManager",
        Cmd.unBlockChatRoomMembers.value,
        info={"roomId": room_id, "members": [user_b]},
    )
    assert_api.assert_result_equals(unblock, None)
    empty_block_list = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomBlockList.value,
        info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
    )
    assert assert_api.get_result(empty_block_list) == []

    add_allow = primary_device.call(
        "ChatRoomManager",
        Cmd.addMembersToChatRoomWhiteList.value,
        info={"roomId": room_id, "members": [user_a, user_b]},
    )
    assert_api.assert_result_equals(add_allow, None)

    allow_list = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomWhiteListFromServer.value,
        info={"roomId": room_id},
    )
    assert assert_api.get_result(allow_list) == sorted([user_a, user_b])

    is_owner_allowed = primary_device.call(
        "ChatRoomManager",
        Cmd.isMemberInChatRoomWhiteListFromServer.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(is_owner_allowed, True)

    remove_allow = primary_device.call(
        "ChatRoomManager",
        Cmd.removeMembersFromChatRoomWhiteList.value,
        info={"roomId": room_id, "members": [user_a]},
    )
    assert_api.assert_result_equals(remove_allow, None)
    allow_list_after_remove = primary_device.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomWhiteListFromServer.value,
        info={"roomId": room_id},
    )
    assert assert_api.get_result(allow_list_after_remove) == [user_b]

    mute_all = primary_device.call(
        "ChatRoomManager",
        Cmd.muteAllChatRoomMembers.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(mute_all, None)
    after_mute_all = primary_device.call("ChatRoomManager", Cmd.getChatRoom.value, info={"roomId": room_id})
    assert assert_api.get_result(after_mute_all)["isAllMemberMuted"] is True

    unmute_all = primary_device.call(
        "ChatRoomManager",
        Cmd.unMuteAllChatRoomMembers.value,
        info={"roomId": room_id},
    )
    assert_api.assert_result_equals(unmute_all, None)
    after_unmute_all = primary_device.call("ChatRoomManager", Cmd.getChatRoom.value, info={"roomId": room_id})
    assert assert_api.get_result(after_unmute_all)["isAllMemberMuted"] is False
