"""Web real SDK 登录探针，用于隔离 global_login fixture 与 runtime/login 本体问题。"""

from __future__ import annotations

import time
import uuid

import pytest

from src import Cmd
from src.rest_api.user_api import get_user_access_token
from src.rest_api.chatroom_api import delete_chat_room
from tests.chat._utils import build_text


pytestmark = [
    pytest.mark.web,
    pytest.mark.client,
    pytest.mark.real_web,
    pytest.mark.no_global_login,
]


def test_real_web_init_only_without_global_login(primary_device, assert_api):
    status = primary_device.call("Client", "getRealSdkStatus", info={})
    result = assert_api.get_result(status)
    assert isinstance(result, dict)
    assert result["available"] is True

    init = primary_device.call(
        "Client",
        Cmd.init.value,
        info={
            "appKey": "easemob#dutest",
            "webSdkMode": "real_sdk",
            "enableDNSConfig": True,
        },
    )
    assert_api.assert_result_equals(init, True)


def test_real_web_runtime_status_without_global_login(primary_device, assert_api):
    status = primary_device.call("Client", "getRealSdkStatus", info={})
    result = assert_api.get_result(status)
    assert isinstance(result, dict)
    assert result["available"] is True
    assert result["sdkMode"] == "real_sdk"

    debug = primary_device.call("Client", "getRealSdkDebug", info={})
    events = assert_api.get_result(debug)
    assert isinstance(events, list)
    assert any(
        event.get("type") in {"bridge_init_requested", "init_enter"}
        for event in events
    )


def test_real_web_dump_chatroom_manager_methods_without_global_login(
    primary_device,
    assert_api,
):
    methods = primary_device.call("Client", "dumpRealSdkChatRoomManagerMethods", info={})
    result = assert_api.get_result(methods)
    assert isinstance(result, list)
    assert result, result
    assert "destroyChatRoom" not in result or "deleteChatRoom" in result or "destroyChatRoom" in result


def test_real_web_dump_group_manager_methods_without_global_login(
    primary_device,
    assert_api,
):
    methods = primary_device.call("Client", "dumpRealSdkGroupManagerMethods", info={})
    result = assert_api.get_result(methods)
    assert isinstance(result, list)
    assert result, result


def test_real_web_create_chatroom_probe_without_global_login(
    primary_device,
    assert_api,
    user_a,
):
    token_a = get_user_access_token(user_a, "1")

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)
    login = primary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token_a},
    )
    assert_api.assert_result_equals(login, user_a)

    created = primary_device.call(
        "ChatRoomManager",
        Cmd.createChatRoom.value,
        info={
            "subject": f"web-real-probe-room-{uuid.uuid4().hex[:8]}",
            "desc": "web real create chatroom probe",
            "maxUserCount": 200,
        },
    )
    room_id = ""
    try:
        room = assert_api.get_result(created)
        assert isinstance(room, dict)
        room_id = room.get("roomId") or room.get("chatRoomId") or ""
        assert isinstance(room_id, str) and room_id, room
    finally:
        if room_id:
            delete_chat_room(room_id)


def test_real_web_token_login_without_global_login(
    primary_device,
    assert_api,
    user_a,
):
    token = get_user_access_token(user_a, "1")

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)

    login = primary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token},
    )
    assert_api.assert_result_equals(login, user_a)

    connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(connected, True)

    debug = primary_device.call("Client", "getRealSdkDebug", info={})
    events = assert_api.get_result(debug)
    assert isinstance(events, list)
    assert any(event.get("type") == "login_attempt" for event in events)
    assert any(
        event.get("type") == "login_success" and event.get("runtime") == "imsdk"
        for event in events
    )


def test_real_web_bridge_real_text_message_without_global_login(
    primary_device,
    assert_api,
):
    start = primary_device.call("Client", Cmd.startCallback.value, info={})
    assert_api.assert_result_equals(start, True)
    primary_device.drain_events(timeout=0.2)

    message = {
        "msgId": "bridge-probe-msg-001",
        "from": "probe_sender",
        "to": "probe_receiver",
        "convId": "probe_sender",
        "chatType": 0,
        "direction": 1,
        "status": 2,
        "body": {
            "type": 0,
            "content": "bridge-probe-content",
        },
    }
    resp = primary_device.call("ChatManager", "realWebTextMessage", info=message)
    assert_api.assert_result_equals(resp, True)

    event = primary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=10.0,
    )
    if event is None:
        bridge_state = assert_api.get_result(
            primary_device.call("Client", "getBridgeState", info={})
        )
        pytest.fail(
            "realWebTextMessage probe did not emit onMessagesReceived; "
            f"bridge_state={bridge_state!r}"
        )
    messages = (event.get("data") or {}).get("messages")
    assert isinstance(messages, list) and messages
    got = messages[0]
    assert got["msgId"] == message["msgId"]
    assert got["from"] == message["from"]
    assert got["to"] == message["to"]
    assert got["body"] == message["body"]


