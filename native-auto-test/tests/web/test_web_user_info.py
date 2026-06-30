"""Web UserInfoManager foundation API regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.client]


def test_web_user_info_update_then_fetch(primary_device, assert_api, user_a, user_b, require_capability):
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
            "nickName": "web-nick-a",
            "sign": "web-sign-a",
            "mail": "web-a@example.com",
        },
    )
    assert_api.assert_result_matches(
        update,
        userId=user_a,
        nickName="web-nick-a",
        sign="web-sign-a",
        mail="web-a@example.com",
    )

    update_type = primary_device.call(
        "UserInfoManager",
        Cmd.updateOwnUserInfoWithType.value,
        info={"userInfoType": 5, "userInfoValue": "web-sign-b"},
    )
    assert_api.assert_result_matches(
        update_type,
        userId=user_a,
        sign="web-sign-b",
    )

    own = primary_device.call("UserInfoManager", Cmd.fetchOwnInfo.value, info={})
    assert_api.assert_result_equals(
        own,
        {
            "userId": user_a,
            "nickName": "web-nick-a",
            "sign": "web-sign-b",
            "mail": "web-a@example.com",
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
                "nickName": "web-nick-a",
                "sign": "web-sign-b",
                "mail": "web-a@example.com",
            },
            user_b: {"userId": user_b},
        },
    )

    partial = primary_device.call(
        "UserInfoManager",
        Cmd.fetchUserInfoByIdWithType.value,
        info={"userIds": [user_a], "userInfoTypes": [0, 5]},
    )
    assert_api.assert_result_equals(
        partial,
        {
            user_a: {
                "userId": user_a,
                "nickName": "web-nick-a",
                "sign": "web-sign-b",
            },
        },
    )
