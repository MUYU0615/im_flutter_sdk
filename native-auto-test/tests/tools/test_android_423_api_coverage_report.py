import pytest
from pathlib import Path

from src.tools.android_423_api_coverage_report import (
    _automation_evidence_kind,
    build_rows,
    summarize,
)
from tests.conftest import _all_items_marked_no_global_login


pytestmark = pytest.mark.no_global_login


P1_EQUIVALENT_APIS = {
    "addReaction": "ChatManager.addReaction",
    "asyncFetchHistoryMessage": "ChatManager.fetchHistoryMessages",
    "asyncRecallMessage": "ChatManager.recallMessage",
    "cleanConversationsMemoryCache": "ChatManager.cleanConversationsMemoryCache",
    "fetchGroupReadAcks": "ChatManager.asyncFetchGroupAcks",
    "getConversationsByType": "ChatManager.getConversationsByType",
    "getReactionDetail": "ChatManager.fetchReactionDetail",
    "getReactionList": "ChatManager.fetchReactionList",
    "removeReaction": "ChatManager.removeReaction",
}

TASK5_EQUIVALENT_APIS = {
    ("ContactManager", "asyncAcceptInvitation"): "ContactManager.acceptInvitation",
    ("ContactManager", "asyncAddContact"): "ContactManager.addContact",
    ("ContactManager", "asyncAddUserToBlackList"): "ContactManager.addUserToBlockList",
    ("ContactManager", "asyncDeclineInvitation"): "ContactManager.declineInvitation",
    ("ContactManager", "asyncDeleteContact"): "ContactManager.deleteContact",
    ("ContactManager", "asyncGetAllContactsFromServer"): "ContactManager.getAllContactsFromServer",
    ("ContactManager", "asyncGetBlackListFromServer"): "ContactManager.getBlockListFromServer",
    ("ContactManager", "asyncGetSelfIdsOnOtherPlatform"): "ContactManager.getSelfIdsOnOtherPlatform",
    ("ContactManager", "asyncRemoveUserFromBlackList"): "ContactManager.removeUserFromBlockList",
    ("PushManager", "updatePushDisplayStyle"): "PushManager.updateImPushStyle",
    ("PushManager", "updatePushNickname"): "PushManager.updatePushNickname",
    ("UserInfoManager", "getUserInfoWithUserId"): "UserInfoManager.fetchUserInfoById",
    ("UserInfoManager", "getUserInfoWithUserIds"): "UserInfoManager.fetchUserInfoById",
}

TASK6_CHATROOM_EQUIVALENT_APIS = {
    ("ChatRoomManager", "asyncAddChatRoomAdmin"): "ChatRoomManager.addChatRoomAdmin",
    ("ChatRoomManager", "asyncBlockChatroomMembers"): "ChatRoomManager.blockChatRoomMembers",
    ("ChatRoomManager", "asyncChangeChatRoomSubject"): "ChatRoomManager.changeChatRoomSubject",
    ("ChatRoomManager", "asyncChangeChatroomDescription"): "ChatRoomManager.changeChatRoomDescription",
    ("ChatRoomManager", "asyncChangeOwner"): "ChatRoomManager.changeChatRoomOwner",
    ("ChatRoomManager", "asyncCreateChatRoom"): "ChatRoomManager.createChatRoom",
    ("ChatRoomManager", "asyncDestroyChatRoom"): "ChatRoomManager.destroyChatRoom",
    ("ChatRoomManager", "asyncFetchChatRoomAllAttributesFromServer"): "ChatRoomManager.fetchChatRoomAttributes",
    ("ChatRoomManager", "asyncFetchChatRoomAnnouncement"): "ChatRoomManager.fetchChatRoomAnnouncement",
    ("ChatRoomManager", "asyncFetchChatRoomBlackList"): "ChatRoomManager.fetchChatRoomBlockList",
    ("ChatRoomManager", "asyncFetchChatRoomFromServer"): "ChatRoomManager.fetchChatRoomInfoFromServer",
    ("ChatRoomManager", "asyncFetchChatRoomMembers"): "ChatRoomManager.fetchChatRoomMembers",
    ("ChatRoomManager", "asyncFetchChatRoomMuteList"): "ChatRoomManager.fetchChatRoomMuteList",
    ("ChatRoomManager", "asyncMuteChatRoomMembers"): "ChatRoomManager.muteChatRoomMembers",
    ("ChatRoomManager", "asyncRemoveChatRoomAdmin"): "ChatRoomManager.removeChatRoomAdmin",
    ("ChatRoomManager", "asyncRemoveChatRoomAttributeFromServer"): "ChatRoomManager.removeChatRoomAttributes",
    ("ChatRoomManager", "asyncRemoveChatRoomAttributeFromServerForced"): "ChatRoomManager.removeChatRoomAttributes",
    ("ChatRoomManager", "asyncRemoveChatRoomMembers"): "ChatRoomManager.removeChatRoomMembers",
    ("ChatRoomManager", "asyncSetChatroomAttribute"): "ChatRoomManager.setChatRoomAttributes",
    ("ChatRoomManager", "asyncSetChatroomAttributeForced"): "ChatRoomManager.setChatRoomAttributes",
    ("ChatRoomManager", "asyncUnBlockChatRoomMembers"): "ChatRoomManager.unBlockChatRoomMembers",
    ("ChatRoomManager", "asyncUnMuteChatRoomMembers"): "ChatRoomManager.unMuteChatRoomMembers",
    ("ChatRoomManager", "asyncUpdateChatRoomAnnouncement"): "ChatRoomManager.updateChatRoomAnnouncement",
    ("ChatRoomManager", "fetchChatRoomMembers"): "ChatRoomManager.fetchChatRoomMembers",
    ("ChatRoomManager", "fetchPublicChatRoomsFromServer"): "ChatRoomManager.fetchPublicChatRoomsFromServer",
}

