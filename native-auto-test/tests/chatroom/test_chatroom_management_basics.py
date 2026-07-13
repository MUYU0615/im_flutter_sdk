from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

import pytest

from src import Cmd, ne
from tests.chatroom.chatroom_helpers import create_chatroom_or_skip, safe_delete_chatroom


pytestmark = [pytest.mark.client, pytest.mark.chatroom, pytest.mark.agorachat4_23_0]


def _assert_success_envelope(assert_api, resp: dict, *, cmd: str, device: str) -> None:
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatRoomManager",
            "cmd": cmd,
            "device": device,
            "result": ne("__missing__"),
        },
        ignore_keys={"sequence"},
    )


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.update_and_fetch_announcement.success")
@pytest.mark.api("ChatRoomManager.updateChatRoomAnnouncement")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAnnouncement")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_update_and_fetch_announcement_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、更新、and、拉取、announcement、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.updateChatRoomAnnouncement、ChatRoomManager.fetchChatRoomAnnouncement，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、更新、and、拉取、announcement、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.updateChatRoomAnnouncement、ChatRoomManager.fetchChatRoomAnnouncement，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="announcement", desc_prefix="announcement")
    announcement = f"notice-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        update_resp = client.call(
            "ChatRoomManager",
            Cmd.updateChatRoomAnnouncement.value,
            info={"roomId": room_id, "announcement": announcement},
        )
        _assert_success_envelope(
            assert_api,
            update_resp,
            cmd=Cmd.updateChatRoomAnnouncement.value,
            device=_expected_device(client),
        )

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAnnouncement.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAnnouncement.value,
                "device": _expected_device(client),
                "result": announcement,
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.add_fetch_remove_white_list.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.addMembersToChatRoomWhiteList")
@pytest.mark.api("ChatRoomManager.fetchChatRoomWhiteListFromServer")
@pytest.mark.api("ChatRoomManager.removeMembersFromChatRoomWhiteList")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_chatroom_add_fetch_remove_white_list_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、添加、拉取、移除、白名单、列表、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.addMembersToChatRoomWhiteList、ChatRoomManager.fetchChatRoomWhiteListFromServer、ChatRoomManager.removeMembersFromChatRoomWhiteList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、添加、拉取、移除、白名单、列表、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.addMembersToChatRoomWhiteList、ChatRoomManager.fetchChatRoomWhiteListFromServer、ChatRoomManager.removeMembersFromChatRoomWhiteList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    remote_device = _expected_device(remote)
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="whitelist", desc_prefix="whitelist")
    try:
        join_resp = remote.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": room_id})
        assert_api.assert_response_matches(
            join_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.joinChatRoom.value,
                "device": remote_device,
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

        add_resp = primary.call(
            "ChatRoomManager",
            Cmd.addMembersToChatRoomWhiteList.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        _assert_success_envelope(
            assert_api,
            add_resp,
            cmd=Cmd.addMembersToChatRoomWhiteList.value,
            device=primary_device,
        )

        fetch_after_add = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            fetch_after_add,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomWhiteListFromServer.value,
                "device": primary_device,
                "result": ne(None),
            },
            ignore_keys={"sequence"},
        )
        white_list = fetch_after_add.get("result")
        assert isinstance(white_list, list), f"fetchChatRoomWhiteListFromServer result 应为 list: {fetch_after_add}"
        assert user_b in white_list, f"白名单缺少已添加成员: user_b={user_b}, white_list={white_list}"

        remove_resp = primary.call(
            "ChatRoomManager",
            Cmd.removeMembersFromChatRoomWhiteList.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        _assert_success_envelope(
            assert_api,
            remove_resp,
            cmd=Cmd.removeMembersFromChatRoomWhiteList.value,
            device=primary_device,
        )

        fetch_after_remove = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomWhiteListFromServer.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            fetch_after_remove,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomWhiteListFromServer.value,
                "device": primary_device,
                "result": ne(None),
            },
            ignore_keys={"sequence"},
        )
        white_list_after_remove = fetch_after_remove.get("result")
        assert isinstance(white_list_after_remove, list), (
            f"fetchChatRoomWhiteListFromServer result 应为 list: {fetch_after_remove}"
        )
        assert user_b not in white_list_after_remove, (
            f"白名单移除后仍包含成员: user_b={user_b}, white_list={white_list_after_remove}"
        )
    finally:
        safe_delete_chatroom(room_id)


