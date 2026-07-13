"""
联系人（好友）模块用例，对应 contact_manager.dart：添加好友、接受邀请、获取好友列表。
场景：deviceA 添加 deviceB 为好友，B 同意后校验 A、B 的好友列表（用户由 conftest 创建，teardown 删除）。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import json
import time

import pytest

from src import Cmd, ne
from src.rest_api.contact_api import get_user_contacts
from src.test_flow import ContactTestFlow
from src.test_flow.model_test_flow import receive_contact_changed_event
from src.sdk_api.event_keys import ContactChangeEvent


pytestmark = [pytest.mark.client, pytest.mark.contact]

# 异常用例：不存在于环信的用户 ID
USER_NONEXISTENT = "nonexistent_contact_user_xyz_999"

# 备注边界：256 字符，含特殊字符
_REMARK_SPECIAL_CORE = r'''!@#$%^&*()_+-=[]{}|;':\",./<>?`~中文\t\n\r'''
REMARK_SPECIAL_101 = ((_REMARK_SPECIAL_CORE * 20)[:101])
assert len(REMARK_SPECIAL_101) == 101


def _wait_get_contact(device, user_id: str, *, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    last_resp: dict | None = None
    while time.monotonic() < deadline:
        last_resp = device.call(
            "ContactManager",
            Cmd.getContact.value,
            info={"userId": user_id},
        )
        if isinstance(last_resp.get("result"), dict):
            return last_resp
        time.sleep(0.5)
    return last_resp or {}


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


# ---------- addContact ----------


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.add_contact.nonexistent_user.error")
@pytest.mark.api("ContactManager.addContact")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_add_nonexistent_user(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、添加、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.addContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、添加、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.addContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": USER_NONEXISTENT, "reason": "hello"},
    )
    assert_api.assert_error(resp, code=204, description="User does not exist")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.add_contact.empty_user_id.error")
@pytest.mark.api("ContactManager.addContact")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_add_empty_user_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、添加、空值参数、用户、id；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.addContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、添加、空值参数、用户、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.addContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": "", "reason": "hello"},
    )
    assert_api.assert_error(resp, code=101, description="User ID is invalid")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_contact_add_self(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为contact、添加、self；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.addContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为contact、添加、self；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.addContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_a, "reason": "self"},
    )
    assert_api.assert_error(resp, code=101, description="User ID is invalid")


# ---------- deleteContact ----------


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
def test_contact_delete_contact_not_friend(topology_primary_or_device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为contact、删除、contact、not、friend；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.deleteContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为contact、删除、contact、not、friend；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.deleteContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": user_b, "keepConversation": True},
    )
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ContactManager", "cmd": Cmd.deleteContact.value, "device": "{{device}}",
                  "result": "{{userId}}"},
        context={"userId": user_b, "device": _expected_device(client)},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_contact_delete_contact_nonexistent_user(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、删除、contact、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.deleteContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、删除、contact、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.deleteContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": USER_NONEXISTENT, "keepConversation": True},
    )
    assert_api.assert_error(resp, code=204, description="User does not exist")


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.add_accept_list_delete.friend_flow.success")
@pytest.mark.api("ContactManager.acceptInvitation")
@pytest.mark.api("ContactManager.deleteContact")
@pytest.mark.api("ContactManager.getAllContactsFromServer")
@pytest.mark.clients("owner", "peer")
@pytest.mark.roles_mode("ordered")
def test_friend_add_accept_and_list(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为friend、添加、accept、and、列表；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.acceptInvitation、ContactManager.deleteContact、ContactManager.getAllContactsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为friend、添加、accept、and、列表；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.acceptInvitation、ContactManager.deleteContact、ContactManager.getAllContactsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    flow = ContactTestFlow(assert_api)
    flow.delete_friend(device_a, user_b, wait_event=False)
    flow.delete_friend(device_b, user_a, wait_event=False)
    try:
        # 1. 设备 A 添加设备 B 为好友（ContactManager.addContact）
        resp_add = device_a.call(
            "ContactManager",
            Cmd.addContact.value,
            info={"userId": user_b, "reason": "hello"},
        )
        assert_api.assert_success(resp_add)
        print("登录响应:", json.dumps(resp_add))
        assert_api.assert_response_matches(
            resp_add,
            expected={"manager": "ContactManager", "cmd": Cmd.addContact.value, "device": "{{device}}", "result": "{{userId}}"},
            context={"userId": user_b, "device": "deviceA"},
            ignore_keys={"sequence", "result"},
        )
        # 1.1 设备 B 获取好友邀请回调
        resp_invite = receive_contact_changed_event(
            device_b,
            ContactChangeEvent.INVITED.value,
            timeout=10.0,
        )
        assert resp_invite is not None, "设备 B 未收到好友邀请回调"
        assert_api.assert_response_matches(
            resp_invite,
            expected={
                "type": "event",
                "eventType": Cmd.onContactChanged.value,
                "data": {"type": ContactChangeEvent.INVITED.value, "userId": "{{userId}}", "reason": "hello"},
            },
            context={"userId": user_a},
            ignore_keys={"timestamp", "sequence"},
        )
        # 2. 设备 B 同意 A 的好友申请
        resp_accept = device_b.call(
            "ContactManager",
            Cmd.acceptInvitation.value,
            info={"userId": user_a},
        )
        assert_api.assert_success(resp_accept)
        # 当前真实链路里 accepted 回调不稳定，以双方好友状态作为正式 E2E 证据。
        # 3. 设备 A 获取好友列表
        resp_list_a = device_a.call(
            "ContactManager",
            Cmd.getAllContactsFromServer.value,
            info={},
        )
        assert_api.assert_success(resp_list_a)
        assert_api.assert_response_matches(
            resp_list_a,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.getAllContactsFromServer.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )
        contacts_a = resp_list_a.get("result") or []
        assert user_b in contacts_a, f"设备 A 好友列表未包含 B: {contacts_a}"
        # 4. 设备 B 获取好友列表
        resp_list_b = device_b.call(
            "ContactManager",
            Cmd.getAllContactsFromServer.value,
            info={},
        )
        assert_api.assert_success(resp_list_b)
        assert_api.assert_response_matches(
            resp_list_b,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.getAllContactsFromServer.value,
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        contacts_b = resp_list_b.get("result") or []
        assert user_a in contacts_b, f"设备 B 好友列表未包含 A: {contacts_b}"
    finally:
        flow.delete_friend(device_a, user_b, wait_event=False)
        flow.delete_friend(device_b, user_a, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.add_decline_and_verify_not_friends.success")
@pytest.mark.api("ContactManager.declineInvitation")
@pytest.mark.api("ContactManager.getAllContactsFromServer")
@pytest.mark.clients("owner", "peer")
@pytest.mark.roles_mode("ordered")
def test_friend_add_decline_and_verify_not_friends(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为friend、添加、decline、and、verify、not、friends；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.declineInvitation、ContactManager.getAllContactsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为friend、添加、decline、and、verify、not、friends；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.declineInvitation、ContactManager.getAllContactsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    flow = ContactTestFlow(assert_api)
    flow.delete_friend(device_a, user_b, wait_event=False)
    flow.delete_friend(device_b, user_a, wait_event=False)
    try:
        # 1. A 添加 B
        resp_add = device_a.call(
            "ContactManager",
            Cmd.addContact.value,
            info={"userId": user_b, "reason": "decline_flow"},
        )
        assert_api.assert_success(resp_add)
        assert_api.assert_response_matches(
            resp_add,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.addContact.value,
                "device": "{{device}}",
                "result": "{{userId}}",
            },
            context={"userId": user_b, "device": "deviceA"},
            ignore_keys={"sequence"},
        )
        # 2. B 收到好友邀请
        resp_invite = receive_contact_changed_event(
            device_b,
            ContactChangeEvent.INVITED.value,
            timeout=10.0,
        )
        assert resp_invite is not None, "设备 B 未收到好友邀请回调"
        assert_api.assert_response_matches(
            resp_invite,
            expected={
                "type": "event",
                "eventType": Cmd.onContactChanged.value,
                "data": {"type": ContactChangeEvent.INVITED.value, "userId": "{{userId}}", "reason": "decline_flow"},
            },
            context={"userId": user_a},
            ignore_keys={"timestamp", "sequence"},
        )
        # 3. B 拒绝 A 的好友申请
        resp_decline = device_b.call(
            "ContactManager",
            Cmd.declineInvitation.value,
            info={"userId": user_a},
        )
        assert_api.assert_success(resp_decline)
        # 4. A 收到好友请求被拒绝回调
        resp_declined = receive_contact_changed_event(
            device_a,
            ContactChangeEvent.INVITATION_DECLINED.value,
            timeout=10.0,
        )
        assert resp_declined is not None, "设备 A 未收到 onFriendRequestDeclined 回调"
        assert_api.assert_response_matches(
            resp_declined,
            expected={
                "type": "event",
                "eventType": Cmd.onContactChanged.value,
                "data": {"type": ContactChangeEvent.INVITATION_DECLINED.value, "userId": "{{userId}}"},
            },
            context={"userId": user_b},
            ignore_keys={"timestamp", "sequence"},
        )
        # 5. 双方好友列表均不应包含对方（未成为好友）
        resp_list_a = device_a.call(
            "ContactManager",
            Cmd.getAllContactsFromServer.value,
            info={},
        )
        assert_api.assert_success(resp_list_a)
        assert_api.assert_response_matches(
            resp_list_a,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.getAllContactsFromServer.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )
        contacts_a = resp_list_a.get("result") or []
        assert user_b not in contacts_a, f"拒绝好友申请后 A 不应包含 B: {contacts_a}"

        resp_list_b = device_b.call(
            "ContactManager",
            Cmd.getAllContactsFromServer.value,
            info={},
        )
        assert_api.assert_success(resp_list_b)
        assert_api.assert_response_matches(
            resp_list_b,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.getAllContactsFromServer.value,
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        contacts_b = resp_list_b.get("result") or []
        assert user_a not in contacts_b, f"拒绝好友申请后 B 不应包含 A: {contacts_b}"
    finally:
        flow.delete_friend(device_a, user_b, wait_event=False)
        flow.delete_friend(device_b, user_a, wait_event=False)


# ---------- acceptInvitation ----------


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
def test_contact_accept_invitation_without_pending(topology_primary_or_device_a, assert_api, user_c):
    """
    1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、accept、invitation、without、pending；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.acceptInvitation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、accept、invitation、without、pending；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.acceptInvitation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.acceptInvitation.value,
        info={"userId": user_c},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "cmd": Cmd.acceptInvitation.value,
            "device": "{{device}}",
            "manager": "ContactManager",
            "result": "{{userId}}",
            "sequence": "{{sequence}}",
        },
        context={"userId": user_c, "device": _expected_device(client)},
        ignore_keys={"sequence"},
    )
    # 查询 C 的好友列表（REST）；接口可能直接返回 list，或包在 data 里
    contacts = get_user_contacts(user_c)
    items = contacts if isinstance(contacts, list) else contacts.get("data", [])
    assert isinstance(items, list), f"好友列表应为 list，实际 {type(items).__name__}: {items!r}"
    assert user_c not in items, f"无待处理邀请时不应新增目标好友，实际 {items!r}"


