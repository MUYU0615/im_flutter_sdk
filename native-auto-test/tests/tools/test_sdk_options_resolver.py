from __future__ import annotations

import pytest

from src.tools.sdk_options_resolver import resolve_sdk_init_options


pytestmark = pytest.mark.no_global_login


def test_resolve_sdk_init_options_converts_common_keys():
    config = {
        "sdk_options": {
            "app_key": "easemob#dutest",
            "auto_login": False,
            "debug_mode": True,
            "enable_dns_config": False,
            "rest_server": "https://a1.easemob.com",
            "im_server": "im-api-wechat.easemob.com",
            "im_port": 6717,
            "web_socket_server": "im-api-wechat.easemob.com",
            "web_socket_port": 80,
            "sync_data_web_socket_server": "sync.example.com",
            "sync_data_web_socket_port": 443,
            "enable_auto_sync_contacts": True,
            "enable_user_info": True,
            "require_ack": True,
        }
    }

    resolved = resolve_sdk_init_options("android", config=config)

    assert resolved == {
        "appKey": "easemob#dutest",
        "autoLogin": False,
        "debugModel": True,
        "acceptInvitationAlways": False,
        "autoAcceptGroupInvitation": False,
        "deleteMessagesAsExitGroup": True,
        "deleteMessagesAsExitChatRoom": True,
        "enableDNSConfig": False,
        "restServer": "https://a1.easemob.com",
        "imServer": "im-api-wechat.easemob.com",
        "imPort": 6717,
        "webSocketServer": "im-api-wechat.easemob.com",
        "webSocketPort": 80,
        "syncDataWebSocketServer": "sync.example.com",
        "syncDataWebSocketPort": 443,
        "enableAutoSyncContacts": True,
        "enableUserInfo": True,
        "isAutoDownload": True,
        "isChatRoomOwnerLeaveAllowed": True,
        "requireAck": True,
        "requireDeliveryAck": False,
        "serverTransfer": True,
        "sortMessageByServerTime": True,
        "usingHttpsOnly": False,
        "loadEmptyConversations": False,
        "useReplacedMessageContents": False,
        "enableTLS": False,
        "messagesReceiveCallbackIncludeSend": False,
        "regardImportMessagesAsRead": False,
        "pushConfig": {},
        "areaCode": -1,
    }


def test_resolve_sdk_init_options_rejects_missing_app_key():
    with pytest.raises(ValueError, match="sdk_options.app_key"):
        resolve_sdk_init_options("android", config={"sdk_options": {}})


def test_resolve_sdk_init_options_rejects_invalid_bool():
    config = {"sdk_options": {"app_key": "easemob#dutest", "auto_login": "yes"}}

    with pytest.raises(TypeError, match="auto_login"):
        resolve_sdk_init_options("android", config=config)


def test_resolve_sdk_init_options_rejects_invalid_port():
    config = {"sdk_options": {"app_key": "easemob#dutest", "web_socket_port": "80"}}

    with pytest.raises(TypeError, match="web_socket_port"):
        resolve_sdk_init_options("android", config=config)


def test_resolve_sdk_init_options_rejects_unknown_keys():
    config = {"sdk_options": {"app_key": "easemob#dutest", "web_sdk_mode": "real_sdk"}}

    with pytest.raises(KeyError, match="web_sdk_mode"):
        resolve_sdk_init_options("web", config=config)
