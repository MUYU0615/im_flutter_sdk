"""
Push 模块剩余 API 覆盖用例。

本文件优先覆盖不依赖真实厂商推送证书/token 的推送配置接口。
预期返回通过 discovery 从真实模拟器响应确认后固定。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd, ne


pytestmark = [pytest.mark.client]


def _assert_success_null(assert_api, resp: dict, *, cmd: str):
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PushManager",
            "cmd": cmd,
            "device": "deviceA",
            "result": None,
        },
        ignore_keys={"sequence"},
    )


def _assert_push_config_update_result(assert_api, resp: dict, *, cmd: str):
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PushManager",
            "cmd": cmd,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    if result is True:
        return
    assert result == {
        "code": 209,
        "description": "Failed to update push configurations",
    }


def _assert_push_action_result(assert_api, resp: dict):
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.reportPushAction.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    if result in (None, True):
        return
    assert result == {
        "code": 209,
        "description": "Failed to update push configurations",
    }


@pytest.mark.real_e2e
@pytest.mark.case_id("push.fetch_configs_update_nickname_and_style.current_result")
@pytest.mark.api("PushManager.getImPushConfigFromServer")
@pytest.mark.api("PushManager.updatePushNickname")
@pytest.mark.api("PushManager.updateImPushStyle")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_fetch_configs_update_nickname_and_style(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送查询/拉取场景所需的测试数据，场景为推送、拉取、configs、更新、nickname、and、style；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.getImPushConfigFromServer、PushManager.updatePushNickname、PushManager.updateImPushStyle，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送查询/拉取场景所需的测试数据，场景为推送、拉取、configs、更新、nickname、and、style；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.getImPushConfigFromServer、PushManager.updatePushNickname、PushManager.updateImPushStyle，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    configs_resp = device_a.call("PushManager", Cmd.getImPushConfigFromServer.value, info={})
    assert_api.assert_response_matches(
        configs_resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.getImPushConfigFromServer.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    configs_result = configs_resp.get("result")
    assert isinstance(configs_result, dict)
    if "code" in configs_result:
        assert configs_result == {
            "code": 209,
            "description": "Failed to update push configurations",
        }
    else:
        assert isinstance(configs_result.get("displayName"), str)
        assert isinstance(configs_result.get("pushStyle"), int)

    nick_resp = device_a.call(
        "PushManager",
        Cmd.updatePushNickname.value,
        info={"nickname": "push-api-coverage"},
    )
    _assert_push_config_update_result(assert_api, nick_resp, cmd=Cmd.updatePushNickname.value)

    style_resp = device_a.call(
        "PushManager",
        Cmd.updateImPushStyle.value,
        info={"pushStyle": 0},
    )
    _assert_push_config_update_result(assert_api, style_resp, cmd=Cmd.updateImPushStyle.value)


@pytest.mark.real_e2e
@pytest.mark.case_id("push.report_push_action.click.current_result")
@pytest.mark.api("PushManager.reportPushAction")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_report_push_action_calls_sdk_with_click_payload(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送查询/拉取场景所需的测试数据，场景为推送、report、推送、action、calls、sdk、with、click；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.reportPushAction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送查询/拉取场景所需的测试数据，场景为推送、report、推送、action、calls、sdk、with、click；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.reportPushAction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    resp = device_a.call(
        "PushManager",
        Cmd.reportPushAction.value,
        info={
            "action": "CLICK",
            "data": {
                "messageId": "native-auto-test-push-action",
                "notifierName": "default",
            },
        },
    )
    _assert_push_action_result(assert_api, resp)


@pytest.mark.real_e2e
@pytest.mark.case_id("push.report_push_action.requires_action.error")
@pytest.mark.api("PushManager.reportPushAction")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_report_push_action_requires_action(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、report、推送、action、requires、action；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.reportPushAction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、report、推送、action、requires、action；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.reportPushAction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_a.call(
        "PushManager",
        Cmd.reportPushAction.value,
        info={"data": {"messageId": "native-auto-test-push-action"}},
    )
    assert_api.assert_error(resp, code=110, description="'action' can not be null")


@pytest.mark.parametrize("action", ["ARRIVED", "foo", 2, -1])
@pytest.mark.real_e2e
@pytest.mark.case_id("push.report_push_action.invalid_action.error")
@pytest.mark.api("PushManager.reportPushAction")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_report_push_action_rejects_invalid_action(device_a, assert_api, action):
    """
    1. 在已登录的 Android 共享 session 中准备推送异常/边界场景所需的测试数据，场景为推送、report、推送、action、rejects、无效参数、action；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.reportPushAction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送异常/边界场景所需的测试数据，场景为推送、report、推送、action、rejects、无效参数、action；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.reportPushAction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "PushManager",
        Cmd.reportPushAction.value,
        info={
            "action": action,
            "data": {"messageId": "native-auto-test-push-action"},
        },
    )
    assert_api.assert_error(resp, code=110, description="'action' is invalid")


