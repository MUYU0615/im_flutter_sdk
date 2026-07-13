"""Group list API 异常/边界用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import assert_group_list_response


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_joined_groups_with_extra_info_fields(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、with、extra、信息、fields；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroups，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、with、extra、信息、fields；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroups，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.getJoinedGroups.value,
        info={"unexpected": "value", "pageNum": 0, "pageSize": -1},
    )
    # 当前端对该接口忽略无关参数并返回稳定列表结构
    assert_group_list_response(
        assert_api,
        resp,
        cmd=Cmd.getJoinedGroups.value,
        device=_expected_device(client),
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_joined_groups_from_server_with_extra_info_fields(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、from、服务端、with、extra；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、joined、groups、from、服务端、with、extra；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getJoinedGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.getJoinedGroupsFromServer.value,
        info={"unexpected": "value", "cursor": "invalid", "pageSize": 0},
    )
    # 当前端对该接口忽略无关参数并返回稳定列表结构
    assert_group_list_response(
        assert_api,
        resp,
        cmd=Cmd.getJoinedGroupsFromServer.value,
        device=_expected_device(client),
    )
