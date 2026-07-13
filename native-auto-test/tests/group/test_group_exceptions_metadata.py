"""Group metadata 异常用例（strict）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"
SUBJECT_TOO_LONG = "s" * 1025
DESC_TOO_LONG = "d" * 4097


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_update_subject_empty(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、subject、空值参数；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、subject、空值参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(client, assert_api, owner=user_a, group_name=new_group_name("ex_subject"), invite_members=[])
        resp = client.call("GroupManager", Cmd.updateGroupSubject.value, info={"groupId": group_id, "subject": ""})
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupSubject.value,
                "device": _expected_device(client),
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_update_subject_too_long(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、subject、too、long；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、subject、too、long；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(client, assert_api, owner=user_a, group_name=new_group_name("ex_subject_len"), invite_members=[])
        resp = client.call(
            "GroupManager",
            Cmd.updateGroupSubject.value,
            info={"groupId": group_id, "subject": SUBJECT_TOO_LONG},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateGroupSubject.value,
                "device": _expected_device(client),
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_update_description_empty(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、description、空值参数；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、description、空值参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(client, assert_api, owner=user_a, group_name=new_group_name("ex_desc"), invite_members=[])
        resp = client.call("GroupManager", Cmd.updateDescription.value, info={"groupId": group_id, "description": ""})
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateDescription.value,
                "device": _expected_device(client),
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("state_change")
@pytest.mark.topology_ready
def test_group_update_description_too_long(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、description、too、long；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、description、too、long；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    client = topology_primary_or_device_a
    try:
        group_id, _ = create_group(client, assert_api, owner=user_a, group_name=new_group_name("ex_desc_len"), invite_members=[])
        resp = client.call(
            "GroupManager",
            Cmd.updateDescription.value,
            info={"groupId": group_id, "description": DESC_TOO_LONG},
        )
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.updateDescription.value,
                "device": _expected_device(client),
                "result": None,
            },
            ignore_keys={"sequence"},
        )
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.update_subject.nonexistent_group.error")
@pytest.mark.api("GroupManager.updateGroupSubject")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_subject_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、subject、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、subject、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateGroupSubject，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.updateGroupSubject.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "subject": "new_subject"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("group.update_description.nonexistent_group.error")
@pytest.mark.api("GroupManager.updateDescription")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_group_update_description_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、description、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、更新、description、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.updateDescription，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.updateDescription.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "description": "new_desc"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")
