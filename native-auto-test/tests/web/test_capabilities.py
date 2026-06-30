from src.tools.capabilities import api_status, should_run_api
from src.tools.web_coverage import iter_entries, load_manifest


def test_web_client_login_is_supported():
    assert api_status("web", "Client", "login") == "supported"
    assert should_run_api("web", "Client", "login") is True


def test_web_manifest_has_no_pending_api():
    pending = [
        f"{manager}.{cmd}"
        for manager, cmd, info in iter_entries(load_manifest())
        if info.get("status") == "pending"
    ]

    assert pending == []


def test_web_chat_media_download_apis_are_supported():
    for cmd in (
        "downloadAttachment",
        "downloadBigImage",
        "downloadThumbnail",
        "downloadMessageAttachmentInCombine",
        "downloadMessageThumbnailInCombine",
        "downloadAndParseCombineMessage",
    ):
        assert api_status("web", "ChatManager", cmd) == "supported"
        assert should_run_api("web", "ChatManager", cmd) is True


def test_web_chat_thread_conversation_is_supported():
    assert api_status("web", "ChatManager", "getThreadConversation") == "supported"
    assert should_run_api("web", "ChatManager", "getThreadConversation") is True


def test_web_chat_send_message_is_supported():
    assert api_status("web", "ChatManager", "sendMessage") == "supported"
    assert should_run_api("web", "ChatManager", "sendMessage") is True


def test_web_chat_group_ack_fetch_is_supported():
    assert api_status("web", "ChatManager", "asyncFetchGroupAcks") == "supported"
    assert should_run_api("web", "ChatManager", "asyncFetchGroupAcks") is True


def test_web_push_server_config_and_token_apis_are_supported():
    for cmd in (
        "getImPushConfigFromServer",
        "updateHMSPushToken",
        "updateFCMPushToken",
        "updateAPNsPushToken",
        "reportPushAction",
        "setPushTemplate",
        "getPushTemplate",
        "bindDeviceToken",
    ):
        assert api_status("web", "PushManager", cmd) == "supported"
        assert should_run_api("web", "PushManager", cmd) is True


def test_web_conversation_manager_unread_count_is_supported():
    for cmd in (
        "getUnreadMsgCount",
        "markAllMessagesAsRead",
        "markMessageAsRead",
        "syncConversationExt",
        "removeMessage",
        "getLatestMessage",
        "getLatestMessageFromOthers",
        "clearAllMessages",
        "deleteMessageByIds",
        "deleteMessagesWithTs",
        "insertMessage",
        "appendMessage",
        "updateConversationMessage",
        "loadMsgWithId",
        "loadMsgWithStartId",
        "loadMsgWithKeywords",
        "loadMsgWithMsgType",
        "loadMsgWithTime",
        "messageCount",
        "removeMsgFromServerWithTimeStamp",
        "getReactionList",
        "groupAckCount",
        "chatThread",
    ):
        assert api_status("web", "ConversationManager", cmd) == "supported"
        assert should_run_api("web", "ConversationManager", cmd) is True


def test_web_unclassified_client_events_are_supported():
    for cmd in (
        "onMultiDeviceGroupEvent",
        "onMultiDeviceContactEvent",
        "onMultiDeviceThreadEvent",
        "onMultiDeviceRemoveMessagesEvent",
        "onMultiDevicesConversationEvent",
        "onUserDidLoginFromOtherDevice",
        "onUserDidRemoveFromServer",
        "onUserDidForbidByServer",
        "onUserDidChangePassword",
        "onUserDidLoginTooManyDevice",
        "onUserKickedByOtherDevice",
        "onUserAuthenticationFailed",
        "onSendDataToFlutter",
        "onTokenWillExpire",
        "onTokenDidExpire",
        "onAppActiveNumberReachLimit",
    ):
        assert api_status("web", "Unclassified", cmd) == "supported"
        assert should_run_api("web", "Unclassified", cmd) is True


