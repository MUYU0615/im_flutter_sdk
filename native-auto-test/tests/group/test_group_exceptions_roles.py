"""Group 角色权限异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"
_NONEXISTENT_USER = "nonexistent_user_999999"


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.add_admin.nonexistent_group.error")
@pytest.mark.api("GroupManager.addAdmin")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_add_admin_nonexistent_group(topology_primary_or_device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、admin、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addAdmin，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、admin、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addAdmin，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.addAdmin.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "admin": user_b},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.remove_admin.nonexistent_group.error")
@pytest.mark.api("GroupManager.removeAdmin")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_remove_admin_nonexistent_group(topology_primary_or_device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、admin、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeAdmin，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、admin、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeAdmin，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.removeAdmin.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "admin": user_b},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.update_owner.nonexistent_group.error")
@pytest.mark.api("GroupManager.updateGroupOwner")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_owner_nonexistent_group(topology_primary_or_device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、owner、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupOwner，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、owner、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupOwner，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.updateGroupOwner.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "owner": user_b},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_add_admin_non_member(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、添加、admin、non、成员；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addAdmin，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、添加、admin、non、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addAdmin，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("ex_add_admin"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.addAdmin.value,
            info={"groupId": group_id, "admin": _NONEXISTENT_USER},
        )
        assert_api.assert_error(resp, code=600, description="doesn't exist")
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
