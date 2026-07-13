"""Group block/unblock API 正常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _assert_group_blocked_flag(device_a, assert_api, group_id: str, blocked: bool):
    expected_device = _expected_device(device_a)
    resp = device_a.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.getGroupWithId.value,
            "device": expected_device,
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    assert isinstance(result, dict), f"getGroupWithId result 非 dict: {resp}"
    assert "messageBlocked" in result, f"getGroupWithId result 缺少 messageBlocked: {resp}"
    assert result.get("messageBlocked") is blocked, (
        f"messageBlocked 状态不符合预期: expected={blocked}, actual={result.get('messageBlocked')}, resp={resp}"
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_block_then_unblock_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、封禁、then、unblock、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockGroup、GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组状态变更场景所需的测试数据，场景为群组、封禁、then、unblock、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.blockGroup、GroupManager.unblockGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("block"),
            invite_members=[],
        )

        resp_block = client.call("GroupManager", Cmd.blockGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp_block,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.blockGroup.value,
                "device": expected_device,
                "result": None,
            },
            ignore_keys={"sequence"},
        )
        _assert_group_blocked_flag(client, assert_api, group_id, True)

        resp_unblock = client.call("GroupManager", Cmd.unblockGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp_unblock,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.unblockGroup.value,
                "device": expected_device,
                "result": None,
            },
            ignore_keys={"sequence"},
        )
        _assert_group_blocked_flag(client, assert_api, group_id, False)
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
