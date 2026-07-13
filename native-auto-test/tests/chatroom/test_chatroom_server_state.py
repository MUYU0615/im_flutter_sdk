from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd
from tests.chatroom.chatroom_helpers import create_chatroom_or_skip, safe_delete_chatroom


pytestmark = [pytest.mark.client, pytest.mark.chatroom]


def _expected_device(client) -> str:
    return getattr(client, "name", "deviceA")


@pytest.mark.real_e2e
@pytest.mark.case_id("chatroom.fetch_public_chat_rooms_from_server.success")
@pytest.mark.api("ChatRoomManager.fetchPublicChatRoomsFromServer")
@pytest.mark.clients("sender")
@pytest.mark.roles_mode("ordered")
@pytest.mark.e2e_flow("local_state")
@pytest.mark.topology_ready
def test_chatroom_fetch_public_chat_rooms_from_server_success(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、public、chat、rooms、from、服务端、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchPublicChatRoomsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天室查询/拉取场景所需的测试数据，场景为聊天室、拉取、public、chat、rooms、from、服务端、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatRoomManager.fetchPublicChatRoomsFromServer，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    client = topology_primary_or_device_a
    room_id = ""
    room_name = ""
    try:
        room_id, room_name = create_chatroom_or_skip(owner=user_a, name_prefix="public", desc_prefix="public")
        resp = client.call("ChatRoomManager", Cmd.fetchPublicChatRoomsFromServer.value, info={"pageNum": 1, "pageSize": 1})
        assert_api.assert_response_matches(
            resp,
            expected={
                "manager": "ChatRoomManager",
                "cmd": Cmd.fetchPublicChatRoomsFromServer.value,
                "device": _expected_device(client),
                "result": {
                    "count": 1,
                    "list": [
                        {
                            "roomId": room_id,
                            "owner": user_a,
                            "name": room_name,
                            "maxUsers": 0,
                            "permissionType": -1,
                            "isAllMemberMuted": False,
                            "adminList": [],
                            "memberCount": 0,
                            "muteList": [],
                            "muteExpireTimestamp": -1,
                            "createTimestamp": 0,
                            "memberList": [],
                            "isInWhitelist": False,
                            "blockList": [],
                            "desc": "",
                            "announcement": "",
                        }
                    ],
                },
            },
            ignore_keys={"sequence"},
        )
    finally:
        if room_id:
            safe_delete_chatroom(room_id)
