"""Web UserInfoManager typed field filter regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


def test_web_user_info_type_filters_and_unknown_users_are_stable(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.updateOwnUserInfo,
        Cmd.updateOwnUserInfoWithType,
        Cmd.fetchOwnInfo,
        Cmd.fetchUserInfoById,
        Cmd.fetchUserInfoByIdWithType,
    ):
        require_capability("UserInfoManager", cmd.value)

    update = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfo.value,
        info={
            "nickName": "web-type-nick",
            "mail": "web-type@example.com",
            "sign": "web-type-sign",
            "phone": "13800000000",
        },
    )
    assert_api.assert_result_matches(
        update,
        userId=user_a,
        nickName="web-type-nick",
        mail="web-type@example.com",
        sign="web-type-sign",
        phone="13800000000",
    )

    update_unknown_type = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfoWithType.value,
        info={"userInfoType": 9999, "userInfoValue": "ignored"},
    )
    assert_api.assert_result_matches(update_unknown_type, userId=user_a, nickName="web-type-nick")

    own = primary_device.call("UserInfoManager", Cmd.fetchOwnInfo.value, info={})
    assert_api.assert_result_equals(
        own,
        {
            "userId": user_a,
            "nickName": "web-type-nick",
            "mail": "web-type@example.com",
            "sign": "web-type-sign",
            "phone": "13800000000",
        },
    )

    partial = primary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={"userIds": [user_a, user_b], "userInfoTypes": [0, 2, 5, 9999]},
    )
    assert_api.assert_result_equals(
        partial,
        {
            user_a: {
                "userId": user_a,
                "nickName": "web-type-nick",
                "mail": "web-type@example.com",
                "sign": "web-type-sign",
            },
            user_b: {"userId": user_b},
        },
    )

    full = primary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoById.value,
        info={"userIds": [user_a, user_b]},
    )
    assert_api.assert_result_equals(
        full,
        {
            user_a: {
                "userId": user_a,
                "nickName": "web-type-nick",
                "mail": "web-type@example.com",
                "sign": "web-type-sign",
                "phone": "13800000000",
            },
            user_b: {"userId": user_b},
        },
    )