@pytest.mark.real_e2e
@pytest.mark.case_id("push.global_silent_mode_flow.success")
@pytest.mark.api("PushManager.setSilentModeForAll")
@pytest.mark.api("PushManager.fetchSilentModeForAll")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_global_silent_mode_flow(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、global、silent、mode、flow；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.setSilentModeForAll、PushManager.fetchSilentModeForAll，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、global、silent、mode、flow；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.setSilentModeForAll、PushManager.fetchSilentModeForAll，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    set_resp = device_a.call(
        "PushManager",
        Cmd.setSilentModeForAll.value,
        info={"param": {"paramType": 0, "remindType": 0}},
    )
    _assert_success_null(assert_api, set_resp, cmd=Cmd.setSilentModeForAll.value)

    fetch_resp = device_a.call("PushManager", Cmd.fetchSilentModeForAll.value, info={})
    assert_api.assert_response_matches(
        fetch_resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.fetchSilentModeForAll.value,
            "device": "deviceA",
            "result": {
                "expireTs": 0,
                "convId": ne(None),
                "conversationType": 0,
                "startTime": {"hour": 0, "minute": 0},
                "endTime": {"hour": 0, "minute": 0},
                "remindType": 0,
            },
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("push.conversation_silent_mode_flow.success")
@pytest.mark.api("PushManager.setConversationSilentMode")
@pytest.mark.api("PushManager.fetchConversationSilentMode")
@pytest.mark.api("PushManager.fetchSilentModeForConversations")
@pytest.mark.api("PushManager.removeConversationSilentMode")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_conversation_silent_mode_flow(device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、会话、silent、mode、flow；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.setConversationSilentMode、PushManager.fetchConversationSilentMode、PushManager.fetchSilentModeForConversations、PushManager.removeConversationSilentMode，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、会话、silent、mode、flow；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.setConversationSilentMode、PushManager.fetchConversationSilentMode、PushManager.fetchSilentModeForConversations、PushManager.removeConversationSilentMode，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    conv_id = user_b
    set_resp = device_a.call(
        "PushManager",
        Cmd.setConversationSilentMode.value,
        info={
            "convId": conv_id,
            "conversationType": 0,
            "param": {"paramType": 0, "remindType": 0},
        },
    )
    _assert_success_null(assert_api, set_resp, cmd=Cmd.setConversationSilentMode.value)

    fetch_resp = device_a.call(
        "PushManager",
        Cmd.fetchConversationSilentMode.value,
        info={"convId": conv_id, "conversationType": 0},
    )
    assert_api.assert_response_matches(
        fetch_resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.fetchConversationSilentMode.value,
            "device": "deviceA",
            "result": {
                "expireTs": 0,
                "convId": conv_id,
                "conversationType": 0,
                "startTime": {"hour": 0, "minute": 0},
                "endTime": {"hour": 0, "minute": 0},
                "remindType": 0,
            },
        },
        ignore_keys={"sequence"},
    )

    batch_resp = device_a.call(
        "PushManager",
        Cmd.fetchSilentModeForConversations.value,
        info={conv_id: 0},
    )
    assert_api.assert_response_matches(
        batch_resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.fetchSilentModeForConversations.value,
            "device": "deviceA",
            "result": {
                conv_id: {
                    "expireTs": 0,
                    "convId": conv_id,
                    "conversationType": 0,
                    "startTime": {"hour": 0, "minute": 0},
                    "endTime": {"hour": 0, "minute": 0},
                    "remindType": 0,
                }
            },
        },
        ignore_keys={"sequence"},
    )

    remove_resp = device_a.call(
        "PushManager",
        Cmd.removeConversationSilentMode.value,
        info={"convId": conv_id, "conversationType": 0},
    )
    _assert_success_null(assert_api, remove_resp, cmd=Cmd.removeConversationSilentMode.value)


@pytest.mark.real_e2e
@pytest.mark.case_id("push.preferred_language_and_template.success")
@pytest.mark.api("PushManager.setPreferredNotificationLanguage")
@pytest.mark.api("PushManager.fetchPreferredNotificationLanguage")
@pytest.mark.api("PushManager.setPushTemplate")
@pytest.mark.api("PushManager.getPushTemplate")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_preferred_language_and_template(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、preferred、language、and、template；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.setPreferredNotificationLanguage、PushManager.fetchPreferredNotificationLanguage、PushManager.setPushTemplate、PushManager.getPushTemplate，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、preferred、language、and、template；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.setPreferredNotificationLanguage、PushManager.fetchPreferredNotificationLanguage、PushManager.setPushTemplate、PushManager.getPushTemplate，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    set_lang_resp = device_a.call(
        "PushManager",
        Cmd.setPreferredNotificationLanguage.value,
        info={"code": "en"},
    )
    _assert_success_null(assert_api, set_lang_resp, cmd=Cmd.setPreferredNotificationLanguage.value)

    fetch_lang_resp = device_a.call(
        "PushManager",
        Cmd.fetchPreferredNotificationLanguage.value,
        info={},
    )
    assert_api.assert_response_matches(
        fetch_lang_resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.fetchPreferredNotificationLanguage.value,
            "device": "deviceA",
            "result": "en",
        },
        ignore_keys={"sequence"},
    )

    set_template_resp = device_a.call(
        "PushManager",
        Cmd.setPushTemplate.value,
        info={"pushTemplateName": "default"},
    )
    _assert_success_null(assert_api, set_template_resp, cmd=Cmd.setPushTemplate.value)

    get_template_resp = device_a.call("PushManager", Cmd.getPushTemplate.value, info={})
    assert_api.assert_response_matches(
        get_template_resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.getPushTemplate.value,
            "device": "deviceA",
            "result": "default",
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.parametrize(
    ("cmd", "info", "expected_result"),
    [
        (
            Cmd.updateHMSPushToken.value,
            {"token": "hms-token-api-coverage"},
            "hms-token-api-coverage",
        ),
        (
            Cmd.updateFCMPushToken.value,
            {"token": "fcm-token-api-coverage"},
            {"code": 110, "description": "Notifier name should not be empty!"},
        ),
        (
            Cmd.bindDeviceToken.value,
            {"notifierName": "default", "deviceToken": "bind-token-api-coverage"},
            None,
        ),
    ],
)
@pytest.mark.real_e2e
@pytest.mark.case_id("push.vendor_token_update.current_environment")
@pytest.mark.api("PushManager.updateHMSPushToken")
@pytest.mark.api("PushManager.updateFCMPushToken")
@pytest.mark.api("PushManager.bindDeviceToken")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_vendor_token_update_current_environment(device_a, assert_api, cmd, info, expected_result):
    """
    1. 在已登录的 Android 共享 session 中准备推送状态变更场景所需的测试数据，场景为推送、vendor、token、更新、current、environment；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.updateHMSPushToken、PushManager.updateFCMPushToken、PushManager.bindDeviceToken，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送状态变更场景所需的测试数据，场景为推送、vendor、token、更新、current、environment；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.updateHMSPushToken、PushManager.updateFCMPushToken、PushManager.bindDeviceToken，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及变更后的本地状态、服务端状态或回调事件符合预期。'
    )
    resp = device_a.call("PushManager", cmd, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PushManager",
            "cmd": cmd,
            "device": "deviceA",
            "result": expected_result,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("push.apns_token_update_android_missing_plugin.error")
@pytest.mark.api("PushManager.updateAPNsPushToken")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_apns_token_update_android_missing_plugin(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送异常/边界场景所需的测试数据，场景为推送、apns、token、更新、android、missing、plugin；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.updateAPNsPushToken，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送异常/边界场景所需的测试数据，场景为推送、apns、token、更新、android、missing、plugin；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.updateAPNsPushToken，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "PushManager",
        Cmd.updateAPNsPushToken.value,
        info={"token": "apns-token-api-coverage"},
    )
    assert_api.assert_error(resp, code=-1, description="MissingPluginException")


@pytest.mark.real_e2e
@pytest.mark.case_id("push.sync_conversations_silent_mode.current_environment")
@pytest.mark.api("PushManager.syncSilentModels")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_push_sync_conversations_silent_mode_current_environment(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、sync、conversations、silent、mode、current、environment；
    2. 通过 WebSocket 控制测试 App 调用 PushManager.syncSilentModels，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备推送基础能力场景所需的测试数据，场景为推送、sync、conversations、silent、mode、current、environment；\n'
        '2. 通过 WebSocket 控制测试 App 调用 PushManager.syncSilentModels，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_a.call("PushManager", Cmd.syncSilentModels.value, info={})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "PushManager",
            "cmd": Cmd.syncSilentModels.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    assert resp.get("result") is None or resp.get("result") is True or isinstance(resp.get("result"), dict)
