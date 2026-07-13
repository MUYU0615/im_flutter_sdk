"""ChatRoom 成员白名单/禁言检查接口。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd, ge
from tests.chatroom.chatroom_helpers import create_chatroom_or_skip, safe_delete_chatroom


pytestmark = [pytest.mark.client, pytest.mark.chatroom, pytest.mark.agorachat1_4_0]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


CHATROOM_JOIN_IGNORE_KEYS = {
    "sequence",
    "timestamp",
    "serverTime",
    "localTime",
    "createTimestamp",
    "desc",
    "announcement",
    "adminList",
    "memberList",
    "blockList",
    "muteList",
    "muteExpireTimestamp",
    "permissionType",
    "isInWhitelist",
    "isAllMemberMuted",
    "name",
    "owner",
    "maxUsers",
}


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chatroom_is_member_in_white_list_and_mute_list_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、is、成员、in、白名单、列表、and、禁言；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.isMemberInChatRoomWhiteListFromServer、ChatRoomManager.isMemberInChatRoomMuteList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、is、成员、in、白名单、列表、and、禁言；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.isMemberInChatRoomWhiteListFromServer、ChatRoomManager.isMemberInChatRoomMuteList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="member_check", desc_prefix="member_check")
    try:
        resp_white = client.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            resp_white,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.isMemberInChatRoomWhiteListFromServer.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        assert isinstance(resp_white.get("result"), bool), (
            f"isMemberInChatRoomWhiteListFromServer result 应为 bool: {resp_white}"
        )

        resp_mute = client.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomMuteList.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            resp_mute,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.isMemberInChatRoomMuteList.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        assert isinstance(resp_mute.get("result"), bool), f"isMemberInChatRoomMuteList result 应为 bool: {resp_mute}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chatroom_is_member_in_white_list_and_mute_list_nonexistent_room(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、is、成员、in、白名单、列表、and、禁言；
    2. 通过 WebSocket 控制测试 App 调用 聊天室、is、成员、in、白名单、列表、and、禁言，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、is、成员、in、白名单、列表、and、禁言；\n'
        '2. 通过 WebSocket 控制测试 App 调用 聊天室、is、成员、in、白名单、列表、and、禁言，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id = "nonexistent_chatroom_member_check_999999"
    for cmd in (Cmd.isMemberInChatRoomWhiteListFromServer.value, Cmd.isMemberInChatRoomMuteList.value):
        resp = topology_primary_or_device_a.call("ChatRoomManager", cmd, info={"roomId": room_id})
        assert_api.assert_error(resp, code=700, description="do not find this group")


@pytest.mark.real_e2e
def test_chatroom_member_white_list_check_reflects_server_state(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、成员、白名单、列表、check、reflects、服务端、state；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.isMemberInChatRoomWhiteListFromServer、ChatRoomManager.addMembersToChatRoomWhiteList、ChatRoomManager.removeMembersFromChatRoomWhiteList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、成员、白名单、列表、check、reflects、服务端、state；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.isMemberInChatRoomWhiteListFromServer、ChatRoomManager.addMembersToChatRoomWhiteList、ChatRoomManager.removeMembersFromChatRoomWhiteList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="white_check", desc_prefix="white_check")
    try:
        join_resp = device_b.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": room_id})
        assert_api.assert_response_matches(
            join_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.joinChatRoom.value,
                "device": "deviceB",
                "result": {
                    "roomId": room_id,
                    "memberCount": ge(1),
                },
            },
            ignore_keys=CHATROOM_JOIN_IGNORE_KEYS,
        )

        before_resp = device_b.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert before_resp.get("result") is False, f"加入白名单前 B 不应在白名单: {before_resp}"

        add_resp = device_a.call(
            "ChatRoomManager",
            Cmd.addMembersToChatRoomWhiteList.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        assert_api.assert_response_matches(
            add_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.addMembersToChatRoomWhiteList.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        after_add_resp = device_b.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert after_add_resp.get("result") is True, f"加入白名单后 B 应在白名单: {after_add_resp}"

        remove_resp = device_a.call(
            "ChatRoomManager",
            Cmd.removeMembersFromChatRoomWhiteList.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        assert_api.assert_response_matches(
            remove_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.removeMembersFromChatRoomWhiteList.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        after_remove_resp = device_b.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert after_remove_resp.get("result") is False, f"移除白名单后 B 不应在白名单: {after_remove_resp}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
def test_chatroom_member_mute_list_check_reflects_server_state(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、成员、禁言、列表、check、reflects、服务端、state；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.isMemberInChatRoomMuteList、ChatRoomManager.muteChatRoomMembers、ChatRoomManager.unMuteChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、成员、禁言、列表、check、reflects、服务端、state；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.isMemberInChatRoomMuteList、ChatRoomManager.muteChatRoomMembers、ChatRoomManager.unMuteChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="mute_check", desc_prefix="mute_check")
    try:
        join_resp = device_b.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": room_id})
        assert_api.assert_response_matches(
            join_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.joinChatRoom.value,
                "device": "deviceB",
                "result": {
                    "roomId": room_id,
                    "memberCount": ge(1),
                },
            },
            ignore_keys=CHATROOM_JOIN_IGNORE_KEYS,
        )

        before_resp = device_b.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomMuteList.value,
            info={"roomId": room_id},
        )
        assert before_resp.get("result") is False, f"禁言前 B 不应在禁言列表: {before_resp}"

        mute_resp = device_a.call(
            "ChatRoomManager",
            Cmd.muteChatRoomMembers.value,
            info={"roomId": room_id, "muteMembers": [user_b], "duration": 60000},
        )
        assert_api.assert_response_matches(
            mute_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.muteChatRoomMembers.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        after_mute_resp = device_b.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomMuteList.value,
            info={"roomId": room_id},
        )
        assert after_mute_resp.get("result") is True, f"禁言后 B 应在禁言列表: {after_mute_resp}"

        unmute_resp = device_a.call(
            "ChatRoomManager",
            Cmd.unMuteChatRoomMembers.value,
            info={"roomId": room_id, "unMuteMembers": [user_b]},
        )
        assert_api.assert_response_matches(
            unmute_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.unMuteChatRoomMembers.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        after_unmute_resp = device_b.call(
            "ChatRoomManager",
            Cmd.isMemberInChatRoomMuteList.value,
            info={"roomId": room_id},
        )
        assert after_unmute_resp.get("result") is False, f"解除禁言后 B 不应在禁言列表: {after_unmute_resp}"
    finally:
        safe_delete_chatroom(room_id)
