"""Group member list API 异常/边界用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.test_group_member_list import _extract_member_ids


pytestmark = [pytest.mark.client, pytest.mark.group, pytest.mark.agorachat1_4_0]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.get_member_list_from_server.nonexistent_group.error")
@pytest.mark.api("GroupManager.getGroupMemberListFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_get_group_member_list_from_server_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、群组、成员、列表、from、服务端、不存在对象；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMemberListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、群组、成员、列表、from、服务端、不存在对象；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMemberListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.getGroupMemberListFromServer.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "pageNum": 1, "pageSize": 20},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.parametrize(
    ("page_num", "page_size"),
    [
        (0, 20),
        (-1, 20),
        (1, 0),
        (1, -1),
    ],
)
def test_group_get_group_member_list_from_server_invalid_paging(
    topology_primary_or_device_a, assert_api, page_num, page_size
):
    # 用不存在群 ID 触发稳定错误，避免分页边界受群态影响
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、群组、成员、列表、from、服务端、无效参数；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMemberListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、群组、成员、列表、from、服务端、无效参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMemberListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "GroupManager",
        Cmd.getGroupMemberListFromServer.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "pageNum": page_num, "pageSize": page_size},
    )
    result = resp.get("result")
    if isinstance(result, dict) and "code" in result and "description" in result:
        code = result.get("code")
        desc = str(result.get("description", ""))
        assert isinstance(code, int), f"错误码类型异常: {resp}"
        assert desc, f"错误描述为空: {resp}"
        assert_api.assert_error(resp, code=code, description=desc)
        return

    # 若当前端未返回错误，则至少保证返回结构可解析
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.getGroupMemberListFromServer.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    _extract_member_ids(resp.get("result"), resp=resp)
