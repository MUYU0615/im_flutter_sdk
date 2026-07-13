"""Group 成员属性删除 API 异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.remove_member_attributes.nonexistent_group.current_success")
@pytest.mark.api("GroupManager.removeMemberAttributesFromGroup")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_remove_member_attributes_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、成员、attributes、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、成员、attributes、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.removeMemberAttributesFromGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "keys": ["k1"]},
    )
    # 按当前端稳定语义：不存在群也返回成功
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.removeMemberAttributesFromGroup.value,
            "device": _expected_device(client),
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_remove_member_attributes_empty_keys(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、成员、attributes、空值参数、keys；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、成员、attributes、空值参数、keys；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("ex_member_attr_rm"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.removeMemberAttributesFromGroup.value,
            info={"groupId": group_id, "keys": []},
        )
        assert_api.assert_error(resp, code=205, description="Invalid parameter")
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_remove_member_attributes_nonexistent_key(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、成员、attributes、不存在对象、key；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、成员、attributes、不存在对象、key；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("ex_member_attr_rm_key"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.removeMemberAttributesFromGroup.value,
            info={"groupId": group_id, "keys": ["k_not_exists"]},
        )
        # 按当前端稳定语义：删除不存在 key 走成功
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.removeMemberAttributesFromGroup.value,
                "device": _expected_device(client),
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
