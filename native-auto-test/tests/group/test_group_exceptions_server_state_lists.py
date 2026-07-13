"""Group 服务端状态列表 API 异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.parametrize(
    "cmd",
    [
        Cmd.getGroupBlockListFromServer.value,
        Cmd.getGroupMuteListFromServer.value,
        Cmd.getGroupWhiteListFromServer.value,
        Cmd.isMemberInWhiteListFromServer.value,
    ],
)
def test_group_server_state_list_nonexistent_group(topology_primary_or_device_a, assert_api, cmd):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、服务端、state、列表、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 群组、服务端、state、列表、不存在对象、群组，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、服务端、state、列表、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 群组、服务端、state、列表、不存在对象、群组，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"groupId": _NONEXISTENT_GROUP_ID}
    if cmd in (Cmd.getGroupBlockListFromServer.value, Cmd.getGroupMuteListFromServer.value):
        info.update({"pageNum": 1, "pageSize": 20})
    resp = topology_primary_or_device_a.call("GroupManager", cmd, info=info)
    assert_api.assert_error(resp, code=600, description="do not find this group")