def test_web_native_only_apis_are_not_applicable():
    for cmd in (
        "changeAppKey",
        "updateUsingHttpsOnlySetting",
        "updateLoginExtensionInfo",
        "updateDeleteMessagesWhenLeaveGroupSetting",
        "updateDeleteMessageWhenLeaveRoomSetting",
        "updateRoomOwnerCanLeaveSetting",
        "updateAutoAcceptGroupInvitationSetting",
        "acceptInvitationAlways",
        "updateAutoDownloadAttachmentThumbnailSetting",
        "updateRequireAckSetting",
        "updateDeliveryAckSetting",
        "updateSortMessageByServerTimeSetting",
        "updateMessagesReceiveCallbackIncludeSendSetting",
        "updateRegradeMessagesSetting",
        "changeAppId",
    ):
        assert api_status("web", "Client", cmd) == "not_applicable"
        assert should_run_api("web", "Client", cmd) is False

    for cmd in (
        "onOfflineMessageSyncStart",
        "onOfflineMessageSyncFinish",
    ):
        assert api_status("web", "MessageManager", cmd) == "not_applicable"
        assert should_run_api("web", "MessageManager", cmd) is False


def test_web_message_recall_info_event_is_supported():
    assert api_status("web", "MessageManager", "onMessagesRecalledInfo") == "supported"
    assert should_run_api("web", "MessageManager", "onMessagesRecalledInfo") is True


def test_web_message_changed_event_is_supported():
    assert api_status("web", "MessageManager", "onMessageChanged") == "supported"
    assert should_run_api("web", "MessageManager", "onMessageChanged") is True


def test_web_message_progress_and_error_events_are_supported():
    for cmd in (
        "onMessageProgress",
        "onMessageProgressUpdate",
        "onMessageError",
    ):
        assert api_status("web", "MessageManager", cmd) == "supported"
        assert should_run_api("web", "MessageManager", cmd) is True


def test_web_legacy_message_callbacks_are_supported():
    for cmd in (
        "onMessageSuccess",
        "onMessageReadAck",
        "onMessageDeliveryAck",
    ):
        assert api_status("web", "MessageManager", cmd) == "supported"
        assert should_run_api("web", "MessageManager", cmd) is True


def test_web_cmd_message_event_is_supported():
    assert api_status("web", "MessageManager", "onCmdMessagesReceived") == "supported"
    assert should_run_api("web", "MessageManager", "onCmdMessagesReceived") is True


def test_web_stream_message_event_is_supported():
    assert api_status("web", "MessageManager", "onStreamMessagesReceived") == "supported"
    assert should_run_api("web", "MessageManager", "onStreamMessagesReceived") is True


def test_web_group_read_ack_update_event_is_supported():
    assert api_status("web", "MessageManager", "onReadAckForGroupMessageUpdated") == "supported"
    assert should_run_api("web", "MessageManager", "onReadAckForGroupMessageUpdated") is True


def test_web_group_message_read_event_is_supported():
    assert api_status("web", "MessageManager", "onGroupMessageRead") == "supported"
    assert should_run_api("web", "MessageManager", "onGroupMessageRead") is True


def test_web_chat_thread_manager_local_apis_are_supported():
    for cmd in (
        "fetchChatThreadDetail",
        "fetchJoinedChatThreads",
        "fetchChatThreadsWithParentId",
        "fetchJoinedChatThreadsWithParentId",
        "fetchChatThreadMember",
        "fetchLastMessageWithChatThreads",
        "removeMemberFromChatThread",
        "updateChatThreadSubject",
        "createChatThread",
        "joinChatThread",
        "leaveChatThread",
        "destroyChatThread",
        "onUserKickOutOfChatThread",
    ):
        assert api_status("web", "ChatThreadManager", cmd) == "supported"
        assert should_run_api("web", "ChatThreadManager", cmd) is True


def test_web_push_manager_local_apis_are_supported():
    for cmd in (
        "getImPushConfig",
        "updateImPushStyle",
        "updatePushNickname",
        "setConversationSilentMode",
        "removeConversationSilentMode",
        "fetchConversationSilentMode",
        "setSilentModeForAll",
        "fetchSilentModeForAll",
        "fetchSilentModeForConversations",
        "setPreferredNotificationLanguage",
        "fetchPreferredNotificationLanguage",
        "getImPushConfigFromServer",
        "updateHMSPushToken",
        "updateFCMPushToken",
        "updateAPNsPushToken",
        "reportPushAction",
        "setPushTemplate",
        "getPushTemplate",
        "bindDeviceToken",
    ):
        assert api_status("web", "PushManager", cmd) == "supported"
        assert should_run_api("web", "PushManager", cmd) is True


