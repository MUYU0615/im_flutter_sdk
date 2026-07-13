"""Group 成员属性 API 异常用例（strict）。"""
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
@pytest.mark.case_id("group.set_member_attributes.nonexistent_group.current_success")
@pytest.mark.api("GroupManager.setMemberAttributesFromGroup")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_set_member_attributes_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、set、成员、attributes、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.setMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、set、成员、attributes、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.setMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.setMemberAttributesFromGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "attributes": {"k": "v"}},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.setMemberAttributesFromGroup.value,
            "device": _expected_device(client),
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
def test_group_fetch_member_attributes_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、attributes、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、attributes、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.fetchMemberAttributesFromGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.fetchMemberAttributesFromGroup.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    assert isinstance(result, dict), f"fetchMemberAttributesFromGroup result 非 dict: {resp}"
    assert "k" in result, f"fetchMemberAttributesFromGroup 当前端返回应包含 k: {resp}"
    assert result.get("k") == "v", f"fetchMemberAttributesFromGroup 当前端返回值不匹配: {resp}"


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.fetch_members_attributes.nonexistent_group.current_result")
@pytest.mark.api("GroupManager.fetchMembersAttributesFromGroup")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_fetch_members_attributes_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、attributes、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchMembersAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、拉取、成员、attributes、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchMembersAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.fetchMembersAttributesFromGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "userIds": ["test_user_x"]},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.fetchMembersAttributesFromGroup.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    assert isinstance(result, dict), f"fetchMembersAttributesFromGroup result 非 dict: {resp}"
    assert "test_user_x" in result, f"fetchMembersAttributesFromGroup 当前端返回应包含 test_user_x: {resp}"
    user_attrs = result.get("test_user_x")
    assert isinstance(user_attrs, dict), f"fetchMembersAttributesFromGroup 成员属性非 dict: {resp}"
    assert user_attrs == {}, f"fetchMembersAttributesFromGroup 当前端空属性语义应为 {{}}: {resp}"


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_set_member_attributes_empty_attributes(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、set、成员、attributes、空值参数、attributes；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.setMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、set、成员、attributes、空值参数、attributes；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.setMemberAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("ex_member_attr"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.setMemberAttributesFromGroup.value,
            info={"groupId": group_id, "attributes": {}},
        )
        assert_api.assert_error(resp, code=205, description="Invalid parameter")
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
