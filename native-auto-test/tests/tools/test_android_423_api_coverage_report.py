import pytest
from pathlib import Path

from src.tools.android_423_api_coverage_report import (
    _automation_evidence_kind,
    _direct_e2e_case_state,
    build_rows,
    scan_automation,
    summarize,
)
from tests.conftest import _all_items_marked_no_global_login


pytestmark = pytest.mark.no_global_login
NATIVE_AUTO_TEST_ROOT = Path(__file__).resolve().parents[2]


P1_EQUIVALENT_APIS = {
    "addReaction": "ChatManager.addReaction",
    "asyncFetchHistoryMessage": "ChatManager.fetchHistoryMessages",
    "asyncRecallMessage": "ChatManager.recallMessage",
    "cleanConversationsMemoryCache": "ChatManager.cleanConversationsMemoryCache",
    "downloadBigImage": "ChatManager.downloadBigImage",
    "fetchGroupReadAcks": "ChatManager.asyncFetchGroupAcks",
    "getConversationsByType": "ChatManager.getConversationsByType",
    "getReactionDetail": "ChatManager.fetchReactionDetail",
    "getReactionList": "ChatManager.fetchReactionList",
    "reportMessage": "ChatManager.reportMessage",
    "removeReaction": "ChatManager.removeReaction",
    "saveMessage": "ChatManager.saveMessage",
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
    ("ContactManager", "asyncSaveBlackList"): "ContactManager.saveBlackList",
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
    ("GroupManager", "createGroup"): "native-auto-test/tests/group/test_group_lifecycle.py",
    ("GroupManager", "destroyGroup"): "native-auto-test/tests/group/test_group_lifecycle.py",
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

TASK7B_GROUP_EQUIVALENT_APIS = {
    ("GroupManager", "addGroupAdmin"): "GroupManager.addAdmin",
    ("GroupManager", "removeGroupAdmin"): "GroupManager.removeAdmin",
    ("GroupManager", "asyncAddUsersToGroup"): "GroupManager.addMembers",
    ("GroupManager", "asyncRemoveUserFromGroup"): "GroupManager.removeMembers",
    ("GroupManager", "removeUserFromGroup"): "GroupManager.removeMembers",
    ("GroupManager", "removeUsersFromGroup"): "GroupManager.removeMembers",
    ("GroupManager", "asyncBlockUser"): "GroupManager.blockMembers",
    ("GroupManager", "blockUser"): "GroupManager.blockMembers",
    ("GroupManager", "blockUsers"): "GroupManager.blockMembers",
    ("GroupManager", "asyncUnblockUser"): "GroupManager.unblockMembers",
    ("GroupManager", "unblockUser"): "GroupManager.unblockMembers",
    ("GroupManager", "unblockUsers"): "GroupManager.unblockMembers",
    ("GroupManager", "asyncFetchGroupBlackList"): "GroupManager.getGroupBlockListFromServer",
    ("GroupManager", "getBlockedUsers"): "GroupManager.getGroupBlockListFromServer",
    ("GroupManager", "muteGroupMembers"): "GroupManager.muteMembers",
    ("GroupManager", "unMuteGroupMembers"): "GroupManager.unMuteMembers",
    ("GroupManager", "blockGroupMessage"): "GroupManager.blockGroup",
    ("GroupManager", "unblockGroupMessage"): "GroupManager.unblockGroup",
}

TASK7B_GROUP_TARGET_CASES = {
    ("GroupManager", "addGroupAdmin"): "native-auto-test/tests/group/test_group_roles.py",
    ("GroupManager", "removeGroupAdmin"): "native-auto-test/tests/group/test_group_roles.py",
    ("GroupManager", "asyncAddUsersToGroup"): "native-auto-test/tests/group/test_group_members.py",
    ("GroupManager", "asyncRemoveUserFromGroup"): "native-auto-test/tests/group/test_group_members.py",
    ("GroupManager", "removeUserFromGroup"): "native-auto-test/tests/group/test_group_members.py",
    ("GroupManager", "removeUsersFromGroup"): "native-auto-test/tests/group/test_group_members.py",
    ("GroupManager", "asyncBlockUser"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "blockUser"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "blockUsers"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "asyncUnblockUser"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "unblockUser"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "unblockUsers"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "asyncFetchGroupBlackList"): "native-auto-test/tests/group/test_group_server_state_lists.py",
    ("GroupManager", "getBlockedUsers"): "native-auto-test/tests/group/test_group_server_state_lists.py",
    ("GroupManager", "muteGroupMembers"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "unMuteGroupMembers"): "native-auto-test/tests/group/test_group_moderation.py",
    ("GroupManager", "blockGroupMessage"): "native-auto-test/tests/group/test_group_exceptions_blocking.py",
    ("GroupManager", "unblockGroupMessage"): "native-auto-test/tests/group/test_group_exceptions_blocking.py",
}

TASK7C_GROUP_EQUIVALENT_APIS = {
    ("GroupManager", "fetchGroupAnnouncement"): "GroupManager.getGroupAnnouncementFromServer",
    ("GroupManager", "fetchGroupBlackList"): "GroupManager.getGroupBlockListFromServer",
    ("GroupManager", "fetchGroupMembers"): "GroupManager.getGroupMemberListFromServer",
    ("GroupManager", "fetchGroupMuteList"): "GroupManager.getGroupMuteListFromServer",
    ("GroupManager", "fetchGroupSharedFileList"): "GroupManager.getGroupFileListFromServer",
    ("GroupManager", "inviteUser"): "GroupManager.inviterUser",
    ("GroupManager", "updateGroupAnnouncement"): "GroupManager.updateGroupAnnouncement",
}

TASK7C_GROUP_CASE_REQUIRED_APIS = {
    ("GroupManager", "deleteGroupSharedFile"): "GroupManager.removeGroupSharedFile",
    ("GroupManager", "downloadGroupSharedFile"): "GroupManager.downloadGroupSharedFile",
    ("GroupManager", "uploadGroupSharedFile"): "GroupManager.uploadGroupSharedFile",
}

TASK7C_GROUP_TARGET_CASES = {
    ("GroupManager", "fetchGroupAnnouncement"): "native-auto-test/tests/group/test_group_announcement.py",
    ("GroupManager", "fetchGroupBlackList"): "native-auto-test/tests/group/test_group_server_state_lists.py",
    ("GroupManager", "fetchGroupMembers"): "native-auto-test/tests/group/test_group_member_list.py",
    ("GroupManager", "fetchGroupMuteList"): "native-auto-test/tests/group/test_group_server_state_lists.py",
    ("GroupManager", "fetchGroupSharedFileList"): "native-auto-test/tests/group/test_group_file_list.py",
    ("GroupManager", "inviteUser"): "native-auto-test/tests/group/test_group_inviter.py",
    ("GroupManager", "updateGroupAnnouncement"): "native-auto-test/tests/group/test_group_announcement.py",
    ("GroupManager", "deleteGroupSharedFile"): "native-auto-test/tests/group/test_group_shared_files.py",
    ("GroupManager", "downloadGroupSharedFile"): "native-auto-test/tests/group/test_group_shared_files.py",
    ("GroupManager", "uploadGroupSharedFile"): "native-auto-test/tests/group/test_group_shared_files.py",
    ("GroupManager", "asyncUpdateGroupNamecard"): "native-auto-test/tests/group/test_group_member_attributes.py",
    ("GroupManager", "getGroupNamecard"): "native-auto-test/tests/group/test_group_member_attributes.py",
    ("GroupManager", "loadAllGroups"): "native-auto-test/tests/group/test_group_joined_groups.py",
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


def test_chat_manager_native_conversation_load_apis_are_covered_by_positive_case():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "ChatManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    expected_wrappers = {
        "getAllConversations": "ChatManager.getAllConversations",
        "loadAllConversations": "ChatManager.loadAllConversationsFromDB",
    }
    for api, wrapper in expected_wrappers.items():
        row = rows[("ChatManager", api, "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert row["review_requires_positive_case"] == "true"
        assert row["automation_positive_refs"] != "0"
        assert wrapper in row["covered_by_wrapper_api"]


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

    row = rows[("ContactManager", "saveBlackList", "native_android_api")]
    assert row["coverage_conclusion"] == "covered_by_case"
    assert row["android_covered"] == "yes"
    assert row["automation_covered"] == "yes"
    assert row["review_action"] == "direct_e2e_case"
    assert "ContactManager.saveBlackList" in row["covered_by_wrapper_api"]

    for key, wrapper in {
        ("UserInfoManager", "fetchSubscribedUsers"): "UserInfoManager.fetchSubscribedUsers",
        ("UserInfoManager", "subscribeUsersInfo"): "UserInfoManager.subscribeUsersInfo",
        ("UserInfoManager", "unsubscribeUsersInfo"): "UserInfoManager.unsubscribeUsersInfo",
    }.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert wrapper in row["covered_by_wrapper_api"]


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
    text = (NATIVE_AUTO_TEST_ROOT / "tests/chatroom/test_chatroom_management_basics.py").read_text(encoding="utf-8")

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
        if key not in {("GroupManager", "createGroup"), ("GroupManager", "destroyGroup")}:
            assert target_case in row["automation_files"]


def test_task7a_direct_e2e_target_cases_are_runnable_pytest_files():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key in TASK7A_GROUP_TARGET_CASES:
        row = rows[(key[0], key[1], "native_android_api")]
        target_case = row["target_case"]
        assert "/tests/" in target_case
        assert not target_case.endswith("group_helpers.py")
        target_path = NATIVE_AUTO_TEST_ROOT.parent / target_case
        text = target_path.read_text(encoding="utf-8")
        assert "def test_" in text


def test_task7a_group_join_leave_target_case_is_not_error_only():
    text = (NATIVE_AUTO_TEST_ROOT / "tests/group/test_group_members.py").read_text(encoding="utf-8")
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


def test_bare_command_reference_is_unknown_not_positive_evidence():
    bare_block = '''
def test_bare_reference(device_b):
    resp_join = device_b.call("GroupManager", Cmd.joinPublicGroup.value, info={"groupId": group_id})
'''

    assert _automation_evidence_kind(bare_block, "joinPublicGroup") == "unknown"


def test_task7a_group_join_leave_success_references_are_positive_evidence():
    text = (NATIVE_AUTO_TEST_ROOT / "tests/group/test_group_members.py").read_text(encoding="utf-8")
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
        assert row["automation_covered"] == "yes"
        assert row["coverage_conclusion"] == "covered_by_case"


def test_task7b_group_member_role_block_mute_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, wrapper in TASK7B_GROUP_EQUIVALENT_APIS.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert wrapper in row["covered_by_wrapper_api"]


def test_task7b_group_target_cases_point_to_runnable_pytest_files():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, target_case in TASK7B_GROUP_TARGET_CASES.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["target_case"] == target_case
        assert target_case in row["automation_files"]
        assert not target_case.endswith("group_helpers.py")
        target_path = NATIVE_AUTO_TEST_ROOT.parent / target_case
        text = target_path.read_text(encoding="utf-8")
        assert "def test_" in text


def test_task7b_group_member_role_block_mute_rows_require_positive_evidence():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key in TASK7B_GROUP_EQUIVALENT_APIS:
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["review_requires_positive_case"] == "true"
        assert row["automation_positive_refs"] != "0"
        assert row["automation_covered"] == "yes"
        assert row["coverage_conclusion"] == "covered_by_case"


def test_task7c_group_announcement_lists_and_invite_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, wrapper in TASK7C_GROUP_EQUIVALENT_APIS.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert row["review_requires_positive_case"] == "true"
        assert row["automation_positive_refs"] != "0"
        assert wrapper in row["covered_by_wrapper_api"]


def test_task8a_shared_file_native_apis_are_covered_by_positive_case():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, wrapper in TASK7C_GROUP_CASE_REQUIRED_APIS.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert row["review_requires_positive_case"] == "true"
        assert row["automation_positive_refs"] != "0"
        assert wrapper in row["covered_by_wrapper_api"]


def test_task7c_namecard_and_load_all_groups_are_covered_by_positive_case():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    expected_wrappers = {
        ("GroupManager", "asyncUpdateGroupNamecard"): "GroupManager.updateGroupNamecard",
        ("GroupManager", "getGroupNamecard"): "GroupManager.getGroupNamecard",
        ("GroupManager", "loadAllGroups"): "GroupManager.loadAllGroups",
    }
    for key, wrapper in expected_wrappers.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert row["review_action"] == "direct_e2e_case"
        assert row["review_requires_positive_case"] == "true"
        assert row["automation_positive_refs"] != "0"
        assert wrapper in row["covered_by_wrapper_api"]


def test_task7c_group_target_cases_point_to_runnable_pytest_files():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }
    if not any(row[0] == "GroupManager" and row[2] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    for key, target_case in TASK7C_GROUP_TARGET_CASES.items():
        row = rows[(key[0], key[1], "native_android_api")]
        assert row["target_case"] == target_case
        target_path = NATIVE_AUTO_TEST_ROOT.parent / target_case
        text = target_path.read_text(encoding="utf-8")
        assert "def test_" in text
        assert not target_case.endswith("group_helpers.py")


def test_task7c_shared_file_invalid_or_nonexistent_cases_are_not_positive_evidence():
    invalid_block = '''
def test_group_download_shared_file_nonexistent_group_current_behavior(device_a, assert_api):
    resp = device_a.call(
        "GroupManager",
        Cmd.downloadGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "fileId": "1", "savePath": "/private/tmp"},
    )
    assert_api.assert_response_matches(
        resp,
        expected={"manager": "GroupManager", "cmd": Cmd.downloadGroupSharedFile.value, "result": True},
    )
'''

    assert _automation_evidence_kind(invalid_block, "downloadGroupSharedFile") == "error_only"


def test_positive_case_with_cleanup_exception_handler_stays_positive_evidence():
    block = '''
def test_user_info_subscribe_fetch_and_unsubscribe_users_info(device_a, assert_api):
    subscribe_resp = device_a.call(
        "UserInfoManager",
        Cmd.subscribeUsersInfo.value,
        info={"userIds": ["u2"]},
    )
    assert_api.assert_response_matches(
        subscribe_resp,
        expected={"manager": "UserInfoManager", "cmd": Cmd.subscribeUsersInfo.value, "result": True},
    )
    try:
        pass
    except Exception:
        raise
'''

    assert _automation_evidence_kind(block, "subscribeUsersInfo") == "positive"


def test_positive_required_direct_case_with_only_error_refs_is_not_covered():
    conclusion, automation_covered = _direct_e2e_case_state(
        requires_positive_case=True,
        has_automation_refs=True,
        positive_refs=0,
    )

    assert conclusion == "case_required"
    assert automation_covered is False


def test_report_tool_tests_are_not_scanned_as_e2e_automation_evidence():
    automation = scan_automation()

    for cmd in ("joinPublicGroup", "leaveGroup"):
        files = automation[("GroupManager", cmd)]["files"]
        assert not any(path.startswith("native-auto-test/tests/tools/") for path in files)


def test_task7a_group_join_leave_positive_refs_do_not_come_from_textual_fallback_only():
    automation = scan_automation()

    for key in (
        ("GroupManager", "joinPublicGroup"),
        ("GroupManager", "leaveGroup"),
    ):
        evidence = automation[key]["evidence_kinds"]
        assert evidence["positive"] > 0
        assert evidence["unknown"] >= 0
        assert evidence["positive"] < automation[key]["refs"]


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


def test_review_actions_can_override_wrapper_missing_conclusion():
    rows = build_rows()
    if not any(row["row_kind"] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    row_by_key = {
        (row["manager"], row["api"]): row
        for row in rows
        if row["row_kind"] == "native_android_api"
    }

    clear_row = row_by_key[("ConversationManager", "clear")]
    assert clear_row["review_action"] == "model_property_covered"
    assert clear_row["coverage_conclusion"] == "indirect_covered_by_case"
    assert clear_row["native_test_requirement"] == "indirect_e2e"

    insert_row = row_by_key[("ConversationManager", "insertMessage")]
    assert insert_row["review_action"] == "direct_e2e_case"
    assert insert_row["coverage_conclusion"] == "covered_by_case"
    assert insert_row["native_test_requirement"] == "direct_e2e"

    text_row = row_by_key[("MessageManager", "createTextSendMessage")]
    assert text_row["review_action"] == "direct_e2e_case"
    assert text_row["coverage_conclusion"] == "covered_by_case"
    assert text_row["native_test_requirement"] == "direct_e2e"

    txt_row = row_by_key[("MessageManager", "createTxtSendMessage")]
    assert txt_row["review_action"] == "direct_e2e_case"
    assert txt_row["coverage_conclusion"] == "covered_by_case"
    assert txt_row["native_test_requirement"] == "direct_e2e"

    video_row = row_by_key[("MessageManager", "createVideoSendMessage")]
    assert video_row["review_action"] == "direct_e2e_case"
    assert video_row["coverage_conclusion"] == "covered_by_case"
    assert video_row["native_test_requirement"] == "direct_e2e"

    location_row = row_by_key[("MessageManager", "createLocationSendMessage")]
    assert location_row["review_action"] == "direct_e2e_case"
    assert location_row["coverage_conclusion"] == "covered_by_case"
    assert location_row["native_test_requirement"] == "direct_e2e"

    combine_row = row_by_key[("MessageManager", "createCombinedSendMessage")]
    assert combine_row["review_action"] == "direct_e2e_case"
    assert combine_row["coverage_conclusion"] == "covered_by_case"
    assert combine_row["native_test_requirement"] == "direct_e2e"

    gif_row = row_by_key[("MessageManager", "createGifImageMessage")]
    assert gif_row["review_action"] == "direct_e2e_case"
    assert gif_row["coverage_conclusion"] == "covered_by_case"
    assert gif_row["native_test_requirement"] == "direct_e2e"

    voice_row = row_by_key[("MessageManager", "createVoiceSendMessage")]
    assert voice_row["review_action"] == "direct_e2e_case"
    assert voice_row["coverage_conclusion"] == "covered_by_case"
    assert voice_row["native_test_requirement"] == "direct_e2e"

    mapping_row = row_by_key[("ConversationManager", "msgType2ConversationType")]
    assert mapping_row["review_action"] == "not_applicable"
    assert mapping_row["coverage_conclusion"] == "not_applicable"
    assert mapping_row["native_test_requirement"] == "not_applicable"


def test_covered_by_case_rows_default_to_direct_e2e_review_action_when_unreviewed():
    rows = build_rows()
    if not any(row["row_kind"] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    row_by_key = {
        (row["manager"], row["api"]): row
        for row in rows
        if row["row_kind"] == "native_android_api"
    }

    row = row_by_key[("ChatManager", "ackMessageRead")]
    assert row["coverage_conclusion"] == "covered_by_case"
    assert row["native_test_requirement"] == "direct_e2e"
    assert row["review_action"] == "direct_e2e_case"


def test_scan_android_accepts_double_parenthesized_call_method():
    rows = build_rows()
    if not any(row["row_kind"] == "native_android_api" for row in rows):
        pytest.skip("Android 4.23 native API rows unavailable; run coverage report after Gradle resolves the API jar.")

    row_by_key = {
        (row["manager"], row["api"]): row
        for row in rows
        if row["row_kind"] == "native_android_api"
    }

    row = row_by_key[("ConversationManager", "insertMessage")]
    assert row["android_covered"] == "yes"
    assert row["android_wrapper_sdk_call_evidence"] == "yes"
    assert row["android_handler"] == "ConversationManager.insertMessage"
