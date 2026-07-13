"""
Presence 在线状态用例，对应 presence_manager.dart。
场景：A 发布 presence，B 订阅 A → B 查询 A 的在线状态与订阅列表 → B 取消订阅 → 再次查询应返回空。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from src import gt, ne

pytestmark = [pytest.mark.client, pytest.mark.presence]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


# 用户 A/B 由 conftest 的 created_test_users 创建，teardown 删除；用例中注入 user_a / user_b

# 订阅有效期（秒），不超过 30 天
PRESENCE_EXPIRY = 3600

# 30 天（秒），用于「过期时间大于 30 天」的非法参数测试
SECONDS_30_DAYS = 30 * 24 * 3600

# 不存在的用户 ID，用于订阅不存在用户的测试
USER_NONEXISTENT = "nonexistent_user_xyz_999"


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.publish_subscribe_query_unsubscribe.success")
@pytest.mark.api("PresenceManager.publishPresenceWithDescription")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.api("PresenceManager.fetchPresenceStatus")
@pytest.mark.api("PresenceManager.fetchSubscribedMembersWithPageNum")
@pytest.mark.api("PresenceManager.presenceUnsubscribe")
def test_presence_publish_subscribe_query_unsubscribe(device_a, device_b, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态查询/拉取场景所需的测试数据，场景为在线状态、发布、订阅、query、取消订阅；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchPresenceStatus、PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态查询/拉取场景所需的测试数据，场景为在线状态、发布、订阅、query、取消订阅；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchPresenceStatus、PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    # 1. A 发布自定义在线状态（PresenceManager.publishPresenceWithDescription）
    resp_pub = device_a.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": "online"},
    )
    assert_api.assert_success(resp_pub)
    # 全量断言：与预期 JSON 比对，不一致时列出 diff；device 用占位符从 context 注入
    assert_api.assert_response_matches(
        resp_pub,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceWithDescription.value,
            "device": "{{device}}",
            "result": True,
        },
        context={"device": "deviceA"},
        ignore_keys={"sequence"},
    )

    # 2. B 订阅 A 的在线状态（PresenceManager.presenceSubscribe）
    resp_sub = device_b.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": PRESENCE_EXPIRY},
    )
    assert_api.assert_success(resp_sub)
    # 断言 result[0].statusDescription 为发布时的 desc（online），publisher 为订阅用户 A；lastTime/expiryTime/statusDetails 等变化字段不参与比对
    assert_api.assert_response_matches(
        resp_sub,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceSubscribe.value,
            "device": "{{device}}",
            "result": [{"statusDescription": "online", "publisher": "{{publisher}}", "expiryTime": gt(0)}],
        },
        context={"device": "deviceB", "publisher": user_a},
        ignore_keys={"sequence", "lastTime", "statusDetails"},
    )

    # 3. B 查询指定用户 A 的当前在线状态（fetchPresenceStatus）
    resp_status = device_b.call(
        "PresenceManager",
        Cmd.fetchPresenceStatus.value,
        info={"members": [user_a]},
    )
    assert_api.assert_success(resp_status)
    # assert_api.assert_response_matches(
    #     resp_status,
    #     expected={
    #         "manager": "PresenceManager",
    #         "cmd": Cmd.fetchPresenceStatus.value,
    #         "device": "{{device}}",
    #         "result": [{"statusDescription": "online", "publisher": "{{publisher}}", "lastTime": "{{lastTime}}",
    #                     "expiryTime": gt(0)}],
    #     },
    #     context={"device": "deviceB", "publisher": user_a},
    #     ignore_keys={"lastTime", "statusDetails"},
    # )
    #
    # # 4. B 获取订阅用户列表（fetchSubscribedMembersWithPageNum）
    resp_members = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    assert_api.assert_response_matches(
        resp_members,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": ["{{publisher}}"]
        },
        context={"device": "deviceB", "publisher": user_a},
        ignore_keys={"sequence"},
    )
    #
    # # 5. B 取消订阅 A（presenceUnsubscribe）
    resp_unsub = device_b.call(
        "PresenceManager",
        Cmd.presenceUnsubscribe.value,
        info={"members": [user_a]},
    )
    assert_api.assert_response_matches(
        resp_unsub,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceUnsubscribe.value,
            "device": "{{device}}",
            "result": None,
        },
        context={"device": "deviceB"},
        ignore_keys={"sequence"},
    )

    # # 6. B 再次查询订阅列表，应返回空
    resp_members_after = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    assert_api.assert_success(resp_members_after)
    assert_api.assert_response_matches(
        resp_members_after,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": [],
        },
        context={"device": "deviceB"},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.publish_empty_desc_then_fetch.current_result")
@pytest.mark.api("PresenceManager.publishPresenceWithDescription")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.api("PresenceManager.fetchPresenceStatus")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
def test_presence_publish_empty_desc_then_fetch(device_a, device_b, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、发布、空值参数、desc、then、拉取；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchPresenceStatus，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、发布、空值参数、desc、then、拉取；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchPresenceStatus，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    # 1. A 发布 desc 为空
    resp_pub = device_a.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": ""},
    )
    assert_api.assert_success(resp_pub)

    # 2. B 订阅 A
    resp_sub = device_b.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": PRESENCE_EXPIRY},
    )
    assert_api.assert_success(resp_sub)

    # 3. B 查询 A 的在线状态，断言 statusDescription 为空
    resp_status = device_b.call(
        "PresenceManager",
        Cmd.fetchPresenceStatus.value,
        info={"members": [user_a]},
    )
    assert_api.assert_success(resp_status)
    assert_api.assert_response_matches(
        resp_status,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchPresenceStatus.value,
            "device": "{{device}}",
            "result": [{"statusDescription": "", "publisher": "{{publisher}}"}],
        },
        context={"device": "deviceB", "publisher": user_a},
        ignore_keys={"sequence", "lastTime", "expiryTime", "statusDetails"},
    )


# 128KB 字符，用于 desc 上限/大体积测试
DESC_128K = "x" * (128 * 1024)


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.publish_128k_desc.error")
@pytest.mark.api("PresenceManager.publishPresenceWithDescription")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_presence_publish_128k_desc(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态基础能力场景所需的测试数据，场景为在线状态、发布、128k、desc；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态基础能力场景所需的测试数据，场景为在线状态、发布、128k、desc；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    # 1. A 发布 128k desc
    client = topology_primary_or_device_a
    resp_pub = client.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": DESC_128K},
    )
    assert_api.assert_response_matches(
        resp_pub,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceWithDescription.value,
            "device": "{{device}}",
            "result": {
		        "description": "Presence parameter length is exceeded",
		        "code": 1100
	        },
        },
        context={"device": _expected_device(client)},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.subscribe_nonexistent_user.current_result")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_presence_subscribe_nonexistent_user(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、订阅、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceSubscribe，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、订阅、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceSubscribe，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [USER_NONEXISTENT], "expiry": PRESENCE_EXPIRY},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceSubscribe.value,
            "device": "{{device}}",
            "result": [{"statusDescription": "", "publisher": "{{publisher}}", "expiryTime": gt(0),"statusDetails":{},"lastTime":0}],
        },
        context={"device": "deviceA", "publisher": USER_NONEXISTENT},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.subscribe_expiry_over_30_days.error")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
def test_presence_subscribe_expiry_over_30_days(device_a, device_b, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、订阅、expiry、over、30、days；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceSubscribe，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、订阅、expiry、over、30、days；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceSubscribe，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    # A 先发布 presence，确保 A 存在且在线
    resp_pub = device_a.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": "online"},
    )
    assert_api.assert_success(resp_pub)
    # B 订阅 A，但 expiry 超过 30 天（30*24*3600 + 1 秒）
    resp = device_b.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": SECONDS_30_DAYS + 1},
    )
    assert_api.assert_error(resp)


# presenceSubscribe / presenceUnsubscribe 单次成员数上限（超过则预期报错）
PRESENCE_SUBSCRIBE_MAX_MEMBERS = 100


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.subscribe_over_100_members.error")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_presence_subscribe_over_100_members(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、订阅、over、100、成员；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceSubscribe，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、订阅、over、100、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceSubscribe，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    members_over_limit = [f"user_{i}" for i in range(PRESENCE_SUBSCRIBE_MAX_MEMBERS + 1)]
    client = topology_primary_or_device_a
    resp = client.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": members_over_limit, "expiry": PRESENCE_EXPIRY},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceSubscribe.value,
            "device": "{{device}}",
            "result": {
                "description": "Presence parameter length is exceeded",
                "code": 1100
            },
        },
        context={"device": _expected_device(client)},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.unsubscribe_over_100_members.error")
@pytest.mark.api("PresenceManager.presenceUnsubscribe")
@pytest.mark.clients("receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_presence_unsubscribe_over_100_members(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、取消订阅、over、100、成员；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceUnsubscribe，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为在线状态、取消订阅、over、100、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.presenceUnsubscribe，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    members_over_limit = [f"user_{i}" for i in range(PRESENCE_SUBSCRIBE_MAX_MEMBERS + 1)]
    client = topology_primary_or_device_a
    resp = client.call(
        "PresenceManager",
        Cmd.presenceUnsubscribe.value,
        info={"members": members_over_limit},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.presenceUnsubscribe.value,
            "device": "{{device}}",
            "result": {
                "description": "Presence parameter length is exceeded",
                "code": 1100
            },
        },
        context={"device": _expected_device(client)},
        ignore_keys={"sequence"},
    )

# ---------- fetchSubscribedMembersWithPageNum 分页测试 ----------


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.fetch_subscribed_members.pagination.success")
@pytest.mark.api("PresenceManager.publishPresenceWithDescription")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.api("PresenceManager.fetchSubscribedMembersWithPageNum")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
def test_fetch_subscribed_members_pagination(device_a, device_b, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态查询/拉取场景所需的测试数据，场景为拉取、subscribed、成员、pagination；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态查询/拉取场景所需的测试数据，场景为拉取、subscribed、成员、pagination；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    # 准备：A 发布，B 订阅 A
    resp_pub = device_a.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": "online"},
    )
    assert_api.assert_success(resp_pub)
    resp_sub = device_b.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": PRESENCE_EXPIRY},
    )
    assert_api.assert_success(resp_sub)

    # 第 1 页：pageNum=1, pageSize=20，应返回 [user_a]
    resp_p1 = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 20},
    )
    assert_api.assert_response_matches(
        resp_p1,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": ["{{publisher}}"],
        },
        context={"device": "deviceB", "publisher": user_a},
        ignore_keys={"sequence"},
    )

    # 第 2 页：应为空列表
    resp_p2 = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 2, "pageSize": 20},
    )
    assert_api.assert_response_matches(
        resp_p2,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": [],
        },
        context={"device": "deviceB"},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.fetch_subscribed_members.page_size_one.success")
@pytest.mark.api("PresenceManager.publishPresenceWithDescription")
@pytest.mark.api("PresenceManager.presenceSubscribe")
@pytest.mark.api("PresenceManager.fetchSubscribedMembersWithPageNum")
@pytest.mark.clients("sender,receiver")
@pytest.mark.roles_mode("ordered")
def test_fetch_subscribed_members_pagination_page_size_one(device_a, device_b, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态查询/拉取场景所需的测试数据，场景为拉取、subscribed、成员、pagination、page、size、one；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态查询/拉取场景所需的测试数据，场景为拉取、subscribed、成员、pagination、page、size、one；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.publishPresenceWithDescription、PresenceManager.presenceSubscribe、PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    resp_pub = device_a.call(
        "PresenceManager",
        Cmd.presenceWithDescription.value,
        info={"desc": "online"},
    )
    assert_api.assert_success(resp_pub)
    resp_sub = device_b.call(
        "PresenceManager",
        Cmd.presenceSubscribe.value,
        info={"members": [user_a], "expiry": PRESENCE_EXPIRY},
    )
    assert_api.assert_success(resp_sub)

    resp_1 = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 1},
    )
    assert_api.assert_response_matches(
        resp_1,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": ["{{publisher}}"],
        },
        context={"device": "deviceB", "publisher": user_a},
        ignore_keys={"sequence"},
    )

    resp_2 = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 2, "pageSize": 1},
    )
    assert_api.assert_response_matches(
        resp_2,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": [],
        },
        context={"device": "deviceB"},
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("presence.fetch_subscribed_members.invalid_pagination.current_result")
@pytest.mark.api("PresenceManager.fetchSubscribedMembersWithPageNum")
@pytest.mark.clients("receiver")
@pytest.mark.roles_mode("ordered")
def test_fetch_subscribed_members_invalid_pagination(device_b, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为拉取、subscribed、成员、无效参数、pagination；
    2. 通过 WebSocket 控制测试 App 调用 PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备在线状态异常/边界场景所需的测试数据，场景为拉取、subscribed、成员、无效参数、pagination；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PresenceManager.fetchSubscribedMembersWithPageNum，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp_zero_page = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 0, "pageSize": 20},
    )
    # pageNum 从 1 开始时，0 可能报错；若服务端从 0 开始则改为断言成功并校验结果
    assert_api.assert_response_matches(
        resp_zero_page,
        expected={
            "manager": "PresenceManager",
            "cmd": Cmd.fetchSubscribedMembersWithPageNum.value,
            "device": "{{device}}",
            "result": ["{{publisher}}"],
        },
        context={"device": "deviceB", "publisher": user_a},
        ignore_keys={"sequence"},
    )

    resp_zero_size = device_b.call(
        "PresenceManager",
        Cmd.fetchSubscribedMembersWithPageNum.value,
        info={"pageNum": 1, "pageSize": 0},
    )
    assert_api.assert_error(resp_zero_size)
