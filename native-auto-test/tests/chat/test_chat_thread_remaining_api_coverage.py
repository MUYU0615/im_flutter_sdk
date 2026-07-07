"""
ChatThread 剩余 API 覆盖用例。

本文件补充 ChatThreadManager 的查询、更新、离开类方法覆盖。前置链路统一为：
A 建群并邀请 B、B 发送群父消息、A 基于父消息创建子区、B 加入子区。
"""
from __future__ import annotations

import uuid
import time

import pytest

from src import Cmd, ne
from tests.chat._utils import build_text
from tests.group.group_helpers import create_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.chat, pytest.mark.group, pytest.mark.multi_device]


def _find_msg_with_id(messages: list, msg_id: str) -> dict | None:
    for item in messages:
        if isinstance(item, dict) and str(item.get("msgId")) == str(msg_id):
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


def _create_thread_context(device_a, device_b, assert_api, user_a: str, user_b: str):
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
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        evt_success = device_b.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)
        parent_msg_id = ((evt_success or {}).get("data") or {}).get("msg", {}).get("msgId")
        assert isinstance(parent_msg_id, str) and parent_msg_id, f"未拿到群父消息 msgId: {evt_success}"

        evt_group_recv = device_a.receive_message(match_event_type=Cmd.onMessagesReceived.value, timeout=20.0)
        messages = ((evt_group_recv or {}).get("data") or {}).get("messages") or []
        assert _find_msg_with_id(messages, parent_msg_id) is not None, (
            f"A 端未收到父消息: targetMsgId={parent_msg_id}, evt={evt_group_recv}"
        )

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
            "device": "deviceA",
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
            "device": "deviceB",
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


def _cleanup_thread_context(device_a, device_b, assert_api, context: dict):
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
                "device": "deviceA",
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
                "device": "deviceA",
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
def test_chat_thread_fetch_detail_and_lists(device_a, device_b, assert_api, user_a, user_b):
    """fetchChatThreadDetail/getThreadConversation/joined/parent 列表：创建并加入子区后校验详情、线程会话和列表。"""
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b)
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
                "device": "deviceA",
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
                "device": "deviceA",
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
                "device": "deviceB",
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
                "device": "deviceA",
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
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        _assert_cursor_contains_thread(
            joined_parent_resp,
            thread_id=thread_id,
            cmd=Cmd.fetchJoinedChatThreadsWithParentId.value,
        )
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context)


@pytest.mark.real_e2e
@pytest.mark.case_id("thread.members_and_last_message.after_create_join.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatThreadManager.createChatThread")
@pytest.mark.api("ChatThreadManager.joinChatThread")
@pytest.mark.api("ChatThreadManager.fetchChatThreadMember")
@pytest.mark.api("ChatThreadManager.fetchLastMessageWithChatThreads")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
def test_chat_thread_fetch_members_and_latest_message(device_a, device_b, assert_api, user_a, user_b):
    """fetchChatThreadMember / fetchLastMessageWithChatThreads：成员列表包含 A/B，新建子区未发线程消息时最新消息映射为空。"""
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b)
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
                "device": "deviceA",
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
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )
        latest = latest_resp.get("result") or {}
        assert latest == {}, f"新建子区未发送线程内消息时最新消息映射应为空: {latest_resp}"
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context)


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
def test_chat_thread_update_name_and_leave(device_a, device_b, assert_api, user_a, user_b):
    """updateChatThreadSubject / leaveChatThread：更新子区名称后，B 退出子区并从已加入列表消失。"""
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b)
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
                "device": "deviceA",
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
                "device": "deviceA",
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
                "device": "deviceB",
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
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        items = (joined_parent_resp.get("result") or {}).get("list") or []
        assert not any(isinstance(item, dict) and item.get("threadId") == thread_id for item in items)
    finally:
        _cleanup_thread_context(device_a, device_b, assert_api, context)


@pytest.mark.real_e2e
@pytest.mark.case_id("thread.destroy_event.after_create_join.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.api("ChatThreadManager.createChatThread")
@pytest.mark.api("ChatThreadManager.joinChatThread")
@pytest.mark.api("ChatThreadManager.destroyChatThread")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
def test_chat_thread_destroy_event_received_by_group_member(device_a, device_b, assert_api, user_a, user_b):
    """destroyChatThread：子区创建后由 owner 解散，群成员收到 onChatThreadDestroy 事件并携带子区信息。"""
    context: dict = {}
    try:
        context = _create_thread_context(device_a, device_b, assert_api, user_a, user_b)
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
                "device": "deviceA",
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
        _cleanup_thread_context(device_a, device_b, assert_api, context)
