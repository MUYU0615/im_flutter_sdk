from __future__ import annotations
from tests.case_steps import describe_case_steps

from uuid import uuid4

import pytest

from src import Cmd, ne
from tests.chatroom.chatroom_helpers import create_chatroom_or_skip, safe_delete_chatroom


pytestmark = [pytest.mark.client, pytest.mark.chatroom, pytest.mark.agorachat1_4_0]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.create_room_via_sdk_without_permission.error")
@pytest.mark.api("ChatRoomManager.createChatRoom")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chatroom_create_room_via_sdk_without_permission(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、创建、room、via、sdk、without、permission；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.createChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、创建、room、via、sdk、without、permission；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.createChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    room_name = f"sdk_create_{uuid4().hex[:8]}"
    room_desc = f"sdk_desc_{uuid4().hex[:8]}"
    resp = topology_primary_or_device_a.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": room_name,
            "desc": room_desc,
            "welcomeMsg": "welcome",
            "maxUserCount": 200,
            "members": [],
        },
    )
    assert_api.assert_error(resp, code=703, description="you have no permission to do this.")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.create_and_fetch_from_server.success")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chatroom_create_and_fetch_from_server(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、创建、and、拉取、from、服务端；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、创建、and、拉取、from、服务端；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    room_id, room_name = create_chatroom_or_skip(owner=user_a, name_prefix="create", desc_prefix="create")
    try:
        resp = client.call("ChatRoomManager", Cmd.fetchChatRoomInfoFromServer.value, info={"roomId": room_id})
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomInfoFromServer.value,
                "device": _expected_device(client),
                "result": {
                    "roomId": room_id,
                    "owner": user_a,
                    "name": room_name,
                    "maxUsers": 200,
                    "memberCount": 1,
                    "permissionType": 2,
                    "isAllMemberMuted": False,
                    "adminList": [],
                    "muteList": [],
                    "muteExpireTimestamp": -1,
                    "createTimestamp": 0,
                    "memberList": [],
                    "isInWhitelist": False,
                    "blockList": [],
                    "desc": "nothing left here",
                    "announcement": "",
                },
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_room_info_with_members_from_server.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_room_info_with_members_from_server(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、room、信息、with、成员、from、服务端；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、room、信息、with、成员、from、服务端；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="fetch_members", desc_prefix="fetch_members")
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
                    "memberCount": ne(None),
                    "isAllMemberMuted": False,
                    "isInWhitelist": False,
                },
            },
            ignore_keys={
                "sequence",
                "owner",
                "maxUsers",
                "permissionType",
                "adminList",
                "muteList",
                "muteExpireTimestamp",
                "memberList",
                "blockList",
                "name",
                "desc",
                "announcement",
                "createTimestamp",
            },
        )

        resp = device_a.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id, "fetchMembers": True},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomInfoFromServer.value,
                "device": "deviceA",
                "result": {
                    "roomId": room_id,
                    "owner": user_a,
                    "memberCount": 2,
                    "memberList": ne(None),
                },
            },
            ignore_keys={
                "sequence",
                "name",
                "maxUsers",
                "permissionType",
                "isAllMemberMuted",
                "adminList",
                "muteList",
                "muteExpireTimestamp",
                "createTimestamp",
                "isInWhitelist",
                "blockList",
                "desc",
                "announcement",
            },
        )
        result = resp.get("result")
        assert isinstance(result, dict), f"fetchChatRoomInfoFromServer result 应为 dict: {resp}"
        members = result.get("memberList")
        assert isinstance(members, list), f"fetchMembers=true 时 memberList 应为 list: {resp}"
        assert user_a not in members, f"fetchMembers=true 的普通成员列表不应包含 owner: user_a={user_a}, members={members}"
        assert user_b in members, f"memberList 缺少加入成员: user_b={user_b}, members={members}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.destroy_room.success")
@pytest.mark.api("ChatRoomManager.destroyChatRoom")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chatroom_destroy_room_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、销毁、room、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、销毁、room、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="destroy", desc_prefix="destroy")
    resp = client.call("ChatRoomManager", Cmd.destroyChatRoom.value, info={"roomId": room_id})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatRoomManager",
            "cmd": Cmd.destroyChatRoom.value,
            "device": _expected_device(client),
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_room_info_from_server_after_destroy.error")
@pytest.mark.api("ChatRoomManager.destroyChatRoom")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chatroom_fetch_room_info_from_server_after_destroy(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、room、信息、from、服务端、after、销毁；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、room、信息、from、服务端、after、销毁；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="destroy_fetch", desc_prefix="destroy_fetch")
    resp_destroy = client.call("ChatRoomManager", Cmd.destroyChatRoom.value, info={"roomId": room_id})
    assert_api.assert_response_matches(
        resp_destroy,
        expected={
            "manager": "ChatRoomManager",
            "cmd": Cmd.destroyChatRoom.value,
            "device": _expected_device(client),
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    resp_fetch = client.call("ChatRoomManager", Cmd.fetchChatRoomInfoFromServer.value, info={"roomId": room_id})
    assert_api.assert_error(resp_fetch, code=700, description="do not find this group")
