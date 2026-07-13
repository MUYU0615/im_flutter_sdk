"""
用户属性（UserInfoManager）模块用例：
- updateUserInfo（updateOwnUserInfo / updateOwnUserInfoWithType）：设置/修改当前用户自己的属性信息
- fetchUserInfoById（fetchUserInfoById / fetchUserInfoByIdWithType）：获取指定用户属性
- fetchOwnInfo：获取当前登录用户自己的属性信息
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import json
import sys

import pytest

from src import Cmd


pytestmark = [pytest.mark.client]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


# assert_response_matches 的 expected 若写成 result: resp.get("result")，预期与 actual 在 result
# 上完全一致，无法发现「实际多出字段」。应对关心的字段写显式 dict（含 userId 等）。

# userInfoType / userInfoTypes 与原生 SDK 一致：0 NICKNAME, 1 AVATAR_URL, 2 EMAIL, 3 PHONE,
# 4 GENDER, 5 SIGN, 6 BIRTH, 100 EXT

# fetchUserInfoById* 返回 Map<userId, EMUserInfo>；仅校验 userId 时，其余 EMUserInfo 字段放入 ignore_keys
_USER_INFO_FETCH_BY_ID_IGNORE_KEYS = frozenset({
    "sequence",
    "ext",
    "avatarUrl",
    "phone",
    "birth",
    "nickName",
    "sign",
    "gender",
    "mail",
})

# 需在 result[userId] 中断言 nickName/sign/mail 时，勿把上述字段放入 ignore（否则会跳过值比对）
_USER_INFO_FETCH_BY_ID_STRICT_IGNORE_KEYS = frozenset({
    "sequence",
    "ext",
    "avatarUrl",
    "phone",
    "birth",
    "gender",
})

# updateOwnUserInfoWithType 需断言本次写入的 nickName，故不把 nickName 放入 ignore
_USER_INFO_UPDATE_WITH_TYPE_IGNORE_KEYS = frozenset({
    "sequence",
    "ext",
    "avatarUrl",
    "phone",
    "birth",
    "sign",
    "gender",
    "mail",
})

@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_update_own_set_and_modify(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料状态变更场景所需的测试数据，场景为用户、信息、更新、当前用户、set、and、modify；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料状态变更场景所需的测试数据，场景为用户、信息、更新、当前用户、set、and、modify；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    resp_set = client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={"nickName": "nick-init", "sign": "sign-init", "gender": 1,"mail":"aa"},
    )
    assert_api.assert_response_matches(
        resp_set,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.updateOwnUserInfo.value,
            "device": expected_device,
            "result": {
                "nickName": "nick-init",
                "sign": "sign-init",
                "gender": 1,
                "mail":"aa",
                "userId": user_a,
            },
        },
        ignore_keys={"sequence", "ext", "avatarUrl", "phone", "birth", "gender"},
    )

    resp_modify = client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={"nickName": "nick-mod", "sign": "sign-mod"},
    )
    assert_api.assert_response_matches(
        resp_modify,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.updateOwnUserInfo.value,
            "device": expected_device,
            "result": {
                "nickName": "nick-mod",
                "sign": "sign-mod",
                "userId": user_a,
            },
        },
        # Android 仅更新 nick/sign 时，本次未传的 mail/gender 可能按默认值返回。
        ignore_keys={"sequence", "ext", "avatarUrl", "phone", "birth", "mail", "gender"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_update_own_with_type_nickname(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料状态变更场景所需的测试数据，场景为用户、信息、更新、当前用户、with、type、nickname；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfoWithType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料状态变更场景所需的测试数据，场景为用户、信息、更新、当前用户、with、type、nickname；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfoWithType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfoWithType.value,
        info={"userInfoType": 0, "userInfoValue": "nick-by-type"},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.updateOwnUserInfoWithType.value,
            "device": _expected_device(client),
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    if isinstance(result, str):
        result = json.loads(result)
    assert isinstance(result, dict), f"updateOwnUserInfoWithType result 应为 dict 或 JSON 字符串: {resp!r}"
    assert result.get("nickname") == "nick-by-type" or result.get("nickName") == "nick-by-type"


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_update_then_fetch_user_info_by_id(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、拉取、用户、信息、by；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、拉取、用户、信息、by；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={
            "nickName": "nick-then-bid",
            "sign": "sign-then-bid",
            "mail": "mail-then-bid@example.com",
        },
    )
    resp = client.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": [user_a]},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.fetchUserInfoById.value,
            "device": expected_device,
            "result": {
                user_a: {
                    "userId": user_a,
                    "nickName": "nick-then-bid",
                    "sign": "sign-then-bid",
                    "mail": "mail-then-bid@example.com",
                },
            },
        },
        ignore_keys=_USER_INFO_FETCH_BY_ID_STRICT_IGNORE_KEYS,
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_user_info_update_then_fetch_own_info(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、拉取、当前用户、信息；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchOwnInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、拉取、当前用户、信息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchOwnInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={
            "nickName": "nick-own-info",
            "sign": "sign-own-info",
            "mail": "mail-own-info@example.com",
        },
    )
    resp = client.call(
        "UserInfoManager",
        Cmd.fetchOwnInfo.value,
        info={},
    )
    assert_api.assert_error(resp, code=-1, description="MissingPluginException")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_update_then_fetch_user_info_by_id_with_type(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、拉取、用户、信息、by；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchUserInfoByIdWithType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、拉取、用户、信息、by；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchUserInfoByIdWithType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={
            "nickName": "nick-then-wit",
            "sign": "sign-then-wit",
            "mail": "mail-then-wit@example.com",
        },
    )
    resp = client.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={
            "userIds": [user_a],
            "userInfoTypes": [0, 5],
        },
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.fetchUserInfoByIdWithType.value,
            "device": expected_device,
            "result": {
                user_a: {
                    "userId": user_a,
                    "nickName": "nick-then-wit",
                    "sign": "sign-then-wit",
                },
            },
        },
        ignore_keys=_USER_INFO_FETCH_BY_ID_STRICT_IGNORE_KEYS
        | frozenset({"mail"}),
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_update_then_all_fetch_paths_in_one_flow(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、all、拉取、paths、in；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchUserInfoById、UserInfoManager.fetchUserInfoByIdWithType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、更新、then、all、拉取、paths、in；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo、UserInfoManager.fetchUserInfoById、UserInfoManager.fetchUserInfoByIdWithType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={
            "nickName": "nick-flow-all",
            "sign": "sign-flow-all",
            "mail": "mail-flow-all@example.com",
        },
    )
    expected_full = {
        "userId": user_a,
        "nickName": "nick-flow-all",
        "sign": "sign-flow-all",
        "mail": "mail-flow-all@example.com",
    }
    expected_partial = {
        "userId": user_a,
        "nickName": "nick-flow-all",
        "sign": "sign-flow-all",
    }
    r_bid = client.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": [user_a]},
    )
    assert_api.assert_response_matches(
        r_bid,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.fetchUserInfoById.value,
            "device": expected_device,
            "result": {user_a: expected_full},
        },
        ignore_keys=_USER_INFO_FETCH_BY_ID_STRICT_IGNORE_KEYS,
    )
    r_wit = client.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={"userIds": [user_a], "userInfoTypes": [0, 5]},
    )
    assert_api.assert_response_matches(
        r_wit,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.fetchUserInfoByIdWithType.value,
            "device": expected_device,
            "result": {user_a: expected_partial},
        },
        ignore_keys=_USER_INFO_FETCH_BY_ID_STRICT_IGNORE_KEYS
        | frozenset({"mail"}),
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_user_info_update_own_nickname_length_over_64(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、更新、当前用户、nickname、length、over、64；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、更新、当前用户、nickname、length、over、64；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={"nickName": "n" * 2050},
    )
    assert_api.assert_error(resp, code=901, description="User info exceeds the data length")

@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_update_own_nickname_empty(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、更新、当前用户、nickname、空值参数；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、更新、当前用户、nickname、空值参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.updateOwnUserInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={"nickName": ""},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.updateOwnUserInfo.value,
            "device": _expected_device(client),
            "result": {
                "userId": user_a,
            },
        },
        ignore_keys=_USER_INFO_UPDATE_WITH_TYPE_IGNORE_KEYS | frozenset({"nickName"}),
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_fetch_by_id_normal(topology_primary_or_device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、拉取、by、id、normal；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、拉取、by、id、normal；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": [user_a, user_b]},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.fetchUserInfoById.value,
            "device": _expected_device(client),
            "result": {
                user_a: {"userId": user_a},
                user_b: {"userId": user_b},
            },
        },
        ignore_keys=_USER_INFO_FETCH_BY_ID_IGNORE_KEYS,
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_fetch_by_id_with_type_normal(topology_primary_or_device_a, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、拉取、by、id、with、type、normal；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoByIdWithType，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、拉取、by、id、with、type、normal；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoByIdWithType，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    resp = client.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={
            "userIds": [user_a, user_b],
            "userInfoTypes": [0, 5],
        },
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "UserInfoManager",
            "cmd": Cmd.fetchUserInfoByIdWithType.value,
            "device": _expected_device(client),
            "result": {
                user_a: {"userId": user_a},
                user_b: {"userId": user_b},
            },
        },
        ignore_keys=_USER_INFO_FETCH_BY_ID_IGNORE_KEYS,
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("user_info.subscribe_fetch_unsubscribe.success")
@pytest.mark.api("UserInfoManager.subscribeUsersInfo")
@pytest.mark.api("UserInfoManager.fetchSubscribedUsers")
@pytest.mark.api("UserInfoManager.unsubscribeUsersInfo")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_user_info_subscribe_fetch_and_unsubscribe_users_info(
    topology_primary_or_device_a, assert_api, user_b
):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、订阅、拉取、and、取消订阅、users、信息；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.subscribeUsersInfo、UserInfoManager.fetchSubscribedUsers、UserInfoManager.unsubscribeUsersInfo，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料查询/拉取场景所需的测试数据，场景为用户、信息、订阅、拉取、and、取消订阅、users、信息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.subscribeUsersInfo、UserInfoManager.fetchSubscribedUsers、UserInfoManager.unsubscribeUsersInfo，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    expected_device = _expected_device(client)
    subscribed = False
    try:
        subscribe_resp = client.call(
            "UserInfoManager",
            Cmd.subscribeUsersInfo.value,
            info={"userIds": [user_b]},
        )
        subscribe_error = assert_api.get_error(subscribe_resp)
        if (
            subscribe_error.get("code") == 505
            and "metadata subscription not allow"
            in str(subscribe_error.get("description", ""))
        ):
            pytest.skip("当前 appkey 未开通用户资料订阅服务：metadata subscription not allow")
        assert_api.assert_success(subscribe_resp)
        subscribed = True

        fetch_resp = client.call(
            "UserInfoManager",
            Cmd.fetchSubscribedUsers.value,
            info={},
        )
        assert_api.assert_response_matches(
            fetch_resp,
            expected={
                "manager": "UserInfoManager",
                "cmd": Cmd.fetchSubscribedUsers.value,
                "device": expected_device,
                "result": [{"userId": user_b}],
            },
            ignore_keys={
                "sequence",
                "ext",
                "avatarUrl",
                "phone",
                "birth",
                "nickName",
                "sign",
                "gender",
                "mail",
            },
        )

        unsubscribe_resp = client.call(
            "UserInfoManager",
            Cmd.unsubscribeUsersInfo.value,
            info={"userIds": [user_b]},
        )
        assert_api.assert_success(unsubscribe_resp)
        subscribed = False

        fetch_after_unsubscribe = client.call(
            "UserInfoManager",
            Cmd.fetchSubscribedUsers.value,
            info={},
        )
        assert_api.assert_response_matches(
            fetch_after_unsubscribe,
            expected={
                "manager": "UserInfoManager",
                "cmd": Cmd.fetchSubscribedUsers.value,
                "device": expected_device,
            },
            ignore_keys={"sequence", "result"},
        )
        subscribed_user_ids = {
            item.get("userId")
            for item in fetch_after_unsubscribe.get("result", [])
            if isinstance(item, dict)
        }
        assert user_b not in subscribed_user_ids
    finally:
        original_exc_type = sys.exc_info()[0]
        if subscribed:
            try:
                client.call(
                    "UserInfoManager",
                    Cmd.unsubscribeUsersInfo.value,
                    info={"userIds": [user_b]},
                )
            except Exception:
                if original_exc_type is None:
                    raise


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_user_info_fetch_by_id_empty_user_ids(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、拉取、by、id、空值参数、用户、ids；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、拉取、by、id、空值参数、用户、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": []},
    )
    assert_api.assert_error(resp, code=205, description="userIds is empty")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_user_info_fetch_by_id_user_ids_over_100(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、拉取、by、id、用户、ids、over；
    2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备用户资料异常/边界场景所需的测试数据，场景为用户、信息、拉取、by、id、用户、ids、over；\n'
        '2. 通过 WebSocket 控制测试 App 调用 UserInfoManager.fetchUserInfoById，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    user_ids = [f"uid_{i}" for i in range(101)]
    resp = topology_primary_or_device_a.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": user_ids},
    )
    assert_api.assert_error(resp, code=900, description=" The maximum number of user IDs is exceeded.")
