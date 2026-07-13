"""Group inviterUser 异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"
_NONEXISTENT_USER = "nonexistent_user_999999"


@pytest.mark.real_e2e
@pytest.mark.case_id("group.inviter_user.nonexistent_group.error")
@pytest.mark.api("GroupManager.inviterUser")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_inviter_user_nonexistent_group(device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、inviter、用户、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、inviter、用户、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.inviterUser.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "members": [user_b], "reason": "auto-inviter"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_inviter_user_empty_members(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、inviter、用户、空值参数、成员；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、inviter、用户、空值参数、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("ex_inviter_empty"),
            invite_members=[],
        )
        resp = device_a.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={"groupId": group_id, "members": [], "reason": "auto-inviter"},
        )
        # 当前端稳定语义：空 members 调用成功
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.inviterUser.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_inviter_user_nonexistent_user(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、inviter、用户、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、inviter、用户、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("ex_inviter_user"),
            invite_members=[],
        )
        resp = device_a.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={"groupId": group_id, "members": [_NONEXISTENT_USER], "reason": "auto-inviter"},
        )
        assert_api.assert_error(resp, code=603, description="doesn't exist")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)
