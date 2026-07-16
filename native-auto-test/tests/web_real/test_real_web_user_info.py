"""Real Web SDK/service UserInfoManager E2E cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client, pytest.mark.real_web]


def test_real_web_user_info_update_events_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
):
    nick_name = f"web-own-event-{uuid.uuid4().hex[:8]}"
    sign = f"web-user-event-{uuid.uuid4().hex[:8]}"

    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    subscribe = secondary_device.call(
        "UserInfoManager",
        Cmd.subscribeUsersInfo.value,
        info={"userIds": [user_a]},
    )
    subscribe_error = assert_api.get_error(subscribe)
    if "subscribeUsersInfo failed" in str(subscribe_error.get("description", "")):
        pytest.skip("当前 Web appkey/服务未开通用户资料订阅能力：subscribeUsersInfo REST business error")
    assert_api.get_result(subscribe)
    subscribed = secondary_device.call(
        "UserInfoManager",
        Cmd.fetchSubscribedUsers.value,
        info={},
    )
    subscribed_result = assert_api.get_result(subscribed)
    assert isinstance(subscribed_result, dict)
    assert user_a in subscribed_result
    secondary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": [user_a]},
    )
    primary_device.drain_events(timeout=0.5)
    secondary_device.drain_events(timeout=0.5)

    update = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={"nickName": nick_name, "sign": sign},
    )
    update_result = assert_api.get_result(update)
    assert isinstance(update_result, dict)
    assert update_result.get("userId") == user_a

    own_event = primary_device.receive_message(
        match_event_type="onOwnInfoUpdated",
        timeout=10.0,
    )
    assert own_event is not None
    own_data = own_event.get("data")
    assert isinstance(own_data, dict)
    assert own_data.get("userId") == user_a
    assert own_data.get("nickName") == nick_name
    assert own_data.get("sign") == sign

    sign_by_type = f"web-user-event-type-{uuid.uuid4().hex[:8]}"
    typed_update = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfoWithType.value,
        info={"userInfoType": 5, "userInfoValue": sign_by_type},
    )
    typed_update_result = assert_api.get_result(typed_update)
    assert isinstance(typed_update_result, dict)
    assert typed_update_result.get("userId") == user_a
    assert typed_update_result.get("nickName") == nick_name
    assert typed_update_result.get("sign") == sign_by_type

    user_event = secondary_device.receive_message(
        match_event_type="onUserInfoUpdated",
        timeout=10.0,
    )
    assert user_event is not None
    user_data = user_event.get("data")
    assert isinstance(user_data, list)
    assert any(
        isinstance(item, dict)
        and item.get("userId") == user_a
        and item.get("nickName") == nick_name
        and item.get("sign") == sign_by_type
        for item in user_data
    )


def test_real_web_user_info_update_and_fetch(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
):
    nick_name = f"web-nick-{uuid.uuid4().hex[:8]}"
    sign = f"web-sign-{uuid.uuid4().hex[:8]}"

    update = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={"nickName": nick_name, "sign": sign},
    )
    update_result = assert_api.get_result(update)
    assert isinstance(update_result, dict)
    assert update_result.get("userId") == user_a
    assert update_result.get("nickName") == nick_name
    assert update_result.get("sign") == sign

    fetched = secondary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": [user_a]},
    )
    fetched_result = assert_api.get_result(fetched)
    assert isinstance(fetched_result, dict)
    user_info = fetched_result.get(user_a)
    assert isinstance(user_info, dict)
    assert user_info.get("userId") == user_a
    assert user_info.get("nickName") == nick_name
    assert user_info.get("sign") == sign

    typed = secondary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={"userIds": [user_a], "userInfoTypes": [0, 5]},
    )
    typed_result = assert_api.get_result(typed)
    assert isinstance(typed_result, dict)
    typed_user_info = typed_result.get(user_a)
    assert isinstance(typed_user_info, dict)
    assert typed_user_info.get("userId") == user_a
    assert typed_user_info.get("nickName") == nick_name
    assert typed_user_info.get("sign") == sign

    typed_sign = f"web-sign-type-{uuid.uuid4().hex[:8]}"
    typed_update = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfoWithType.value,
        info={"userInfoType": 5, "userInfoValue": typed_sign},
    )
    typed_update_result = assert_api.get_result(typed_update)
    assert isinstance(typed_update_result, dict)
    assert typed_update_result.get("userId") == user_a
    assert typed_update_result.get("nickName") == nick_name
    assert typed_update_result.get("sign") == typed_sign

    own = primary_device.call(
        "UserInfoManager",
        Cmd.fetchOwnInfo.value,
        info={},
    )
    own_result = assert_api.get_result(own)
    assert isinstance(own_result, dict)
    assert own_result.get("userId") == user_a
    assert own_result.get("nickName") == nick_name
    assert own_result.get("sign") == typed_sign

    typed_after_update = secondary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={"userIds": [user_a], "userInfoTypes": [0, 5]},
    )
    typed_after_update_result = assert_api.get_result(typed_after_update)
    assert isinstance(typed_after_update_result, dict)
    typed_after_update_user_info = typed_after_update_result.get(user_a)
    assert isinstance(typed_after_update_user_info, dict)
    assert typed_after_update_user_info.get("userId") == user_a
    assert typed_after_update_user_info.get("nickName") == nick_name
    assert typed_after_update_user_info.get("sign") == typed_sign
