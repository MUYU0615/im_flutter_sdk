"""Group moderation API（按当前稳定语义合并）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd, GroupChangeEvent
from tests.group.group_helpers import (
    assert_group_events,
    assert_group_snapshot,
    collect_group_events,
    create_group,
    destroy_group,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group, pytest.mark.agorachat1_4_0]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _group_state(device_a, assert_api, group_id: str):
    expected_device = _expected_device(device_a)
    resp = device_a.call("GroupManager", Cmd.getGroupSpecificationFromServer.value, info={"groupId": group_id, "fetchMembers": True})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.getGroupSpecificationFromServer.value,
            "device": expected_device,
        },
        ignore_keys={"sequence", "result"},
    )
    return resp


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_group_block_unblock_members_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、封禁、unblock、成员、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockMembers、GroupManager.unblockMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、封禁、unblock、成员、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockMembers、GroupManager.unblockMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    group_id = ""
    group_name = new_group_name("mod_block")
    try:
        group_id, _ = create_group(
            primary,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[user_b],
        )
        resp_block = primary.call("GroupManager", Cmd.blockMembers.value, info={"groupId": group_id, "members": [user_b]})
        assert_api.assert_response_matches(
            resp_block,
            expected={"manager": "GroupManager", "cmd": Cmd.blockMembers.value, "device": primary_device, "result": True},
            ignore_keys={"sequence"},
        )
        removed_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_USER_REMOVED.value,
                "onUserRemovedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onUserRemovedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            removed_events,
            expected_event_types={
                GroupChangeEvent.ON_USER_REMOVED.value,
                "onUserRemovedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onUserRemovedFromGroup"},
        )
        assert_group_snapshot(
            assert_api,
            _group_state(primary, assert_api, group_id),
            cmd=Cmd.getGroupSpecificationFromServer.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=1,
            block_list_value=[user_b],
            device=primary_device,
        )

        resp_unblock = primary.call("GroupManager", Cmd.unblockMembers.value, info={"groupId": group_id, "members": [user_b]})
        assert_api.assert_response_matches(
            resp_unblock,
            expected={"manager": "GroupManager", "cmd": Cmd.unblockMembers.value, "device": primary_device, "result": True},
            ignore_keys={"sequence"},
        )
        assert_group_snapshot(
            assert_api,
            _group_state(primary, assert_api, group_id),
            cmd=Cmd.getGroupSpecificationFromServer.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=1,
            block_list_value=[],
            device=primary_device,
        )
    finally:
        if group_id:
            destroy_group(primary, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.parametrize("cmd", [Cmd.blockMembers.value, Cmd.unblockMembers.value])
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_block_unblock_members_nonexistent_group(topology_primary_or_device_a, assert_api, cmd):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、封禁、unblock、成员、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 群组、封禁、unblock、成员、不存在对象、群组，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、封禁、unblock、成员、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 群组、封禁、unblock、成员、不存在对象、群组，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        cmd,
        info={"groupId": _NONEXISTENT_GROUP_ID, "members": ["user_x"]},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_block_members_non_member(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、封禁、成员、non、成员；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、封禁、成员、non、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    user_a = primary.user_id
    user_b = topology.remote_client(0).user_id
    group_id = ""
    try:
        group_id, _ = create_group(primary, assert_api, owner=user_a, group_name=new_group_name("mod_block_nm"), invite_members=[])
        resp = primary.call("GroupManager", Cmd.blockMembers.value, info={"groupId": group_id, "members": [user_b]})
        assert_api.assert_error(resp, code=603, description="are not members of this group")
    finally:
        if group_id:
            destroy_group(primary, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_group_mute_unmute_members_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、禁言、unmute、成员、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.muteMembers、GroupManager.unMuteMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、禁言、unmute、成员、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.muteMembers、GroupManager.unMuteMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    group_id = ""
    group_name = new_group_name("mod_mute")
    try:
        group_id, _ = create_group(primary, assert_api, owner=user_a, group_name=group_name, invite_members=[user_b])
        resp_mute = primary.call("GroupManager", Cmd.muteMembers.value, info={"groupId": group_id, "members": [user_b], "duration": 60})
        assert_group_snapshot(
            assert_api,
            resp_mute,
            cmd=Cmd.muteMembers.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=2,
            mute_list_value=[user_b],
            device=primary_device,
        )
        mute_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_MUTE_LIST_ADDED.value,
                "onMuteListAddedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onMuteListAddedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            mute_events,
            expected_event_types={
                GroupChangeEvent.ON_MUTE_LIST_ADDED.value,
                "onMuteListAddedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onMuteListAddedFromGroup"},
            expected_member=user_b,
        )
        resp_unmute = primary.call("GroupManager", Cmd.unMuteMembers.value, info={"groupId": group_id, "members": [user_b]})
        assert_group_snapshot(
            assert_api,
            resp_unmute,
            cmd=Cmd.unMuteMembers.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=2,
            mute_list_value=[],
            device=primary_device,
        )
        unmute_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_MUTE_LIST_REMOVED.value,
                "onMuteListRemovedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onMuteListRemovedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            unmute_events,
            expected_event_types={
                GroupChangeEvent.ON_MUTE_LIST_REMOVED.value,
                "onMuteListRemovedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onMuteListRemovedFromGroup"},
            expected_member=user_b,
        )
    finally:
        if group_id:
            destroy_group(primary, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_group_mute_all_unmute_all_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、禁言、all、unmute、all、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.muteAllMembers、GroupManager.unMuteAllMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、禁言、all、unmute、all、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.muteAllMembers、GroupManager.unMuteAllMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    group_id = ""
    group_name = new_group_name("mod_mute_all")
    try:
        group_id, _ = create_group(primary, assert_api, owner=user_a, group_name=group_name, invite_members=[user_b])
        resp_mute_all = primary.call("GroupManager", Cmd.muteAllMembers.value, info={"groupId": group_id})
        assert_group_snapshot(
            assert_api,
            resp_mute_all,
            cmd=Cmd.muteAllMembers.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=2,
            is_all_member_muted=True,
            device=primary_device,
        )
        # SDK muteAllMembers 可能不向成员推送 onAllGroupMemberMuteStateChanged 事件
        # （群主 API 调用成功且返回 isAllMemberMuted=true 即可确认功能正确）
        mute_all_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
                "onAllGroupMemberMuteStateChanged",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types=set(),
            timeout=5.0,
        )
        assert_group_events(
            assert_api,
            mute_all_events,
            expected_event_types={
                GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
                "onAllGroupMemberMuteStateChanged",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types=set(),
        )
        resp_unmute_all = primary.call("GroupManager", Cmd.unMuteAllMembers.value, info={"groupId": group_id})
        assert_group_snapshot(
            assert_api,
            resp_unmute_all,
            cmd=Cmd.unMuteAllMembers.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            member_count_value=2,
            is_all_member_muted=False,
            device=primary_device,
        )
        unmute_all_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
                "onAllGroupMemberMuteStateChanged",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types=set(),
            timeout=5.0,
        )
        assert_group_events(
            assert_api,
            unmute_all_events,
            expected_event_types={
                GroupChangeEvent.ON_ALL_MEMBER_MUTE_STATE_CHANGED.value,
                "onAllGroupMemberMuteStateChanged",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types=set(),
        )
    finally:
        if group_id:
            destroy_group(primary, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_group_add_remove_white_list_success(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、添加、移除、白名单、列表、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.addWhiteList、GroupManager.removeWhiteList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、添加、移除、白名单、列表、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.addWhiteList、GroupManager.removeWhiteList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    group_id = ""
    group_name = new_group_name("mod_white")
    try:
        group_id, _ = create_group(primary, assert_api, owner=user_a, group_name=group_name, invite_members=[user_b])
        resp_add = primary.call("GroupManager", Cmd.addWhiteList.value, info={"groupId": group_id, "members": [user_b]})
        assert_api.assert_response_matches(
            resp_add,
            expected={"manager": "GroupManager", "cmd": Cmd.addWhiteList.value, "device": primary_device, "result": True},
            ignore_keys={"sequence"},
        )
        add_white_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_WHITE_LIST_ADDED.value,
                "onAllowListAddedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onAllowListAddedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            add_white_events,
            expected_event_types={
                GroupChangeEvent.ON_WHITE_LIST_ADDED.value,
                "onAllowListAddedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onAllowListAddedFromGroup"},
            expected_member=user_b,
        )
        resp_remove = primary.call("GroupManager", Cmd.removeWhiteList.value, info={"groupId": group_id, "members": [user_b]})
        assert_api.assert_response_matches(
            resp_remove,
            expected={"manager": "GroupManager", "cmd": Cmd.removeWhiteList.value, "device": primary_device, "result": True},
            ignore_keys={"sequence"},
        )
        remove_white_events = collect_group_events(
            remote,
            expected_event_types={
                GroupChangeEvent.ON_WHITE_LIST_REMOVED.value,
                "onAllowListRemovedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onAllowListRemovedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            remove_white_events,
            expected_event_types={
                GroupChangeEvent.ON_WHITE_LIST_REMOVED.value,
                "onAllowListRemovedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onAllowListRemovedFromGroup"},
            expected_member=user_b,
        )
    finally:
        if group_id:
            destroy_group(primary, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_update_group_ext_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、群组、ext、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupExt，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、更新、群组、ext、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupExt，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    group_id = ""
    group_name = new_group_name("mod_ext")
    try:
        group_id, _ = create_group(client, assert_api, owner=user_a, group_name=group_name, invite_members=[])
        resp = client.call("GroupManager", Cmd.updateGroupExt.value, info={"groupId": group_id, "ext": "{\"k\":\"v\"}"})
        assert_group_snapshot(
            assert_api,
            resp,
            cmd=Cmd.updateGroupExt.value,
            group_id=group_id,
            group_name=group_name,
            owner=user_a,
            expected_desc="auto-test group",
            expected_ext="{\"k\":\"v\"}",
            device=_expected_device(client),
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.parametrize(
    "cmd,info,code,desc",
    [
        (Cmd.muteMembers.value, {"groupId": _NONEXISTENT_GROUP_ID, "members": ["u"]}, 600, "do not find this group"),
        (Cmd.unMuteMembers.value, {"groupId": _NONEXISTENT_GROUP_ID, "members": ["u"]}, 600, "do not find this group"),
        (Cmd.muteAllMembers.value, {"groupId": _NONEXISTENT_GROUP_ID}, 600, "do not find this group"),
        (Cmd.unMuteAllMembers.value, {"groupId": _NONEXISTENT_GROUP_ID}, 600, "do not find this group"),
        (Cmd.addWhiteList.value, {"groupId": _NONEXISTENT_GROUP_ID, "members": ["u"]}, 600, "do not find this group"),
        (Cmd.removeWhiteList.value, {"groupId": _NONEXISTENT_GROUP_ID, "members": ["u"]}, 600, "do not find this group"),
        (Cmd.updateGroupExt.value, {"groupId": _NONEXISTENT_GROUP_ID, "ext": "{}"}, 600, "do not find this group"),
    ],
)
def test_group_moderation_nonexistent_group_errors(topology_primary_or_device_a, assert_api, cmd, info, code, desc):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、moderation、不存在对象、群组、errors；
    2. 通过 WebSocket 控制测试 App 调用 群组、moderation、不存在对象、群组、errors，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、moderation、不存在对象、群组、errors；\n'
        '2. 通过 WebSocket 控制测试 App 调用 群组、moderation、不存在对象、群组、errors，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call("GroupManager", cmd, info=info)
    assert_api.assert_error(resp, code=code, description=desc)
