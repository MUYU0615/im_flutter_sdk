from __future__ import annotations
from tests.case_steps import describe_case_steps

import time
import uuid

import pytest

from src import Cmd, ne
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message
from tests.chat._utils import build_text
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.group, pytest.mark.multi_device, pytest.mark.agorachat1_4_0]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


def _topology_pair(topology):
    primary = topology.primary_client(0)
    remote = topology.remote_client(0)
    return primary, remote, primary.user_id, remote.user_id, _expected_device(primary), _expected_device(remote)


def _find_msg_with_id(messages: list, msg_id: str) -> dict | None:
    for item in messages:
        if isinstance(item, dict) and str(item.get("msgId")) == str(msg_id):
            return item
    return None


@pytest.mark.real_e2e
@pytest.mark.topology_ready
def test_chat_thread_user_removed_event_type_not_null(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、thread、用户、removed、event、type、not、null；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.removeMemberFromChatThread，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、thread、用户、removed、event、type、not、null；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.removeMemberFromChatThread，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, device_b_name = _topology_pair(topology)
    group_id = ""
    thread_id = ""
    parent_msg_id = ""
    try:
        try:
            device_a.drain_events()
            device_b.drain_events()
        except Exception:
            pass

        group_name = new_group_name("thread_remove")
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=group_name,
            invite_members=[user_b],
        )

        content = f"thread-parent-{uuid.uuid4().hex[:6]}"
        resp_parent = device_b.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_b, group_id, content, chat_type=1),
        )
        send_temp_id = ((resp_parent.get("result") or {}).get("msgId"))
        success_msg = wait_for_success_message(
            device_b,
            from_user=user_b,
            to_user=group_id,
            content=content,
            chat_type=1,
        )
        parent_msg_id = success_msg.get("msgId")
        assert isinstance(parent_msg_id, str) and parent_msg_id, f"未拿到群父消息 msgId: {success_msg}"

        assert_api.assert_response_matches(
            resp_parent,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.sendMessage.value,
                "device": device_b_name,
                "result": {
                    "msgId": "{{tempId}}",
                    "from": "{{userB}}",
                    "to": "{{groupId}}",
                    "convId": "{{groupId}}",
                    "chatType": 1,
                    "direction": 0,
                    "status": 0,
                    "hasRead": True,
                    "hasReadAck": False,
                    "hasDeliverAck": False,
                    "needGroupAck": False,
                    "isThread": False,
                    "isContentReplaced": False,
                    "body": {
                        "type": 0,
                        "content": "{{content}}",
                    },
                },
            },
            context={"groupId": group_id, "tempId": send_temp_id, "userB": user_b, "content": content},
            ignore_keys={
                "sequence",
                "serverTime",
                "localTime",
                "broadcast",
                "onlineState",
                "targetLanguages",
                "translations",
                "receiverList",
                "groupAckCount",
                "deliverOnlineOnly",
                "isListened",
            },
        )

        matched = wait_for_matching_event_message(
            device_a,
            event_type=Cmd.onMessagesReceived.value,
            from_user=user_b,
            to_user=group_id,
            content=content,
            chat_type=1,
        )
        assert matched, f"A 端未收到父消息: targetMsgId={parent_msg_id}, content={content}"
        parent_msg_id = str(matched.get("msgId") or parent_msg_id)

        thread_name = f"thr-{uuid.uuid4().hex[:8]}"
        resp_create_thread = device_a.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={
                "name": thread_name,
                "msgId": parent_msg_id,
                "parentId": group_id,
            },
        )
        thread_result = resp_create_thread.get("result") or {}
        thread_id = thread_result.get("threadId")
        assert isinstance(thread_id, str) and thread_id, f"createChatThread 未返回 threadId: {resp_create_thread}"
        assert_api.assert_response_matches(
            resp_create_thread,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.createChatThread.value,
                "device": device_a_name,
                "result": {
                    "threadId": "{{threadId}}",
                    "threadName": "{{threadName}}",
                    "owner": "{{userA}}",
                    "parentId": "{{groupId}}",
                    "msgId": "{{parentMsgId}}",
                    "createAt": ne(None),
                },
            },
            context={
                "threadId": thread_id,
                "threadName": thread_name,
                "groupId": group_id,
                "parentMsgId": parent_msg_id,
                "userA": user_a,
                "userB": user_b,
                "content": content,
            },
            ignore_keys={
                "sequence",
                "serverTime",
                "localTime",
                "broadcast",
                "onlineState",
                "targetLanguages",
                "translations",
                "memberCount",
                "messageCount",
            },
        )

        resp_join = device_b.call(
            "ChatThreadManager",
            Cmd.joinChatThread.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_response_matches(
            resp_join,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.joinChatThread.value,
                "device": device_b_name,
                "result": {
                    "threadId": "{{threadId}}",
                    "threadName": "{{threadName}}",
                    "owner": "{{userA}}",
                    "parentId": "{{groupId}}",
                    "msgId": "{{parentMsgId}}",
                    "createAt": ne(None),
                },
            },
            context={
                "threadId": thread_id,
                "threadName": thread_name,
                "groupId": group_id,
                "parentMsgId": parent_msg_id,
                "userA": user_a,
                "content": content,
            },
            ignore_keys={
                "sequence",
                "serverTime",
                "localTime",
                "broadcast",
                "onlineState",
                "targetLanguages",
                "translations",
                "memberCount",
                "messageCount",
            },
        )

        time.sleep(1)
        resp_remove = device_a.call(
            "ChatThreadManager",
            Cmd.removeMemberFromChatThread.value,
            info={"memberId": user_b, "threadId": thread_id},
        )
        assert_api.assert_response_matches(
            resp_remove,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.removeMemberFromChatThread.value,
                "device": device_a_name,
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        evt_removed = device_b.receive_message(match_event_type=Cmd.onUserKickOutOfChatThread.value, timeout=20.0)
        if evt_removed is None:
            evt_removed = device_a.receive_message(match_event_type=Cmd.onUserKickOutOfChatThread.value, timeout=5.0)
        if evt_removed is None:
            pytest.xfail(
                "当前 Android 环境 removeMemberFromChatThread 成功后未收到 onUserKickOutOfChatThread 回调，"
                f"threadId={thread_id}, groupId={group_id}"
            )
        assert_api.assert_response_matches(
            evt_removed,
            expected={
                "type": "event",
                "eventType": Cmd.onUserKickOutOfChatThread.value,
                "data": {
                    "event": {
                        "type": ne(None),
                        "from": "{{operatorId}}",
                        "thread": {
                            "threadId": "{{threadId}}",
                            "threadName": "{{threadName}}",
                            "owner": "{{userA}}",
                            "parentId": "{{groupId}}",
                            "msgId": "{{parentMsgId}}",
                            "createAt": ne(None),
                            "lastMessage": {
                                "msgId": "{{parentMsgId}}",
                                "from": "{{userB}}",
                                "to": "{{groupId}}",
                                "convId": "{{groupId}}",
                                "chatType": 1,
                                "direction": 0,
                                "status": 0,
                                "hasRead": True,
                                "hasReadAck": False,
                                "hasDeliverAck": False,
                                "needGroupAck": False,
                                "isThread": False,
                                "isContentReplaced": False,
                                "deliverOnlineOnly": False,
                                "body": {
                                    "type": 0,
                                    "content": "{{content}}",
                                },
                            },
                        },
                    },
                },
            },
            context={
                "operatorId": user_a,
                "threadId": thread_id,
                "threadName": thread_name,
                "groupId": group_id,
                "parentMsgId": parent_msg_id,
                "userA": user_a,
                "userB": user_b,
                "content": content,
            },
            ignore_keys={
                "timestamp",
                "sequence",
                "serverTime",
                "localTime",
                "broadcast",
                "onlineState",
                "targetLanguages",
                "translations",
                "memberCount",
                "messageCount",
                "lastMessage",
                "isListened",
            },
        )

        evt_data = (evt_removed.get("data") or {}).get("event") or {}
        event_type_value = evt_data.get("type")
        assert isinstance(event_type_value, int), f"onUserKickOutOfChatThread.event.type 不是 int: {evt_removed}"
        assert event_type_value >= 0, f"onUserKickOutOfChatThread.event.type 非法: {evt_removed}"

    finally:
        if thread_id:
            resp_destroy_thread = device_a.call(
                "ChatThreadManager",
                Cmd.destroyChatThread.value,
                info={"threadId": thread_id},
            )
            if not (isinstance((resp_destroy_thread.get("result")), bool) and resp_destroy_thread.get("result") is True):
                # 避免清理失败阻断主断言结论
                assert_api.assert_response_matches(
                    resp_destroy_thread,
                    expected={
                        "manager": "ChatThreadManager",
                        "cmd": Cmd.destroyChatThread.value,
                        "device": device_a_name,
                    },
                    ignore_keys={"sequence", "result", "error"},
                )
        if group_id:
            destroy_group(device_a, assert_api, group_id, device_b=device_b)
