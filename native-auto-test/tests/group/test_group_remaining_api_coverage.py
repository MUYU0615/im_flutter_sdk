"""Group remaining API coverage: normal and boundary cases."""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

import pytest

from src import Cmd, ne
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group, pytest.mark.agorachat1_4_0]


NONEXISTENT_GROUP_ID = "nonexistent_group_remaining_999999"


def _assert_error_result(assert_api, resp: dict, *, cmd: str, code: int, description: str) -> None:
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": cmd,
            "device": "deviceA",
            "result": {
                "code": code,
                "description": description,
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("group.clear_all_groups_from_local.success")
@pytest.mark.api("GroupManager.clearAllGroupsFromDB")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_clear_all_groups_from_local_success(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、clear、all、groups、from、本地、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.clearAllGroupsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、clear、all、groups、from、本地、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.clearAllGroupsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_a.call("GroupManager", Cmd.clearAllGroupsFromDB.value)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.clearAllGroupsFromDB.value,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("group.fetch_members_info.empty_group_id.error")
@pytest.mark.api("GroupManager.fetchGroupMembersInfo")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_fetch_members_info_empty_group_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、信息、空值参数、群组、id；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchGroupMembersInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、信息、空值参数、群组、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchGroupMembersInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.fetchGroupMembersInfo.value,
        info={"groupId": "", "cursor": None, "limit": 20},
    )
    _assert_error_result(
        assert_api,
        resp,
        cmd=Cmd.fetchGroupMembersInfo.value,
        code=600,
        description="Group ID is invalid",
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("group.fetch_members_info.limit_zero.current_result")
@pytest.mark.api("GroupManager.fetchGroupMembersInfo")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_fetch_members_info_invalid_limit(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、信息、无效参数、limit；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchGroupMembersInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、信息、无效参数、limit；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchGroupMembersInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        resp_user_info = device_a.call(
            "UserInfoManager",
            Cmd.fetchUserInfoById.value,
            info={"userIds": [user_a]},
        )
        assert_api.assert_response_matches(
            resp_user_info,
            expected={
                "manager": "UserInfoManager",
                "cmd": Cmd.fetchUserInfoById.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )
        current_user_info = (resp_user_info.get("result") or {}).get(user_a) or {}

        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("member_info_limit"),
            invite_members=[],
        )
        resp = device_a.call(
            "GroupManager",
            Cmd.fetchGroupMembersInfo.value,
            info={"groupId": group_id, "cursor": None, "limit": 0},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.fetchGroupMembersInfo.value,
                "device": "deviceA",
                "result": {
                    "cursor": "",
                    "list": [
                        {
                            "namecard": "",
                            "role": 2,
                            "avatarUrl": ne(None),
                            "nickname": ne(None),
                            "userId": user_a,
                            "memberId": user_a,
                        }
                    ],
                },
            },
            ignore_keys={"sequence", "joinedTs", "joinTime", "string"},
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("group.update_avatar.success")
@pytest.mark.api("GroupManager.updateGroupAvatar")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_avatar_success(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、avatar、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAvatar，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、avatar、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAvatar，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_id = ""
    avatar_url = f"https://example.com/group-avatar/{uuid.uuid4().hex}.png"
    try:
        group_id, group_resp = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("avatar"),
            invite_members=[],
        )
        group_name = (group_resp.get("result") or {}).get("name")
        resp = device_a.call(
            "GroupManager",
            Cmd.updateGroupAvatar.value,
            info={"groupId": group_id, "avatarUrl": avatar_url},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupAvatar.value,
                "device": "deviceA",
                "result": {
                    "groupId": group_id,
                    "name": group_name,
                    "owner": user_a,
                    "ext": "auto-ext",
                    "avatarUrl": avatar_url,
                    "memberCount": 1,
                    "isMemberOnly": True,
                    "isMemberAllowToInvite": False,
                    "messageBlocked": False,
                    "maxUserCount": 200,
                },
            },
            ignore_keys={
                "sequence",
                "desc",
                "memberList",
                "adminList",
                "blockList",
                "muteList",
                "permissionType",
                "isAllMemberMuted",
                "isDisabled",
                "isMemberOnly",
                "announcement",
                "sharedFiles",
                "options",
            },
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.parametrize(
    "avatar_url",
    [
        # updateGroupAvatar：头像 URL 为空字符串，当前实测允许置空并返回群对象。
        "",
        # updateGroupAvatar：头像 URL 超长，当前实测允许写入并返回群对象。
        "https://example.com/" + ("a" * 2048),
    ],
)
@pytest.mark.real_e2e
@pytest.mark.case_id("group.update_avatar.abnormal_values.current_success")
@pytest.mark.api("GroupManager.updateGroupAvatar")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_avatar_abnormal_values(
    device_a,
    assert_api,
    user_a,
    avatar_url,
):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、avatar、abnormal、values；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAvatar，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、avatar、abnormal、values；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAvatar，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, group_resp = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("avatar_bad"),
            invite_members=[],
        )
        group_name = (group_resp.get("result") or {}).get("name")
        resp = device_a.call(
            "GroupManager",
            Cmd.updateGroupAvatar.value,
            info={"groupId": group_id, "avatarUrl": avatar_url},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupAvatar.value,
                "device": "deviceA",
                "result": {
                    "groupId": group_id,
                    "name": group_name,
                    "owner": user_a,
                    "ext": "auto-ext",
                    "avatarUrl": avatar_url,
                    "memberCount": 1,
                    "isMemberOnly": True,
                    "isMemberAllowToInvite": False,
                    "messageBlocked": False,
                    "maxUserCount": 200,
                },
            },
            ignore_keys={
                "sequence",
                "desc",
                "memberList",
                "adminList",
                "blockList",
                "muteList",
                "permissionType",
                "isAllMemberMuted",
                "isDisabled",
                "announcement",
                "sharedFiles",
                "options",
            },
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("group.update_avatar.empty_group_id.error")
@pytest.mark.api("GroupManager.updateGroupAvatar")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_avatar_empty_group_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、avatar、空值参数、群组、id；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAvatar，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、avatar、空值参数、群组、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAvatar，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.updateGroupAvatar.value,
        info={"groupId": "", "avatarUrl": "https://example.com/group-avatar/empty.png"},
    )
    _assert_error_result(
        assert_api,
        resp,
        cmd=Cmd.updateGroupAvatar.value,
        code=600,
        description="Group ID is invalid",
    )
