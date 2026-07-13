from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid

import pytest

from src import Cmd
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message
from tests.chat._utils import build_text


pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.agorachat1_4_0]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _topology_pair(topology):
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    return primary, remote, primary.user_id, remote.user_id, _expected_device(primary), _expected_device(remote)


def _send_text_and_get_real_id(
    device_a,
    device_b,
    assert_api,
    user_a: str,
    to_user: str,
    content: str,
    *,
    expect_receive_on_b: bool,
) -> str:
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp_send = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, to_user, content))
    send_result = resp_send.get("result") or {}
    send_msg_id = send_result.get("msgId")
    assert isinstance(send_msg_id, str) and send_msg_id, f"sendMessage 未返回有效 msgId: {resp_send}"

    assert_api.assert_response_matches(
        resp_send,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.sendMessage.value,
            "device": _expected_device(device_a),
            "result": {
                "from": user_a,
                "to": to_user,
                "convId": to_user,
                "chatType": 0,
                "direction": 0,
                "status": 0,
                "hasRead": True,
                "hasReadAck": False,
                "hasDeliverAck": False,
                "needGroupAck": False,
                "isThread": False,
                "isContentReplaced": False,
                "isListened": False,
                "body": {"type": 0, "content": content},
            },
        },
        ignore_keys={
            "sequence",
            "msgId",
            "serverTime",
            "localTime",
            "broadcast",
            "onlineState",
            "deliverOnlineOnly",
            "targetLanguages",
            "translations",
        },
    )

    success_msg = wait_for_success_message(device_a, from_user=user_a, to_user=to_user, content=content)
    if expect_receive_on_b:
        received_msg = wait_for_matching_event_message(
            device_b,
            event_type=Cmd.onMessagesReceived.value,
            from_user=user_a,
            to_user=to_user,
            content=content,
        )
        assert received_msg, "接收端未收到 onMessagesReceived"

    real_id = success_msg.get("msgId")
    assert isinstance(real_id, str) and real_id, f"未从 onMessageSuccess 获取真实 msgId: {success_msg}"
    return real_id


def _extract_conv_ids_in_order(resp: dict) -> list[str]:
    result = resp.get("result")
    if not isinstance(result, list):
        return []
    conv_ids: list[str] = []
    for item in result:
        if not isinstance(item, dict):
            continue
        conv_id = item.get("convId")
        if isinstance(conv_id, str) and conv_id:
            conv_ids.append(conv_id)
    return conv_ids


@pytest.mark.real_e2e
@pytest.mark.case_id("chat.get_all_conversations_by_sort.latest_first.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.loadAllConversations")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
@pytest.mark.topology_ready
def test_chat_get_all_conversations_by_sort_orders_latest_first(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、all、conversations、by、sort、orders、latest；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadAllConversations，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、获取、all、conversations、by、sort、orders、latest；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.loadAllConversations，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, _device_b_name = _topology_pair(topology)
    self_conv_id = user_a
    peer_conv_id = user_b

    _ = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": self_conv_id, "deleteMessages": True},
    )
    _ = device_a.call(
        "ChatManager",
        Cmd.deleteConversation.value,
        info={"convId": peer_conv_id, "deleteMessages": True},
    )

    _send_text_and_get_real_id(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_a,
        f"s1-sort-self-{uuid.uuid4().hex[:6]}",
        expect_receive_on_b=False,
    )
    time.sleep(1.0)
    _send_text_and_get_real_id(
        device_a,
        device_b,
        assert_api,
        user_a,
        user_b,
        f"s1-sort-peer-{uuid.uuid4().hex[:6]}",
        expect_receive_on_b=True,
    )
    time.sleep(1.5)

    # SDK 原生方法 key 是 loadAllConversations（内部调用 getAllConversationsBySort）
    resp_sorted = device_a.call("ChatManager", Cmd.loadAllConversations.value, info={})

    assert_api.assert_response_matches(
        resp_sorted,
        expected={
            "manager": "ChatManager",
            "cmd": Cmd.loadAllConversations.value,
            "device": device_a_name,
        },
        ignore_keys={"sequence", "result"},
    )
    conv_ids = _extract_conv_ids_in_order(resp_sorted)
    assert peer_conv_id in conv_ids, f"排序结果缺少 peer 会话: convId={peer_conv_id}, resp={resp_sorted}"
    assert self_conv_id in conv_ids, f"排序结果缺少 self 会话: convId={self_conv_id}, resp={resp_sorted}"
    assert conv_ids.index(peer_conv_id) < conv_ids.index(self_conv_id), (
        "getAllConversationsBySort 排序不符合预期（最新会话应在前）: "
        f"peer_index={conv_ids.index(peer_conv_id)}, self_index={conv_ids.index(self_conv_id)}, conv_ids={conv_ids}"
    )