def _join_chatroom_as_b(device_b, assert_api, room_id: str) -> None:
    device_name = _expected_device(device_b)
    join_resp = device_b.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": room_id})
    assert_api.assert_response_matches(
        join_resp,
        expected={
            "manager": "ChatRoomManager",
            "cmd": Cmd.joinChatRoom.value,
            "device": device_name,
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


def _assert_list_response(assert_api, resp: dict, *, cmd: str, device: str) -> list:
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatRoomManager",
            "cmd": cmd,
            "device": device,
            "result": ne(None),
        },
        ignore_keys={"sequence"},
    )
    result = resp.get("result")
    assert isinstance(result, list), f"{cmd} result 应为 list: {resp}"
    return result


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.mute_fetch_unmute_member.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.muteChatRoomMembers")
@pytest.mark.api("ChatRoomManager.fetchChatRoomMuteList")
@pytest.mark.api("ChatRoomManager.unMuteChatRoomMembers")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_chatroom_mute_fetch_unmute_member_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、禁言、拉取、unmute、成员、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.muteChatRoomMembers、ChatRoomManager.fetchChatRoomMuteList、ChatRoomManager.unMuteChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、禁言、拉取、unmute、成员、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.muteChatRoomMembers、ChatRoomManager.fetchChatRoomMuteList、ChatRoomManager.unMuteChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="mute", desc_prefix="mute")
    try:
        _join_chatroom_as_b(remote, assert_api, room_id)

        mute_resp = primary.call(
            "ChatRoomManager",
            Cmd.muteChatRoomMembers.value,
            info={"roomId": room_id, "muteMembers": [user_b], "duration": 60000},
        )
        _assert_success_envelope(assert_api, mute_resp, cmd=Cmd.muteChatRoomMembers.value, device=primary_device)

        mute_list_resp = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMuteList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list = _assert_list_response(
            assert_api,
            mute_list_resp,
            cmd=Cmd.fetchChatRoomMuteList.value,
            device=primary_device,
        )
        assert user_b in mute_list, f"禁言列表缺少被禁言成员: user_b={user_b}, mute_list={mute_list}"

        unmute_resp = primary.call(
            "ChatRoomManager",
            Cmd.unMuteChatRoomMembers.value,
            info={"roomId": room_id, "unMuteMembers": [user_b]},
        )
        _assert_success_envelope(assert_api, unmute_resp, cmd=Cmd.unMuteChatRoomMembers.value, device=primary_device)

        mute_list_after_resp = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMuteList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        mute_list_after = _assert_list_response(
            assert_api,
            mute_list_after_resp,
            cmd=Cmd.fetchChatRoomMuteList.value,
            device=primary_device,
        )
        assert user_b not in mute_list_after, f"解除禁言后列表仍包含成员: user_b={user_b}, mute_list={mute_list_after}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.block_fetch_unblock_member.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.blockChatRoomMembers")
@pytest.mark.api("ChatRoomManager.fetchChatRoomBlockList")
@pytest.mark.api("ChatRoomManager.unBlockChatRoomMembers")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_chatroom_block_fetch_unblock_member_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、封禁、拉取、unblock、成员、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.blockChatRoomMembers、ChatRoomManager.fetchChatRoomBlockList、ChatRoomManager.unBlockChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、封禁、拉取、unblock、成员、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.blockChatRoomMembers、ChatRoomManager.fetchChatRoomBlockList、ChatRoomManager.unBlockChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="block", desc_prefix="block")
    try:
        _join_chatroom_as_b(remote, assert_api, room_id)

        block_resp = primary.call(
            "ChatRoomManager",
            Cmd.blockChatRoomMembers.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        _assert_success_envelope(assert_api, block_resp, cmd=Cmd.blockChatRoomMembers.value, device=primary_device)

        block_list_resp = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomBlockList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        block_list = _assert_list_response(
            assert_api,
            block_list_resp,
            cmd=Cmd.fetchChatRoomBlockList.value,
            device=primary_device,
        )
        assert user_b in block_list, f"黑名单缺少被加入成员: user_b={user_b}, block_list={block_list}"

        unblock_resp = primary.call(
            "ChatRoomManager",
            Cmd.unBlockChatRoomMembers.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        _assert_success_envelope(assert_api, unblock_resp, cmd=Cmd.unBlockChatRoomMembers.value, device=primary_device)

        block_list_after_resp = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomBlockList.value,
            info={"roomId": room_id, "pageNum": 1, "pageSize": 20},
        )
        block_list_after = _assert_list_response(
            assert_api,
            block_list_after_resp,
            cmd=Cmd.fetchChatRoomBlockList.value,
            device=primary_device,
        )
        assert user_b not in block_list_after, f"解除黑名单后列表仍包含成员: user_b={user_b}, block_list={block_list_after}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.change_subject_and_description.success")