def test_real_web_replay_pending_text_message_without_global_login(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    token_a = get_user_access_token(user_a, "1")
    token_b = get_user_access_token(user_b, "1")

    for device, user_id, token in (
        (primary_device, user_a, token_a),
        (secondary_device, user_b, token_b),
    ):
        logout = device.call("Client", Cmd.logout.value, info={"unbindToken": False})
        assert_api.assert_result_equals(logout, True)
        login = device.call(
            "Client",
            Cmd.loginWithAgoraToken.value,
            info={"userId": user_id, "agoraToken": token},
        )
        assert_api.assert_result_equals(login, user_id)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    cleared = secondary_device.call(
        "ChatManager",
        "clearPendingRealTextMessages",
        info={},
    )
    assert_api.assert_result_equals(cleared, True)

    content = f"replay-web-text-{uuid.uuid4().hex[:8]}"
    sent = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    sent_message = assert_api.get_result(sent)
    assert sent_message["msgId"]

    success = primary_device.receive_message(
        match_event_type=Cmd.onMessageSuccess.value,
        timeout=20.0,
    )
    assert success is not None

    pending_messages = []
    deadline = time.time() + 10.0
    while time.time() < deadline:
        pending = secondary_device.call(
            "ChatManager",
            "getPendingRealTextMessages",
            info={},
        )
        pending_messages = assert_api.get_result(pending)
        if pending_messages:
            break
        time.sleep(0.5)
    assert isinstance(pending_messages, list) and pending_messages

    replayed = pending_messages[0]
    assert replayed["msgId"] == sent_message["msgId"]

    replay = secondary_device.call(
        "ChatManager",
        "realWebTextMessage",
        info=replayed,
    )
    assert_api.assert_result_equals(replay, True)

    event = secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=10.0,
    )
    assert event is not None
    messages = (event.get("data") or {}).get("messages")
    assert isinstance(messages, list) and messages
    got = messages[0]
    assert got["msgId"] == sent_message["msgId"]
    assert got["body"] == {"type": 0, "content": content}


def test_real_web_native_handler_state_without_global_login(
    primary_device,
    assert_api,
):
    state = primary_device.call("Client", "getNativeHandlerState", info={})
    result = assert_api.get_result(state)
    assert isinstance(result, dict)
    assert result["chatManagerHasHandler"] is True
    assert result["contactManagerHasHandler"] is True
    assert isinstance(result["chatManagerHandlerInstallCount"], int)
    assert result["chatManagerHandlerInstallCount"] >= 1
    assert isinstance(result["contactManagerHandlerInstallCount"], int)
    assert result["contactManagerHandlerInstallCount"] >= 1
    assert isinstance(result["chatManagerHandlerHashCode"], int)
    assert isinstance(result["contactManagerHandlerHashCode"], int)


