import pytest

from src.tools.android_423_api_coverage_report import build_rows
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