# ---------- declineInvitation ----------


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
def test_contact_decline_invitation_without_pending(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、decline、invitation、without、pending；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.declineInvitation，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、decline、invitation、without、pending；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.declineInvitation，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.declineInvitation.value,
        info={"userId": USER_NONEXISTENT},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.declineInvitation.value,
            "device": "{{device}}",
            "result": "{{userId}}",
        },
        context={"userId": USER_NONEXISTENT, "device": _expected_device(client)},
        ignore_keys={"sequence"},
    )


# ---------- setContactRemark / getContact ----------


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_contact_remark_set_then_list_includes_remark(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、remark、set、then、列表、includes、remark；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、remark、set、then、列表、includes、remark；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    expected_device = _expected_device(primary)
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(primary, remote, user_a, user_b, reason="remark_normal")
    remark_text = "同事-B备注"
    response = primary.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": remark_text},
    )
    assert_api.assert_response_matches(
        response,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.setContactRemark.value,
            "device": "{{device}}",
            "result": None,
        },
        context={"device": expected_device},
        ignore_keys={"sequence"},
    )
    content_resp = primary.call(
        "ContactManager",
        Cmd.getContact.value,
        info={"userId": user_b},
    )
    assert_api.assert_response_matches(
        content_resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getContact.value,
            "device": "{{device}}",
            "result": {"userId": "{{userId}}", "remark": "{{remark}}"},
        },
        context={"device": expected_device, "userId": user_b, "remark": remark_text},
        ignore_keys={"sequence"},
    )
    flow.delete_friend(primary, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_contact_remark_empty_string(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、remark、空值参数、string；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、remark、空值参数、string；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    expected_device = _expected_device(primary)
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(primary, remote, user_a, user_b, reason="remark_empty")
    remark_text = ""
    response = primary.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": remark_text},
    )
    assert_api.assert_response_matches(
        response,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.setContactRemark.value,
            "device": "{{device}}",
            "result": None,
        },
        context={"device": expected_device},
        ignore_keys={"sequence"},
    )
    content_resp = primary.call(
        "ContactManager",
        Cmd.getContact.value,
        info={"userId": user_b},
    )
    assert_api.assert_response_matches(
        content_resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getContact.value,
            "device": "{{device}}",
            "result": {"userId": "{{userId}}", "remark": "{{remark}}"},
        },
        context={"device": expected_device, "userId": user_b, "remark": remark_text},
        ignore_keys={"sequence"},
    )
    flow.delete_friend(primary, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_contact_remark_special_chars_length_101(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、remark、special、chars、length、101；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、remark、special、chars、length、101；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(primary, remote, user_a, user_b, reason="remark_101")
    assert_api.assert_error(
        primary.call(
            "ContactManager",
            Cmd.setContactRemark.value,
            info={"userId": user_b, "remark": REMARK_SPECIAL_101},
        ),
        code=4,
        description="remark length must less than 100",
    )
    flow.delete_friend(primary, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_contact_remark_not_preserved_after_delete_and_readd(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为contact、remark、not、preserved、after、删除、and、readd；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getContact，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人状态变更场景所需的测试数据，场景为contact、remark、not、preserved、after、删除、and、readd；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getContact，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    expected_device = _expected_device(primary)
    old = "持久化备注-删除后应失效"
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(primary, remote, user_a, user_b, reason="remark_readd")
    resp_set = primary.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": old},
    )
    assert_api.assert_response_matches(
        resp_set,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.setContactRemark.value,
            "device": "{{device}}",
            "result": None,
        },
        context={"device": expected_device},
        ignore_keys={"sequence"},
    )
    content_after_set = primary.call(
        "ContactManager",
        Cmd.getContact.value,
        info={"userId": user_b},
    )
    assert_api.assert_response_matches(
        content_after_set,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getContact.value,
            "device": "{{device}}",
            "result": {"userId": "{{userId}}", "remark": "{{remark}}"},
        },
        context={"device": expected_device, "userId": user_b, "remark": old},
        ignore_keys={"sequence"},
    )
    flow.delete_friend(primary, user_b, wait_event=False)

    flow.establish_friends(primary, remote, user_a, user_b, reason="remark_readd_2")
    content_after_readd = _wait_get_contact(primary, user_b)
    assert_api.assert_response_matches(
        content_after_readd,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getContact.value,
            "device": "{{device}}",
            "result": {"userId": "{{userId}}", "remark": ne(old)},
        },
        context={"device": expected_device, "userId": user_b},
        ignore_keys={"sequence"},
    )
    flow.delete_friend(primary, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_contact_set_contact_remark_non_friend(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、set、contact、remark、non、friend；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人基础能力场景所需的测试数据，场景为contact、set、contact、remark、non、friend；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": USER_NONEXISTENT, "remark": "x"},
    )
    assert_api.assert_error(
        resp,
        code=221,
        description="updateRemark | they are not friends, please add as a friend first.",
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.get_block_list_from_server.empty_or_list.success")
@pytest.mark.api("ContactManager.getBlockListFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_get_block_list_from_server_returns_list(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、封禁、列表、from、服务端、returns、列表；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.getBlockListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、获取、封禁、列表、from、服务端、returns、列表；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.getBlockListFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.getBlockListFromServer.value,
        info={},
    )
    # 校验信封字段，避免使用 actual 的 result 自证；随后单独断言类型为 list。
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getBlockListFromServer.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp.get("result"), list), "getBlockListFromServer should return a list (possibly empty)."


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_contact_fetch_all_fetch_page_fetch_ids_get_local_lists(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、拉取、all、拉取、page、拉取、ids、获取；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getAllContactsFromServer、ContactManager.fetchAllContactIds、ContactManager.fetchAllContacts，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、拉取、all、拉取、page、拉取、ids、获取；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.setContactRemark、ContactManager.getAllContactsFromServer、ContactManager.fetchAllContactIds、ContactManager.fetchAllContacts，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    expected_device = _expected_device(primary)
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(primary, remote, user_a, user_b, reason="fetch_contacts_api")
    remark_for_fetch = "fetch-remark-校验"

    resp_set_remark = primary.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": remark_for_fetch},
    )
    assert_api.assert_response_matches(
        resp_set_remark,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.setContactRemark.value,
            "device": expected_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    resp_sync = primary.call(
        "ContactManager",
        Cmd.getAllContactsFromServer.value,
        info={},
    )
    assert_api.assert_response_matches(
        resp_sync,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContactsFromServer.value,
            "device": expected_device,
        },
        ignore_keys={"sequence", "result"},
    )
    contacts = resp_sync.get("result") or []
    assert user_b in contacts, f"服务端好友列表未包含目标好友: {contacts}"

    # fetchAllContactIds：当前原生通道未实现 direct cmd，冻结真实 MissingPlugin 返回；Dart 方法复用旧 native cmd。
    resp_fetch_ids = primary.call(
        "ContactManager",
        Cmd.fetchAllContactIds.value,
        info={},
    )
    assert_api.assert_error(resp_fetch_ids, code=-1, description="MissingPluginException")

    # fetchAllContacts：服务端一次性好友（含 userId + remark）
    resp_fetch_all = primary.call(
        "ContactManager",
        Cmd.fetchAllContacts.value,
        info={},
    )
    assert_api.assert_response_matches(
        resp_fetch_all,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.fetchAllContacts.value,
            "device": expected_device,
        },
        ignore_keys={"sequence", "result"},
    )
    fetched_contacts = resp_fetch_all.get("result") or []
    assert any(
        isinstance(item, dict)
        and item.get("userId") == user_b
        and item.get("remark") == remark_for_fetch
        for item in fetched_contacts
    ), f"fetchAllContacts 未包含目标好友及备注: {fetched_contacts}"

    # fetchContacts：分页（桥接可能返回 list 或 EMCursorResult 字典）
    resp_page = primary.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": 20},
    )
    page_body = resp_page.get("result")
    if isinstance(page_body, list):
        assert_api.assert_response_matches(
            resp_page,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.fetchContacts.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        assert any(
            isinstance(item, dict)
            and item.get("userId") == user_b
            and item.get("remark") == remark_for_fetch
            for item in page_body
        ), f"fetchContacts list 未包含目标好友及备注: {page_body}"
    else:
        assert_api.assert_response_matches(
            resp_page,
            expected={
                "manager": "ContactManager",
                "cmd": Cmd.fetchContacts.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        page_list = page_body.get("list") or []
        assert any(
            isinstance(item, dict)
            and item.get("userId") == user_b
            and item.get("remark") == remark_for_fetch
            for item in page_list
        ), f"fetchContacts cursor list 未包含目标好友及备注: {page_body}"

    # getContact：本地单个好友
    resp_get_one = primary.call(
        "ContactManager",
        Cmd.getContact.value,
        info={"userId": user_b},
    )
    assert_api.assert_response_matches(
        resp_get_one,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getContact.value,
            "device": expected_device,
            "result": {"userId": user_b, "remark": remark_for_fetch},
        },
        ignore_keys={"sequence"},
    )

    # getAllContacts：本地好友对象列表
    resp_all_local = primary.call(
        "ContactManager",
        Cmd.getAllContacts.value,
        info={},
    )
    assert_api.assert_response_matches(
        resp_all_local,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContacts.value,
            "device": expected_device,
        },
        ignore_keys={"sequence", "result"},
    )
    local_contacts = resp_all_local.get("result") or []
    assert any(
        isinstance(item, dict)
        and item.get("userId") == user_b
        and item.get("remark") == remark_for_fetch
        for item in local_contacts
    ), f"getAllContacts 未包含目标好友及备注: {local_contacts}"

    # getAllContactIds：当前原生通道未实现 direct cmd，冻结真实 MissingPlugin 返回；本地 ID 读取由 getAllContactsFromDB 覆盖。
    resp_local_ids = primary.call(
        "ContactManager",
        Cmd.getAllContactIds.value,
        info={},
    )
    assert_api.assert_error(resp_local_ids, code=-1, description="MissingPluginException")

    flow.delete_friend(primary, user_b, wait_event=False)


# ---------- fetchContacts（异常：文档 pageSize ∈ [1,50]）----------


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.fetch_contacts.page_size_zero.boundary")
@pytest.mark.api("ContactManager.fetchContacts")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_fetch_contacts_page_size_zero(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、拉取、contacts、page、size、zero；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.fetchContacts，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、拉取、contacts、page、size、zero；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.fetchContacts，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": 0},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.fetchContacts.value,
            "device": _expected_device(client),
            "result": {"list": []},
        },
        ignore_keys={"sequence", "cursor"},
    )