def test_real_web_contact_fetch_probe_without_global_login(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    token_a = get_user_access_token(user_a, "1")
    token_b = get_user_access_token(user_b, "1")

    for device in (primary_device, secondary_device):
        logout = device.call("Client", Cmd.logout.value, info={"unbindToken": False})
        assert_api.assert_result_equals(logout, True)

    login_a = primary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token_a},
    )
    assert_api.assert_result_equals(login_a, user_a)
    login_b = secondary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_b, "agoraToken": token_b},
    )
    assert_api.assert_result_equals(login_b, user_b)

    for device in (primary_device, secondary_device):
        reset = device.call("Client", "webReset", info={})
        assert_api.assert_result_equals(reset, True)

    try:
        primary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_b, "keepConversation": True},
        )
        secondary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_a, "keepConversation": True},
        )
    except Exception:
        pass

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "real-web-contact-probe"},
    )
    assert_api.assert_result_equals(add, user_b)

    accept = secondary_device.call(
        "ContactManager",
        Cmd.acceptInvitation.value,
        info={"userId": user_a},
    )
    assert_api.assert_result_equals(accept, True)

    ids_result = []
    contacts_result = []
    snapshot_a_result = {}
    snapshot_b_result = {}
    deadline = time.time() + 8.0
    while True:
        ids = primary_device.call(
            "ContactManager",
            Cmd.getAllContactsFromServer.value,
            info={},
        )
        ids_result = assert_api.get_result(ids)

        contacts = primary_device.call(
            "ContactManager",
            Cmd.fetchAllContacts.value,
            info={},
        )
        contacts_result = assert_api.get_result(contacts)

        snapshot_a = primary_device.call(
            "Client", "getRealSdkContactSnapshot", info={}
        )
        snapshot_a_result = assert_api.get_result(snapshot_a)
        snapshot_b = secondary_device.call(
            "Client",
            "getRealSdkContactSnapshot",
            info={},
        )
        snapshot_b_result = assert_api.get_result(snapshot_b)

        snapshot_a_items = (snapshot_a_result.get("snapshot") or {}).get("items") or []
        snapshot_b_items = (snapshot_b_result.get("snapshot") or {}).get("items") or []
        snapshot_a_complete = bool(
            (snapshot_a_result.get("snapshot") or {}).get("complete")
        )
        snapshot_b_complete = bool(
            (snapshot_b_result.get("snapshot") or {}).get("complete")
        )
        if (
            ids_result
            or contacts_result
            or snapshot_a_items
            or snapshot_b_items
            or (snapshot_a_complete and snapshot_b_complete)
        ):
            break
        if time.time() >= deadline:
            break
        time.sleep(0.5)

    cache_state_a = primary_device.call(
        "Client", "getRealSdkContactCacheState", info={}
    )
    cache_state_a_result = assert_api.get_result(cache_state_a)
    cache_state_b = secondary_device.call(
        "Client", "getRealSdkContactCacheState", info={}
    )
    cache_state_b_result = assert_api.get_result(cache_state_b)
    sync_state_a = primary_device.call("Client", "getRealSdkSyncState", info={})
    sync_state_a_result = assert_api.get_result(sync_state_a)
    sync_state_b = secondary_device.call("Client", "getRealSdkSyncState", info={})
    sync_state_b_result = assert_api.get_result(sync_state_b)

    debug = primary_device.call("Client", "getRealSdkDebug", info={})
    events = assert_api.get_result(debug)
    assert isinstance(events, list)
    debug_b = secondary_device.call("Client", "getRealSdkDebug", info={})
    events_b = assert_api.get_result(debug_b)
    assert isinstance(events_b, list)
    methods_resp = primary_device.call(
        "Client",
        "dumpRealSdkContactManagerMethods",
        info={},
    )
    methods = assert_api.get_result(methods_resp)

    if not ids_result and not contacts_result:
        pytest.fail(
            "web real contact fetch empty; "
            f"ids={ids_result!r} contacts={contacts_result!r} "
            f"snapshotA={snapshot_a_result!r} snapshotB={snapshot_b_result!r} "
            f"cacheA={cache_state_a_result!r} cacheB={cache_state_b_result!r} "
            f"syncA={sync_state_a_result!r} syncB={sync_state_b_result!r} "
            f"methods={methods!r} debugA={events!r} debugB={events_b!r}"
        )


def test_real_web_blocklist_probe_without_global_login(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    token_a = get_user_access_token(user_a, "1")
    token_b = get_user_access_token(user_b, "1")

    for device in (primary_device, secondary_device):
        logout = device.call("Client", Cmd.logout.value, info={"unbindToken": False})
        assert_api.assert_result_equals(logout, True)

    login_a = primary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_a, "agoraToken": token_a},
    )
    assert_api.assert_result_equals(login_a, user_a)
    login_b = secondary_device.call(
        "Client",
        Cmd.loginWithAgoraToken.value,
        info={"userId": user_b, "agoraToken": token_b},
    )
    assert_api.assert_result_equals(login_b, user_b)

    for device in (primary_device, secondary_device):
        reset = device.call("Client", "webReset", info={})
        assert_api.assert_result_equals(reset, True)

    try:
        primary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_b, "keepConversation": True},
        )
    except Exception:
        pass
    try:
        primary_device.call(
            "ContactManager",
            Cmd.removeUserFromBlockList.value,
            info={"userId": user_b},
        )
    except Exception:
        pass

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "real-web-blocklist-probe"},
    )
    assert_api.assert_result_equals(add, user_b)

    accept = secondary_device.call(
        "ContactManager",
        Cmd.acceptInvitation.value,
        info={"userId": user_a},
    )
    assert_api.assert_result_equals(accept, True)

    save = primary_device.call(
        "ContactManager",
        Cmd.saveBlackList.value,
        info={"userIds": [user_b]},
    )
    save_result = assert_api.get_result(save)

    block_resp = primary_device.call(
        "ContactManager",
        Cmd.getBlockListFromServer.value,
        info={},
    )

    debug_a = primary_device.call("Client", "getRealSdkDebug", info={})
    events_a = assert_api.get_result(debug_a)
    debug_b = secondary_device.call("Client", "getRealSdkDebug", info={})
    events_b = assert_api.get_result(debug_b)

    pytest.fail(
        "web real blocklist probe "
        f"save={save!r} save_result={save_result!r} "
        f"block_resp={block_resp!r} "
        f"debugA={events_a!r} debugB={events_b!r}"
    )
