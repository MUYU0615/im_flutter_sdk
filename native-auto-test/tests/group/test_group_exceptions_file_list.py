"""Group 共享文件列表异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


@pytest.mark.parametrize(
    "page_num,page_size",
    [
        (1, 20),
        (0, 20),
        (1, 0),
    ],
)
@pytest.mark.real_e2e
@pytest.mark.case_id("group.get_file_list_from_server.nonexistent_group.error")
@pytest.mark.api("GroupManager.getGroupFileListFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_get_group_file_list_from_server_nonexistent_group(
    device_a,
    assert_api,
    page_num,
    page_size,
):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、群组、file、列表、from、服务端、不存在对象；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupFileListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、群组、file、列表、from、服务端、不存在对象；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupFileListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.getGroupFileListFromServer.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "pageNum": page_num, "pageSize": page_size},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")
