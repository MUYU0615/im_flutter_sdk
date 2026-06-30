import pytest

from src.tools.android_423_api_coverage_report import build_rows


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


def test_chat_manager_p1_equivalent_native_apis_are_not_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }

    for api, wrapper in P1_EQUIVALENT_APIS.items():
        row = rows[("ChatManager", api, "native_android_api")]
        assert row["coverage_conclusion"] == "covered_by_case"
        assert row["android_covered"] == "yes"
        assert row["automation_covered"] == "yes"
        assert wrapper in row["covered_by_wrapper_api"]


def test_chat_manager_unimplemented_native_conversation_load_apis_stay_wrapper_missing():
    rows = {
        (row["manager"], row["api"], row["row_kind"]): row
        for row in build_rows()
    }

    for api in ("getAllConversations", "loadAllConversations"):
        row = rows[("ChatManager", api, "native_android_api")]
        assert row["coverage_conclusion"] == "wrapper_missing"
        assert row["android_covered"] == "no"
        assert row["review_action"] == "expose_wrapper"