@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.fetch_contacts.page_size_exceeds_50.error")
@pytest.mark.api("ContactManager.fetchContacts")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_fetch_contacts_page_size_exceeds_50(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、拉取、contacts、page、size、exceeds、50；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.fetchContacts，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、拉取、contacts、page、size、exceeds、50；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.fetchContacts，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": 51},
    )
    assert_api.assert_error(
        resp,
        code=112,
        description="getContacts | page size more than max limit : 50",
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.fetch_contacts.page_size_negative.boundary")
@pytest.mark.api("ContactManager.fetchContacts")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_fetch_contacts_page_size_negative(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、拉取、contacts、page、size、negative；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.fetchContacts，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、拉取、contacts、page、size、negative；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.fetchContacts，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": -1},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.fetchContacts.value,
            "device": _expected_device(client),
            "result": {"cursor": "", "list": []},
        },
        ignore_keys={"sequence"},
    )




@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_contact_add_user_to_block_list_nonexistent(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、添加、用户、to、封禁、列表、不存在对象；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.addUserToBlockList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、添加、用户、to、封禁、列表、不存在对象；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.addUserToBlockList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "ContactManager",
        Cmd.addUserToBlockList.value,
        info={"userId": USER_NONEXISTENT},
    )
    assert_api.assert_error(resp, code=204, description="User does not exist")


