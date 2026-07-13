"""Group announcement API 正常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import (
    create_group,
    destroy_group,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_update_and_get_announcement_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、更新、and、获取、announcement、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAnnouncement、GroupManager.getGroupAnnouncementFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、更新、and、获取、announcement、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAnnouncement、GroupManager.getGroupAnnouncementFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_id = ""
    announcement = new_group_name("announce")
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("announce_group"),
            invite_members=[],
        )

        resp_update = client.call(
            "GroupManager",
            Cmd.updateGroupAnnouncement.value,
            info={"groupId": group_id, "announcement": announcement},
        )
        assert_api.assert_response_matches(
            resp_update,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupAnnouncement.value,
                "device": expected_device,
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        resp_get = client.call(
            "GroupManager",
            Cmd.getGroupAnnouncementFromServer.value,
            info={"groupId": group_id},
        )
        assert_api.assert_response_matches(
            resp_get,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupAnnouncementFromServer.value,
                "device": expected_device,
                "result": announcement,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
