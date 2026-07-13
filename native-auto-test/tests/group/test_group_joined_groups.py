"""Group list API 用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import (
    assert_group_list_response,
    create_group,
    destroy_group,
    find_group_in_list,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_joined_groups_local_contains_created_group(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、本地、contains、created、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroups，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、本地、contains、created、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroups，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_name = new_group_name("joined_local")
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[],
        )
        resp = client.call("GroupManager", Cmd.getJoinedGroups.value, info={})
        groups = assert_group_list_response(
            assert_api,
            resp,
            cmd=Cmd.getJoinedGroups.value,
            device=expected_device,
        )
        matched = find_group_in_list(groups, group_id)
        assert matched is not None, f"getJoinedGroups 未包含新建群: groupId={group_id}, resp={resp}"
        assert matched.get("owner") == user_a, f"getJoinedGroups owner 不匹配: expected={user_a}, actual={matched}"
        assert matched.get("name") == group_name, f"getJoinedGroups name 不匹配: expected={group_name}, actual={matched}"
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_load_all_groups_local_cache_contains_created_group(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、load、all、groups、本地、cache、contains、created；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.loadAllGroups、GroupManager.getJoinedGroups，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、load、all、groups、本地、cache、contains、created；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.loadAllGroups、GroupManager.getJoinedGroups，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_name = new_group_name("load_all")
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[],
        )
        resp_load = client.call("GroupManager", Cmd.loadAllGroups.value, info={})
        assert_api.assert_response_matches(
            resp_load,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.loadAllGroups.value,
                "device": expected_device,
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        resp = client.call("GroupManager", Cmd.getJoinedGroups.value, info={})
        groups = assert_group_list_response(
            assert_api,
            resp,
            cmd=Cmd.getJoinedGroups.value,
            device=expected_device,
        )
        matched = find_group_in_list(groups, group_id)
        assert matched is not None, f"loadAllGroups 后 getJoinedGroups 未包含新建群: groupId={group_id}, resp={resp}"
        assert matched.get("owner") == user_a, f"loadAllGroups 后 owner 不匹配: expected={user_a}, actual={matched}"
        assert matched.get("name") == group_name, f"loadAllGroups 后 name 不匹配: expected={group_name}, actual={matched}"
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_joined_groups_from_server_contains_created_group(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、from、服务端、contains、created；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、from、服务端、contains、created；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_name = new_group_name("joined_server")
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[],
        )
        resp = client.call("GroupManager", Cmd.getJoinedGroupsFromServer.value, info={})
        groups = assert_group_list_response(
            assert_api,
            resp,
            cmd=Cmd.getJoinedGroupsFromServer.value,
            device=expected_device,
        )
        matched = find_group_in_list(groups, group_id)
        assert matched is not None, (
            f"getJoinedGroupsFromServer 未包含新建群: groupId={group_id}, resp={resp}"
        )
        assert matched.get("owner") == user_a, (
            f"getJoinedGroupsFromServer owner 不匹配: expected={user_a}, actual={matched}"
        )
        assert matched.get("name") == group_name, (
            f"getJoinedGroupsFromServer name 不匹配: expected={group_name}, actual={matched}"
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