def test_web_chat_room_manager_local_lifecycle_apis_are_supported():
    for cmd in (
        "createChatRoom",
        "fetchPublicChatRoomsFromServer",
        "fetchChatRoomInfoFromServer",
        "getChatRoom",
        "getAllChatRooms",
        "joinChatRoom",
        "leaveChatRoom",
        "changeChatRoomSubject",
        "changeChatRoomDescription",
        "fetchChatRoomMembers",
        "updateChatRoomAnnouncement",
        "fetchChatRoomAnnouncement",
        "destroyChatRoom",
    ):
        assert api_status("web", "ChatRoomManager", cmd) == "supported"
        assert should_run_api("web", "ChatRoomManager", cmd) is True


def test_web_chat_room_manager_local_moderation_apis_are_supported():
    for cmd in (
        "muteChatRoomMembers",
        "unMuteChatRoomMembers",
        "changeChatRoomOwner",
        "addChatRoomAdmin",
        "removeChatRoomAdmin",
        "fetchChatRoomMuteList",
        "removeChatRoomMembers",
        "blockChatRoomMembers",
        "unBlockChatRoomMembers",
        "fetchChatRoomBlockList",
        "addMembersToChatRoomWhiteList",
        "removeMembersFromChatRoomWhiteList",
        "fetchChatRoomWhiteListFromServer",
        "isMemberInChatRoomWhiteListFromServer",
        "muteAllChatRoomMembers",
        "unMuteAllChatRoomMembers",
        "isMemberInChatRoomMuteList",
    ):
        assert api_status("web", "ChatRoomManager", cmd) == "supported"
        assert should_run_api("web", "ChatRoomManager", cmd) is True


def test_web_chat_room_manager_local_attribute_apis_are_supported():
    for cmd in (
        "fetchChatRoomAttributes",
        "setChatRoomAttributes",
        "removeChatRoomAttributes",
    ):
        assert api_status("web", "ChatRoomManager", cmd) == "supported"
        assert should_run_api("web", "ChatRoomManager", cmd) is True


def test_web_presence_manager_local_apis_are_supported():
    for cmd in (
        "publishPresenceWithDescription",
        "presenceSubscribe",
        "presenceUnsubscribe",
        "fetchSubscribedMembersWithPageNum",
        "fetchPresenceStatus",
    ):
        assert api_status("web", "PresenceManager", cmd) == "supported"
        assert should_run_api("web", "PresenceManager", cmd) is True


def test_web_presence_status_changed_event_is_supported():
    assert api_status("web", "MessageManager", "onPresenceStatusChanged") == "supported"
    assert should_run_api("web", "MessageManager", "onPresenceStatusChanged") is True


def test_web_group_manager_local_lifecycle_apis_are_supported():
    for cmd in (
        "createGroup",
        "getGroupWithId",
        "getJoinedGroups",
        "getJoinedGroupsFromServer",
        "getPublicGroupsFromServer",
        "getGroupSpecificationFromServer",
        "getGroupMemberListFromServer",
        "getGroupBlockListFromServer",
        "getGroupMuteListFromServer",
        "getGroupWhiteListFromServer",
        "isMemberInWhiteListFromServer",
        "getGroupFileListFromServer",
        "fetchJoinedGroupCount",
        "addMembers",
        "inviterUser",
        "removeMembers",
        "blockMembers",
        "unblockMembers",
        "blockGroup",
        "unblockGroup",
        "updateGroupOwner",
        "addAdmin",
        "removeAdmin",
        "muteMembers",
        "unMuteMembers",
        "muteAllMembers",
        "unMuteAllMembers",
        "addWhiteList",
        "removeWhiteList",
        "uploadGroupSharedFile",
        "downloadGroupSharedFile",
        "removeGroupSharedFile",
        "updateGroupAnnouncement",
        "getGroupAnnouncementFromServer",
        "updateGroupExt",
        "setMemberAttributesFromGroup",
        "removeMemberAttributesFromGroup",
        "fetchMemberAttributesFromGroup",
        "fetchMembersAttributesFromGroup",
        "joinPublicGroup",
        "requestToJoinPublicGroup",
        "acceptJoinApplication",
        "declineJoinApplication",
        "acceptInvitationFromGroup",
        "declineInvitationFromGroup",
        "clearAllGroupsFromDB",
        "isMemberInGroupMuteList",
        "fetchGroupMembersInfo",
        "updateGroupAvatar",
        "updateGroupSubject",
        "updateDescription",
        "leaveGroup",
        "destroyGroup",
    ):
        assert api_status("web", "GroupManager", cmd) == "supported"
        assert should_run_api("web", "GroupManager", cmd) is True
