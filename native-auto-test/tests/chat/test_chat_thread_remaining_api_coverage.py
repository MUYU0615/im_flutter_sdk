"""
ChatThread 剩余 API 覆盖用例。

本文件补充 ChatThreadManager 的查询、更新、离开类方法覆盖。前置链路统一为：
A 建群并邀请 B、B 发送群父消息、A 基于父消息创建子区、B 加入子区。
"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid
import time

import pytest

from src import Cmd, ne
from tests.chat._message_helpers import wait_for_matching_event_message, wait_for_success_message
from tests.chat._utils import build_text
from tests.group.group_helpers import create_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.group, pytest.mark.multi_device]


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


def _find_group_text_message(messages: list, *, from_user: str, group_id: str, content: str) -> dict | None:
    for item in messages:
        if not isinstance(item, dict):
            continue
        body = item.get("body") if isinstance(item.get("body"), dict) else {}
        if (
            item.get("from") == from_user
            and item.get("to") == group_id
            and item.get("convId") == group_id
            and item.get("chatType") == 1
            and body.get("type") == 0
            and body.get("content") == content
        ):
            return item
    return None


def _cleanup_joined_threads(device, user_id: str):
    """清理账号已加入的历史 thread，避免账号状态脏导致 reach limit。"""
    cursor = ""
    seen: set[str] = set()
    for _ in range(5):
        resp = device.call(
            "ChatThreadManager",
            Cmd.fetchJoinedChatThreads.value,
            info={"cursor": cursor, "pageSize": 50},
        )
        result = resp.get("result") if isinstance(resp, dict) else None
        if not isinstance(result, dict):
            break
        items = result.get("list") or []
        if not isinstance(items, list) or not items:
            break
        for item in items:
            if not isinstance(item, dict):
                continue
            thread_id = item.get("threadId")
            if not isinstance(thread_id, str) or not thread_id or thread_id in seen:
                continue
            seen.add(thread_id)
            detail_resp = device.call(
                "ChatThreadManager",
                Cmd.fetchChatThreadDetail.value,
                info={"threadId": thread_id},
            )
            detail = detail_resp.get("result") if isinstance(detail_resp, dict) else None
            owner = detail.get("owner") if isinstance(detail, dict) else None
            if owner == user_id:
                device.call(
                    "ChatThreadManager",
                    Cmd.destroyChatThread.value,
                    info={"threadId": thread_id},
                )
            else:
                device.call(
                    "ChatThreadManager",
                    Cmd.leaveChatThread.value,
                    info={"threadId": thread_id},
                )
        next_cursor = result.get("cursor")
        if not isinstance(next_cursor, str) or not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor


def _create_thread_context(device_a, device_b, assert_api, user_a: str, user_b: str, device_a_name: str, device_b_name: str):
    group_id = ""
    thread_id = ""
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass
    _cleanup_joined_threads(device_a, user_a)
    _cleanup_joined_threads(device_b, user_b)
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    last_group_error: AssertionError | None = None
    for attempt in range(2):
        try:
            group_id, _ = create_group(
                device_a,
                assert_api,
                owner=user_a,
                group_name=new_group_name("thread_api"),
                invite_members=[user_b],
            )
            break
        except AssertionError as exc:
            last_group_error = exc
            if "Server is unreachable" not in str(exc) or attempt == 1:
                raise
            time.sleep(1)
    if not group_id and last_group_error is not None:
        raise last_group_error

    thread_name = f"thr-{uuid.uuid4().hex[:8]}"
    content = ""
    parent_msg_id = ""
    resp_create = {}
    for attempt in range(2):
        content = f"thread-parent-{uuid.uuid4().hex[:8]}"
        resp_parent = device_b.call(
            "ChatManager",
            Cmd.sendMessage.value,
            info=build_text(user_b, group_id, content, chat_type=1),
        )
        assert_api.assert_response_matches(
            resp_parent,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.sendMessage.value,
                "device": device_b_name,
            },
            ignore_keys={"sequence", "result"},
        )
        success_msg = wait_for_success_message(
            device_b,
            from_user=user_b,
            to_user=group_id,
            content=content,
            chat_type=1,
        )
        parent_msg_id = success_msg.get("msgId")
        assert isinstance(parent_msg_id, str) and parent_msg_id, f"未拿到群父消息 msgId: {success_msg}"

        matched_parent = wait_for_matching_event_message(
            device_a,
            event_type=Cmd.onMessagesReceived.value,
            from_user=user_b,
            to_user=group_id,
            content=content,
            chat_type=1,
        )
        assert matched_parent, f"A 端未收到父消息: targetMsgId={parent_msg_id}, content={content}"

        resp_create = device_a.call(
            "ChatThreadManager",
            Cmd.createChatThread.value,
            info={"name": thread_name, "msgId": parent_msg_id, "parentId": group_id},
        )
        thread = resp_create.get("result") or {}
        thread_id = thread.get("threadId") if isinstance(thread, dict) else None
        if isinstance(thread_id, str) and thread_id:
            break
        if attempt == 0:
            time.sleep(1)
    thread = resp_create.get("result") or {}
    thread_id = thread.get("threadId") if isinstance(thread, dict) else None
    assert isinstance(thread_id, str) and thread_id, f"createChatThread 未返回 threadId: {resp_create}"
    assert_api.assert_response_matches(
        resp_create,
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
            "userA": user_a,
            "groupId": group_id,
            "parentMsgId": parent_msg_id,
        },
        ignore_keys={"sequence", "memberCount", "messageCount", "lastMessage"},
    )

    create_evt = device_b.receive_message(match_event_type=Cmd.onChatThreadCreate.value, timeout=20.0)
    if create_evt is not None:
        assert_api.assert_response_matches(
            create_evt,
            expected={
                "type": "event",
                "eventType": Cmd.onChatThreadCreate.value,
                "data": {
                    "threadId": thread_id,
                    "threadName": thread_name,
                    "owner": "",
                    "parentId": group_id,
                    "userId": user_a,
                    "operation": "create",
                },
            },
            ignore_keys={"timestamp"},
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
            "userA": user_a,
            "groupId": group_id,
            "parentMsgId": parent_msg_id,
        },
        ignore_keys={"sequence", "memberCount", "messageCount", "lastMessage"},
    )

    return {
        "group_id": group_id,
        "thread_id": thread_id,
        "thread_name": thread_name,
        "parent_msg_id": parent_msg_id,
        "content": content,
    }


def _cleanup_thread_context(device_a, device_b, assert_api, context: dict, device_a_name: str):
    thread_id = context.get("thread_id")
    group_id = context.get("group_id")
    if thread_id:
        resp_destroy = device_a.call(
            "ChatThreadManager",
            Cmd.destroyChatThread.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_response_matches(
            resp_destroy,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.destroyChatThread.value,
                "device": device_a_name,
            },
            ignore_keys={"sequence", "result"},
        )
    if group_id:
        resp_destroy_group = device_a.call("GroupManager", Cmd.destroyGroup.value, info={"groupId": group_id})
        assert_api.assert_response_matches(
            resp_destroy_group,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.destroyGroup.value,
                "device": device_a_name,
            },
            ignore_keys={"sequence", "result"},
        )


def _assert_cursor_contains_thread(resp: dict, *, thread_id: str, cmd: str):
    assert resp.get("manager") == "ChatThreadManager"
    assert resp.get("cmd") == cmd
    result = resp.get("result")
    assert isinstance(result, dict), f"{cmd} result 应为 cursor dict: {resp}"
    items = result.get("list")
    assert isinstance(items, list), f"{cmd} result.list 应为 list: {resp}"
    assert any(isinstance(item, dict) and item.get("threadId") == thread_id for item in items), (
        f"{cmd} 未返回目标 threadId={thread_id}: {resp}"
    )


@pytest.mark.real_e2e
@pytest.mark.case_id("thread.detail_and_lists.after_create_join.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatManager.getThreadConversation")
@pytest.mark.api("ChatThreadManager.createChatThread")
@pytest.mark.api("ChatThreadManager.joinChatThread")
@pytest.mark.api("ChatThreadManager.fetchChatThreadDetail")
@pytest.mark.api("ChatThreadManager.fetchJoinedChatThreads")
@pytest.mark.api("ChatThreadManager.fetchChatThreadsWithParentId")
@pytest.mark.api("ChatThreadManager.fetchJoinedChatThreadsWithParentId")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
@pytest.mark.topology_ready
def test_chat_thread_fetch_detail_and_lists(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、thread、拉取、detail、and、lists；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getThreadConversation、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、thread、拉取、detail、and、lists；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.getThreadConversation、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, device_b_name = _topology_pair(topology)
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b, device_a_name, device_b_name)
        thread_id = context["thread_id"]
        group_id = context["group_id"]

        detail_resp = device_a.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadDetail.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_response_matches(
            detail_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchChatThreadDetail.value,
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
                "threadName": context["thread_name"],
                "userA": user_a,
                "groupId": group_id,
                "parentMsgId": context["parent_msg_id"],
            },
            ignore_keys={"sequence", "memberCount", "messageCount", "lastMessage"},
        )

        conversation_resp = device_a.call(
            "ChatManager",
            Cmd.getThreadConversation.value,
            info={"convId": thread_id},
        )
        assert_api.assert_response_matches(
            conversation_resp,
            expected={
                "manager": "ChatManager",
                "cmd": Cmd.getThreadConversation.value,
                "device": device_a_name,
                "result": {
                    "convId": thread_id,
                    "type": 1,
                    "isThread": True,
                },
            },
            ignore_keys={
                "sequence",
                "ext",
                "isPinned",
                "pinnedTime",
                "marks",
                "latestMessage",
                "lastReceivedMessage",
            },
        )

        joined_resp = device_b.call(
            "ChatThreadManager",
            Cmd.fetchJoinedChatThreads.value,
            info={"cursor": "", "pageSize": 20},
        )
        assert_api.assert_response_matches(
            joined_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchJoinedChatThreads.value,
                "device": device_b_name,
            },
            ignore_keys={"sequence", "result"},
        )
        _assert_cursor_contains_thread(
            joined_resp,
            thread_id=thread_id,
            cmd=Cmd.fetchJoinedChatThreads.value,
        )

        parent_resp = device_a.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadsWithParentId.value,
            info={"parentId": group_id, "cursor": "", "pageSize": 20},
        )
        assert_api.assert_response_matches(
            parent_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchChatThreadsWithParentId.value,
                "device": device_a_name,
            },
            ignore_keys={"sequence", "result"},
        )
        _assert_cursor_contains_thread(
            parent_resp,
            thread_id=thread_id,
            cmd=Cmd.fetchChatThreadsWithParentId.value,
        )

        joined_parent_resp = device_b.call(
            "ChatThreadManager",
            Cmd.fetchJoinedChatThreadsWithParentId.value,
            info={"parentId": group_id, "cursor": "", "pageSize": 20},
        )
        assert_api.assert_response_matches(
            joined_parent_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchJoinedChatThreadsWithParentId.value,
                "device": device_b_name,
            },
            ignore_keys={"sequence", "result"},
        )
        _assert_cursor_contains_thread(
            joined_parent_resp,
            thread_id=thread_id,
            cmd=Cmd.fetchJoinedChatThreadsWithParentId.value,
        )
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context, device_a_name)


@pytest.mark.real_e2e
@pytest.mark.case_id("thread.members_and_last_message.after_create_join.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatThreadManager.createChatThread")
@pytest.mark.api("ChatThreadManager.joinChatThread")
@pytest.mark.api("ChatThreadManager.fetchChatThreadMember")
@pytest.mark.api("ChatThreadManager.fetchLastMessageWithChatThreads")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
@pytest.mark.topology_ready
def test_chat_thread_fetch_members_and_latest_message(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、thread、拉取、成员、and、latest、消息；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.fetchChatThreadMember，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天查询/拉取场景所需的测试数据，场景为chat、thread、拉取、成员、and、latest、消息；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.fetchChatThreadMember，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, device_b_name = _topology_pair(topology)
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b, device_a_name, device_b_name)
        thread_id = context["thread_id"]

        members_resp = device_a.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadMember.value,
            info={"threadId": thread_id, "cursor": "", "pageSize": 20},
        )
        assert_api.assert_response_matches(
            members_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchChatThreadMember.value,
                "device": device_a_name,
            },
            ignore_keys={"sequence", "result"},
        )
        members_result = members_resp.get("result") or {}
        members = members_result.get("list") or []
        assert user_a in members
        assert user_b in members

        latest_resp = device_a.call(
            "ChatThreadManager",
            Cmd.fetchLastMessageWithChatThreads.value,
            info={"threadIds": [thread_id]},
        )
        assert_api.assert_response_matches(
            latest_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchLastMessageWithChatThreads.value,
                "device": device_a_name,
            },
            ignore_keys={"sequence", "result"},
        )
        latest = latest_resp.get("result") or {}
        assert latest == {}, f"新建子区未发送线程内消息时最新消息映射应为空: {latest_resp}"
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context, device_a_name)


@pytest.mark.real_e2e
@pytest.mark.case_id("thread.update_and_leave.after_create_join.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatThreadManager.createChatThread")
@pytest.mark.api("ChatThreadManager.joinChatThread")
@pytest.mark.api("ChatThreadManager.updateChatThreadSubject")
@pytest.mark.api("ChatThreadManager.leaveChatThread")
@pytest.mark.api("ChatThreadManager.fetchJoinedChatThreadsWithParentId")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
@pytest.mark.topology_ready
def test_chat_thread_update_name_and_leave(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、thread、更新、name、and、离开；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.updateChatThreadSubject，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、thread、更新、name、and、离开；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.updateChatThreadSubject，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, device_b_name = _topology_pair(topology)
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b, device_a_name, device_b_name)
        thread_id = context["thread_id"]
        group_id = context["group_id"]
        new_name = f"thr-new-{uuid.uuid4().hex[:6]}"

        update_resp = device_a.call(
            "ChatThreadManager",
            Cmd.updateChatThreadSubject.value,
            info={"threadId": thread_id, "name": new_name},
        )
        assert_api.assert_response_matches(
            update_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.updateChatThreadSubject.value,
                "device": device_a_name,
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        update_evt = device_b.receive_message(match_event_type=Cmd.onChatThreadUpdate.value, timeout=20.0)
        if update_evt is None:
            update_evt = device_a.receive_message(match_event_type=Cmd.onChatThreadUpdate.value, timeout=5.0)
        assert_api.assert_response_matches(
            update_evt,
            expected={
                "type": "event",
                "eventType": Cmd.onChatThreadUpdate.value,
                "data": {
                    "threadId": thread_id,
                    "threadName": new_name,
                    "owner": "",
                    "parentId": group_id,
                    "userId": user_a,
                    "operation": "update",
                },
            },
            ignore_keys={"timestamp"},
        )

        detail_resp = device_a.call(
            "ChatThreadManager",
            Cmd.fetchChatThreadDetail.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_response_matches(
            detail_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchChatThreadDetail.value,
                "device": device_a_name,
                "result": {
                    "threadId": thread_id,
                    "threadName": new_name,
                    "parentId": group_id,
                },
            },
            ignore_keys={"sequence", "owner", "msgId", "createAt", "memberCount", "messageCount", "lastMessage"},
        )

        leave_resp = device_b.call(
            "ChatThreadManager",
            Cmd.leaveChatThread.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_response_matches(
            leave_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.leaveChatThread.value,
                "device": device_b_name,
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        joined_parent_resp = device_b.call(
            "ChatThreadManager",
            Cmd.fetchJoinedChatThreadsWithParentId.value,
            info={"parentId": group_id, "cursor": "", "pageSize": 20},
        )
        assert_api.assert_response_matches(
            joined_parent_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.fetchJoinedChatThreadsWithParentId.value,
                "device": device_b_name,
            },
            ignore_keys={"sequence", "result"},
        )
        items = (joined_parent_resp.get("result") or {}).get("list") or []
        assert not any(isinstance(item, dict) and item.get("threadId") == thread_id for item in items)
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context, device_a_name)


@pytest.mark.real_e2e
@pytest.mark.case_id("thread.destroy_event.after_create_join.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatThreadManager.createChatThread")
@pytest.mark.api("ChatThreadManager.joinChatThread")
@pytest.mark.api("ChatThreadManager.destroyChatThread")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
@pytest.mark.topology_ready
def test_chat_thread_destroy_event_received_by_group_member(topology, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、thread、销毁、event、received、by、群组、成员；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.destroyChatThread，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、thread、销毁、event、received、by、群组、成员；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatThreadManager.createChatThread、ChatThreadManager.joinChatThread、ChatThreadManager.destroyChatThread，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    device_a, device_b, user_a, user_b, device_a_name, device_b_name = _topology_pair(topology)
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b, device_a_name, device_b_name)
        thread_id = context["thread_id"]

        destroy_resp = device_a.call(
            "ChatThreadManager",
            Cmd.destroyChatThread.value,
            info={"threadId": thread_id},
        )
        assert_api.assert_response_matches(
            destroy_resp,
            expected={
                "manager": "ChatThreadManager",
                "cmd": Cmd.destroyChatThread.value,
                "device": device_a_name,
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        destroy_evt = device_b.receive_message(match_event_type=Cmd.onChatThreadDestroy.value, timeout=20.0)
        if destroy_evt is None:
            destroy_evt = device_a.receive_message(match_event_type=Cmd.onChatThreadDestroy.value, timeout=5.0)
        assert_api.assert_response_matches(
            destroy_evt,
            expected={
                "type": "event",
                "eventType": Cmd.onChatThreadDestroy.value,
                "data": {
                    "threadId": thread_id,
                    "threadName": context["thread_name"],
                    "owner": "",
                    "parentId": context["group_id"],
                    "userId": user_a,
                    "operation": "destroy",
                },
            },
            ignore_keys={"timestamp"},
        )
        context["thread_id"] = ""
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context, device_a_name)
