"""Group announcement API 异常/边界用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


@pytest.mark.real_e2e
@pytest.mark.case_id("group.update_announcement.nonexistent_group.error")
@pytest.mark.api("GroupManager.updateGroupAnnouncement")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_announcement_nonexistent_group(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、announcement、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAnnouncement，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、announcement、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAnnouncement，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.updateGroupAnnouncement.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "announcement": "a1"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.case_id("group.get_announcement.nonexistent_group.error")
@pytest.mark.api("GroupManager.getGroupAnnouncementFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_get_announcement_nonexistent_group(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、announcement、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupAnnouncementFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、获取、announcement、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupAnnouncementFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.getGroupAnnouncementFromServer.value,
        info={"groupId": _NONEXISTENT_GROUP_ID},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_update_announcement_empty(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、announcement、空值参数；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAnnouncement、GroupManager.getGroupAnnouncementFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、announcement、空值参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupAnnouncement、GroupManager.getGroupAnnouncementFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("announce_empty"),
            invite_members=[],
        )
        resp_update = device_a.call(
            "GroupManager",
            Cmd.updateGroupAnnouncement.value,
            info={"groupId": group_id, "announcement": ""},
        )
        assert_api.assert_response_matches(
            resp_update,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupAnnouncement.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        resp_get = device_a.call(
            "GroupManager",
            Cmd.getGroupAnnouncementFromServer.value,
            info={"groupId": group_id},
        )
        assert_api.assert_response_matches(
            resp_get,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupAnnouncementFromServer.value,
                "device": "deviceA",
                "result": "",
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)
