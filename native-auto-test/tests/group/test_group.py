"""Group 历史复现用例（保留）。

说明：
- 主体正常/异常用例已拆分到：
  - test_group_lifecycle.py
  - test_group_members.py
  - test_group_metadata.py
  - test_group_exceptions_*.py
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import (
    assert_group_members_exact,
    assert_group_snapshot,
    create_group,
    destroy_group,
    member_count,
    new_group_name,
)


pytestmark = [
    pytest.mark.client,
    pytest.mark.group,
    pytest.mark.skip(reason="legacy reproduction-only group cases; canonical Android E2E lives in split group_* suites"),
]


@pytest.mark.real_e2e
def test_group_member_count_local_then_server_sync(device_a, device_b, assert_api, user_a, user_b, user_c):
    """
    1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、成员、count、本地、then、服务端、sync；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers、GroupManager.getGroupWithId、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、成员、count、本地、then、服务端、sync；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addMembers、GroupManager.getGroupWithId、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    group_name = new_group_name("count_sync")
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[user_b],
        )

        resp_add = device_a.call(
            "GroupManager",
            Cmd.addMembers.value,
            info={"groupId": group_id, "members": [user_c], "welcome": "count-sync-case"},
        )
        assert_api.assert_response_matches(
            resp_add,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.addMembers.value,
                "device": "deviceA",
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        resp_local_before = device_a.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
        assert_group_snapshot(
            assert_api,
            resp_local_before,
            cmd=Cmd.getGroupWithId.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=None,
        )
        local_before_count = member_count(resp_local_before)

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
            member_count_value=3,
        )
        assert member_count(resp_server) == 3, f"服务端成员数量预期 3: {resp_server}"
        assert_group_members_exact(resp_server, [user_b, user_c], err_prefix="服务端拉取后")
        server_count = member_count(resp_server)

        resp_local_after = device_a.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
        assert_group_snapshot(
            assert_api,
            resp_local_after,
            cmd=Cmd.getGroupWithId.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=3,
        )
        local_after_count = member_count(resp_local_after)
        assert local_after_count == 3, f"服务端拉取后本地成员数量预期 3: {resp_local_after}"

        assert local_after_count == server_count, (
            "从服务端拉取后，本地人数未与服务端对齐: "
            f"local_after={local_after_count}, server={server_count}"
        )

        if local_before_count == server_count:
            pytest.skip(
                f"本次未复现“本地人数不正确”问题: local_before={local_before_count}, server={server_count}"
            )

        assert local_before_count != server_count, (
            f"预期复现本地与服务端人数不一致，但未复现: local_before={local_before_count}, server={server_count}"
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id, device_b=device_b)