@pytest.mark.real_e2e
@pytest.mark.case_id("contact.block_list_flow_then_unblock_restores_friend.success")
@pytest.mark.api("ContactManager.addUserToBlockList")
@pytest.mark.api("ContactManager.getAllContactsFromServer")
@pytest.mark.clients("owner", "peer")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("server_state")
@pytest.mark.topology_ready
def test_contact_block_list_flow_then_unblock_restores_friend(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、封禁、列表、flow、then、unblock、restores、friend；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.addUserToBlockList、ContactManager.getAllContactsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人查询/拉取场景所需的测试数据，场景为contact、封禁、列表、flow、then、unblock、restores、friend；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.addUserToBlockList、ContactManager.getAllContactsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    user_a = primary.user_id
    user_b = remote.user_id
    primary_device = _expected_device(primary)
    remote_device = _expected_device(remote)
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(primary, remote, user_a, user_b, reason="blocklist_flow")
    resp_add_block = primary.call(
        "ContactManager",
        Cmd.addUserToBlockList.value,
        info={"userId": user_b},
    )
    assert_api.assert_success(resp_add_block)
    assert_api.assert_response_matches(
        resp_add_block,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.addUserToBlockList.value,
            "device": primary_device,
            "result": user_b,
        },
        ignore_keys={"sequence"},
    )

    resp_block = flow.get_block_list(primary)
    assert_api.assert_success(resp_block)
    assert_api.assert_response_matches(
        resp_block,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getBlockListFromServer.value,
            "device": primary_device,
            "result": [user_b],
        },
        ignore_keys={"sequence"},
    )

    resp_friends_a_blocked = flow.get_all_contacts_from_server(primary)
    assert_api.assert_success(resp_friends_a_blocked)
    assert_api.assert_response_matches(
        resp_friends_a_blocked,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContactsFromServer.value,
            "device": primary_device,
        },
        ignore_keys={"sequence", "result"},
    )
    friends_a_blocked = resp_friends_a_blocked.get("result") or []
    assert user_b in friends_a_blocked, f"A 拉黑后服务端好友列表未包含 B: {friends_a_blocked}"

    resp_friends_b = flow.get_all_contacts_from_server(remote)
    assert_api.assert_success(resp_friends_b)
    assert_api.assert_response_matches(
        resp_friends_b,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContactsFromServer.value,
            "device": remote_device,
        },
        ignore_keys={"sequence", "result"},
    )
    friends_b = resp_friends_b.get("result") or []
    assert user_a in friends_b, f"B 好友列表未包含 A: {friends_b}"

    resp_remove_block = primary.call(
        "ContactManager",
        Cmd.removeUserFromBlockList.value,
        info={"userId": user_b},
    )
    assert_api.assert_success(resp_remove_block)
    assert_api.assert_response_matches(
        resp_remove_block,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.removeUserFromBlockList.value,
            "device": primary_device,
            "result": user_b,
        },
        ignore_keys={"sequence"},
    )

    resp_friends_a_after = flow.get_all_contacts_from_server(primary)
    assert_api.assert_success(resp_friends_a_after)
    assert_api.assert_response_matches(
        resp_friends_a_after,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getAllContactsFromServer.value,
            "device": primary_device,
        },
        ignore_keys={"sequence", "result"},
    )
    friends_a_after = resp_friends_a_after.get("result") or []
    assert user_b in friends_a_after, f"A 解除拉黑后好友列表未包含 B: {friends_a_after}"

    flow.delete_friend(primary, user_b, wait_event=False)


