"""Resolve SDK init options for bridge-controlled real E2E runs."""
from __future__ import annotations

from typing import Any

from .config import load_config


_KEY_MAP: dict[str, str] = {
    "app_key": "appKey",
    "auto_login": "autoLogin",
    "debug_mode": "debugModel",
    "enable_dns_config": "enableDNSConfig",
    "rest_server": "restServer",
    "im_server": "imServer",
    "im_port": "imPort",
    "web_socket_server": "webSocketServer",
    "web_socket_port": "webSocketPort",
    "sync_data_web_socket_server": "syncDataWebSocketServer",
    "sync_data_web_socket_port": "syncDataWebSocketPort",
    "enable_auto_sync_contacts": "enableAutoSyncContacts",
    "enable_user_info": "enableUserInfo",
    "require_ack": "requireAck",
    "require_delivery_ack": "requireDeliveryAck",
    "accept_invitation_always": "acceptInvitationAlways",
    "auto_accept_group_invitation": "autoAcceptGroupInvitation",
    "delete_messages_as_exit_group": "deleteMessagesAsExitGroup",
    "delete_messages_as_exit_chat_room": "deleteMessagesAsExitChatRoom",
    "is_auto_download": "isAutoDownload",
    "is_chat_room_owner_leave_allowed": "isChatRoomOwnerLeaveAllowed",
    "server_transfer": "serverTransfer",
    "sort_message_by_server_time": "sortMessageByServerTime",
    "using_https_only": "usingHttpsOnly",
    "load_empty_conversations": "loadEmptyConversations",
    "use_replaced_message_contents": "useReplacedMessageContents",
    "enable_tls": "enableTLS",
    "messages_receive_callback_include_send": "messagesReceiveCallbackIncludeSend",
    "regard_import_messages_as_read": "regardImportMessagesAsRead",
    "dns_url": "dnsUrl",
    "device_name": "deviceName",
    "os_type": "osType",
}

_BOOL_KEYS = {
    "auto_login",
    "debug_mode",
    "enable_dns_config",
    "enable_auto_sync_contacts",
    "enable_user_info",
    "require_ack",
    "require_delivery_ack",
    "accept_invitation_always",
    "auto_accept_group_invitation",
    "delete_messages_as_exit_group",
    "delete_messages_as_exit_chat_room",
    "is_auto_download",
    "is_chat_room_owner_leave_allowed",
    "server_transfer",
    "sort_message_by_server_time",
    "using_https_only",
    "load_empty_conversations",
    "use_replaced_message_contents",
    "enable_tls",
    "messages_receive_callback_include_send",
    "regard_import_messages_as_read",
}

_INT_KEYS = {
    "im_port",
    "web_socket_port",
    "sync_data_web_socket_port",
    "os_type",
}

_DEFAULTS: dict[str, Any] = {
    "autoLogin": True,
    "debugModel": False,
    "acceptInvitationAlways": False,
    "autoAcceptGroupInvitation": False,
    "deleteMessagesAsExitGroup": True,
    "deleteMessagesAsExitChatRoom": True,
    "enableDNSConfig": True,
    "enableAutoSyncContacts": False,
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


def resolve_sdk_init_options(
    platform: str,
    *,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return bridge Client.init options for a target platform.

    `platform` is accepted for call-site clarity and future platform validation.
    The current schema is intentionally platform-neutral: tests express SDK init
    semantics once, and the Flutter/platform wrappers map them to real SDK init.
    """
    if not platform:
        raise ValueError("platform must not be empty")
    cfg = config if config is not None else load_config()
    raw = cfg.get("sdk_options") or {}
    if not isinstance(raw, dict):
        raise TypeError("sdk_options must be a mapping")

    unknown = sorted(set(raw) - set(_KEY_MAP))
    if unknown:
        raise KeyError(f"Unknown sdk_options key(s): {', '.join(unknown)}")

    app_key = raw.get("app_key")
    if not isinstance(app_key, str) or not app_key.strip():
        raise ValueError("sdk_options.app_key must be a non-empty string")

    resolved: dict[str, Any] = dict(_DEFAULTS)
    for source_key, target_key in _KEY_MAP.items():
        if source_key not in raw or raw[source_key] is None:
            continue
        value = raw[source_key]
        if source_key in _BOOL_KEYS and not isinstance(value, bool):
            raise TypeError(f"sdk_options.{source_key} must be bool")
        if source_key in _INT_KEYS and not isinstance(value, int):
            raise TypeError(f"sdk_options.{source_key} must be int")
        if source_key == "app_key":
            value = value.strip()
        resolved[target_key] = value

    if platform == "web" and not resolved.get("restServer"):
        rest_api = cfg.get("rest_api") or {}
        if isinstance(rest_api, dict):
            rest_base_url = rest_api.get("base_url")
            if isinstance(rest_base_url, str) and rest_base_url.strip():
                resolved["restServer"] = rest_base_url.strip()
    return resolved
