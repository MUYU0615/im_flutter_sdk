"""
Contact 剩余 API 覆盖用例。

本文件只补充方法级覆盖缺口：getAllContactsFromDB、getBlockListFromDB、
getSelfIdsOnOtherPlatform、saveBlackList。每个 case 都先通过真实 SDK 调用准备状态，再对
目标 cmd 的响应信封和业务字段做断言。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import sys

import pytest

from src import Cmd
from src.rest_api.user_api import get_user_access_token
from src.test_flow import ContactTestFlow


pytestmark = [pytest.mark.client, pytest.mark.contact]


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.get_all_contacts_from_db.after_server_sync.success")
@pytest.mark.api("ContactManager.getAllContactsFromDB")
@pytest.mark.clients("owner", "peer")
@pytest.mark.roles_mode("ordered")
def test_contact_get_all_contacts_from_db_after_server_sync(
    device_a, device_b, assert_api, user_a, user_b
):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、all、contacts、from、db、after、服务端；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.getAllContactsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、all、contacts、from、db、after、服务端；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.getAllContactsFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(device_a, device_b, user_a, user_b, reason="local_contacts_db")

    sync_resp = device_a.call(
        "ContactManager",
        Cmd.getAllContactsFromServer.value,
        info={},
    )
    assert_api.assert_response_matches(
        sync_resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContactsFromServer.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    synced_contacts = sync_resp.get("result") or []
    assert user_b in synced_contacts, f"服务端好友列表未包含目标好友: {synced_contacts}"

    local_resp = device_a.call(
        "ContactManager",
        Cmd.getAllContactsFromDB.value,
        info={},
    )
    assert_api.assert_response_matches(
        local_resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContactsFromDB.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    local_contacts = local_resp.get("result") or []
    assert user_b in local_contacts, f"本地好友列表未包含目标好友: {local_contacts}"

    flow.delete_friend(device_a, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.get_block_list_from_db.after_server_sync.success")
@pytest.mark.api("ContactManager.getBlockListFromDB")
@pytest.mark.clients("owner", "peer")
@pytest.mark.roles_mode("ordered")
def test_contact_get_block_list_from_db_after_server_sync(
    device_a, device_b, assert_api, user_a, user_b
):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、封禁、列表、from、db、after、服务端；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.getBlockListFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、封禁、列表、from、db、after、服务端；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.getBlockListFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(device_a, device_b, user_a, user_b, reason="local_block_db")
    flow.add_to_block_list(device_a, user_b)

    server_resp = device_a.call(
        "ContactManager",
        Cmd.getBlockListFromServer.value,
        info={},
    )
    assert_api.assert_response_matches(
        server_resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getBlockListFromServer.value,
            "device": "deviceA",
            "result": [user_b],
        },
        ignore_keys={"sequence"},
    )

    local_resp = device_a.call(
        "ContactManager",
        Cmd.getBlockListFromDB.value,
        info={},
    )
    assert_api.assert_response_matches(
        local_resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getBlockListFromDB.value,
            "device": "deviceA",
            "result": [user_b],
        },
        ignore_keys={"sequence"},
    )

    assert_api.assert_success(flow.remove_from_block_list(device_a, user_b))
    flow.delete_friend(device_a, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.save_black_list.server.success")
@pytest.mark.api("ContactManager.saveBlackList")
@pytest.mark.skipif(
    "config.getoption('--target-platform') not in {'android', 'web'}",
    reason="ContactManager.saveBlackList 当前仅在 Android/Web wrapper 暴露",
)
def test_contact_save_black_list_then_fetch_from_server(
    primary_device, secondary_device, assert_api, user_a, user_b
):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、save、black、列表、then、拉取、from、服务端；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.saveBlackList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、save、black、列表、then、拉取、from、服务端；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.saveBlackList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    flow = ContactTestFlow(assert_api)
    friend_established = False
    try:
        primary_device.drain_events(timeout=0.5)
        secondary_device.drain_events(timeout=0.5)

        add_resp = primary_device.call(
            "ContactManager",
            Cmd.addContact.value,
            info={"userId": user_b, "reason": "save_black_list"},
        )
        assert_api.assert_response_matches(
            add_resp,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.addContact.value,
                "result": user_b,
            },
            ignore_keys={"sequence", "device"},
        )

        accept_resp = secondary_device.call(
            "ContactManager",
            Cmd.acceptInvitation.value,
            info={"userId": user_a},
        )
        assert_api.assert_response_matches(
            accept_resp,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.acceptInvitation.value,
            },
            ignore_keys={"sequence", "device", "result"},
        )
        assert accept_resp.get("result") in (True, user_a), f"acceptInvitation 返回不符合预期: {accept_resp}"
        friend_established = True

        save_resp = primary_device.call(
            "ContactManager",
            Cmd.saveBlackList.value,
            info={"userIds": [user_b]},
        )
        assert_api.assert_response_matches(
            save_resp,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.saveBlackList.value,
                "result": True,
            },
            ignore_keys={"sequence", "device"},
        )

        server_resp = primary_device.call(
            "ContactManager",
            Cmd.getBlockListFromServer.value,
            info={},
        )
        assert_api.assert_response_matches(
            server_resp,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.getBlockListFromServer.value,
            },
            ignore_keys={"sequence", "device", "result"},
        )
        block_list = server_resp.get("result") or []
        assert user_b in block_list, f"服务端黑名单未包含目标用户: {block_list}"
    finally:
        original_exc_type = sys.exc_info()[0]
        cleanup_errors = []
        if friend_established:
            try:
                assert_api.assert_success(flow.remove_from_block_list(primary_device, user_b))
            except Exception as exc:
                cleanup_errors.append(exc)
            try:
                flow.delete_friend(primary_device, user_b, wait_event=False)
            except Exception as exc:
                cleanup_errors.append(exc)
        if cleanup_errors and original_exc_type is None:
            raise cleanup_errors[0]


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.get_self_ids_on_other_platform.single_device.empty")
@pytest.mark.api("ContactManager.getSelfIdsOnOtherPlatform")
@pytest.mark.clients("owner")
@pytest.mark.roles_mode("ordered")
def test_contact_get_self_ids_on_other_platform_returns_list(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、self、ids、on、other、platform、returns；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.getSelfIdsOnOtherPlatform，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、self、ids、on、other、platform、returns；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.getSelfIdsOnOtherPlatform，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    resp = device_a.call(
        "ContactManager",
        Cmd.getSelfIdsOnOtherPlatform.value,
        info={},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getSelfIdsOnOtherPlatform.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp.get("result"), list), f"result 应为 list: {resp}"
