"""Real Web SDK/service PushManager E2E cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client, pytest.mark.real_web]


def test_real_web_push_preferred_notification_language(
    primary_device,
    assert_api,
):
    language_code = "zh-Hans"

    set_language = primary_device.call(
        "PushManager",
        Cmd.setPreferredNotificationLanguage.value,
        info={"code": language_code},
    )
    assert_api.assert_success(set_language)
    assert_api.assert_result_equals(set_language, None)

    fetched = primary_device.call(
        "PushManager",
        Cmd.fetchPreferredNotificationLanguage.value,
        info={},
    )
    assert_api.assert_result_equals(fetched, language_code)

    debug = assert_api.get_result(
        primary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "setPushPerformLanguage_success" in debug_types, debug
    assert "getPushPerformLanguage_success" in debug_types, debug


def test_real_web_push_silent_mode_for_all(
    primary_device,
    assert_api,
):
    set_all = primary_device.call(
        "PushManager",
        Cmd.setSilentModeForAll.value,
        info={"param": {"paramType": 0, "remindType": 1}},
    )
    assert_api.assert_success(set_all)
    assert_api.assert_result_equals(set_all, None)

    fetched = primary_device.call(
        "PushManager",
        Cmd.fetchSilentModeForAll.value,
        info={},
    )
    fetched_result = assert_api.get_result(fetched)
    assert isinstance(fetched_result, dict)
    assert fetched_result.get("convId") == ""
    assert fetched_result.get("conversationType") == 0
    assert fetched_result.get("remindType") == 1

    debug = assert_api.get_result(
        primary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "setSilentModeForAll_success" in debug_types, debug
    assert "getSilentModeForAll_success" in debug_types, debug


def test_real_web_push_conversation_silent_modes(
    primary_device,
    assert_api,
):
    conv_a = f"web-real-silent-a-{uuid.uuid4().hex[:8]}"
    conv_b = f"web-real-silent-b-{uuid.uuid4().hex[:8]}"

    set_conv = primary_device.call(
        "PushManager",
        Cmd.setConversationSilentMode.value,
        info={
            "convId": conv_a,
            "conversationType": 0,
            "param": {"paramType": 0, "remindType": 1},
        },
    )
    assert_api.assert_result_equals(set_conv, None)

    conv_mode = primary_device.call(
        "PushManager",
        Cmd.fetchConversationSilentMode.value,
        info={"convId": conv_a, "conversationType": 0},
    )
    assert_api.assert_result_matches(
        conv_mode,
        convId=conv_a,
        conversationType=0,
        remindType=1,
    )

    chat_remind = primary_device.call(
        "ChatManager",
        Cmd.conversationRemindType.value,
        info={"convId": conv_a, "conversationType": 0},
    )
    assert_api.assert_result_equals(chat_remind, 1)

    batch = primary_device.call(
        "PushManager",
        Cmd.fetchSilentModeForConversations.value,
        info={conv_a: 0, conv_b: 1},
    )
    batch_result = assert_api.get_result(batch)
    assert batch_result[conv_a]["convId"] == conv_a
    assert batch_result[conv_a]["conversationType"] == 0
    assert batch_result[conv_a]["remindType"] == 1
    assert batch_result[conv_b]["convId"] == conv_b
    assert batch_result[conv_b]["conversationType"] == 1
    assert batch_result[conv_b]["remindType"] == 0

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
        remindType=0,
    )

    debug = assert_api.get_result(
        primary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "setSilentModeForConversation_success" in debug_types, debug
    assert "getSilentModeForConversation_success" in debug_types, debug
    assert "getSilentModeForConversations_success" in debug_types, debug
    assert "clearRemindTypeForConversation_success" in debug_types, debug


def test_real_web_push_sync_conversations_silent_mode(
    primary_device,
    assert_api,
):
    sync_result = primary_device.call(
        "PushManager",
        Cmd.syncSilentModels.value,
        info={},
    )
    assert_api.assert_result_equals(sync_result, True)

    debug = assert_api.get_result(
        primary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "getSilentModeForAll_success" in debug_types, debug


def test_real_web_push_bind_device_token(
    primary_device,
    assert_api,
):
    notifier_name = f"web-notifier-{uuid.uuid4().hex[:8]}"
    device_token = f"web-device-token-{uuid.uuid4().hex}"

    bind_resp = primary_device.call(
        "PushManager",
        Cmd.bindDeviceToken.value,
        info={"notifierName": notifier_name, "deviceToken": device_token},
    )
    assert_api.assert_result_equals(bind_resp, None)

    debug = assert_api.get_result(
        primary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "uploadPushToken_success" in debug_types, debug
