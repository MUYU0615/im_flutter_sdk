"""Group block/unblock API 异常/边界用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


@pytest.mark.real_e2e
@pytest.mark.case_id("group.block.nonexistent_group.error")
@pytest.mark.api("GroupManager.blockGroup")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_block_nonexistent_group(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、封禁、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、封禁、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("GroupManager", Cmd.blockGroup.value, info={"groupId": _NONEXISTENT_GROUP_ID})
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.case_id("group.unblock.nonexistent_group.error")
@pytest.mark.api("GroupManager.unblockGroup")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_unblock_nonexistent_group(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、unblock、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、unblock、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("GroupManager", Cmd.unblockGroup.value, info={"groupId": _NONEXISTENT_GROUP_ID})
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_block_idempotent(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、封禁、idempotent；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockGroup、GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、封禁、idempotent；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockGroup、GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("block_idem"),
            invite_members=[],
        )
        resp1 = device_a.call("GroupManager", Cmd.blockGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp1,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.blockGroup.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )
        resp2 = device_a.call("GroupManager", Cmd.blockGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp2,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.blockGroup.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            # 若仍 blocked，先解封再销毁，避免端侧状态影响销毁
            try:
                device_a.call("GroupManager", Cmd.unblockGroup.value, info={"groupId": group_id})
            except Exception:
                pass
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_unblock_idempotent(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、unblock、idempotent；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、unblock、idempotent；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("unblock_idem"),
            invite_members=[],
        )
        resp1 = device_a.call("GroupManager", Cmd.unblockGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp1,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.unblockGroup.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )
        resp2 = device_a.call("GroupManager", Cmd.unblockGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp2,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.unblockGroup.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)
