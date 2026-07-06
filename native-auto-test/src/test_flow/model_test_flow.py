"""
多步业务流封装（仅当同一用例中重复出现「多步操作」时使用）。

- 放在本文件：如加好友→同意→删好友、拉黑/拉黑名单等**组合流程**，避免 test 里堆重复代码。
- **不要**放入本文件：只对单个 `cmd` 做一次 `call` 的用例，直接在 `tests/test_*.py` 里写 `device_x.call` + `assert_response_matches` / `assert_error`。

当前实现：联系人模块 `ContactTestFlow`（device 由调用方传入，不绑死在实例上）。
"""
from __future__ import annotations

from typing import Any
import time

from .. import Cmd
from ..sdk_api.event_keys import ContactChangeEvent


def receive_contact_changed_event(device: Any, contact_type: str, *, timeout: float = 10.0) -> dict[str, Any] | None:
    """接收联系人变更事件：外层统一为 onContactChanged，具体类型在 data.type。"""
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None
        event = device.receive_message(
            match_event_type=Cmd.onContactChanged.value,
            timeout=min(1.0, remaining),
        )
        if event is None:
            continue
        data = event.get("data")
        if isinstance(data, dict) and data.get("type") == contact_type:
            return event


class ContactTestFlow:
    """仅持有 assert_api；具体在哪个 device 上操作由方法参数传入。"""

    def __init__(self, assert_api: Any) -> None:
        self._api = assert_api

    def establish_friends(
        self,
        initiator: Any,
        peer: Any,
        user_a: str,
        user_b: str,
        *,
        reason: str = "flow",
    ) -> None:
        """initiator 添加 user_b，peer 侧同意；消费邀请与同意相关回调。"""
        self._api.assert_success(
            initiator.call(
                "ContactManager",
                Cmd.addContact.value,
                info={"userId": user_b, "reason": reason},
            )
        )
        assert receive_contact_changed_event(
            peer,
            ContactChangeEvent.INVITED.value,
            timeout=10.0,
        )
        self._api.assert_success(
            peer.call(
                "ContactManager",
                Cmd.acceptInvitation.value,
                info={"userId": user_a},
            )
        )

    def delete_friend(
        self,
        initiator: Any,
        friend_user_id: str,
        *,
        keep_conversation: bool = True,
        wait_event: bool = True,
    ) -> None:
        """在 initiator 连接上删除好友；需要时消费 CONTACT_DELETE。"""
        self._api.assert_success(
            initiator.call(
                "ContactManager",
                Cmd.deleteContact.value,
                info={"userId": friend_user_id, "keepConversation": keep_conversation},
            )
        )
        if not wait_event:
            return
        assert receive_contact_changed_event(
            initiator,
            ContactChangeEvent.CONTACT_DELETE.value,
            timeout=10.0,
        )

    def get_all_contacts_from_server(self, device: Any) -> dict[str, Any]:
        """拉取指定 device 的好友列表原始响应，由用例层 assert_response_matches。"""
        return device.call("ContactManager", Cmd.getAllContactsFromServer.value, info={})

    def get_block_list(self, device: Any) -> dict[str, Any]:
        """拉取指定 device 的黑名单原始响应，由用例层 assert_response_matches。"""
        return device.call("ContactManager", Cmd.getBlockListFromServer.value, info={})

    def add_to_block_list(self, device: Any, user_id: str) -> None:
        self._api.assert_success(
            device.call(
                "ContactManager",
                Cmd.addUserToBlockList.value,
                info={"userId": user_id},
            )
        )

    def remove_from_block_list(self, device: Any, user_id: str) -> dict[str, Any]:
        """取消拉黑；返回原始响应，由用例 assert_response_matches / assert_error。"""
        return device.call(
            "ContactManager",
            Cmd.removeUserFromBlockList.value,
            info={"userId": user_id},
        )
