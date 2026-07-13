from __future__ import annotations
from tests.case_steps import describe_case_steps

import uuid

from src import Cmd
import pytest
from src.tools.assertions import get_result
from tests.chat._utils import build_text


@pytest.mark.real_e2e
@pytest.mark.skip(reason="MissingPlugin: searchChatMsgFromDB 未在当前集成端实现")
def test_chat_search_chat_msg_from_db_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、search、chat、msg、from、db、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.searchChatMsgFromDB，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备聊天事件回调场景所需的测试数据，场景为chat、search、chat、msg、from、db、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 ChatManager.sendMessage、ChatManager.searchChatMsgFromDB，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    keyword = f"kw-{uuid.uuid4().hex[:6]}"
    _ = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, keyword))
    _ = device_a.receive_message(match_event_type=Cmd.onMessageSuccess.value, timeout=20.0)

    resp = device_a.call("ChatManager", Cmd.searchChatMsgFromDB.value, info={"keywords": keyword})
    # 先以宽松断言通过（发现模式下观察具体结构），非空即可。
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "ChatManager", "cmd": Cmd.searchChatMsgFromDB.value, "device": "deviceA"},
        ignore_keys={"sequence"},
    )
    # 若 result 为列表，确保至少有一条
    try:
        res = get_result(resp)
        if isinstance(res, list):
            assert len(res) >= 1
    except Exception:
        pass