@pytest.mark.api("ChatRoomManager.changeChatRoomSubject")
@pytest.mark.api("ChatRoomManager.changeChatRoomDescription")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_change_subject_and_description_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室基础能力场景所需的测试数据，场景为聊天室、change、subject、and、description、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.changeChatRoomSubject、ChatRoomManager.changeChatRoomDescription、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室基础能力场景所需的测试数据，场景为聊天室、change、subject、and、description、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.changeChatRoomSubject、ChatRoomManager.changeChatRoomDescription、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="profile", desc_prefix="profile")
    new_subject = f"room-subject-{uuid.uuid4().hex[:8]}"
    new_description = f"room-description-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        subject_resp = client.call(
            "ChatRoomManager",
            Cmd.changeChatRoomSubject.value,
            info={"roomId": room_id, "subject": new_subject},
        )
        _assert_success_envelope(
            assert_api, subject_resp, cmd=Cmd.changeChatRoomSubject.value, device=_expected_device(client)
        )

        description_resp = client.call(
            "ChatRoomManager",
            Cmd.changeChatRoomDescription.value,
            info={"roomId": room_id, "description": new_description},
        )
        _assert_success_envelope(
            assert_api,
            description_resp,
            cmd=Cmd.changeChatRoomDescription.value,
            device=_expected_device(client),
        )

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomInfoFromServer.value,
                "device": _expected_device(client),
                "result": {
                    "roomId": room_id,
                    "name": new_subject,
                    "desc": new_description,
                },
            },
            ignore_keys={
                "sequence",
                "owner",
                "maxUsers",
                "permissionType",
                "isAllMemberMuted",
                "adminList",
                "memberCount",
                "muteList",
                "muteExpireTimestamp",
                "createTimestamp",
                "memberList",
                "isInWhitelist",
                "blockList",
                "announcement",
            },
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.add_and_remove_admin.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.addChatRoomAdmin")
@pytest.mark.api("ChatRoomManager.removeChatRoomAdmin")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_chatroom_add_and_remove_admin_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、添加、and、移除、admin、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.addChatRoomAdmin、ChatRoomManager.removeChatRoomAdmin、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、添加、and、移除、admin、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.addChatRoomAdmin、ChatRoomManager.removeChatRoomAdmin、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="admin", desc_prefix="admin")
    try:
        _join_chatroom_as_b(remote, assert_api, room_id)

        add_resp = primary.call(
            "ChatRoomManager",
            Cmd.addChatRoomAdmin.value,
            info={"roomId": room_id, "admin": user_b},
        )
        _assert_success_envelope(assert_api, add_resp, cmd=Cmd.addChatRoomAdmin.value, device=primary_device)

        fetch_after_add = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        admin_list = (fetch_after_add.get("result") or {}).get("adminList")
        assert isinstance(admin_list, list), f"adminList 应为 list: {fetch_after_add}"
        assert user_b in admin_list, f"添加管理员后 adminList 缺少成员: user_b={user_b}, adminList={admin_list}"

        remove_resp = primary.call(
            "ChatRoomManager",
            Cmd.removeChatRoomAdmin.value,
            info={"roomId": room_id, "admin": user_b},
        )
        _assert_success_envelope(assert_api, remove_resp, cmd=Cmd.removeChatRoomAdmin.value, device=primary_device)

        fetch_after_remove = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        admin_list_after = (fetch_after_remove.get("result") or {}).get("adminList")
        assert isinstance(admin_list_after, list), f"adminList 应为 list: {fetch_after_remove}"
        assert user_b not in admin_list_after, (
            f"移除管理员后 adminList 仍包含成员: user_b={user_b}, adminList={admin_list_after}"
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.remove_member.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.removeChatRoomMembers")
@pytest.mark.api("ChatRoomManager.fetchChatRoomMembers")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_chatroom_remove_member_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、移除、成员、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.removeChatRoomMembers、ChatRoomManager.fetchChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、移除、成员、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.removeChatRoomMembers、ChatRoomManager.fetchChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="kick", desc_prefix="kick")
    try:
        _join_chatroom_as_b(remote, assert_api, room_id)

        remove_resp = primary.call(
            "ChatRoomManager",
            Cmd.removeChatRoomMembers.value,
            info={"roomId": room_id, "members": [user_b]},
        )
        _assert_success_envelope(assert_api, remove_resp, cmd=Cmd.removeChatRoomMembers.value, device=primary_device)

        members_resp = primary.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomMembers.value,
            info={"roomId": room_id, "cursor": "", "pageSize": 20},
        )
        assert_api.assert_response_matches(
            members_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomMembers.value,
                "device": primary_device,
                "result": {
                    "cursor": ne(None),
                    "list": ne(None),
                },
            },
            ignore_keys={"sequence"},
        )
        members = (members_resp.get("result") or {}).get("list")
        assert isinstance(members, list), f"fetchChatRoomMembers result.list 应为 list: {members_resp}"
        assert user_b not in members, f"踢出成员后成员列表仍包含该成员: user_b={user_b}, members={members}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.mute_and_unmute_all_members.success")