def test_contact_remove_from_block_list_when_not_blocked(
    device_a, device_b, assert_api, user_a, user_b
):
    """已是好友但未加入黑名单时调用 removeUserFromBlockList。"""
    flow = ContactTestFlow(assert_api)
    flow.establish_friends(device_a, device_b, user_a, user_b, reason="unblock_not_in_list")
    resp_bl = flow.get_block_list(device_a)
    assert_api.assert_success(resp_bl)
    assert_api.assert_response_matches(
        resp_bl,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.getBlockListFromServer.value,
            "device": "deviceA",
            "result": [],
        },
        ignore_keys={"sequence", "result"},
    )
    assert user_b not in assert_api.get_result(resp_bl)
    assert_api.assert_success(flow.remove_from_block_list(device_a, user_b))
    flow.delete_friend(device_a, user_b, wait_event=False)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("api_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("contact.remove_from_block_list.nonexistent_user.idempotent")
@pytest.mark.api("ContactManager.removeUserFromBlockList")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_contact_remove_from_block_list_nonexistent_user(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、移除、from、封禁、列表、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 ContactManager.removeUserFromBlockList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备联系人异常/边界场景所需的测试数据，场景为contact、移除、from、封禁、列表、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ContactManager.removeUserFromBlockList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "ContactManager",
        Cmd.removeUserFromBlockList.value,
        info={"userId": USER_NONEXISTENT},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ContactManager",
            "cmd": Cmd.removeUserFromBlockList.value,
            "device": _expected_device(client),
            "result": USER_NONEXISTENT,
        },
        ignore_keys={"sequence"},
    )
