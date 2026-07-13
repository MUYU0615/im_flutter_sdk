from __future__ import annotations
from tests.case_steps import describe_case_steps

from uuid import uuid4

import pytest

from src import Cmd
from src.tools.response_match import ge


pytestmark = [pytest.mark.client, pytest.mark.chatroom, pytest.mark.agorachat1_4_0]


def _nonexistent_room_id() -> str:
    return f"nonexistent_chatroom_{uuid4().hex[:12]}"


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_room_info.nonexistent.error")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_room_info_nonexistent(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、room、信息、不存在对象；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、room、信息、不存在对象；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id = _nonexistent_room_id()
    resp = device_a.call("ChatRoomManager", Cmd.fetchChatRoomInfoFromServer.value, info={"roomId": room_id})
    assert_api.assert_error(resp, code=700, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.destroy_room.nonexistent.error")
@pytest.mark.api("ChatRoomManager.destroyChatRoom")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_destroy_room_nonexistent(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、销毁、room、不存在对象；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、销毁、room、不存在对象；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id = _nonexistent_room_id()
    resp = device_a.call("ChatRoomManager", Cmd.destroyChatRoom.value, info={"roomId": room_id})
    assert_api.assert_error(resp, code=700, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.join_room.nonexistent.current_error")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.clients("receiver")
@pytest.mark.roles_mode("ordered")
def test_chatroom_join_room_nonexistent_current_behavior(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、加入、room、不存在对象、current、behavior；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、加入、room、不存在对象、current、behavior；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id = _nonexistent_room_id()
    resp = device_b.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": room_id})
    assert_api.assert_error(resp, code=705, description="Chat room does not exist")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.join_room.empty_id.error")
@pytest.mark.api("ChatRoomManager.joinChatRoom")
@pytest.mark.clients("receiver")
@pytest.mark.roles_mode("ordered")
def test_chatroom_join_room_empty_id(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、加入、room、空值参数、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、加入、room、空值参数、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.joinChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_b.call("ChatRoomManager", Cmd.joinChatRoom.value, info={"roomId": ""})
    assert_api.assert_error(resp, code=700, description="Chat room ID is invalid")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.leave_room.nonexistent.current_bool")
@pytest.mark.api("ChatRoomManager.leaveChatRoom")
@pytest.mark.clients("receiver")
@pytest.mark.roles_mode("ordered")
def test_chatroom_leave_room_nonexistent(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、离开、room、不存在对象；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.leaveChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、离开、room、不存在对象；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.leaveChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id = _nonexistent_room_id()
    resp = device_b.call("ChatRoomManager", Cmd.leaveChatRoom.value, info={"roomId": room_id})
    assert_api.assert_response_matches(
        resp,
        expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.leaveChatRoom.value,
                "device": "deviceB",
            },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp.get("result"), bool), f"leaveChatRoom 当前端返回应为 bool: {resp}"


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.leave_room.empty_id.current_bool")
@pytest.mark.api("ChatRoomManager.leaveChatRoom")
@pytest.mark.clients("receiver")
@pytest.mark.roles_mode("ordered")
def test_chatroom_leave_room_empty_id(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、离开、room、空值参数、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.leaveChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、离开、room、空值参数、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.leaveChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_b.call("ChatRoomManager", Cmd.leaveChatRoom.value, info={"roomId": ""})
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatRoomManager",
            "cmd": Cmd.leaveChatRoom.value,
            "device": "deviceB",
        },
        ignore_keys={"sequence", "result"},
    )
    assert isinstance(resp.get("result"), bool), f"leaveChatRoom 空 roomId 当前端返回应为 bool: {resp}"


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_room_info.empty_id.error")
@pytest.mark.api("ChatRoomManager.fetchChatRoomInfoFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_room_info_empty_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、room、信息、空值参数、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、room、信息、空值参数、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomInfoFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatRoomManager", Cmd.fetchChatRoomInfoFromServer.value, info={"roomId": ""})
    assert_api.assert_error(resp, code=700, description="Chat room ID is invalid")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_members.nonexistent_room.error")
@pytest.mark.api("ChatRoomManager.fetchChatRoomMembers")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_members_nonexistent_room(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、成员、不存在对象、room；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、成员、不存在对象、room；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    room_id = _nonexistent_room_id()
    resp = device_a.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMembers.value,
        info={"roomId": room_id, "cursor": "", "pageSize": 20},
    )
    assert_api.assert_error(resp, code=700, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_members.empty_room_id.error")
@pytest.mark.api("ChatRoomManager.fetchChatRoomMembers")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_members_empty_room_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、成员、空值参数、room、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、成员、空值参数、room、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchChatRoomMembers，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatRoomManager",
        Cmd.fetchChatRoomMembers.value,
        info={"roomId": "", "cursor": "", "pageSize": 20},
    )
    assert_api.assert_error(resp, code=700, description="Chat room ID is invalid")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.destroy_room.empty_id.error")
@pytest.mark.api("ChatRoomManager.destroyChatRoom")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_destroy_room_empty_id(device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、销毁、room、空值参数、id；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、销毁、room、空值参数、id；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.destroyChatRoom，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call("ChatRoomManager", Cmd.destroyChatRoom.value, info={"roomId": ""})
    assert_api.assert_error(resp, code=700, description="Chat room ID is invalid")


@pytest.mark.parametrize(
    ("page_num", "page_size"),
    [
        (0, 1),
        (-1, 1),
        (1, 0),
        (1, -1),
    ],
)
@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_public_chat_rooms.invalid_paging.current_result")
@pytest.mark.api("ChatRoomManager.fetchPublicChatRoomsFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
def test_chatroom_fetch_public_chat_rooms_invalid_paging(device_a, assert_api, page_num, page_size):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、public、chat、rooms、无效参数、paging；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchPublicChatRoomsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室异常/边界场景所需的测试数据，场景为聊天室、拉取、public、chat、rooms、无效参数、paging；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchPublicChatRoomsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "ChatRoomManager",
        Cmd.fetchPublicChatRoomsFromServer.value,
        info={"pageNum": page_num, "pageSize": page_size},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "ChatRoomManager",
            "cmd": Cmd.fetchPublicChatRoomsFromServer.value,
            "device": "deviceA",
            "result": {
                "count": ge(0),
            },
        },
        ignore_keys={"sequence", "list"},
    )
    result = resp.get("result")
    assert isinstance(result, dict), f"result 应为 dict，实际: {result!r}"
    room_list = result.get("list")
    assert isinstance(room_list, list), f"result.list 应为 list，实际: {room_list!r}"
    if room_list:
        sample = room_list[0]
        assert isinstance(sample, dict), f"聊天室条目应为 dict，实际: {sample!r}"
        required_keys = {
            "roomId",
            "owner",
            "name",
            "maxUsers",
            "permissionType",
            "isAllMemberMuted",
            "adminList",
            "memberCount",
            "muteList",
            "muteExpireTimestamp",
            "createTimestamp",
            "memberList",
            "isInWhitelist",
            "blockList",
            "desc",
            "announcement",
        }
        missing = sorted(required_keys - set(sample.keys()))
        assert not missing, f"聊天室条目缺少关键字段: {missing}, sample={sample!r}"