@pytest.mark.api("ChatRoomManager.muteAllChatRoomMembers")
@pytest.mark.api("ChatRoomManager.unMuteAllChatRoomMembers")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_mute_and_unmute_all_members_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、禁言、and、unmute、all、成员、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.muteAllChatRoomMembers、ChatRoomManager.unMuteAllChatRoomMembers、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、禁言、and、unmute、all、成员、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.muteAllChatRoomMembers、ChatRoomManager.unMuteAllChatRoomMembers、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="mute_all", desc_prefix="mute_all")
    try:
        client = topology_primary_or_device_a
        mute_resp = client.call(
            "ChatRoomManager",
            Cmd.muteAllChatRoomMembers.value,
            info={"roomId": room_id},
        )
        _assert_success_envelope(assert_api, mute_resp, cmd=Cmd.muteAllChatRoomMembers.value, device=_expected_device(client))

        fetch_after_mute = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        assert (fetch_after_mute.get("result") or {}).get("isAllMemberMuted") is True, (
            f"全员禁言后 isAllMemberMuted 未变为 true: {fetch_after_mute}"
        )

        unmute_resp = client.call(
            "ChatRoomManager",
            Cmd.unMuteAllChatRoomMembers.value,
            info={"roomId": room_id},
        )
        _assert_success_envelope(
            assert_api, unmute_resp, cmd=Cmd.unMuteAllChatRoomMembers.value, device=_expected_device(client)
        )

        fetch_after_unmute = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomInfoFromServer.value,
            info={"roomId": room_id},
        )
        assert (fetch_after_unmute.get("result") or {}).get("isAllMemberMuted") is False, (
            f"解除全员禁言后 isAllMemberMuted 未变为 false: {fetch_after_unmute}"
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.set_and_fetch_attributes.success")
@pytest.mark.api("ChatRoomManager.setChatRoomAttributes")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_set_and_fetch_attributes_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、set、and、拉取、attributes、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.setChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、set、and、拉取、attributes、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.setChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="attrs", desc_prefix="attrs")
    attr_key = f"room_attr_{uuid.uuid4().hex[:8]}"
    attr_value = f"value-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: attr_value},
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(assert_api, set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client))
        failures = set_resp.get("result")
        assert isinstance(failures, dict), f"setChatRoomAttributes result 应为失败 key map: {set_resp}"
        assert attr_key not in failures, f"设置聊天室属性失败: key={attr_key}, failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": {
                    attr_key: attr_value,
                },
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.set_attributes_non_forced.success")
@pytest.mark.api("ChatRoomManager.setChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_set_attributes_non_forced_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室基础能力场景所需的测试数据，场景为聊天室、set、attributes、non、forced、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.setChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室基础能力场景所需的测试数据，场景为聊天室、set、attributes、non、forced、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.setChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="attrs_nf", desc_prefix="attrs_nf")
    attr_key = f"room_attr_nf_{uuid.uuid4().hex[:8]}"
    attr_value = f"value-nf-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: attr_value},
                "autoDelete": False,
                "forced": False,
            },
        )
        _assert_success_envelope(assert_api, set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client))
        failures = set_resp.get("result")
        assert isinstance(failures, dict), f"setChatRoomAttributes result 应为失败 key map: {set_resp}"
        assert attr_key not in failures, f"非强制设置聊天室属性失败: key={attr_key}, failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": {
                    attr_key: attr_value,
                },
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.fetch_all_attributes.success")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_all_attributes_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、all、attributes、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、all、attributes、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="attrs_all", desc_prefix="attrs_all")
    attr_key_1 = f"room_attr_all_1_{uuid.uuid4().hex[:8]}"
    attr_key_2 = f"room_attr_all_2_{uuid.uuid4().hex[:8]}"
    attributes = {
        attr_key_1: f"value-1-{uuid.uuid4().hex[:8]}",
        attr_key_2: f"value-2-{uuid.uuid4().hex[:8]}",
    }
    try:
        client = topology_primary_or_device_a
        set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": attributes,
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(assert_api, set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client))
        failures = set_resp.get("result")
        assert isinstance(failures, dict), f"setChatRoomAttributes result 应为失败 key map: {set_resp}"
        assert not set(attributes).intersection(failures), f"设置聊天室属性失败: failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": attributes,
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.fetch_attributes_by_partial_keys.success")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_attributes_by_partial_keys_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、attributes、by、partial、keys、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、attributes、by、partial、keys、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="attrs_partial", desc_prefix="attrs_partial")
    attr_key_1 = f"room_attr_partial_1_{uuid.uuid4().hex[:8]}"
    attr_key_2 = f"room_attr_partial_2_{uuid.uuid4().hex[:8]}"
    attributes = {
        attr_key_1: f"value-1-{uuid.uuid4().hex[:8]}",
        attr_key_2: f"value-2-{uuid.uuid4().hex[:8]}",
    }
    try:
        client = topology_primary_or_device_a
        set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": attributes,
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(assert_api, set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client))
        failures = set_resp.get("result")
        assert isinstance(failures, dict), f"setChatRoomAttributes result 应为失败 key map: {set_resp}"
        assert not set(attributes).intersection(failures), f"设置聊天室属性失败: failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key_1]},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": {
                    attr_key_1: attributes[attr_key_1],
                },
            },
            ignore_keys={"sequence"},
        )
        fetched = fetch_resp.get("result")
        assert attr_key_2 not in fetched, f"按部分 key 拉取时返回了未请求的 key: fetched={fetched}"
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.update_attribute_overwrites_previous_value.success")
@pytest.mark.api("ChatRoomManager.setChatRoomAttributes")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_update_attribute_overwrites_previous_value(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、更新、attribute、overwrites、previous、value；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.setChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、更新、attribute、overwrites、previous、value；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.setChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="attrs_update", desc_prefix="attrs_update")
    attr_key = f"room_attr_update_{uuid.uuid4().hex[:8]}"
    old_value = f"old-{uuid.uuid4().hex[:8]}"
    new_value = f"new-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        first_set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: old_value},
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(
            assert_api, first_set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client)
        )

        second_set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: new_value},
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(
            assert_api, second_set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client)
        )
        failures = second_set_resp.get("result")
        assert isinstance(failures, dict), f"setChatRoomAttributes result 应为失败 key map: {second_set_resp}"
        assert attr_key not in failures, f"覆盖更新聊天室属性失败: key={attr_key}, failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": {
                    attr_key: new_value,
                },
            },
            ignore_keys={"sequence"},
        )
        assert (fetch_resp.get("result") or {}).get(attr_key) != old_value, (
            f"聊天室属性覆盖更新后仍返回旧值: old={old_value}, resp={fetch_resp}"
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.change_owner.success")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.api("ChatRoomManager.changeChatRoomOwner")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_chatroom_change_owner_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室基础能力场景所需的测试数据，场景为聊天室、change、owner、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.changeChatRoomOwner、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室基础能力场景所需的测试数据，场景为聊天室、change、owner、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom、ChatRoomManager.changeChatRoomOwner、ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    room_id, room_name = create_chatroom_or_skip(owner=user_a, name_prefix="owner", desc_prefix="owner")
    try:
        _join_chatroom_as_b(remote, assert_api, room_id)

        change_resp = primary.call(
            "ChatRoomManager",
            Cmd.changeChatRoomOwner.value,
            info={"roomId": room_id, "newOwner": user_b},
        )
        assert_api.assert_response_matches(
            change_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.changeChatRoomOwner.value,
                "device": primary_device,
                "result": {
                    "owner": user_b,
                    "maxUsers": 200,
                    "permissionType": 0,
                    "isAllMemberMuted": False,
                    "adminList": [],
                    "memberCount": 2,
                    "muteList": [],
                    "muteExpireTimestamp": -1,
                    "roomId": room_id,
                    "createTimestamp": 0,
                    "memberList": [user_a],
                    "isInWhitelist": False,
                    "blockList": [],
                    "name": room_name,
                    "desc": "nothing left here",
                    "announcement": "",
                },
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.remove_attributes.success")
@pytest.mark.api("ChatRoomManager.removeChatRoomAttributes")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_remove_attributes_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、移除、attributes、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.removeChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、移除、attributes、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.removeChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="remove_attrs", desc_prefix="remove_attrs")
    attr_key = f"room_attr_remove_{uuid.uuid4().hex[:8]}"
    attr_value = f"value-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: attr_value},
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(assert_api, set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client))

        remove_resp = client.call(
            "ChatRoomManager",
            Cmd.removeChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key], "forced": True},
        )
        _assert_success_envelope(
            assert_api, remove_resp, cmd=Cmd.removeChatRoomAttributes.value, device=_expected_device(client)
        )
        failures = remove_resp.get("result")
        assert isinstance(failures, dict), f"removeChatRoomAttributes result 应为失败 key map: {remove_resp}"
        assert attr_key not in failures, f"删除聊天室属性失败: key={attr_key}, failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": {},
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
@pytest.mark.case_id("chatroom.remove_attributes_non_forced.success")
@pytest.mark.api("ChatRoomManager.removeChatRoomAttributes")
@pytest.mark.api("ChatRoomManager.fetchChatRoomAttributes")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_remove_attributes_non_forced_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、移除、attributes、non、forced、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.removeChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室状态变更场景所需的测试数据，场景为聊天室、移除、attributes、non、forced、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.removeChatRoomAttributes、ChatRoomManager.fetchChatRoomAttributes，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    room_id, _ = create_chatroom_or_skip(owner=user_a, name_prefix="remove_attrs_nf", desc_prefix="remove_attrs_nf")
    attr_key = f"room_attr_remove_nf_{uuid.uuid4().hex[:8]}"
    attr_value = f"value-nf-{uuid.uuid4().hex[:8]}"
    try:
        client = topology_primary_or_device_a
        set_resp = client.call(
            "ChatRoomManager",
            Cmd.setChatRoomAttributes.value,
            info={
                "roomId": room_id,
                "attributes": {attr_key: attr_value},
                "autoDelete": False,
                "forced": True,
            },
        )
        _assert_success_envelope(assert_api, set_resp, cmd=Cmd.setChatRoomAttributes.value, device=_expected_device(client))

        remove_resp = client.call(
            "ChatRoomManager",
            Cmd.removeChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key], "forced": False},
        )
        _assert_success_envelope(
            assert_api, remove_resp, cmd=Cmd.removeChatRoomAttributes.value, device=_expected_device(client)
        )
        failures = remove_resp.get("result")
        assert isinstance(failures, dict), f"removeChatRoomAttributes result 应为失败 key map: {remove_resp}"
        assert attr_key not in failures, f"非强制删除聊天室属性失败: key={attr_key}, failures={failures}"

        fetch_resp = client.call(
            "ChatRoomManager",
            Cmd.fetchChatRoomAttributes.value,
            info={"roomId": room_id, "keys": [attr_key]},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchChatRoomAttributes.value,
                "device": _expected_device(client),
                "result": {},
            },
            ignore_keys={"sequence"},
        )
    finally:
        safe_delete_chatroom(room_id)
