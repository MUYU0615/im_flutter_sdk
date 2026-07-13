"""Group public list/count API 用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _assert_public_groups_result(result: object, *, resp: dict) -> None:
    assert isinstance(result, dict), f"getPublicGroupsFromServer result 应为 dict: {resp}"
    assert "cursor" in result, f"getPublicGroupsFromServer result 缺少 cursor: {resp}"
    assert "list" in result, f"getPublicGroupsFromServer result 缺少 list: {resp}"
    cursor = result.get("cursor")
    groups = result.get("list")
    assert isinstance(cursor, str), f"getPublicGroupsFromServer cursor 应为 str: {resp}"
    assert isinstance(groups, list), f"getPublicGroupsFromServer list 应为 list: {resp}"
    for idx, item in enumerate(groups):
        assert isinstance(item, dict), f"getPublicGroupsFromServer list[{idx}] 不是 dict: {item!r}"
        group_id = item.get("groupId")
        name = item.get("name")
        assert isinstance(group_id, str) and group_id, (
            f"getPublicGroupsFromServer list[{idx}].groupId 非法: {item!r}"
        )
        assert isinstance(name, str), f"getPublicGroupsFromServer list[{idx}].name 非法: {item!r}"


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_fetch_joined_group_count_success(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、拉取、joined、群组、count、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchJoinedGroupCount，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、拉取、joined、群组、count、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchJoinedGroupCount，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call("GroupManager", Cmd.fetchJoinedGroupCount.value, info={})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.fetchJoinedGroupCount.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    assert isinstance(result, int), f"fetchJoinedGroupCount result 应为 int: {resp}"
    assert result >= 0, f"fetchJoinedGroupCount result 应>=0: {resp}"


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_public_groups_from_server_success(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、public、groups、from、服务端、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getPublicGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、public、groups、from、服务端、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getPublicGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.getPublicGroupsFromServer.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.getPublicGroupsFromServer.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    _assert_public_groups_result(result, resp=resp)
