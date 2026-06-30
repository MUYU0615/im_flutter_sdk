"""Web PushManager local state regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web]


def test_web_push_local_config_and_language(primary_device, assert_api, require_capability):
    for cmd in (
        Cmd.getImPushConfig,
        Cmd.updateImPushStyle,
        Cmd.updatePushNickname,
        Cmd.setPreferredNotificationLanguage,
        Cmd.fetchPreferredNotificationLanguage,
    ):
        require_capability("PushManager", cmd.value)

    nickname = f"web-push-{uuid.uuid4().hex[:8]}"
    update_style = primary_device.call(
        "PushManager",
        Cmd.updateImPushStyle.value,
        info={"pushStyle": 1},
    )
    assert_api.assert_result_equals(update_style, None)

    update_nickname = primary_device.call(
        "PushManager",
        Cmd.updatePushNickname.value,
        info={"nickname": nickname},
    )
    assert_api.assert_result_equals(update_nickname, None)

    config = primary_device.call("PushManager", Cmd.getImPushConfig.value, info={})
    assert_api.assert_result_matches(config, pushStyle=1, displayName=nickname)

    set_language = primary_device.call(
        "PushManager",
        Cmd.setPreferredNotificationLanguage.value,
        info={"code": "zh-Hans"},
    )
    assert_api.assert_result_equals(set_language, None)

    language = primary_device.call(
        "PushManager",
        Cmd.fetchPreferredNotificationLanguage.value,
        info={},
    )
    assert_api.assert_result_equals(language, "zh-Hans")


def test_web_push_server_config_template_and_token_state(primary_device, assert_api, require_capability):
    for cmd in (
        Cmd.getImPushConfigFromServer,
        Cmd.updateHMSPushToken,
        Cmd.updateFCMPushToken,
        Cmd.updateAPNsPushToken,
        Cmd.reportPushAction,
        Cmd.setPushTemplate,
        Cmd.getPushTemplate,
        Cmd.bindDeviceToken,
    ):
        require_capability("PushManager", cmd.value)

    nickname = f"web-push-server-{uuid.uuid4().hex[:8]}"
    template = f"web-template-{uuid.uuid4().hex[:8]}"

    assert_api.assert_result_equals(
        primary_device.call("PushManager", Cmd.updateImPushStyle.value, info={"pushStyle": 1}),
        None,
    )
    assert_api.assert_result_equals(
        primary_device.call("PushManager", Cmd.updatePushNickname.value, info={"nickname": nickname}),
        None,
    )

    server_config = primary_device.call("PushManager", Cmd.getImPushConfigFromServer.value, info={})
    assert_api.assert_result_matches(server_config, pushStyle=1, displayName=nickname)

    for cmd, token in (
        (Cmd.updateHMSPushToken, "web-hms-token"),
        (Cmd.updateFCMPushToken, "web-fcm-token"),
        (Cmd.updateAPNsPushToken, "web-apns-token"),
    ):
        assert_api.assert_result_equals(
            primary_device.call("PushManager", cmd.value, info={"token": token}),
            None,
        )

    bind_resp = primary_device.call(
        "PushManager",
        Cmd.bindDeviceToken.value,
        info={"notifierName": "web-notifier", "deviceToken": "web-device-token"},
    )
    assert_api.assert_result_equals(bind_resp, None)

    report_resp = primary_device.call(
        "PushManager",
        Cmd.reportPushAction.value,
        info={"action": "opened", "messageId": "web-push-msg"},
    )
    assert_api.assert_result_equals(report_resp, None)

    assert_api.assert_result_equals(
        primary_device.call("PushManager", Cmd.setPushTemplate.value, info={"pushTemplateName": template}),
        None,
    )
    assert_api.assert_result_equals(
        primary_device.call("PushManager", Cmd.getPushTemplate.value, info={}),
        template,
    )


def test_web_push_local_silent_modes(primary_device, assert_api, require_capability):
    for cmd in (
        Cmd.setConversationSilentMode,
        Cmd.removeConversationSilentMode,
        Cmd.fetchConversationSilentMode,
        Cmd.setSilentModeForAll,
        Cmd.fetchSilentModeForAll,
        Cmd.fetchSilentModeForConversations,
    ):
        require_capability("PushManager", cmd.value)

    conv_a = f"web-conv-a-{uuid.uuid4().hex[:8]}"
    conv_b = f"web-conv-b-{uuid.uuid4().hex[:8]}"

    set_all = primary_device.call(
        "PushManager",
        Cmd.setSilentModeForAll.value,
        info={"param": {"paramType": 0, "remindType": 1}},
    )
    assert_api.assert_result_equals(set_all, None)

    all_mode = primary_device.call("PushManager", Cmd.fetchSilentModeForAll.value, info={})
    assert_api.assert_result_matches(all_mode, convId="", conversationType=0, remindType=1)

    set_conv = primary_device.call(
        "PushManager",
        Cmd.setConversationSilentMode.value,
        info={
            "convId": conv_a,
            "conversationType": 0,
            "param": {"paramType": 0, "remindType": 2},
        },
    )
    assert_api.assert_result_equals(set_conv, None)

    conv_mode = primary_device.call(
        "PushManager",
        Cmd.fetchConversationSilentMode.value,
        info={"convId": conv_a, "conversationType": 0},
    )
    assert_api.assert_result_matches(conv_mode, convId=conv_a, conversationType=0, remindType=2)

    batch = primary_device.call(
        "PushManager",
        Cmd.fetchSilentModeForConversations.value,
        info={conv_a: 0, conv_b: 1},
    )
    batch_result = assert_api.get_result(batch)
    assert batch_result[conv_a]["remindType"] == 2
    assert batch_result[conv_b]["convId"] == conv_b
    assert batch_result[conv_b]["conversationType"] == 1
    assert batch_result[conv_b]["remindType"] == 1

    remove = primary_device.call(
        "PushManager",
        Cmd.removeConversationSilentMode.value,
        info={"convId": conv_a, "conversationType": 0},
    )
    assert_api.assert_result_equals(remove, None)

    conv_after_remove = primary_device.call(
        "PushManager",
        Cmd.fetchConversationSilentMode.value,
        info={"convId": conv_a, "conversationType": 0},
    )
    assert_api.assert_result_matches(
        conv_after_remove,
        convId=conv_a,
        conversationType=0,
        remindType=1,
    )
