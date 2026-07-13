from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

import pytest

from src import Cmd
from tests.chat._message_helpers import matches_received_text, received_messages, wait_for_success_message
from tests.chat._utils import build_text


ON_MESSAGE_REACTION_DID_CHANGE = "onMessageReactionDidChange"


def _xfail_if_reaction_service_unavailable(resp: dict) -> None:
    result = resp.get("result")
    if isinstance(result, dict) and result.get("code") == 303:
        desc = str(result.get("description", ""))
        if "Unknown server error" in desc:
            pytest.xfail("当前 Android 环境 reaction 服务返回 303 Unknown server error，按服务能力限制处理")


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _topology_pair(topology):
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    return primary, remote, primary.user_id, remote.user_id, _expected_device(primary), _expected_device(remote)


def _send_text_and_wait_success(device_a, user_a: str, user_b: str, content: str) -> str:
    resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessage 未返回临时 msgId: {resp}"
    success_msg = wait_for_success_message(device_a, from_user=user_a, to_user=user_b, content=content)
    real_id = success_msg.get("msgId")
    assert real_id, f"missing real msgId from final onMessageSuccess: {success_msg!r}"
    return str(real_id)


def _send_text_and_wait_received(device_a, device_b, user_a: str, user_b: str, content: str) -> str:
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content))
    temp_id = ((resp.get("result") or {}).get("msgId"))
    assert temp_id, f"sendMessage 未返回临时 msgId: {resp}"

    seen_events = []
    for _ in range(5):
        evt_received = device_b.receive_message(match_event_type=Cmd.onMessagesReceived.value, timeout=20.0)
        if evt_received:
            seen_events.append(evt_received)
        for message in received_messages(evt_received):
            if matches_received_text(message, from_user=user_a, to_user=user_b, content=content):
                receiver_msg_id = message.get("msgId")
                assert receiver_msg_id, f"B 端目标消息缺少 msgId: {message}"
                return str(receiver_msg_id)
    raise AssertionError(f"B 端未收到目标消息 content={content}, senderTempMsgId={temp_id}: events={seen_events}")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_chat_reaction_change_event_received_by_sender(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、Reaction、change、event、received、by、sender；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、Reaction、change、event、received、by、sender；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, _, remote_device = _topology_pair(topology)
    reaction = "👍"
    real_id = _send_text_and_wait_received(
        device_a,
        device_b,
        user_a,
        user_b,
        f"reaction-event-{uuid.uuid4().hex[:8]}",
    )

    resp = device_b.call("ChatManager", Cmd.addReaction.value, info={"reaction": reaction, "msgId": real_id})
    _xfail_if_reaction_service_unavailable(resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": remote_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    evt = device_a.receive_message(match_event_type=ON_MESSAGE_REACTION_DID_CHANGE, timeout=20.0)
    assert_api.assert_response_matches(
        evt,
        expected={
            "type": "event",
            "eventType": ON_MESSAGE_REACTION_DID_CHANGE,
            "data": {
                "events": [
                    {
                        "convId": user_b,
                        "msgId": real_id,
                        "operations": [
                            {"userId": user_b, "reaction": reaction, "operate": 1},
                        ],
                        "reactions": [
                            {"reaction": reaction, "count": 1, "isAddedBySelf": False, "userList": [user_b]},
                        ],
                    },
                ],
            },
        },
        ignore_keys={"timestamp"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("chat.fetch_reaction_list.invalid_msg_id.empty")
@pytest.mark.api("ChatManager.fetchReactionList")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_fetch_reaction_list_invalid_msg_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、列表、无效参数、msg、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、列表、无效参数、msg、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    # Flutter 端签名要求 chatType 必填；请求体键名为 msgIds。
    info = {"msgIds": ["__invalid_msg_id__"], "chatType": 0}
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.fetchReactionList.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionList.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": {"__invalid_msg_id__": []},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("chat.fetch_reaction_list.empty_msg_ids.error")
@pytest.mark.api("ChatManager.fetchReactionList")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_fetch_reaction_list_empty_msg_ids(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、列表、空值参数、msg、ids；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、列表、空值参数、msg、ids；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"msgIds": [], "chatType": 0}
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.fetchReactionList.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionList.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": {"code": 110, "description": "'messageIdList' can not be null"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("chat.fetch_reaction_list.invalid_chat_type.error")
@pytest.mark.api("ChatManager.fetchReactionList")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_fetch_reaction_list_invalid_chat_type(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、列表、无效参数、chat、type；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionList，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、列表、无效参数、chat、type；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionList，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    info = {"msgIds": ["__invalid_msg_id__"], "chatType": -1}
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.fetchReactionList.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionList.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": {"code": 110, "description": "'chatType' is invalid"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
@pytest.mark.case_id("chat.fetch_reaction_detail.invalid_msg_id.empty")
@pytest.mark.api("ChatManager.fetchReactionDetail")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chat_fetch_reaction_detail_invalid(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、无效参数；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、无效参数；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    # 原生 wrapper 将 pageSize 按必填读取（Android: getInt），缺失会直接抛参错。
    info = {"msgId": "__invalid_msg_id__", "reaction": "👍", "pageSize": 20}
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.fetchReactionDetail.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionDetail.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": {"cursor": "", "list": []},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_reaction_detail_invalid_page_size(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、无效参数、page、size；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、无效参数、page、size；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_success(device_a, user_a, user_b, "reaction-detail-invalid-page-size")

    info = {"msgId": real_id, "reaction": "👍", "pageSize": -1}
    resp = device_a.call("ChatManager", Cmd.fetchReactionDetail.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionDetail.value,
            "device": primary_device,
            "result": {"code": 110, "description": "'pageSize' must be greater than 0"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_reaction_detail_empty_reaction(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、空值参数、Reaction；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、空值参数、Reaction；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_success(device_a, user_a, user_b, "reaction-detail-empty-reaction")

    info = {"msgId": real_id, "reaction": "", "pageSize": 20}
    resp = device_a.call("ChatManager", Cmd.fetchReactionDetail.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionDetail.value,
            "device": primary_device,
            "result": {"code": 110, "description": "'reaction' can not be null"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_fetch_reaction_detail_oversize_page_size(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、oversize、page、size；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、拉取、Reaction、detail、oversize、page、size；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.fetchReactionDetail，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_success(device_a, user_a, user_b, "reaction-detail-oversize-page-size")

    info = {"msgId": real_id, "reaction": "👍", "pageSize": 1000}
    resp = device_a.call("ChatManager", Cmd.fetchReactionDetail.value, info=info)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.fetchReactionDetail.value,
            "device": primary_device,
            "result": {"code": 110, "description": "Limit exceeds the maximum quantity limit"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_add_reaction_duplicate_reaction(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、添加、Reaction、duplicate、Reaction；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、添加、Reaction、duplicate、Reaction；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_success(device_a, user_a, user_b, "reaction-duplicate")

    resp_add_first = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "👍", "msgId": real_id})
    _xfail_if_reaction_service_unavailable(resp_add_first)
    resp_add_second = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "👍", "msgId": real_id})
    assert_api.assert_response_matches(
        resp_add_first,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": primary_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )
    assert_api.assert_response_matches(
        resp_add_second,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": primary_device,
            "result": {"code": 1301, "description": "the user is already operation this message"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_remove_reaction_not_exists_reaction(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、移除、Reaction、not、exists、Reaction；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、移除、Reaction、not、exists、Reaction；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_success(device_a, user_a, user_b, "reaction-remove-not-exists")

    resp = device_a.call("ChatManager", Cmd.removeReaction.value, info={"reaction": "👍", "msgId": real_id})
    _xfail_if_reaction_service_unavailable(resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.removeReaction.value,
            "device": primary_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_remove_reaction_invalid_msg_id(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、Reaction、无效参数、msg、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、Reaction、无效参数、msg、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.removeReaction.value, info={"reaction": "ok", "msgId": "__invalid_msg_id__"})
    _xfail_if_reaction_service_unavailable(resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.removeReaction.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_add_reaction_missing_msg_id_returns_validation_error(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、添加、Reaction、missing、msg、id、returns、validation；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、添加、Reaction、missing、msg、id、returns、validation；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "ok"})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": {"code": 110, "description": "'msgId' can not be null"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_remove_reaction_empty_reaction_returns_validation_error(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、Reaction、空值参数、Reaction、returns、validation、error；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、移除、Reaction、空值参数、Reaction、returns、validation、error；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.removeReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call("ChatManager", Cmd.removeReaction.value, info={"reaction": "", "msgId": "__invalid_msg_id__"})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.removeReaction.value,
            "device": _expected_device(topology_primary_or_device_a),
            "result": {"code": 110, "description": "'reaction' can not be null"},
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_chat_add_reaction_too_long_reaction(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、添加、Reaction、too、long、Reaction；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天异常/边界场景所需的测试数据，场景为chat、添加、Reaction、too、long、Reaction；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_success(device_a, user_a, user_b, "reaction-too-long")

    resp_128 = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "a" * 128, "msgId": real_id})
    _xfail_if_reaction_service_unavailable(resp_128)
    assert_api.assert_response_matches(
        resp_128,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": primary_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )

    resp_256 = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "b" * 256, "msgId": real_id})
    _xfail_if_reaction_service_unavailable(resp_256)
    assert_api.assert_response_matches(
        resp_256,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": primary_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("receiver_event")
@pytest.mark.topology_ready
def test_chat_add_reaction_special_char_reaction(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、添加、Reaction、special、char、Reaction；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、添加、Reaction、special、char、Reaction；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.addReaction，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, primary_device, _ = _topology_pair(topology)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    real_id = _send_text_and_wait_received(device_a, device_b, user_a, user_b, "reaction-special-char")

    resp = device_a.call("ChatManager", Cmd.addReaction.value, info={"reaction": "\n\t", "msgId": real_id})
    _xfail_if_reaction_service_unavailable(resp)
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.addReaction.value,
            "device": primary_device,
            "result": None,
        },
        ignore_keys={"sequence"},
    )
