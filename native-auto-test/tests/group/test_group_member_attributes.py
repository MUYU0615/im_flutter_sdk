"""Group 成员属性 API 正常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd, GroupChangeEvent
from tests.group.group_helpers import (
    assert_group_events,
    collect_group_events,
    create_group,
    destroy_group,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("account_state_sync")
@pytest.mark.topology_ready
def test_group_set_and_fetch_member_attributes_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、set、and、拉取、成员、attributes、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.setMemberAttributesFromGroup、GroupManager.fetchMemberAttributesFromGroup、GroupManager.fetchMembersAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、set、and、拉取、成员、attributes、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.setMemberAttributesFromGroup、GroupManager.fetchMemberAttributesFromGroup、GroupManager.fetchMembersAttributesFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    remote_device = _expected_device(remote)
    group_id = ""
    attrs = {"k1": "v1", "level": "gold"}
    try:
        group_id, _ = create_group(
            primary,
            assert_api,
            owner=user_a,
            group_name=new_group_name("member_attr"),
            invite_members=[user_b],
        )

        resp_set = remote.call(
            "GroupManager",
            Cmd.setMemberAttributesFromGroup.value,
            info={"groupId": group_id, "attributes": attrs},
        )
        assert_api.assert_response_matches(
            resp_set,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.setMemberAttributesFromGroup.value,
                "device": remote_device,
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        attr_events = collect_group_events(
            primary,
            expected_event_types={
                GroupChangeEvent.ON_ATTRIBUTES_CHANGED_OF_MEMBER.value,
                "onGroupAttributesChangedOfMember",
                "onAttributesChangedOfGroupMember",
            },
            group_id=group_id,
            required_all_event_types={"onAttributesChangedOfGroupMember"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            attr_events,
            expected_event_types={
                GroupChangeEvent.ON_ATTRIBUTES_CHANGED_OF_MEMBER.value,
                "onGroupAttributesChangedOfMember",
                "onAttributesChangedOfGroupMember",
            },
            group_id=group_id,
            required_all_event_types={"onAttributesChangedOfGroupMember"},
            expected_member=user_b,
        )

        resp_fetch_single = remote.call(
            "GroupManager",
            Cmd.fetchMemberAttributesFromGroup.value,
            info={"groupId": group_id},
        )
        assert_api.assert_response_matches(
            resp_fetch_single,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.fetchMemberAttributesFromGroup.value,
                "device": remote_device,
            },
            ignore_keys={"sequence", "result"},
        )
        result_single = resp_fetch_single.get("result")
        assert isinstance(result_single, dict), f"fetchMemberAttributesFromGroup result 非 dict: {resp_fetch_single}"
        for k, v in attrs.items():
            assert result_single.get(k) == v, f"fetchMemberAttributesFromGroup 属性不匹配 key={k}: {resp_fetch_single}"

        resp_fetch_multi = primary.call(
            "GroupManager",
            Cmd.fetchMembersAttributesFromGroup.value,
            info={"groupId": group_id, "userIds": [user_b]},
        )
        assert_api.assert_response_matches(
            resp_fetch_multi,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.fetchMembersAttributesFromGroup.value,
                "device": primary_device,
            },
            ignore_keys={"sequence", "result"},
        )
        result_multi = resp_fetch_multi.get("result")
        assert isinstance(result_multi, dict), f"fetchMembersAttributesFromGroup result 非 dict: {resp_fetch_multi}"
        assert user_b in result_multi, f"fetchMembersAttributesFromGroup 未包含目标成员: {resp_fetch_multi}"
        user_attrs = result_multi.get(user_b)
        assert isinstance(user_attrs, dict), f"成员属性值非 dict: {resp_fetch_multi}"
        for k, v in attrs.items():
            assert user_attrs.get(k) == v, f"fetchMembersAttributesFromGroup 属性不匹配 key={k}: {resp_fetch_multi}"
    finally:
        if group_id:
            destroy_group(primary, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_update_and_get_namecard_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、更新、and、获取、namecard、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupNamecard、GroupManager.getGroupNamecard，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、更新、and、获取、namecard、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupNamecard、GroupManager.getGroupNamecard，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_id = ""
    namecard = f"card_{user_a}"
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("namecard"),
            invite_members=[],
        )

        resp_update = client.call(
            "GroupManager",
            Cmd.updateGroupNamecard.value,
            info={"groupId": group_id, "namecard": namecard},
        )
        assert_api.assert_response_matches(
            resp_update,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupNamecard.value,
                "device": expected_device,
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        resp_get = client.call(
            "GroupManager",
            Cmd.getGroupNamecard.value,
            info={"groupId": group_id, "userId": user_a},
        )
        assert_api.assert_response_matches(
            resp_get,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupNamecard.value,
                "device": expected_device,
                "result": namecard,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