TASK6_CHATROOM_TARGET_CASES = {
    ("ChatRoomManager", "asyncChangeChatRoomSubject"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncChangeChatroomDescription"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    (
        "ChatRoomManager",
        "asyncFetchChatRoomAllAttributesFromServer",
    ): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncFetchChatRoomAnnouncement"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncFetchChatRoomBlackList"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncFetchChatRoomMuteList"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    (
        "ChatRoomManager",
        "asyncRemoveChatRoomAttributeFromServer",
    ): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    (
        "ChatRoomManager",
        "asyncRemoveChatRoomAttributeFromServerForced",
    ): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncSetChatroomAttribute"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncSetChatroomAttributeForced"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "asyncUpdateChatRoomAnnouncement"): "native-auto-test/tests/chatroom/test_chatroom_management_basics.py",
    ("ChatRoomManager", "fetchPublicChatRoomsFromServer"): "native-auto-test/tests/chatroom/test_chatroom_server_state.py",
}

TASK7A_GROUP_EQUIVALENT_APIS = {
    ("GroupManager", "createGroup"): "GroupManager.createGroup",
    ("GroupManager", "destroyGroup"): "GroupManager.destroyGroup",
    ("GroupManager", "leaveGroup"): "GroupManager.leaveGroup",
    ("GroupManager", "asyncJoinGroup"): "GroupManager.joinPublicGroup",
    ("GroupManager", "getJoinedGroupsFromServer"): "GroupManager.getJoinedGroupsFromServer",
    ("GroupManager", "getPublicGroupsFromServer"): "GroupManager.getPublicGroupsFromServer",
    ("GroupManager", "asyncGetGroupFromServer"): "GroupManager.getGroupSpecificationFromServer",
    ("GroupManager", "applyJoinToGroup"): "GroupManager.requestToJoinPublicGroup",
    ("GroupManager", "acceptApplication"): "GroupManager.acceptJoinApplication",
    ("GroupManager", "declineApplication"): "GroupManager.declineJoinApplication",
    ("GroupManager", "acceptInvitation"): "GroupManager.acceptInvitationFromGroup",
    ("GroupManager", "declineInvitation"): "GroupManager.declineInvitationFromGroup",
    ("GroupManager", "changeGroupName"): "GroupManager.updateGroupSubject",
    ("GroupManager", "changeGroupDescription"): "GroupManager.updateDescription",
    ("GroupManager", "changeGroupAvatar"): "GroupManager.updateGroupAvatar",
    ("GroupManager", "changeOwner"): "GroupManager.updateGroupOwner",
}

