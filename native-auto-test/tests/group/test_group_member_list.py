"""Group member list API 正常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group, pytest.mark.agorachat1_4_0]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _extract_member_ids(result: object, *, resp: dict) -> set[str]:
    members = result
    if isinstance(result, dict):
        assert "list" in result, f"getGroupMemberListFromServer result(dict) 缺少 list: {resp}"
        members = result.get("list")
    assert isinstance(members, list), f"getGroupMemberListFromServer result/list 不是 list: {resp}"

    user_ids: set[str] = set()
    for idx, item in enumerate(members):
        if isinstance(item, str):
            assert item, f"memberList[{idx}] 为空字符串: {resp}"
            user_ids.add(item)
            continue
        assert isinstance(item, dict), f"memberList[{idx}] 不是 str/dict: {item!r}"
        candidate = None
        for k in ("member", "userId", "username", "owner", "userName"):
            v = item.get(k)
            if isinstance(v, str) and v:
                candidate = v
                break
        assert candidate is not None, f"memberList[{idx}] 无可识别成员字段: {item!r}"
        user_ids.add(candidate)
    return user_ids


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_group_get_group_member_list_from_server_success(topology_primary_or_device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、成员、列表、from、服务端、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMemberListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、获取、群组、成员、列表、from、服务端、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.getGroupMemberListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("member_list"),
            invite_members=[user_b],
        )
        resp = client.call(
            "GroupManager",
            Cmd.getGroupMemberListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.getGroupMemberListFromServer.value,
                "device": _expected_device(client),
            },
            ignore_keys={"sequence", "result"},
        )
        user_ids = _extract_member_ids(resp.get("result"), resp=resp)
        assert user_b in user_ids, f"成员列表未包含受邀成员: member={user_b}, resp={resp}"
        # 当前端语义：该接口返回成员列表（不包含群主）
        assert user_a not in user_ids, f"成员列表不应包含群主: owner={user_a}, resp={resp}"
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
