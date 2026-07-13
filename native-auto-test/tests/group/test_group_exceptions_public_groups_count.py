"""Group public list/count API 异常/边界用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.test_group_public_groups_count import _assert_public_groups_result


pytestmark = [pytest.mark.client, pytest.mark.group]


@pytest.mark.real_e2e
@pytest.mark.parametrize(
    ("page_num", "page_size"),
    [
        (0, 20),
        (-1, 20),
        (1, 0),
        (1, -1),
    ],
)
def test_group_get_public_groups_from_server_invalid_paging(device_a, assert_api, page_num, page_size):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、public、groups、from、服务端、无效参数、paging；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getPublicGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、public、groups、from、服务端、无效参数、paging；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getPublicGroupsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.getPublicGroupsFromServer.value,
        info={"pageNum": page_num, "pageSize": page_size},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.getPublicGroupsFromServer.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    _assert_public_groups_result(resp.get("result"), resp=resp)


@pytest.mark.real_e2e
def test_group_fetch_joined_group_count_with_extra_info(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、拉取、joined、群组、count、with、extra、信息；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchJoinedGroupCount，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、拉取、joined、群组、count、with、extra、信息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.fetchJoinedGroupCount，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.fetchJoinedGroupCount.value,
        info={"unexpected": "value", "pageSize": 0},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.fetchJoinedGroupCount.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    assert isinstance(result, int), f"fetchJoinedGroupCount result 应为 int: {resp}"
    assert result >= 0, f"fetchJoinedGroupCount result 应>=0: {resp}"