TASK7A_GROUP_TARGET_CASES = {
    ("GroupManager", "createGroup"): "native-auto-test/tests/group/group_helpers.py",
    ("GroupManager", "destroyGroup"): "native-auto-test/tests/group/group_helpers.py",
    ("GroupManager", "leaveGroup"): "native-auto-test/tests/group/test_group_members.py",
    ("GroupManager", "asyncJoinGroup"): "native-auto-test/tests/group/test_group_members.py",
    ("GroupManager", "getJoinedGroupsFromServer"): "native-auto-test/tests/group/test_group_joined_groups.py",
    ("GroupManager", "getPublicGroupsFromServer"): "native-auto-test/tests/group/test_group_public_groups_count.py",
    ("GroupManager", "asyncGetGroupFromServer"): "native-auto-test/tests/group/test_group_lifecycle.py",
    ("GroupManager", "applyJoinToGroup"): "native-auto-test/tests/group/test_group_join_requests_and_invitations.py",
    ("GroupManager", "acceptApplication"): "native-auto-test/tests/group/test_group_join_requests_and_invitations.py",
    ("GroupManager", "declineApplication"): "native-auto-test/tests/group/test_group_join_requests_and_invitations.py",
    ("GroupManager", "acceptInvitation"): "native-auto-test/tests/group/test_group_join_requests_and_invitations.py",
    ("GroupManager", "declineInvitation"): "native-auto-test/tests/group/test_group_join_requests_and_invitations.py",
    ("GroupManager", "changeGroupName"): "native-auto-test/tests/group/test_group_metadata.py",
    ("GroupManager", "changeGroupDescription"): "native-auto-test/tests/group/test_group_metadata.py",
    ("GroupManager", "changeGroupAvatar"): "native-auto-test/tests/group/test_group_remaining_api_coverage.py",
    ("GroupManager", "changeOwner"): "native-auto-test/tests/group/test_group_roles.py",
}


class _FakeItem:
    def __init__(self, marked: bool):
        self.marked = marked

    def get_closest_marker(self, name):
        if name == "no_global_login" and self.marked:
            return object()
        return None


def test_no_global_login_requires_all_collected_items_marked():
    assert _all_items_marked_no_global_login([_FakeItem(True), _FakeItem(True)]) is True
    assert _all_items_marked_no_global_login([_FakeItem(True), _FakeItem(False)]) is False
    assert _all_items_marked_no_global_login([]) is False


