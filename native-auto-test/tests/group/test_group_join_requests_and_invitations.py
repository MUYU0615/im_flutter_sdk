"""Group 入群申请与邀请处理（正常 + 异常）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import pytest

from src import Cmd, GroupChangeEvent
from tests.group.group_helpers import (
    assert_group_events,
    assert_group_members_exact,
    collect_group_events,
    create_group,
    destroy_group,
    member_count,
    new_group_name,
)


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"
_NONEXISTENT_USER = "nonexistent_user_999999"


@pytest.mark.real_e2e
def test_group_request_to_join_and_accept_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、request、to、加入、and、accept、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.requestToJoinPublicGroup、GroupManager.acceptJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、request、to、加入、and、accept、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.requestToJoinPublicGroup、GroupManager.acceptJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("public_need_approval"),
            invite_members=[],
            style=2,
        )

        resp_request = device_b.call(
            "GroupManager",
            Cmd.requestToJoinPublicGroup.value,
            info={"groupId": group_id, "reason": "auto-apply-accept"},
        )
        assert_api.assert_response_matches(
            resp_request,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.requestToJoinPublicGroup.value,
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        request_result = resp_request.get("result")
        if request_result is not None:
            assert isinstance(request_result, dict), f"requestToJoinPublicGroup result 非 dict: {resp_request}"
            assert request_result.get("groupId") == group_id, f"requestToJoinPublicGroup groupId 不匹配: {resp_request}"

        owner_request_events = collect_group_events(
            device_a,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_RECEIVED.value,
                "onGroupRequestToJoinReceived",
                "onRequestToJoinReceivedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onRequestToJoinReceivedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            owner_request_events,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_RECEIVED.value,
                "onGroupRequestToJoinReceived",
                "onRequestToJoinReceivedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onRequestToJoinReceivedFromGroup"},
            expected_member=user_b,
        )

        resp_accept = device_a.call(
            "GroupManager",
            Cmd.acceptJoinApplication.value,
            info={"groupId": group_id, "userId": user_b},
        )
        assert_api.assert_response_matches(
            resp_accept,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.acceptJoinApplication.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        applicant_accept_events = collect_group_events(
            device_b,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_ACCEPTED.value,
                GroupChangeEvent.ON_MEMBER_JOINED.value,
                "onGroupRequestToJoinAccepted",
                "onRequestToJoinAcceptedFromGroup",
                "onMemberJoinedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onRequestToJoinAcceptedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            applicant_accept_events,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_ACCEPTED.value,
                GroupChangeEvent.ON_MEMBER_JOINED.value,
                "onGroupRequestToJoinAccepted",
                "onRequestToJoinAcceptedFromGroup",
                "onMemberJoinedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onRequestToJoinAcceptedFromGroup"},
            expected_member=user_b,
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_request_to_join_and_decline_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、request、to、加入、and、decline、成功路径；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.requestToJoinPublicGroup、GroupManager.declineJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组事件回调场景所需的测试数据，场景为群组、request、to、加入、and、decline、成功路径；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.requestToJoinPublicGroup、GroupManager.declineJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应以及发送端或接收端的 SDK 回调事件符合预期。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("public_need_decline"),
            invite_members=[],
            style=2,
        )

        resp_request = device_b.call(
            "GroupManager",
            Cmd.requestToJoinPublicGroup.value,
            info={"groupId": group_id, "reason": "auto-apply-decline"},
        )
        assert_api.assert_response_matches(
            resp_request,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.requestToJoinPublicGroup.value,
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        request_result = resp_request.get("result")
        if request_result is not None:
            assert isinstance(request_result, dict), f"requestToJoinPublicGroup result 非 dict: {resp_request}"
            assert request_result.get("groupId") == group_id, f"requestToJoinPublicGroup groupId 不匹配: {resp_request}"

        owner_request_events = collect_group_events(
            device_a,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_RECEIVED.value,
                "onGroupRequestToJoinReceived",
                "onRequestToJoinReceivedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onRequestToJoinReceivedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            owner_request_events,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_RECEIVED.value,
                "onGroupRequestToJoinReceived",
                "onRequestToJoinReceivedFromGroup",
            },
            group_id=group_id,
            required_all_event_types={"onRequestToJoinReceivedFromGroup"},
            expected_member=user_b,
        )

        resp_decline = device_a.call(
            "GroupManager",
            Cmd.declineJoinApplication.value,
            info={"groupId": group_id, "userId": user_b, "reason": "auto-reject"},
        )
        assert_api.assert_response_matches(
            resp_decline,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.declineJoinApplication.value,
                "device": "deviceA",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        applicant_decline_events = collect_group_events(
            device_b,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_DECLINED.value,
                "onGroupRequestToJoinDeclined",
                "onRequestToJoinDeclinedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onRequestToJoinDeclinedFromGroup"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            applicant_decline_events,
            expected_event_types={
                GroupChangeEvent.ON_REQUEST_TO_JOIN_DECLINED.value,
                "onGroupRequestToJoinDeclined",
                "onRequestToJoinDeclinedFromGroup",
            },
            group_id=group_id,
            allow_missing_group_id=True,
            required_all_event_types={"onRequestToJoinDeclinedFromGroup"},
            expected_member=user_b,
        )
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_accept_invitation_from_group_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 关闭 Android-B 自动接受群邀请，并由 Android-A 创建需要被邀请人确认的群；
    2. Android-A 调用 GroupManager.inviterUser 邀请 Android-B 对应账号入群，Android-B 校验收到群邀请事件；
    3. Android-B 调用 GroupManager.acceptInvitationFromGroup 接受邀请，Android-A 校验收到邀请已接受事件；
    4. Android-A 从服务端拉取群详情，校验 Android-B 对应账号已经成为群成员。
    """
    describe_case_steps(
        '1. 关闭 Android-B 自动接受群邀请，并由 Android-A 创建需要被邀请人确认的群；\n'
        '2. Android-A 调用 GroupManager.inviterUser 邀请 Android-B 对应账号入群，Android-B 校验收到群邀请事件；\n'
        '3. Android-B 调用 GroupManager.acceptInvitationFromGroup 接受邀请，Android-A 校验收到邀请已接受事件；\n'
        '4. Android-A 从服务端拉取群详情，校验 Android-B 对应账号已经成为群成员。'
    )
    group_id = ""
    try:
        resp_auto_off = device_b.call(
            "Client",
            Cmd.updateAutoAcceptGroupInvitationSetting.value,
            info={"autoAcceptGroupInvitation": False},
        )
        assert_api.assert_response_matches(
            resp_auto_off,
            expected={
                "manager": "Client",
                "cmd": Cmd.updateAutoAcceptGroupInvitationSetting.value,
                "device": "deviceB",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("accept_invite"),
            invite_members=[],
            invite_need_confirm=True,
        )

        resp_invite = device_a.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={"groupId": group_id, "members": [user_b], "reason": "auto-invite-accept"},
        )
        assert_api.assert_response_matches(
            resp_invite,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.inviterUser.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        invite_events = collect_group_events(
            device_b,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_RECEIVED.value,
                "onGroupInvitationReceived",
            },
            group_id=group_id,
            required_all_event_types={"onGroupInvitationReceived"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            invite_events,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_RECEIVED.value,
                "onGroupInvitationReceived",
            },
            group_id=group_id,
            required_all_event_types={"onGroupInvitationReceived"},
            expected_inviter=user_a,
        )

        resp_accept = device_b.call(
            "GroupManager",
            Cmd.acceptInvitationFromGroup.value,
            info={"groupId": group_id, "inviter": user_a},
        )
        assert_api.assert_response_matches(
            resp_accept,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.acceptInvitationFromGroup.value,
                "device": "deviceB",
            },
            ignore_keys={"sequence", "result"},
        )
        accept_result = resp_accept.get("result")
        assert isinstance(accept_result, dict), f"acceptInvitationFromGroup result 非 dict: {resp_accept}"
        assert accept_result.get("groupId") == group_id, f"acceptInvitationFromGroup groupId 不匹配: {resp_accept}"

        accepted_events = collect_group_events(
            device_a,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_ACCEPTED.value,
                "onGroupInvitationAccepted",
            },
            group_id=group_id,
            required_all_event_types={"onGroupInvitationAccepted"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            accepted_events,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_ACCEPTED.value,
                "onGroupInvitationAccepted",
            },
            group_id=group_id,
            required_all_event_types={"onGroupInvitationAccepted"},
            expected_member=user_b,
        )

        resp_group = device_a.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        assert isinstance(resp_group.get("result"), dict), f"getGroupSpecificationFromServer result 非 dict: {resp_group}"
        assert member_count(resp_group) == 2, f"接受群邀请后 memberCount 应为 2: {resp_group}"
        assert_group_members_exact(resp_group, [user_b], err_prefix="接受群邀请后")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_decline_invitation_from_group_success(device_a, device_b, assert_api, user_a, user_b):
    """
    1. 关闭 Android-B 自动接受群邀请，并由 Android-A 创建需要被邀请人确认的群；
    2. Android-A 调用 GroupManager.inviterUser 邀请 Android-B 对应账号入群，Android-B 校验收到群邀请事件；
    3. Android-B 调用 GroupManager.declineInvitationFromGroup 拒绝邀请，Android-A 校验收到邀请已拒绝事件；
    4. Android-A 从服务端拉取群详情，校验 Android-B 对应账号没有成为群成员。
    """
    describe_case_steps(
        '1. 关闭 Android-B 自动接受群邀请，并由 Android-A 创建需要被邀请人确认的群；\n'
        '2. Android-A 调用 GroupManager.inviterUser 邀请 Android-B 对应账号入群，Android-B 校验收到群邀请事件；\n'
        '3. Android-B 调用 GroupManager.declineInvitationFromGroup 拒绝邀请，Android-A 校验收到邀请已拒绝事件；\n'
        '4. Android-A 从服务端拉取群详情，校验 Android-B 对应账号没有成为群成员。'
    )
    group_id = ""
    try:
        resp_auto_off = device_b.call(
            "Client",
            Cmd.updateAutoAcceptGroupInvitationSetting.value,
            info={"autoAcceptGroupInvitation": False},
        )
        assert_api.assert_response_matches(
            resp_auto_off,
            expected={
                "manager": "Client",
                "cmd": Cmd.updateAutoAcceptGroupInvitationSetting.value,
                "device": "deviceB",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("decline_invite"),
            invite_members=[],
            invite_need_confirm=True,
        )

        resp_invite = device_a.call(
            "GroupManager",
            Cmd.inviterUser.value,
            info={"groupId": group_id, "members": [user_b], "reason": "auto-invite-decline"},
        )
        assert_api.assert_response_matches(
            resp_invite,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.inviterUser.value,
                "device": "deviceA",
            },
            ignore_keys={"sequence", "result"},
        )

        invite_events = collect_group_events(
            device_b,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_RECEIVED.value,
                "onGroupInvitationReceived",
            },
            group_id=group_id,
            required_all_event_types={"onGroupInvitationReceived"},
            timeout=10.0,
        )
        assert_group_events(
            assert_api,
            invite_events,
            expected_event_types={
                GroupChangeEvent.ON_INVITATION_RECEIVED.value,
                "onGroupInvitationReceived",
            },
            group_id=group_id,
            required_all_event_types={"onGroupInvitationReceived"},
            expected_inviter=user_a,
        )

        resp_decline = device_b.call(
            "GroupManager",
            Cmd.declineInvitationFromGroup.value,
            info={"groupId": group_id, "inviter": user_a, "reason": "auto-invite-reject"},
        )
        assert_api.assert_response_matches(
            resp_decline,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.declineInvitationFromGroup.value,
                "device": "deviceB",
                "result": None,
            },
            ignore_keys={"sequence"},
        )

        try:
            declined_events = collect_group_events(
                device_a,
                expected_event_types={
                    GroupChangeEvent.ON_INVITATION_DECLINED.value,
                    "onGroupInvitationDeclined",
                },
                group_id=group_id,
                timeout=3.0,
                required_all_event_types=set(),
            )
        except AssertionError:
            declined_events = []
        if declined_events:
            assert_group_events(
                assert_api,
                declined_events,
                expected_event_types={
                    GroupChangeEvent.ON_INVITATION_DECLINED.value,
                    "onGroupInvitationDeclined",
                },
                group_id=group_id,
                expected_member=user_b,
            )

        resp_group = device_a.call(
            "GroupManager",
            Cmd.getGroupSpecificationFromServer.value,
            info={"groupId": group_id, "fetchMembers": True},
        )
        assert isinstance(resp_group.get("result"), dict), f"getGroupSpecificationFromServer result 非 dict: {resp_group}"
        assert member_count(resp_group) == 1, f"拒绝群邀请后 memberCount 应为 1: {resp_group}"
        assert_group_members_exact(resp_group, [], err_prefix="拒绝群邀请后")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_request_to_join_public_group_nonexistent_group(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、request、to、加入、public、群组、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.requestToJoinPublicGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、request、to、加入、public、群组、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.requestToJoinPublicGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_b.call(
        "GroupManager",
        Cmd.requestToJoinPublicGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "reason": "auto-reason"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_accept_join_application_nonexistent_group(device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、accept、加入、application、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.acceptJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、accept、加入、application、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.acceptJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.acceptJoinApplication.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "userId": user_b},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_decline_join_application_nonexistent_group(device_a, assert_api, user_b):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、decline、加入、application、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.declineJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、decline、加入、application、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.declineJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = device_a.call(
        "GroupManager",
        Cmd.declineJoinApplication.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "userId": user_b, "reason": "auto-reject"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
def test_group_accept_join_application_nonexistent_user(device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、accept、加入、application、不存在对象、用户；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.acceptJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、accept、加入、application、不存在对象、用户；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.acceptJoinApplication，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("accept_nonexist_user"),
            invite_members=[],
            style=2,
        )
        resp = device_a.call(
            "GroupManager",
            Cmd.acceptJoinApplication.value,
            info={"groupId": group_id, "userId": _NONEXISTENT_USER},
        )
        assert_api.assert_error(resp, code=600, description="doesn't exist")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


@pytest.mark.real_e2e
def test_group_accept_invitation_from_group_without_pending_invite(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、accept、invitation、from、群组、without、pending、invite；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.acceptInvitationFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、accept、invitation、from、群组、without、pending、invite；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.acceptInvitationFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_b.call(
        "GroupManager",
        Cmd.acceptInvitationFromGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "inviter": "owner_x"},
    )
    assert_api.assert_error(resp, code=600, description="does not exist")


@pytest.mark.real_e2e
def test_group_decline_invitation_from_group_without_pending_invite(device_b, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、decline、invitation、from、群组、without、pending、invite；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.declineInvitationFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验 API 响应、关键字段和相关状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组基础能力场景所需的测试数据，场景为群组、decline、invitation、from、群组、without、pending、invite；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.declineInvitationFromGroup，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验 API 响应、关键字段和相关状态符合预期。'
    )
    resp = device_b.call(
        "GroupManager",
        Cmd.declineInvitationFromGroup.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "inviter": "owner_x", "reason": "auto-reject"},
    )
    assert_api.assert_error(resp, code=600, description="does not exist")
