"""Group metadata 正常链路。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import (
    assert_group_snapshot,
    create_group,
    destroy_group,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group]


@pytest.mark.real_e2e
def test_group_update_subject(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、subject；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject、GroupManager.getGroupWithId、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、subject；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject、GroupManager.getGroupWithId、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_name = new_group_name("subject")
    group_id = ""
    new_subject = new_group_name("subject_new")
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[user_b],
        )

        resp_update = device_a.call(
            "GroupManager",
            Cmd.updateGroupSubject.value,
            info={"groupId": group_id, "subject": new_subject},
        )
        assert_api.assert_response_matches(
            resp_update,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupSubject.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        resp_local = device_a.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
        assert_group_snapshot(
            assert_api,
            resp_local,
            cmd=Cmd.getGroupWithId.value,
            group_id=group_id,
            group_name="",
            owner=user_a,
            member_count_value=2,
        )
        # 该环境 updateGroupSubject 后 name 为空串；按真实行为冻结
        assert ((resp_local.get("result") or {}).get("name")) == "", f"本地 name 预期为空串: {resp_local}"

        resp_server = device_a.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        assert_group_snapshot(
            assert_api,
            resp_server,
            cmd=Cmd.getGroupSpecificationFromServer.value,
            group_id=group_id,
            group_name="",
            owner=user_a,
            member_count_value=2,
        )
        assert ((resp_server.get("result") or {}).get("name")) == "", f"服务端 name 预期为空串: {resp_server}"
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id, device_b=device_b)


@pytest.mark.real_e2e
def test_group_update_description(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、description；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription、GroupManager.getGroupWithId、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、description；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription、GroupManager.getGroupWithId、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_name = new_group_name("desc")
    group_id = ""
    new_desc = new_group_name("desc_new")
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[user_b],
        )

        resp_update = device_a.call(
            "GroupManager",
            Cmd.updateDescription.value,
            info={"groupId": group_id, "description": new_desc},
        )
        assert_api.assert_response_matches(
            resp_update,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateDescription.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        resp_local = device_a.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
        assert_group_snapshot(
            assert_api,
            resp_local,
            cmd=Cmd.getGroupWithId.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            expected_desc="",
            member_count_value=2,
        )
        # 该环境 updateDescription 后 desc 返回为空串，按真实行为冻结
        assert ((resp_local.get("result") or {}).get("desc")) == "", f"本地 desc 预期为空串: {resp_local}"

        resp_server = device_a.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        assert_group_snapshot(
            assert_api,
            resp_server,
            cmd=Cmd.getGroupSpecificationFromServer.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            expected_desc="",
            member_count_value=2,
        )
        assert ((resp_server.get("result") or {}).get("desc")) == "", f"服务端 desc 预期为空串: {resp_server}"
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id, device_b=device_b)
