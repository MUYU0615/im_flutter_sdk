"""
Client 剩余 API 覆盖用例。

本文件优先补充不会破坏当前 session 登录态的查询类和配置类方法。
所有预期返回值先通过 discovery 从真实模拟器响应确认，再在严格模式下冻结。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from src.tools.config import get_sdk_app_key


pytestmark = [pytest.mark.client]


@pytest.mark.real_e2e
@pytest.mark.case_id("client.connection_state_queries.success")
@pytest.mark.api("Client.isConnected")
@pytest.mark.api("Client.isLoggedInBefore")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_connection_state_queries(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、connection、state、queries；
    2. 通过 WebSocket 控制测试 App 调用 Client.isConnected、Client.isLoggedInBefore，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、connection、state、queries；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.isConnected、Client.isLoggedInBefore，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    connected_resp = device_a.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_response_matches(
        connected_resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.isConnected.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )

    login_before_resp = device_a.call("Client", Cmd.isLoggedInBefore.value, info={})
    assert_api.assert_response_matches(
        login_before_resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.isLoggedInBefore.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("client.init.repeated_call.current_bool")
@pytest.mark.api("Client.init")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_init_repeated_call_idempotent(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、init、repeated、call、idempotent；
    2. 通过 WebSocket 控制测试 App 调用 Client.init，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、init、repeated、call、idempotent；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.init，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    app_key = get_sdk_app_key()
    assert app_key, "config.yaml sdk_options.app_key 不能为空"
    resp = device_a.call(
        "Client",
        Cmd.init.value,
        info={"appKey": app_key, "debugModel": True},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.init.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp.get("result"), bool), f"重复 init 当前端返回应为 bool: {resp}"

    current_user_resp = device_a.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_response_matches(
        current_user_resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.getCurrentUser.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    assert current_user_resp.get("result"), "重复 init 后当前登录用户不应被清空"


@pytest.mark.real_e2e
@pytest.mark.case_id("client.current_token_and_device_id.success")
@pytest.mark.api("Client.getToken")
@pytest.mark.api("Client.getCurrentDeviceId")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_current_token_and_device_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、current、token、and、device、id；
    2. 通过 WebSocket 控制测试 App 调用 Client.getToken、Client.getCurrentDeviceId，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、current、token、and、device、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.getToken、Client.getCurrentDeviceId，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    token_resp = device_a.call("Client", Cmd.getToken.value, info={})
    assert_api.assert_response_matches(
        token_resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.getToken.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(token_resp.get("result"), str)
    assert token_resp["result"], "getToken 应返回非空 token 字符串"

    device_id_resp = device_a.call("Client", Cmd.getCurrentDeviceId.value, info={})
    assert_api.assert_response_matches(
        device_id_resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.getCurrentDeviceId.value,
            "device": "deviceA",
            "result": {"resource": "", "deviceName": ""},
        },
        ignore_keys={"sequence", "deviceUUID"},
    )
    device_info = device_id_resp.get("result")
    assert isinstance(device_info, dict)
    assert isinstance(device_info.get("deviceUUID"), str)
    assert device_info["deviceUUID"], "getCurrentDeviceId 应返回非空 deviceUUID"


@pytest.mark.real_e2e
@pytest.mark.case_id("client.compress_logs.returns_path")
@pytest.mark.api("Client.compressLogs")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_compress_logs_returns_path(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、compress、logs、returns、path；
    2. 通过 WebSocket 控制测试 App 调用 Client.compressLogs，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、compress、logs、returns、path；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.compressLogs，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_a.call("Client", Cmd.compressLogs.value, info={})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "Client",
            "cmd": Cmd.compressLogs.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp.get("result"), str)
    assert resp["result"], "compressLogs 应返回非空路径字符串"


@pytest.mark.real_e2e
@pytest.mark.case_id("client.create_account.empty_user_boundary.error")
@pytest.mark.api("Client.createAccount")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_create_account_empty_user_boundary(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备客户端异常/边界场景所需的测试数据，场景为client、创建、account、空值参数、用户、boundary；
    2. 通过 WebSocket 控制测试 App 调用 Client.createAccount，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端异常/边界场景所需的测试数据，场景为client、创建、account、空值参数、用户、boundary；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.createAccount，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "Client",
        Cmd.createAccount.value,
        info={"userId": "", "password": ""},
    )
    assert_api.assert_error(resp, code=205, description="illegal user name")


@pytest.mark.parametrize(
    ("cmd", "info"),
    [
        (Cmd.updateUsingHttpsOnlySetting.value, {"usingHttpsOnly": False}),
        (Cmd.updateLoginExtensionInfo.value, {"extension": "client-api-coverage"}),
        (
            Cmd.updateDeleteMessagesWhenLeaveGroupSetting.value,
            {"deleteMessagesWhenLeaveGroup": True},
        ),
        (
            Cmd.updateDeleteMessageWhenLeaveRoomSetting.value,
            {"deleteMessageWhenLeaveRoom": True},
        ),
        (Cmd.updateRoomOwnerCanLeaveSetting.value, {"roomOwnerCanLeave": True}),
        (
            Cmd.updateAutoAcceptGroupInvitationSetting.value,
            {"autoAcceptGroupInvitation": True},
        ),
        (Cmd.updateAcceptInvitationAlways.value, {"acceptInvitationAlways": True}),
        (
            Cmd.updateAutoDownloadAttachmentThumbnailSetting.value,
            {"autoDownloadThumbnail": True},
        ),
        (Cmd.updateRequireAckSetting.value, {"requireAck": True}),
        (Cmd.updateDeliveryAckSetting.value, {"requireDeliveryAck": True}),
        (
            Cmd.updateSortMessageByServerTimeSetting.value,
            {"sortMessageByServerTime": True},
        ),
        (
            Cmd.updateMessagesReceiveCallbackIncludeSendSetting.value,
            {"includeSend": True},
        ),
        (Cmd.updateRegradeMessagesSetting.value, {"isRead": True}),
    ],
)
@pytest.mark.real_e2e
@pytest.mark.case_id("client.update_runtime_setting.success")
@pytest.mark.api("Client.updateUsingHttpsOnlySetting")
@pytest.mark.api("Client.updateLoginExtensionInfo")
@pytest.mark.api("Client.updateDeleteMessagesWhenLeaveGroupSetting")
@pytest.mark.api("Client.updateDeleteMessageWhenLeaveRoomSetting")
@pytest.mark.api("Client.updateRoomOwnerCanLeaveSetting")
@pytest.mark.api("Client.updateAutoAcceptGroupInvitationSetting")
@pytest.mark.api("Client.updateAcceptInvitationAlways")
@pytest.mark.api("Client.updateAutoDownloadAttachmentThumbnailSetting")
@pytest.mark.api("Client.updateRequireAckSetting")
@pytest.mark.api("Client.updateDeliveryAckSetting")
@pytest.mark.api("Client.updateSortMessageByServerTimeSetting")
@pytest.mark.api("Client.updateMessagesReceiveCallbackIncludeSendSetting")
@pytest.mark.api("Client.updateRegradeMessagesSetting")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_update_runtime_setting_success(device_a, assert_api, cmd, info):
    """
    1. 在已登录的 Android 共享 session 中准备客户端状态变更场景所需的测试数据，场景为client、更新、runtime、setting、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 Client.updateUsingHttpsOnlySetting、Client.updateLoginExtensionInfo、Client.updateDeleteMessagesWhenLeaveGroupSetting、Client.updateDeleteMessageWhenLeaveRoomSetting，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端状态变更场景所需的测试数据，场景为client、更新、runtime、setting、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.updateUsingHttpsOnlySetting、Client.updateLoginExtensionInfo、Client.updateDeleteMessagesWhenLeaveGroupSetting、Client.updateDeleteMessageWhenLeaveRoomSetting，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    resp = device_a.call("Client", cmd, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "Client",
            "cmd": cmd,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.parametrize(
    ("cmd", "info", "expected_result"),
    [
        # renewToken：空 token 边界，不改变当前密码登录态。
        (
            Cmd.renewToken.value,
            {"agora_token": ""},
            {"code": 104, "description": "New token is invalid"},
        ),
        # changeAppKey：已登录状态下修改 appKey 的非法状态边界。
        (
            Cmd.changeAppKey.value,
            {"appKey": ""},
            {"code": 110, "description": "appkey is null or empty"},
        ),
        # getLoggedInDevicesFromServer/fetchLoggedInDevices：错误账号密码边界。
        (
            Cmd.getLoggedInDevicesFromServer.value,
            {"userId": "__invalid_user__", "password": "__invalid_pwd__", "isPwd": True},
            {"code": 204, "description": "User does not exist"},
        ),
        # kickDevice：错误账号密码与空 resource 边界，不影响当前设备。
        (
            Cmd.kickDevice.value,
            {
                "userId": "__invalid_user__",
                "password": "__invalid_pwd__",
                "resource": "",
                "isPwd": True,
            },
            {"code": 205, "description": "Invalid parameter"},
        ),
        # kickAllDevices：错误账号密码边界，不影响当前设备。
        (
            Cmd.kickAllDevices.value,
            {"userId": "__invalid_user__", "password": "__invalid_pwd__", "isPwd": True},
            {"code": 204, "description": "User does not exist"},
        ),
        # loginWithAgoraToken：非法账号与空 token 边界，不应切换当前密码登录态。
        (
            Cmd.loginWithAgoraToken.value,
            {"userId": "__invalid_user__", "agora_token": ""},
            {"code": 110, "description": "username or token is null or empty!"},
        ),
    ],
)
@pytest.mark.real_e2e
@pytest.mark.case_id("client.session_sensitive_api_boundaries.error")
@pytest.mark.api("Client.renewToken")
@pytest.mark.api("Client.changeAppKey")
@pytest.mark.api("Client.getLoggedInDevicesFromServer")
@pytest.mark.api("Client.kickDevice")
@pytest.mark.api("Client.kickAllDevices")
@pytest.mark.api("Client.loginWithAgoraToken")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_client_session_sensitive_api_boundaries(device_a, assert_api, cmd, info, expected_result):
    """
    1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、session、sensitive、api、boundaries；
    2. 通过 WebSocket 控制测试 App 调用 Client.renewToken、Client.changeAppKey、Client.getLoggedInDevicesFromServer、Client.kickDevice，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备客户端基础能力场景所需的测试数据，场景为client、session、sensitive、api、boundaries；\n'
        '2. 通过 WebSocket 控制测试 App 调用 Client.renewToken、Client.changeAppKey、Client.getLoggedInDevicesFromServer、Client.kickDevice，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_a.call("Client", cmd, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "Client",
            "cmd": cmd,
            "device": "deviceA",
            "result": expected_result,
        },
        ignore_keys={"sequence"},
    )