def test_chat_manager_p1_equivalent_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "ChatManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for api, wrapper in P1_EQUIVALENT_APIS.items():
        row = rows[("ChatManager", api, "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert wrapper in row["covered_by_wrapper_api"]

    row = rows[("ChatManager", "getConversationsByType", "native_android_api")]
    assert row["target_case"] == "native-auto-test/tests/chat/test_chat_s1_local_conversation.py"


def test_chat_manager_unimplemented_native_conversation_load_apis_stay_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "ChatManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for api in ("getAllConversations", "loadAllConversations"):
        row = rows[("ChatManager", api, "native_android_api")]
        assert row["coverage_conclusion"] == "wrapper_missing"
        assert row["android_covered"] == "no"
        assert row["review_action"] == "expose_wrapper"


def test_task5_equivalent_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "ContactManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, wrapper in TASK5_EQUIVALENT_APIS.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert wrapper in row["covered_by_wrapper_api"]

    for key in (
        ("ContactManager", "asyncSaveBlackList"),
        ("ContactManager", "saveBlackList"),
        ("UserInfoManager", "fetchSubscribedUsers"),
        ("UserInfoManager", "subscribeUsersInfo"),
        ("UserInfoManager", "unsubscribeUsersInfo"),
    ):
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "wrapper_missing"
        assert row["android_covered"] == "no"
        assert row["review_action"] == "expose_wrapper"


def test_task5_listener_lifecycle_reviews_are_indirect_not_wrapper_gaps():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "PresenceManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key in (
        ("ContactManager", "setContactListener"),
        ("PresenceManager", "clearListeners"),
    ):
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["review_action"] == "listener_registration_internal"
        assert row["native_test_requirement"] == "indirect_e2e"
        assert row["coverage_conclusion"] == "indirect_covered_by_case"
        assert row["automation_covered"] == "yes"


def test_task6_chatroom_equivalent_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "ChatRoomManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, wrapper in TASK6_CHATROOM_EQUIVALENT_APIS.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert wrapper in row["covered_by_wrapper_api"]


def test_task6_chatroom_target_cases_point_to_direct_case_files():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "ChatRoomManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, target_case in TASK6_CHATROOM_TARGET_CASES.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["target_case"] == target_case


def test_task6_chatroom_attribute_cases_cover_non_forced_branches():
    text = Path("tests/chatroom/test_chatroom_management_basics.py").read_text(encoding="utf-8")

    set_start = text.index("def test_chatroom_set_attributes_non_forced_success")
    remove_start = text.index("def test_chatroom_remove_attributes_non_forced_success")
    set_block = text[set_start:remove_start]
    remove_block = text[remove_start:]
    assert "Cmd.setChatRoomAttributes.value" in set_block
    assert '"forced": False' in set_block
    assert "Cmd.removeChatRoomAttributes.value" in remove_block
    assert '"forced": False' in remove_block


def test_task7a_group_lifecycle_membership_metadata_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, wrapper in TASK7A_GROUP_EQUIVALENT_APIS.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert wrapper in row["covered_by_wrapper_api"]


def test_task7a_group_target_cases_point_to_files_that_call_the_wrapper_commands():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, target_case in TASK7A_GROUP_TARGET_CASES.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["target_case"] == target_case
        assert target_case in row["automation_files"]


def test_task7a_group_join_leave_target_case_is_not_error_only():
    text = Path("tests/group/test_group_members.py").read_text(encoding="utf-8")
    start = text.index("def test_group_join_and_leave_public_group")
    end = text.index("def test_group_members_batch_join_exit_new_events", start)
    block = text[start:end]

    assert "style=3" in block
    assert "Cmd.joinPublicGroup.value" in block
    assert "Cmd.leaveGroup.value" in block
    assert '"cmd": Cmd.joinPublicGroup.value' in block
    assert '"cmd": Cmd.leaveGroup.value' in block
    assert 'assert_api.assert_error(resp_join' not in block
    assert 'assert_api.assert_error(resp_leave' not in block


def test_task7a_group_join_leave_error_only_references_are_not_positive_evidence():
    error_only_block = '''
def test_group_join_and_leave_public_group(device_a, device_b, assert_api):
    resp_join = device_b.call("GroupManager", Cmd.joinPublicGroup.value, info={"groupId": group_id})
    assert_api.assert_error(resp_join, code=603, description="group member permission is required")

    resp_leave = device_b.call("GroupManager", Cmd.leaveGroup.value, info={"groupId": group_id})
    assert_api.assert_error(resp_leave, code=603, description="group member permission is required")
'''

    assert _automation_evidence_kind(error_only_block, "joinPublicGroup") == "error_only"
    assert _automation_evidence_kind(error_only_block, "leaveGroup") == "error_only"


def test_task7a_group_join_leave_success_references_are_positive_evidence():
    text = Path("tests/group/test_group_members.py").read_text(encoding="utf-8")
    start = text.index("def test_group_join_and_leave_public_group")
    end = text.index("def test_group_members_batch_join_exit_new_events", start)
    block = text[start:end]

    assert _automation_evidence_kind(block, "joinPublicGroup") == "positive"
    assert _automation_evidence_kind(block, "leaveGroup") == "positive"


def test_task7a_group_join_leave_rows_require_positive_evidence():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key in (
        ("GroupManager", "asyncJoinGroup"),
        ("GroupManager", "leaveGroup"),
    ):
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["review_requires_positive_case"] == "true"
        assert row["automation_positive_refs"] != "0"
        assert row["coverage_conclusion"] == "covered_by_case"


def test_native_wrapper_missing_summary_counts_only_wrapper_missing_conclusions():
    rows = build_rows()
    if not any(row["row_kind"] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    summary = summarize(rows)
    expected = {}
    for row in rows:
        if row["row_kind"] == "native_android_api" and row["coverage_conclusion"] == "wrapper_missing":
            expected[row["manager"]] = expected.get(row["manager"], 0) + 1

    assert summary["missing_native_android_wrapper_by_manager"] == expected
