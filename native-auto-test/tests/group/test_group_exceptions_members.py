"""Group members 异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"
_NONEXISTENT_USER = "nonexistent_user_999999"


@pytest.mark.real_e2e
def test_group_add_members_empty_members(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、成员、空值参数、成员；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、成员、空值参数、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(device_a, assert_api, owner=user_a, group_name=new_group_name("ex_mem"), invite_members=[])
        resp = device_a.call("GroupManager", Cmd.addMembers.value, info={"groupId": group_id, "members": []})
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.addMembers.value,
                "device": "deviceA",
                "result": True,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("group.add_members.nonexistent_group.error")
@pytest.mark.api("GroupManager.addMembers")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_add_members_nonexistent_group(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、成员、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、成员、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "members": ["test_user_x"]},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_add_members_nonexistent_user(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、成员、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、添加、成员、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(device_a, assert_api, owner=user_a, group_name=new_group_name("ex_user"), invite_members=[])
        resp = device_a.call("GroupManager", Cmd.addMembers.value, info={"groupId": group_id, "members": [_NONEXISTENT_USER]})
        assert_api.assert_error(resp, code=603, description="doesn't exist")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_remove_members_non_member(device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、移除、成员、non、成员；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、移除、成员、non、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(device_a, assert_api, owner=user_a, group_name=new_group_name("ex_rm"), invite_members=[])
        resp = device_a.call("GroupManager", Cmd.removeMembers.value, info={"groupId": group_id, "members": [user_b]})
        assert_api.assert_error(resp, code=603, description="are not members of this group")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.case_id("group.leave_group.nonexistent_group.error")
@pytest.mark.api("GroupManager.leaveGroup")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_leave_group_non_member(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、离开、群组、non、成员；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.leaveGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、离开、群组、non、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.leaveGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    resp = device_b.call("GroupManager", Cmd.leaveGroup.value, info={"groupId": _NONEXISTENT_GROUP_ID})
    assert_api.assert_error(resp, code=600, description="do not find this group")
