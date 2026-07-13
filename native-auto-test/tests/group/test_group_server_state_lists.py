"""Group 服务端状态列表 API 正常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _extract_string_list(result: object, *, api_name: str, resp: dict) -> list[str]:
    if result == {}:
        return []
    value = result
    if isinstance(result, dict):
        # 某些接口返回 {"cursor":"", "list":[...]}
        if "list" in result:
            value = result.get("list")
    assert isinstance(value, list), f"{api_name} result/list 不是 list: {resp}"

    out: list[str] = []
    for idx, item in enumerate(value):
        if isinstance(item, str):
            out.append(item)
            continue
        assert isinstance(item, dict), f"{api_name} list[{idx}] 不是 str/dict: {item!r}"
        member = None
        for key in ("member", "userId", "username", "owner"):
            v = item.get(key)
            if isinstance(v, str):
                member = v
                break
        assert member is not None, f"{api_name} list[{idx}] 无可识别成员字段: {item!r}"
        out.append(member)
    return out


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_group_block_list_from_server_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、封禁、列表、from、服务端、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupBlockListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、封禁、列表、from、服务端、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupBlockListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("block_list"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.getGroupBlockListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupBlockListFromServer.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        blocked_users = _extract_string_list(
            resp.get("result"),
            api_name=Cmd.getGroupBlockListFromServer.value,
            resp=resp,
        )
        assert blocked_users == [], f"新建群 blockList 预期为空: {resp}"
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_group_mute_list_from_server_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、禁言、列表、from、服务端、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMuteListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、禁言、列表、from、服务端、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMuteListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("mute_list"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.getGroupMuteListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupMuteListFromServer.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        muted_users = _extract_string_list(
            resp.get("result"),
            api_name=Cmd.getGroupMuteListFromServer.value,
            resp=resp,
        )
        assert muted_users == [], f"新建群 muteList 预期为空: {resp}"
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_group_white_list_and_member_check_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、白名单、列表、and、成员、check；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupWhiteListFromServer、GroupManager.isMemberInWhiteListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、白名单、列表、and、成员、check；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupWhiteListFromServer、GroupManager.isMemberInWhiteListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("white_list"),
            invite_members=[],
        )
        resp_white = client.call(
            "GroupManager",
            Cmd.getGroupWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        assert_api.assert_response_matches(
            resp_white,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupWhiteListFromServer.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        _extract_string_list(
            resp_white.get("result"),
            api_name=Cmd.getGroupWhiteListFromServer.value,
            resp=resp_white,
        )

        resp_check = client.call(
            "GroupManager",
            Cmd.isMemberInWhiteListFromServer.value,
            info={"groupId": group_id},
        )
        assert_api.assert_response_matches(
            resp_check,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.isMemberInWhiteListFromServer.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        result = resp_check.get("result")
        assert isinstance(result, bool), f"isMemberInWhiteListFromServer result 应为 bool: {resp_check}"
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
