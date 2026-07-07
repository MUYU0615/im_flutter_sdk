"""
Contact 剩余 API 覆盖用例。

本文件只补充方法级覆盖缺口：getAllContactsFromDB、getBlockListFromDB、
getSelfIdsOnOtherPlatform、saveBlackList。每个 case 都先通过真实 SDK 调用准备状态，再对
目标 cmd 的响应信封和业务字段做断言。
"""
from __future__ import annotations

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
    """getAllContactsFromDB/getAllContactIds：同步服务端好友后，从本地 DB 获取好友 ID 列表；Dart getAllContactIds 复用同一 native cmd。"""
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
            "result": [user_b],
        },
        ignore_keys={"sequence"},
    )

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
            "result": [user_b],
        },
        ignore_keys={"sequence"},
    )

    flow.delete_friend(device_a, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.get_block_list_from_db.after_server_sync.success")
@pytest.mark.api("ContactManager.getBlockListFromDB")
@pytest.mark.clients("owner", "peer")
@pytest.mark.roles_mode("ordered")
def test_contact_get_block_list_from_db_after_server_sync(
    device_a, device_b, assert_api, user_a, user_b
):
    """getBlockListFromDB：拉黑并同步服务端黑名单后，从本地 DB 获取黑名单 ID 列表。"""
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
@pytest.mark.no_global_login
@pytest.mark.case_id("contact.save_black_list.server.success")
@pytest.mark.api("ContactManager.saveBlackList")
@pytest.mark.skipif(
    "config.getoption('--target-platform') not in {'android', 'web'}",
    reason="ContactManager.saveBlackList 当前仅在 Android/Web wrapper 暴露",
)
def test_contact_save_black_list_then_fetch_from_server(
    primary_device, secondary_device, assert_api, user_a, user_b
):
    """saveBlackList：批量保存黑名单列表后，从服务端查询黑名单包含目标用户。"""
    flow = ContactTestFlow(assert_api)
    friend_established = False
    try:
        token_a = get_user_access_token(user_a, "1")
        token_b = get_user_access_token(user_b, "1")
        for device in (primary_device, secondary_device):
            logout = device.call(
                "Client",
                Cmd.logout.value,
                info={"unbindToken": False},
            )
            assert_api.assert_response_matches(
                logout,
                expected={
                    "manager": "Client",
                    "cmd": Cmd.logout.value,
                    "result": True,
                },
                ignore_keys={"sequence", "device"},
            )

        login_a = primary_device.call(
            "Client",
            Cmd.loginWithAgoraToken.value,
            info={"userId": user_a, "agoraToken": token_a},
        )
        assert_api.assert_response_matches(
            login_a,
            expected={
                "manager": "Client",
                "cmd": Cmd.loginWithAgoraToken.value,
                "device": "webA",
                "result": user_a,
            },
            ignore_keys={"sequence"},
        )
        login_b = secondary_device.call(
            "Client",
            Cmd.loginWithAgoraToken.value,
            info={"userId": user_b, "agoraToken": token_b},
        )
        assert_api.assert_response_matches(
            login_b,
            expected={
                "manager": "Client",
                "cmd": Cmd.loginWithAgoraToken.value,
                "device": "webB",
                "result": user_b,
            },
            ignore_keys={"sequence"},
        )

        for device in (primary_device, secondary_device):
            reset = device.call("Client", "webReset", info={})
            assert_api.assert_response_matches(
                reset,
                expected={
                    "manager": "Client",
                    "cmd": "webReset",
                    "result": True,
                },
                ignore_keys={"sequence", "device"},
            )

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
                "device": "webA",
                "result": user_b,
            },
            ignore_keys={"sequence"},
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
                "device": "webB",
                "result": True,
            },
            ignore_keys={"sequence"},
        )
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
                "device": "webA",
                "result": True,
            },
            ignore_keys={"sequence"},
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
                "device": "webA",
                "result": [user_b],
            },
            ignore_keys={"sequence"},
        )
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
    """getSelfIdsOnOtherPlatform：获取当前账号其它平台登录 ID，当前单设备登录应返回空列表。"""
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
            "result": [],
        },
        ignore_keys={"sequence"},
    )
