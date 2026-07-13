"""Group inviterUser 正常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd, GroupChangeEvent
from tests.group.group_helpers import (
    assert_group_events,
    assert_group_members_exact,
    collect_group_events,
    create_group,
    destroy_group,
    member_count,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group]


@pytest.mark.real_e2e
def test_group_inviter_user_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、inviter、用户、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、inviter、用户、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.inviterUser、GroupManager.getGroupSpecificationFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("inviter"),
            invite_members=[],
        )

        resp_invite = device_a.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={"groupId": group_id, "members": [user_b], "reason": "auto-inviter"},
        )
        assert_api.assert_response_matches(
            resp_invite,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.inviterUser.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        invite_events = collect_group_events(
            device_b,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_RECEIVED.value,
                GroupChangeEvent.ON_AUTO_ACCEPT_INVITATION.value,
                "onAutoAcceptInvitationFromGroup",
                "onAllowListRemovedFromGroup",
                "onMemberJoinedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onAutoAcceptInvitationFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            invite_events,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_RECEIVED.value,
                GroupChangeEvent.ON_AUTO_ACCEPT_INVITATION.value,
                "onAutoAcceptInvitationFromGroup",
                "onAllowListRemovedFromGroup",
                "onMemberJoinedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onAutoAcceptInvitationFromGroup"},
            expected_inviter=user_a,
            expected_member=user_b,
        )

        resp_group = device_a.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        result = resp_group.get("result")
        assert isinstance(result, dict), f"getGroupSpecificationFromServer result 非 dict: {resp_group}"
        assert member_count(resp_group) == 2, f"inviterUser 后 memberCount 应为 2: {resp_group}"
        assert_group_members_exact(resp_group, [user_b], err_prefix="inviterUser 后")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)
