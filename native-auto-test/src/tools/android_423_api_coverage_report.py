"""Generate Android 4.23 based native API coverage reports.

This report has two independent dimensions:

1. Native Android API coverage:
   - Android native SDK APIs are the primary baseline.
   - Flutter Android wrapper coverage and native-auto-test coverage are
     checked against each native API.
2. Wrapper platform alignment:
   - Flutter wrapper callable APIs are emitted as a separate auxiliary
     report for Android/iOS/Web alignment.

The Android baseline is not built from MethodKey alone. It scans wrapper
dispatch branches and checks whether the matched handler body references
real SDK objects such as EMClient and SDK managers. The primary output is
API-level, not wrapper-API-level.
"""

from __future__ import annotations

import argparse
import ast
import csv
import html
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parent

ANDROID_DIR = REPO_ROOT / "im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk"
IOS_DIR = REPO_ROOT / "im_flutter_sdk_ios/ios/Classes"
WEB_DIR = REPO_ROOT / "im_flutter_sdk_web/lib/src"
TEST_DIRS = (ROOT / "tests", ROOT / "src/test_flow")
AUTOMATION_SCAN_EXCLUDED_PARTS = {
    ("tests", "tools"),
}
CMD_KEYS = ROOT / "src/sdk_api/cmd_keys.py"
ANDROID_METHOD_KEYS = ANDROID_DIR / "MethodKey.java"
IOS_METHOD_KEYS = IOS_DIR / "MethodKeys.h"
WEB_METHOD_KEYS = WEB_DIR / "method_keys.dart"
REVIEW_CONFIG = ROOT / "config/android_423_native_api_review.yaml"
ANDROID_SDK_VERSION = "4.23.0"

ALLOWED_REVIEW_ACTIONS = {
    "expose_wrapper",
    "direct_e2e_case",
    "indirect_e2e_only",
    "model_property_covered",
    "listener_registration_internal",
    "manager_getter_internal",
    "platform_native_missing",
    "not_applicable",
}

AUTOMATION_EVIDENCE_KINDS = {"positive", "error_only", "unknown"}

NATIVE_ANDROID_CLASSES = {
    "Client": "com.hyphenate.chat.EMClient",
    "ChatManager": "com.hyphenate.chat.EMChatManager",
    "ContactManager": "com.hyphenate.chat.EMContactManager",
    "GroupManager": "com.hyphenate.chat.EMGroupManager",
    "ChatRoomManager": "com.hyphenate.chat.EMChatRoomManager",
    "ConversationManager": "com.hyphenate.chat.EMConversation",
    "MessageManager": "com.hyphenate.chat.EMMessage",
    "PushManager": "com.hyphenate.chat.EMPushManager",
    "PresenceManager": "com.hyphenate.chat.EMPresenceManager",
    "UserInfoManager": "com.hyphenate.chat.EMUserInfoManager",
    "ChatThreadManager": "com.hyphenate.chat.EMChatThreadManager",
}

ANDROID_NATIVE_ACCESSORS = {
    "chatManager": "ChatManager",
    "contactManager": "ContactManager",
    "groupManager": "GroupManager",
    "chatroomManager": "ChatRoomManager",
    "pushManager": "PushManager",
    "presenceManager": "PresenceManager",
    "userInfoManager": "UserInfoManager",
    "chatThreadManager": "ChatThreadManager",
}

OBJECT_METHODS = {
    "equals",
    "getClass",
    "hashCode",
    "notify",
    "notifyAll",
    "toString",
    "wait",
}

LISTENER_METHOD_RE = re.compile(r"^(add|remove).*Listener$")
GETTER_SETTER_RE = re.compile(r"^(get|set|is)[A-Z].*")
ASYNC_METHOD_RE = re.compile(r"^async[A-Z].*")

MANAGER_BY_ANDROID_FILE = {
    "ClientWrapper.java": "Client",
    "ContactManagerWrapper.java": "ContactManager",
    "ChatManagerWrapper.java": "ChatManager",
    "ConversationWrapper.java": "ConversationManager",
    "MessageWrapper.java": "MessageManager",
    "ChatRoomManagerWrapper.java": "ChatRoomManager",
    "GroupManagerWrapper.java": "GroupManager",
    "PushManagerWrapper.java": "PushManager",
    "PresenceManagerWrapper.java": "PresenceManager",
    "UserInfoManagerWrapper.java": "UserInfoManager",
    "ChatThreadManagerWrapper.java": "ChatThreadManager",
}

MANAGER_BY_IOS_FILE = {
    "ClientWrapper.m": "Client",
    "ContactManagerWrapper.m": "ContactManager",
    "ChatManagerWrapper.m": "ChatManager",
    "ConversationWrapper.m": "ConversationManager",
    "MessageWrapper.m": "MessageManager",
    "ChatroomManagerWrapper.m": "ChatRoomManager",
    "GroupManagerWrapper.m": "GroupManager",
    "PushManagerWrapper.m": "PushManager",
    "PresenceManagerWrapper.m": "PresenceManager",
    "UserInfoManagerWrapper.m": "UserInfoManager",
    "ThreadManagerWrapper.m": "ChatThreadManager",
}

MANAGER_BY_WEB_FILE = {
    "client_web.dart": "Client",
    "contact_manager_web.dart": "ContactManager",
    "chat_manager_web.dart": "ChatManager",
    "conversation_manager_web.dart": "ConversationManager",
    "message_manager_web.dart": "MessageManager",
    "chat_room_manager_web.dart": "ChatRoomManager",
    "group_manager_web.dart": "GroupManager",
    "push_manager_web.dart": "PushManager",
    "presence_manager_web.dart": "PresenceManager",
    "user_info_manager_web.dart": "UserInfoManager",
    "chat_thread_manager_web.dart": "ChatThreadManager",
}

CONVERSATION_APIS = {
    "getUnreadMsgCount",
    "markAllMessagesAsRead",
    "markMessageAsRead",
    "syncConversationExt",
    "removeMessage",
    "deleteMessageByIds",
    "getLatestMessage",
    "getLatestMessageFromOthers",
    "clearAllMessages",
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
}
MESSAGE_APIS = {"getReactionList", "groupAckCount", "getChatThread", "getPinInfo"}
THREAD_APIS = {
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
}

INDIRECT_COVERAGE_RULES = {
    ("listener", "ChatManager"): (
        "tests/chat/test_chat_manager_remaining_api_coverage.py; tests/chat/test_chat_s423_message_callback_and_combine.py",
        "消息与会话监听通过 startCallback 后触发 onMessagesReceived/onMessageSuccess/onMessageError/onMessagesRecalled/onConversationUpdate 等事件间接覆盖。",
    ),
    ("listener", "Client"): (
        "tests/client/test_client.py; tests/conftest.py",
        "连接、多设备与 token 回调通过 startCallback 和 client event case 间接覆盖。",
    ),
    ("listener", "ContactManager"): (
        "tests/contact/test_contact.py; tests/contact/test_contact_event_helpers.py; src/test_flow/model_test_flow.py",
        "联系人监听通过 onContactChanged 事件流间接覆盖。",
    ),
    ("listener", "GroupManager"): (
        "tests/group/test_group.py; tests/group/test_group_join_requests_and_invitations.py; tests/web/test_web_group_events.py",
        "群组监听通过 onGroupChanged 事件流间接覆盖。",
    ),
    ("listener", "ChatRoomManager"): (
        "tests/chatroom/test_chatroom_callbacks.py; tests/web/test_web_chat_room_events.py",
        "聊天室监听通过 onChatRoomChanged 事件流间接覆盖。",
    ),
    ("listener", "ChatThreadManager"): (
        "tests/chat/test_chat_thread_remaining_api_coverage.py; tests/chat/test_chat_s4_thread_user_removed.py",
        "子区监听通过 chat thread 创建、更新、销毁、踢出事件间接覆盖。",
    ),
    ("listener", "PresenceManager"): (
        "tests/presence/test_presence.py; tests/web/test_web_presence.py",
        "Presence 监听通过 onPresenceStatusChanged 事件流间接覆盖。",
    ),
    ("listener", "UserInfoManager"): (
        "tests/contact/test_friend_info_sync.py; tests/user_info/test_user_info.py",
        "用户资料同步监听通过好友同步和 user info 事件间接覆盖。",
    ),
    ("message_model_property", "MessageManager"): (
        "tests/chat/test_chat_manager_remaining_api_coverage.py; tests/chat/test_chat_crud.py; tests/web_real/test_real_web_chat_server.py",
        "消息模型属性通过 sendMessage/onMessagesReceived/getMessage/importMessages/updateChatMessage 等消息流字段断言间接覆盖。",
    ),
    ("conversation_model_property", "ConversationManager"): (
        "tests/chat/test_conversation_remaining_api_coverage.py; tests/chat/test_chat_s1_local_conversation.py; tests/web_real/test_real_web_chat_server.py",
        "会话模型属性通过 getConversation/loadAllConversations/getConversationsFromServer/会话标记与消息查询间接覆盖。",
    ),
}

NATIVE_ANDROID_EQUIVALENT_WRAPPERS = {
    ("ChatManager", "downloadBigImage"): [
        {
            "manager": "ChatManager",
            "api": "downloadBigImage",
            "reason_zh": "Flutter ChatManager.downloadBigImage 通过 invokeDownloadMethod 反射调用 Android downloadBigImage(EMMessage, EMCallBack)；扫描器无法从字符串反射中自动识别，但现有 E2E 发送真实图片后调用该命令并等待下载回调。",
        }
    ],
    ("ChatManager", "loadAllConversations"): [
        {
            "manager": "ChatManager",
            "api": "loadAllConversationsFromDB",
            "reason_zh": "Flutter ChatManager.loadAllConversationsFromDB 调用 Android loadAllConversations；现有公开 loadAllConversations 返回排序会话列表，不能改成 boolean，因此用测试桥接命令覆盖原生加载本地缓存能力。",
        }
    ],
    ("ChatManager", "reportMessage"): [
        {
            "manager": "ChatManager",
            "api": "reportMessage",
            "reason_zh": "Flutter ChatManager.reportMessage 调用 Android asyncReportMessage，等价覆盖 4.23 reportMessage 的消息举报能力；现有 E2E 发送真实消息后按真实 msgId 调用并断言成功。",
        }
    ],
    ("GroupManager", "asyncUpdateGroupNamecard"): [
        {
            "manager": "GroupManager",
            "api": "updateGroupNamecard",
            "reason_zh": "Flutter GroupManager.updateGroupNamecard 调用 Android asyncUpdateGroupNamecard；等价覆盖 4.23 群名片更新能力。",
        }
    ],
    ("ChatRoomManager", "asyncAddChatRoomAdmin"): [
        {
            "manager": "ChatRoomManager",
            "api": "addChatRoomAdmin",
            "reason_zh": "Flutter ChatRoomManager.addChatRoomAdmin 在后台线程调用 Android addChatRoomAdmin；等价覆盖 4.23 asyncAddChatRoomAdmin 的管理员添加能力。",
        }
    ],
    ("ChatRoomManager", "asyncBlockChatroomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "blockChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.blockChatRoomMembers 调用 Android blockChatroomMembers；等价覆盖 4.23 asyncBlockChatroomMembers 的聊天室拉黑能力。",
        }
    ],
    ("ChatRoomManager", "asyncChangeChatRoomSubject"): [
        {
            "manager": "ChatRoomManager",
            "api": "changeChatRoomSubject",
            "reason_zh": "Flutter ChatRoomManager.changeChatRoomSubject 在后台线程调用 Android changeChatRoomSubject；等价覆盖 4.23 asyncChangeChatRoomSubject 的聊天室名称修改能力。",
        }
    ],
    ("ChatRoomManager", "asyncChangeChatroomDescription"): [
        {
            "manager": "ChatRoomManager",
            "api": "changeChatRoomDescription",
            "reason_zh": "Flutter ChatRoomManager.changeChatRoomDescription 在后台线程调用 Android changeChatroomDescription；等价覆盖 4.23 asyncChangeChatroomDescription 的聊天室描述修改能力。",
        }
    ],
    ("ChatRoomManager", "asyncChangeOwner"): [
        {
            "manager": "ChatRoomManager",
            "api": "changeChatRoomOwner",
            "reason_zh": "Flutter ChatRoomManager.changeChatRoomOwner 在后台线程调用 Android changeOwner；等价覆盖 4.23 asyncChangeOwner 的聊天室 owner 转让能力。",
        }
    ],
    ("ChatRoomManager", "asyncCreateChatRoom"): [
        {
            "manager": "ChatRoomManager",
            "api": "createChatRoom",
            "reason_zh": "Flutter ChatRoomManager.createChatRoom 在后台线程调用 Android createChatRoom；等价覆盖 4.23 asyncCreateChatRoom 的聊天室创建能力。",
        }
    ],
    ("ChatRoomManager", "asyncDestroyChatRoom"): [
        {
            "manager": "ChatRoomManager",
            "api": "destroyChatRoom",
            "reason_zh": "Flutter ChatRoomManager.destroyChatRoom 在后台线程调用 Android destroyChatRoom；等价覆盖 4.23 asyncDestroyChatRoom 的聊天室销毁能力。",
        }
    ],
    ("ChatRoomManager", "asyncFetchChatRoomAllAttributesFromServer"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomAttributes",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomAttributes 调用 Android asyncFetchChatroomAttributesFromServer；不传 keys 时覆盖 4.23 asyncFetchChatRoomAllAttributesFromServer 的全量属性拉取能力。",
        }
    ],
    ("ChatRoomManager", "asyncFetchChatRoomAnnouncement"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomAnnouncement",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomAnnouncement 在后台线程调用 Android fetchChatRoomAnnouncement；等价覆盖 4.23 asyncFetchChatRoomAnnouncement 的公告拉取能力。",
        }
    ],
    ("ChatRoomManager", "asyncFetchChatRoomBlackList"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomBlockList",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomBlockList 在后台线程调用 Android fetchChatRoomBlackList；等价覆盖 4.23 asyncFetchChatRoomBlackList 的黑名单分页拉取能力。",
        }
    ],
    ("ChatRoomManager", "asyncFetchChatRoomFromServer"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomInfoFromServer",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomInfoFromServer 在后台线程调用 Android fetchChatRoomFromServer；等价覆盖 4.23 asyncFetchChatRoomFromServer 的聊天室详情拉取能力。",
        }
    ],
    ("ChatRoomManager", "asyncFetchChatRoomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomMembers 在后台线程调用 Android fetchChatRoomMembers；等价覆盖 4.23 asyncFetchChatRoomMembers 的成员分页拉取能力。",
        }
    ],
    ("ChatRoomManager", "asyncFetchChatRoomMuteList"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomMuteList",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomMuteList 在后台线程调用 Android fetchChatRoomMuteList；等价覆盖 4.23 asyncFetchChatRoomMuteList 的禁言列表分页拉取能力。",
        }
    ],
    ("ChatRoomManager", "asyncMuteChatRoomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "muteChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.muteChatRoomMembers 在后台线程调用 Android muteChatRoomMembers；等价覆盖 4.23 asyncMuteChatRoomMembers 的成员禁言能力。",
        }
    ],
    ("ChatRoomManager", "asyncRemoveChatRoomAdmin"): [
        {
            "manager": "ChatRoomManager",
            "api": "removeChatRoomAdmin",
            "reason_zh": "Flutter ChatRoomManager.removeChatRoomAdmin 在后台线程调用 Android removeChatRoomAdmin；等价覆盖 4.23 asyncRemoveChatRoomAdmin 的管理员移除能力。",
        }
    ],
    ("ChatRoomManager", "asyncRemoveChatRoomAttributeFromServer"): [
        {
            "manager": "ChatRoomManager",
            "api": "removeChatRoomAttributes",
            "reason_zh": "Flutter ChatRoomManager.removeChatRoomAttributes 调用 Android asyncRemoveChatRoomAttributesFromServer；单元素 keys 等价覆盖 4.23 asyncRemoveChatRoomAttributeFromServer。",
        }
    ],
    ("ChatRoomManager", "asyncRemoveChatRoomAttributeFromServerForced"): [
        {
            "manager": "ChatRoomManager",
            "api": "removeChatRoomAttributes",
            "reason_zh": "Flutter ChatRoomManager.removeChatRoomAttributes 在 forced=true 时调用 Android asyncRemoveChatRoomAttributesFromServerForced；单元素 keys 等价覆盖 4.23 asyncRemoveChatRoomAttributeFromServerForced。",
        }
    ],
    ("ChatRoomManager", "asyncRemoveChatRoomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "removeChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.removeChatRoomMembers 在后台线程调用 Android removeChatRoomMembers；等价覆盖 4.23 asyncRemoveChatRoomMembers 的踢出成员能力。",
        }
    ],
    ("ChatRoomManager", "asyncSetChatroomAttribute"): [
        {
            "manager": "ChatRoomManager",
            "api": "setChatRoomAttributes",
            "reason_zh": "Flutter ChatRoomManager.setChatRoomAttributes 调用 Android asyncSetChatroomAttributes；单键 attributes 等价覆盖 4.23 asyncSetChatroomAttribute。",
        }
    ],
    ("ChatRoomManager", "asyncSetChatroomAttributeForced"): [
        {
            "manager": "ChatRoomManager",
            "api": "setChatRoomAttributes",
            "reason_zh": "Flutter ChatRoomManager.setChatRoomAttributes 在 forced=true 时调用 Android asyncSetChatroomAttributesForced；单键 attributes 等价覆盖 4.23 asyncSetChatroomAttributeForced。",
        }
    ],
    ("ChatRoomManager", "asyncUnBlockChatRoomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "unBlockChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.unBlockChatRoomMembers 在后台线程调用 Android unblockChatRoomMembers；等价覆盖 4.23 asyncUnBlockChatRoomMembers 的解除拉黑能力。",
        }
    ],
    ("ChatRoomManager", "asyncUnMuteChatRoomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "unMuteChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.unMuteChatRoomMembers 在后台线程调用 Android unMuteChatRoomMembers；等价覆盖 4.23 asyncUnMuteChatRoomMembers 的解除禁言能力。",
        }
    ],
    ("ChatRoomManager", "asyncUpdateChatRoomAnnouncement"): [
        {
            "manager": "ChatRoomManager",
            "api": "updateChatRoomAnnouncement",
            "reason_zh": "Flutter ChatRoomManager.updateChatRoomAnnouncement 在后台线程调用 Android updateChatRoomAnnouncement；等价覆盖 4.23 asyncUpdateChatRoomAnnouncement 的公告更新能力。",
        }
    ],
    ("ChatRoomManager", "fetchChatRoomMembers"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchChatRoomMembers",
            "reason_zh": "Flutter ChatRoomManager.fetchChatRoomMembers 已暴露同名分页成员拉取能力；Android wrapper 在后台线程调用同步 fetchChatRoomMembers。",
        }
    ],
    ("ChatRoomManager", "fetchPublicChatRoomsFromServer"): [
        {
            "manager": "ChatRoomManager",
            "api": "fetchPublicChatRoomsFromServer",
            "reason_zh": "Flutter ChatRoomManager.fetchPublicChatRoomsFromServer 调用 Android asyncFetchPublicChatRoomsFromServer；等价覆盖 4.23 同步 fetchPublicChatRoomsFromServer 的公开聊天室分页能力。",
        }
    ],
    ("GroupManager", "createGroup"): [
        {
            "manager": "GroupManager",
            "api": "createGroup",
            "reason_zh": "Flutter GroupManager.createGroup 调用 Android asyncCreateGroup；等价覆盖 4.23 createGroup 的群创建能力。",
        }
    ],
    ("GroupManager", "destroyGroup"): [
        {
            "manager": "GroupManager",
            "api": "destroyGroup",
            "reason_zh": "Flutter GroupManager.destroyGroup 调用 Android asyncDestroyGroup；等价覆盖 4.23 destroyGroup 的群销毁能力。",
        }
    ],
    ("GroupManager", "leaveGroup"): [
        {
            "manager": "GroupManager",
            "api": "leaveGroup",
            "reason_zh": "Flutter GroupManager.leaveGroup 调用 Android asyncLeaveGroup；等价覆盖 4.23 leaveGroup 的退群能力。",
        }
    ],
    ("GroupManager", "asyncJoinGroup"): [
        {
            "manager": "GroupManager",
            "api": "joinPublicGroup",
            "reason_zh": "Flutter GroupManager.joinPublicGroup 通过服务端群信息校验后调用 Android joinGroup；等价覆盖 4.23 asyncJoinGroup 的公开群加入能力。",
        }
    ],
    ("GroupManager", "getJoinedGroupsFromServer"): [
        {
            "manager": "GroupManager",
            "api": "getJoinedGroupsFromServer",
            "reason_zh": "Flutter GroupManager.fetchJoinedGroupsFromServer 使用 getJoinedGroupsFromServer method key 调用 Android asyncGetJoinedGroupsFromServer；等价覆盖 4.23 getJoinedGroupsFromServer 的服务端已加入群列表能力。",
        }
    ],
    ("GroupManager", "getPublicGroupsFromServer"): [
        {
            "manager": "GroupManager",
            "api": "getPublicGroupsFromServer",
            "reason_zh": "Flutter GroupManager.fetchPublicGroupsFromServer 使用 getPublicGroupsFromServer method key 调用 Android asyncGetPublicGroupsFromServer；等价覆盖 4.23 getPublicGroupsFromServer 的公开群分页能力。",
        }
    ],
    ("GroupManager", "asyncGetGroupFromServer"): [
        {
            "manager": "GroupManager",
            "api": "getGroupSpecificationFromServer",
            "reason_zh": "Flutter GroupManager.fetchGroupInfoFromServer 使用 getGroupSpecificationFromServer method key 调用 Android getGroupFromServer；等价覆盖 4.23 asyncGetGroupFromServer 的群详情拉取能力。",
        }
    ],
    ("GroupManager", "applyJoinToGroup"): [
        {
            "manager": "GroupManager",
            "api": "requestToJoinPublicGroup",
            "reason_zh": "Flutter GroupManager.requestToJoinPublicGroup 调用 Android asyncApplyJoinToGroup；等价覆盖 4.23 applyJoinToGroup 的入群申请能力。",
        }
    ],
    ("GroupManager", "acceptApplication"): [
        {
            "manager": "GroupManager",
            "api": "acceptJoinApplication",
            "reason_zh": "Flutter GroupManager.acceptJoinApplication 调用 Android asyncAcceptApplication；等价覆盖 4.23 acceptApplication 的入群申请同意能力。",
        }
    ],
    ("GroupManager", "declineApplication"): [
        {
            "manager": "GroupManager",
            "api": "declineJoinApplication",
            "reason_zh": "Flutter GroupManager.declineJoinApplication 调用 Android asyncDeclineApplication；等价覆盖 4.23 declineApplication 的入群申请拒绝能力。",
        }
    ],
    ("GroupManager", "acceptInvitation"): [
        {
            "manager": "GroupManager",
            "api": "acceptInvitationFromGroup",
            "reason_zh": "Flutter GroupManager.acceptInvitationFromGroup 调用 Android asyncAcceptInvitation；等价覆盖 4.23 acceptInvitation 的群邀请接受能力。",
        }
    ],
    ("GroupManager", "declineInvitation"): [
        {
            "manager": "GroupManager",
            "api": "declineInvitationFromGroup",
            "reason_zh": "Flutter GroupManager.declineInvitationFromGroup 调用 Android asyncDeclineInvitation；等价覆盖 4.23 declineInvitation 的群邀请拒绝能力。",
        }
    ],
    ("GroupManager", "changeGroupName"): [
        {
            "manager": "GroupManager",
            "api": "updateGroupSubject",
            "reason_zh": "Flutter GroupManager.changeGroupName/updateGroupName 使用 updateGroupSubject method key 调用 Android asyncChangeGroupName；等价覆盖 4.23 changeGroupName 的群名称修改能力。",
        }
    ],
    ("GroupManager", "changeGroupDescription"): [
        {
            "manager": "GroupManager",
            "api": "updateDescription",
            "reason_zh": "Flutter GroupManager.changeGroupDescription/updateGroupDesc 使用 updateDescription method key 调用 Android asyncChangeGroupDescription；等价覆盖 4.23 changeGroupDescription 的群描述修改能力。",
        }
    ],
    ("GroupManager", "changeGroupAvatar"): [
        {
            "manager": "GroupManager",
            "api": "updateGroupAvatar",
            "reason_zh": "Flutter GroupManager.updateGroupAvatar 调用 Android asyncChangeGroupAvatar；等价覆盖 4.23 changeGroupAvatar 的群头像修改能力。",
        }
    ],
    ("GroupManager", "changeOwner"): [
        {
            "manager": "GroupManager",
            "api": "updateGroupOwner",
            "reason_zh": "Flutter GroupManager.changeOwner 使用 updateGroupOwner method key 调用 Android asyncChangeOwner；等价覆盖 4.23 changeOwner 的群主转让能力。",
        }
    ],
    ("GroupManager", "addGroupAdmin"): [
        {
            "manager": "GroupManager",
            "api": "addAdmin",
            "reason_zh": "Flutter GroupManager.addAdmin 使用 addAdmin method key 调用 Android asyncAddGroupAdmin；等价覆盖 4.23 addGroupAdmin 的管理员添加能力。",
        }
    ],
    ("GroupManager", "removeGroupAdmin"): [
        {
            "manager": "GroupManager",
            "api": "removeAdmin",
            "reason_zh": "Flutter GroupManager.removeAdmin 使用 removeAdmin method key 调用 Android asyncRemoveGroupAdmin；等价覆盖 4.23 removeGroupAdmin 的管理员移除能力。",
        }
    ],
    ("GroupManager", "asyncAddUsersToGroup"): [
        {
            "manager": "GroupManager",
            "api": "addMembers",
            "reason_zh": "Flutter GroupManager.addMembers 使用 addMembers method key 调用 Android addUsersToGroup；等价覆盖 4.23 asyncAddUsersToGroup 的批量加群成员能力。",
        }
    ],
    ("GroupManager", "asyncRemoveUserFromGroup"): [
        {
            "manager": "GroupManager",
            "api": "removeMembers",
            "reason_zh": "Flutter GroupManager.removeMembers 使用 removeMembers method key 调用 Android asyncRemoveUsersFromGroup；单成员列表等价覆盖 4.23 asyncRemoveUserFromGroup。",
        }
    ],
    ("GroupManager", "removeUserFromGroup"): [
        {
            "manager": "GroupManager",
            "api": "removeMembers",
            "reason_zh": "Flutter GroupManager.removeMembers 使用 removeMembers method key 调用 Android asyncRemoveUsersFromGroup；单成员列表等价覆盖 4.23 removeUserFromGroup。",
        }
    ],
    ("GroupManager", "removeUsersFromGroup"): [
        {
            "manager": "GroupManager",
            "api": "removeMembers",
            "reason_zh": "Flutter GroupManager.removeMembers 使用 removeMembers method key 调用 Android asyncRemoveUsersFromGroup；等价覆盖 4.23 removeUsersFromGroup 的批量移除群成员能力。",
        }
    ],
    ("GroupManager", "asyncBlockUser"): [
        {
            "manager": "GroupManager",
            "api": "blockMembers",
            "reason_zh": "Flutter GroupManager.blockMembers 使用 blockMembers method key 调用 Android asyncBlockUsers；单成员列表等价覆盖 4.23 asyncBlockUser。",
        }
    ],
    ("GroupManager", "blockUser"): [
        {
            "manager": "GroupManager",
            "api": "blockMembers",
            "reason_zh": "Flutter GroupManager.blockMembers 使用 blockMembers method key 调用 Android asyncBlockUsers；单成员列表等价覆盖 4.23 blockUser。",
        }
    ],
    ("GroupManager", "blockUsers"): [
        {
            "manager": "GroupManager",
            "api": "blockMembers",
            "reason_zh": "Flutter GroupManager.blockMembers 使用 blockMembers method key 调用 Android asyncBlockUsers；等价覆盖 4.23 blockUsers 的批量拉黑群成员能力。",
        }
    ],
    ("GroupManager", "asyncUnblockUser"): [
        {
            "manager": "GroupManager",
            "api": "unblockMembers",
            "reason_zh": "Flutter GroupManager.unblockMembers 使用 unblockMembers method key 调用 Android asyncUnblockUsers；单成员列表等价覆盖 4.23 asyncUnblockUser。",
        }
    ],
    ("GroupManager", "unblockUser"): [
        {
            "manager": "GroupManager",
            "api": "unblockMembers",
            "reason_zh": "Flutter GroupManager.unblockMembers 使用 unblockMembers method key 调用 Android asyncUnblockUsers；单成员列表等价覆盖 4.23 unblockUser。",
        }
    ],
    ("GroupManager", "unblockUsers"): [
        {
            "manager": "GroupManager",
            "api": "unblockMembers",
            "reason_zh": "Flutter GroupManager.unblockMembers 使用 unblockMembers method key 调用 Android asyncUnblockUsers；等价覆盖 4.23 unblockUsers 的批量解除拉黑能力。",
        }
    ],
    ("GroupManager", "asyncFetchGroupBlackList"): [
        {
            "manager": "GroupManager",
            "api": "getGroupBlockListFromServer",
            "reason_zh": "Flutter GroupManager.getGroupBlockListFromServer 使用 getGroupBlockListFromServer method key 调用 Android asyncGetBlockedUsers；等价覆盖 4.23 asyncFetchGroupBlackList 的黑名单分页拉取能力。",
        }
    ],
    ("GroupManager", "getBlockedUsers"): [
        {
            "manager": "GroupManager",
            "api": "getGroupBlockListFromServer",
            "reason_zh": "Flutter GroupManager.getGroupBlockListFromServer 使用 getGroupBlockListFromServer method key 调用 Android asyncGetBlockedUsers；等价覆盖 4.23 getBlockedUsers 的黑名单分页拉取能力。",
        }
    ],
    ("GroupManager", "muteGroupMembers"): [
        {
            "manager": "GroupManager",
            "api": "muteMembers",
            "reason_zh": "Flutter GroupManager.muteMembers 使用 muteMembers method key 调用 Android asyncMuteGroupMembers；等价覆盖 4.23 muteGroupMembers 的成员禁言能力。",
        }
    ],
    ("GroupManager", "unMuteGroupMembers"): [
        {
            "manager": "GroupManager",
            "api": "unMuteMembers",
            "reason_zh": "Flutter GroupManager.unMuteMembers 使用 unMuteMembers method key 调用 Android asyncUnMuteGroupMembers；等价覆盖 4.23 unMuteGroupMembers 的解除成员禁言能力。",
        }
    ],
    ("GroupManager", "blockGroupMessage"): [
        {
            "manager": "GroupManager",
            "api": "blockGroup",
            "reason_zh": "Flutter GroupManager.blockGroup 使用 blockGroup method key 调用 Android asyncBlockGroupMessage；等价覆盖 4.23 blockGroupMessage 的屏蔽群消息能力。",
        }
    ],
    ("GroupManager", "unblockGroupMessage"): [
        {
            "manager": "GroupManager",
            "api": "unblockGroup",
            "reason_zh": "Flutter GroupManager.unblockGroup 使用 unblockGroup method key 调用 Android asyncUnblockGroupMessage；等价覆盖 4.23 unblockGroupMessage 的解除屏蔽群消息能力。",
        }
    ],
    ("GroupManager", "deleteGroupSharedFile"): [
        {
            "manager": "GroupManager",
            "api": "removeGroupSharedFile",
            "reason_zh": "Flutter GroupManager.removeGroupSharedFile 使用 removeGroupSharedFile method key 调用 Android asyncDeleteGroupSharedFile；等价覆盖 4.23 deleteGroupSharedFile 的共享文件删除能力。",
        }
    ],
    ("GroupManager", "downloadGroupSharedFile"): [
        {
            "manager": "GroupManager",
            "api": "downloadGroupSharedFile",
            "reason_zh": "Flutter GroupManager.downloadGroupSharedFile 使用 downloadGroupSharedFile method key 调用 Android asyncDownloadGroupSharedFile；等价覆盖 4.23 downloadGroupSharedFile 的共享文件下载能力。",
        }
    ],
    ("GroupManager", "fetchGroupAnnouncement"): [
        {
            "manager": "GroupManager",
            "api": "getGroupAnnouncementFromServer",
            "reason_zh": "Flutter GroupManager.fetchAnnouncementFromServer 使用 getGroupAnnouncementFromServer method key 调用 Android asyncFetchGroupAnnouncement；等价覆盖 4.23 fetchGroupAnnouncement 的公告拉取能力。",
        }
    ],
    ("GroupManager", "fetchGroupBlackList"): [
        {
            "manager": "GroupManager",
            "api": "getGroupBlockListFromServer",
            "reason_zh": "Flutter GroupManager.fetchBlockListFromServer 使用 getGroupBlockListFromServer method key 调用 Android asyncGetBlockedUsers；等价覆盖 4.23 fetchGroupBlackList 的黑名单分页拉取能力。",
        }
    ],
    ("GroupManager", "fetchGroupMembers"): [
        {
            "manager": "GroupManager",
            "api": "getGroupMemberListFromServer",
            "reason_zh": "Flutter GroupManager.fetchMemberListFromServer 使用 getGroupMemberListFromServer method key 调用 Android asyncFetchGroupMembers；等价覆盖 4.23 fetchGroupMembers 的成员分页拉取能力。",
        }
    ],
    ("GroupManager", "fetchGroupMuteList"): [
        {
            "manager": "GroupManager",
            "api": "getGroupMuteListFromServer",
            "reason_zh": "Flutter GroupManager.fetchMuteListFromServer 使用 getGroupMuteListFromServer method key 调用 Android asyncFetchGroupMuteList；等价覆盖 4.23 fetchGroupMuteList 的禁言列表分页拉取能力。",
        }
    ],
    ("GroupManager", "fetchGroupSharedFileList"): [
        {
            "manager": "GroupManager",
            "api": "getGroupFileListFromServer",
            "reason_zh": "Flutter GroupManager.fetchGroupFileListFromServer 使用 getGroupFileListFromServer method key 调用 Android asyncFetchGroupSharedFileList；等价覆盖 4.23 fetchGroupSharedFileList 的共享文件列表能力。",
        }
    ],
    ("GroupManager", "inviteUser"): [
        {
            "manager": "GroupManager",
            "api": "inviterUser",
            "reason_zh": "Flutter GroupManager.inviterUser 使用 inviterUser method key 调用 Android asyncInviteUser；等价覆盖 4.23 inviteUser 的群邀请能力，不与直接加人 addMembers 混用。",
        }
    ],
    ("GroupManager", "updateGroupAnnouncement"): [
        {
            "manager": "GroupManager",
            "api": "updateGroupAnnouncement",
            "reason_zh": "Flutter GroupManager.updateGroupAnnouncement 使用 updateGroupAnnouncement method key 调用 Android asyncUpdateGroupAnnouncement；等价覆盖 4.23 updateGroupAnnouncement 的公告更新能力。",
        }
    ],
    ("GroupManager", "uploadGroupSharedFile"): [
        {
            "manager": "GroupManager",
            "api": "uploadGroupSharedFile",
            "reason_zh": "Flutter GroupManager.uploadGroupSharedFile 使用 uploadGroupSharedFile method key 调用 Android asyncUploadGroupSharedFile；等价覆盖 4.23 uploadGroupSharedFile 的共享文件上传能力。",
        }
    ],
    ("ContactManager", "asyncAcceptInvitation"): [
        {
            "manager": "ContactManager",
            "api": "acceptInvitation",
            "reason_zh": "Flutter wrapper 的 acceptInvitation 在后台线程调用 Android acceptInvitation；等价覆盖 4.23 asyncAcceptInvitation 的好友邀请接受能力。",
        }
    ],
    ("ContactManager", "asyncAddContact"): [
        {
            "manager": "ContactManager",
            "api": "addContact",
            "reason_zh": "Flutter wrapper 的 addContact 在后台线程调用 Android addContact；等价覆盖 4.23 asyncAddContact 的添加联系人能力。",
        }
    ],
    ("ContactManager", "asyncAddUserToBlackList"): [
        {
            "manager": "ContactManager",
            "api": "addUserToBlockList",
            "reason_zh": "Flutter wrapper 使用 BlockList 命名，但 Android 实现调用 addUserToBlackList；等价覆盖 4.23 asyncAddUserToBlackList 的拉黑能力。",
        }
    ],
    ("ContactManager", "asyncDeclineInvitation"): [
        {
            "manager": "ContactManager",
            "api": "declineInvitation",
            "reason_zh": "Flutter wrapper 的 declineInvitation 在后台线程调用 Android declineInvitation；等价覆盖 4.23 asyncDeclineInvitation 的好友邀请拒绝能力。",
        }
    ],
    ("ContactManager", "asyncDeleteContact"): [
        {
            "manager": "ContactManager",
            "api": "deleteContact",
            "reason_zh": "Flutter wrapper 的 deleteContact 在后台线程调用 Android deleteContact；等价覆盖 4.23 asyncDeleteContact 的删除联系人能力。",
        }
    ],
    ("ContactManager", "asyncGetAllContactsFromServer"): [
        {
            "manager": "ContactManager",
            "api": "getAllContactsFromServer",
            "reason_zh": "Flutter wrapper 的 getAllContactsFromServer 在后台线程调用 Android getAllContactsFromServer；等价覆盖 4.23 asyncGetAllContactsFromServer 的服务端联系人列表能力。",
        }
    ],
    ("ContactManager", "asyncGetBlackListFromServer"): [
        {
            "manager": "ContactManager",
            "api": "getBlockListFromServer",
            "reason_zh": "Flutter wrapper 使用 BlockList 命名，但 Android 实现调用 getBlackListFromServer；等价覆盖 4.23 asyncGetBlackListFromServer 的服务端黑名单列表能力。",
        }
    ],
    ("ContactManager", "asyncGetSelfIdsOnOtherPlatform"): [
        {
            "manager": "ContactManager",
            "api": "getSelfIdsOnOtherPlatform",
            "reason_zh": "Flutter wrapper 的 getSelfIdsOnOtherPlatform 在后台线程调用 Android getSelfIdsOnOtherPlatform；等价覆盖 4.23 asyncGetSelfIdsOnOtherPlatform 的其它平台登录 ID 查询能力。",
        }
    ],
    ("ContactManager", "asyncRemoveUserFromBlackList"): [
        {
            "manager": "ContactManager",
            "api": "removeUserFromBlockList",
            "reason_zh": "Flutter wrapper 使用 BlockList 命名，但 Android 实现调用 removeUserFromBlackList；等价覆盖 4.23 asyncRemoveUserFromBlackList 的移出黑名单能力。",
        }
    ],
    ("ContactManager", "asyncSaveBlackList"): [
        {
            "manager": "ContactManager",
            "api": "saveBlackList",
            "reason_zh": "Android wrapper 新增 saveBlackList method key 并调用 asyncSaveBlackList；native-auto-test 通过 callNativeMethod 直接覆盖 4.23 批量保存黑名单列表能力，暂不作为跨端 Dart 公开 API。",
        }
    ],
    ("ContactManager", "saveBlackList"): [
        {
            "manager": "ContactManager",
            "api": "saveBlackList",
            "reason_zh": "Android 4.23 saveBlackList 是同步阻塞形态；Android wrapper 使用同名 method key 调用 asyncSaveBlackList 覆盖同一批量保存黑名单列表能力，避免暴露同步阻塞调用。",
        }
    ],
    ("ChatManager", "addReaction"): [
        {
            "manager": "ChatManager",
            "api": "addReaction",
            "reason_zh": "Flutter wrapper 使用同名命令调用 Android asyncAddReaction；覆盖 Android 4.23 同步 addReaction 的用户可见能力。",
        }
    ],
    ("ChatManager", "asyncFetchHistoryMessage"): [
        {
            "manager": "ChatManager",
            "api": "fetchHistoryMessages",
            "reason_zh": "Flutter wrapper 的 fetchHistoryMessages 暴露同一分页拉取历史消息能力；Android 实现调用 fetchHistoryMessages，4.23 还提供 asyncFetchHistoryMessage 等价异步形态。",
        }
    ],
    ("ChatManager", "asyncRecallMessage"): [
        {
            "manager": "ChatManager",
            "api": "recallMessage",
            "reason_zh": "Flutter wrapper 的 recallMessage 在后台线程调用真实 SDK recallMessage 并返回异步结果；等价覆盖 Android asyncRecallMessage 的撤回能力。",
        }
    ],
    ("ChatManager", "fetchGroupReadAcks"): [
        {
            "manager": "ChatManager",
            "api": "asyncFetchGroupAcks",
            "reason_zh": "Flutter wrapper 的 asyncFetchGroupAcks 调用 Android asyncFetchGroupReadAcks；覆盖 fetchGroupReadAcks 的群消息已读回执分页能力。",
        }
    ],
    ("ChatManager", "getReactionDetail"): [
        {
            "manager": "ChatManager",
            "api": "fetchReactionDetail",
            "reason_zh": "Flutter wrapper 的 fetchReactionDetail 调用 Android asyncGetReactionDetail；等价覆盖 getReactionDetail 的 reaction 明细分页能力。",
        }
    ],
    ("ChatManager", "getReactionList"): [
        {
            "manager": "ChatManager",
            "api": "fetchReactionList",
            "reason_zh": "Flutter wrapper 的 fetchReactionList 调用 Android asyncGetReactionList；等价覆盖 getReactionList 的批量 reaction 列表能力。",
        }
    ],
    ("ChatManager", "removeReaction"): [
        {
            "manager": "ChatManager",
            "api": "removeReaction",
            "reason_zh": "Flutter wrapper 使用同名命令调用 Android asyncRemoveReaction；覆盖 Android 4.23 同步 removeReaction 的用户可见能力。",
        }
    ],
    ("PushManager", "updatePushDisplayStyle"): [
        {
            "manager": "PushManager",
            "api": "updateImPushStyle",
            "reason_zh": "Flutter Dart API updatePushDisplayStyle 通过 updateImPushStyle method key 调用 Android asyncUpdatePushDisplayStyle；等价覆盖 4.23 updatePushDisplayStyle 的推送展示样式能力。",
        }
    ],
    ("PushManager", "updatePushNickname"): [
        {
            "manager": "PushManager",
            "api": "updatePushNickname",
            "reason_zh": "Flutter wrapper 的 updatePushNickname 调用 Android asyncUpdatePushNickname；等价覆盖 4.23 updatePushNickname 的推送昵称设置能力。",
        }
    ],
    ("UserInfoManager", "getUserInfoWithUserId"): [
        {
            "manager": "UserInfoManager",
            "api": "fetchUserInfoById",
            "reason_zh": "Flutter wrapper 的 fetchUserInfoById 调用 Android fetchUserInfoByUserId 批量拉取用户属性；用单元素 userIds 等价覆盖 getUserInfoWithUserId 的按用户 ID 查询能力。",
        }
    ],
    ("UserInfoManager", "getUserInfoWithUserIds"): [
        {
            "manager": "UserInfoManager",
            "api": "fetchUserInfoById",
            "reason_zh": "Flutter wrapper 的 fetchUserInfoById 调用 Android fetchUserInfoByUserId 批量拉取用户属性；等价覆盖 getUserInfoWithUserIds 的批量用户属性查询能力。",
        }
    ],
    ("UserInfoManager", "fetchSubscribedUsers"): [
        {
            "manager": "UserInfoManager",
            "api": "fetchSubscribedUsers",
            "reason_zh": "Flutter wrapper 的 fetchSubscribedUsers 调用 Android fetchSubscribedUsers；覆盖已订阅用户资料列表查询能力。",
        }
    ],
    ("UserInfoManager", "subscribeUsersInfo"): [
        {
            "manager": "UserInfoManager",
            "api": "subscribeUsersInfo",
            "reason_zh": "Flutter wrapper 的 subscribeUsersInfo 调用 Android subscribeUsersInfo；覆盖批量订阅陌生人用户资料能力。",
        }
    ],
    ("UserInfoManager", "unsubscribeUsersInfo"): [
        {
            "manager": "UserInfoManager",
            "api": "unsubscribeUsersInfo",
            "reason_zh": "Flutter wrapper 的 unsubscribeUsersInfo 调用 Android unsubscribeUsersInfo；覆盖批量取消订阅陌生人用户资料能力。",
        }
    ],
}


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _load_review_config() -> dict[str, dict[str, str]]:
    if not REVIEW_CONFIG.exists():
        return {}
    import yaml

    raw = yaml.safe_load(REVIEW_CONFIG.read_text(encoding="utf-8")) or {}
    items = raw.get("native_api_review", [])
    if not isinstance(items, list):
        raise ValueError(f"{REVIEW_CONFIG}: native_api_review must be a list, got {type(items).__name__}")
    result: dict[str, dict[str, str]] = {}
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"{REVIEW_CONFIG}: native_api_review[{index}] must be a mapping, got {item!r}")
        missing = [field for field in ("manager", "api") if not item.get(field)]
        if missing:
            raise ValueError(
                f"{REVIEW_CONFIG}: native_api_review[{index}] missing {', '.join(missing)} in item {item!r}"
            )
        key = f"{item['manager']}.{item['api']}"
        normalized = {str(k): "" if v is None else str(v) for k, v in item.items()}
        action = normalized.get("action", "")
        if action and action not in ALLOWED_REVIEW_ACTIONS:
            raise ValueError(f"Unsupported review action: {key} action={action}")
        if key in result:
            raise ValueError(f"{REVIEW_CONFIG}: duplicate native_api_review key: {key}")
        result[key] = normalized
    return result


def _line_no(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def _android_key_map() -> dict[str, str]:
    return {
        field: value
        for field, value in re.findall(
            r"static\s+final\s+String\s+(\w+)\s*=\s*\"([^\"]+)\"",
            _read(ANDROID_METHOD_KEYS),
        )
    }


def _ios_key_map() -> dict[str, str]:
    return {
        field: value
        for field, value in re.findall(
            r"static\s+NSString\s+\*const\s+(\w+)\s*=\s*@\"([^\"]+)\"",
            _read(IOS_METHOD_KEYS),
        )
    }


def _web_key_map() -> dict[str, str]:
    return {
        field: value
        for field, value in re.findall(
            r"static\s+const\s+String\s+(\w+)\s*=\s*'([^']+)'",
            _read(WEB_METHOD_KEYS),
        )
    }


def _java_method_body(text: str, name: str) -> str:
    match = re.search(
        r"\b(?:private|public|protected)\s+[^\n{;=]*\b"
        + re.escape(name)
        + r"\s*\([^;{]*\)\s*(?:throws\s+[^\{]+)?\{",
        text,
    )
    if not match:
        return ""
    start = match.end() - 1
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return text[start:]


def _objc_method_body(text: str, selector: str) -> str:
    match = re.search(
        r"[-+]\s*\([^)]*\)\s*" + re.escape(selector) + r"\b[^\{]*\{",
        text,
    )
    if not match:
        return ""
    start = match.end() - 1
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return text[start:]


def _sdk_evidence(body: str, platform: str) -> str:
    patterns = {
        "android": (
            r"EMClient\.getInstance\(\)",
            r"\.chatManager\(\)",
            r"\.contactManager\(\)",
            r"\.groupManager\(\)",
            r"\.chatroomManager\(\)",
            r"\.pushManager\(\)",
            r"\.presenceManager\(\)",
            r"\.chatThreadManager\(\)",
            r"EMConversation\b",
            r"EMMessage\b",
            r"EMOptions\b",
            r"HyphenateException\b",
        ),
        "ios": (
            r"EMClient\.sharedClient",
            r"\.chatManager",
            r"\.contactManager",
            r"\.groupManager",
            r"\.roomManager",
            r"\.pushManager",
            r"\.presenceManager",
            r"\.threadManager",
            r"EMConversation\b",
            r"EMChatMessage\b",
            r"EMOptions\b",
        ),
        "web": (r"_realSdk\b", r"RealWebSdk", r"js_util\.callMethod", r"_unsupported\("),
    }[platform]
    return "; ".join(
        pattern.replace(r"\b", "").replace("\\", "")
        for pattern in patterns
        if re.search(pattern, body)
    )


def _find_android_api_jar() -> Path | None:
    candidates: list[Path] = []
    roots = [
        Path("/Users/dujiepeng/Settings/gradle/caches"),
        Path.home() / ".gradle/caches",
    ]
    for root in roots:
        if not root.exists():
            continue
        candidates.extend(root.glob(f"**/jetified-hyphenate-chat-{ANDROID_SDK_VERSION}-api.jar"))
        candidates.extend(root.glob(f"**/hyphenate-chat-{ANDROID_SDK_VERSION}.aar"))
    jars = [path for path in candidates if path.name.endswith("-api.jar")]
    if jars:
        return sorted(jars, key=lambda item: len(str(item)))[0]
    # Gradle normally creates an api jar. If only the AAR exists, javap cannot
    # read it directly here; keep the missing path explicit in the report.
    return None


def _native_android_methods() -> dict[tuple[str, str], dict[str, str]]:
    api_jar = _find_android_api_jar()
    if api_jar is None:
        return {}
    output: dict[tuple[str, str], dict[str, str]] = {}
    method_re = re.compile(r"^\s*public\s+(?:static\s+)?(?:final\s+)?[^\(;=]+\s+(\w+)\(")
    for manager, class_name in NATIVE_ANDROID_CLASSES.items():
        proc = subprocess.run(
            ["javap", "-classpath", str(api_jar), "-public", class_name],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if proc.returncode != 0:
            continue
        for line in proc.stdout.splitlines():
            match = method_re.match(line)
            if not match:
                continue
            method = match.group(1)
            if method in OBJECT_METHODS or method == class_name.rsplit(".", 1)[-1]:
                continue
            output[(manager, method)] = {
                "native_android_api_exists": "yes",
                "native_android_class": class_name,
                "native_android_method": method,
                "native_android_artifact": str(api_jar),
                "native_android_signature": line.strip(),
            }
    return output


def _native_calls_from_java_body(body: str) -> set[tuple[str, str]]:
    calls: set[tuple[str, str]] = set()
    for accessor, method in re.findall(
        r"EMClient\.getInstance\(\)\.(chatManager|contactManager|groupManager|chatroomManager|pushManager|presenceManager|userInfoManager|chatThreadManager)\(\)\.(\w+)\s*\(",
        body,
    ):
        manager = ANDROID_NATIVE_ACCESSORS.get(accessor)
        if manager:
            calls.add((manager, method))
    for method in re.findall(r"EMClient\.getInstance\(\)\.(\w+)\s*\(", body):
        if method not in ANDROID_NATIVE_ACCESSORS and method not in OBJECT_METHODS:
            calls.add(("Client", method))
    for method in re.findall(r"\bconversation\.(\w+)\s*\(", body):
        if method not in OBJECT_METHODS:
            calls.add(("ConversationManager", method))
    for method in re.findall(r"\bmsg\.(\w+)\s*\(", body):
        if method not in OBJECT_METHODS:
            calls.add(("MessageManager", method))
    return calls


def _semantics_group(manager: str, method: str) -> str:
    lower = method.lower()
    if LISTENER_METHOD_RE.match(method):
        return "listener"
    if manager == "MessageManager" and GETTER_SETTER_RE.match(method):
        return "message_model_property"
    if manager == "ConversationManager" and GETTER_SETTER_RE.match(method):
        return "conversation_model_property"
    if ASYNC_METHOD_RE.match(method):
        return "async_native_api"
    if "message" in lower or "msg" in lower or manager == "MessageManager":
        return "message"
    if "conversation" in lower or manager == "ConversationManager":
        return "conversation"
    if "group" in lower or manager == "GroupManager":
        return "group"
    if "chatroom" in lower or "chatroom" in manager.lower():
        return "chatroom"
    if "contact" in lower or manager == "ContactManager":
        return "contact"
    if "push" in lower or manager == "PushManager":
        return "push"
    if "presence" in lower or manager == "PresenceManager":
        return "presence"
    if "thread" in lower or manager == "ChatThreadManager":
        return "chat_thread"
    if manager == "Client":
        return "client"
    return "other"


def _native_coverage_assessment(
    manager: str,
    method: str,
    wrappers: list[dict[str, str]],
    automation_infos: list[dict[str, Any]],
) -> dict[str, str]:
    group = _semantics_group(manager, method)
    if wrappers and automation_infos:
        requirement = "direct_e2e"
        conclusion = "covered_by_case"
        reason = "原生 API 已映射到 Android wrapper，且扫描到 native-auto-test case 引用对应 wrapper API。"
    elif wrappers:
        requirement = "direct_e2e"
        conclusion = "case_required"
        reason = "原生 API 已映射到 Android wrapper，但未扫描到 native-auto-test case 引用；需要补自动化覆盖。"
    elif group in {"listener", "message_model_property", "conversation_model_property"}:
        requirement = "indirect_e2e"
        if (group, manager) in INDIRECT_COVERAGE_RULES:
            conclusion = "indirect_covered_by_case"
            reason = INDIRECT_COVERAGE_RULES[(group, manager)][1]
        else:
            conclusion = "manual_review_required"
            reason = "原生 API 更适合通过事件、消息体、会话对象或状态查询间接断言；需要人工绑定覆盖 case，不能从 wrapper 调用自动确认。"
    else:
        requirement = "wrapper_required"
        conclusion = "wrapper_missing"
        reason = "原生 Android SDK 提供该 API，但当前未扫描到 Flutter Android wrapper 调用；需要确认是否补 wrapper，再补 E2E case。"
    return {
        "native_test_requirement": requirement,
        "coverage_semantics_group": group,
        "coverage_conclusion": conclusion,
        "coverage_reason_zh": reason,
    }


def _indirect_coverage_files(manager: str, group: str) -> str:
    rule = INDIRECT_COVERAGE_RULES.get((group, manager))
    return rule[0] if rule else ""


def scan_android() -> dict[tuple[str, str], dict[str, str]]:
    keys = _android_key_map()
    output: dict[tuple[str, str], dict[str, str]] = {}
    for path in sorted(ANDROID_DIR.glob("*Wrapper.java")):
        manager = MANAGER_BY_ANDROID_FILE.get(path.name)
        if not manager:
            continue
        text = _read(path)
        matches = re.finditer(
            r"MethodKey\.(\w+)\.equals\(call\.method\)\)\s*\{\s*([A-Za-z_]\w*)\s*\(",
            text,
            re.S,
        )
        for match in matches:
            field, handler = match.group(1), match.group(2)
            api = keys.get(field)
            if not api:
                continue
            body = _java_method_body(text, handler)
            evidence = _sdk_evidence(body, "android")
            native_calls = sorted(f"{manager_name}.{method}" for manager_name, method in _native_calls_from_java_body(body))
            output[(manager, api)] = {
                "manager": manager,
                "api": api,
                "android_covered": "yes",
                "android_wrapper_sdk_call_evidence": "yes" if evidence else "no",
                "android_native_calls": "; ".join(native_calls),
                "android_file": str(path.relative_to(REPO_ROOT)),
                "android_line": str(_line_no(text, match.start())),
                "android_handler": handler,
                "android_evidence": evidence
                or "入口存在；实现体未扫描到直接 EMClient/EM* SDK 调用，可能是配置、桥接或本地对象入口。",
            }
    return output


def scan_ios() -> dict[tuple[str, str], dict[str, str]]:
    keys = _ios_key_map()
    output: dict[tuple[str, str], dict[str, str]] = {}
    for path in sorted(IOS_DIR.glob("*Wrapper.m")):
        manager = MANAGER_BY_IOS_FILE.get(path.name)
        if not manager:
            continue
        text = _read(path)
        matches = re.finditer(
            r"\[\s*(\w+)\s+isEqualToString:call\.method\s*\]\)\s*\{\s*\[self\s+([A-Za-z_]\w*)",
            text,
            re.S,
        )
        for match in matches:
            field, handler = match.group(1), match.group(2)
            api = keys.get(field)
            if not api:
                continue
            evidence = _sdk_evidence(_objc_method_body(text, handler), "ios")
            output[(manager, api)] = {
                "ios_covered": "yes",
                "ios_real_sdk_call": "yes" if evidence else "no",
                "ios_file": str(path.relative_to(REPO_ROOT)),
                "ios_line": str(_line_no(text, match.start())),
                "ios_evidence": evidence or "入口存在；实现体未扫描到直接 EMClient/EM* SDK 调用。",
            }
        for match in re.finditer(r"\[\s*(\w+)\s+isEqualToString:call\.method\s*\]", text):
            api = keys.get(match.group(1))
            if api and (manager, api) not in output:
                output[(manager, api)] = {
                    "ios_covered": "yes",
                    "ios_real_sdk_call": "unknown",
                    "ios_file": str(path.relative_to(REPO_ROOT)),
                    "ios_line": str(_line_no(text, match.start())),
                    "ios_evidence": "在 handleMethodCall 条件中出现，但未解析到 handler。",
                }
    return output


def scan_web() -> dict[tuple[str, str], dict[str, str]]:
    keys = _web_key_map()
    output: dict[tuple[str, str], dict[str, str]] = {}
    files = [WEB_DIR / "client_web.dart"] + sorted((WEB_DIR / "managers").glob("*_web.dart"))
    for path in files:
        manager = MANAGER_BY_WEB_FILE.get(path.name)
        if not manager:
            continue
        text = _read(path)
        for match in re.finditer(r"case\s+_MethodKeys\.(\w+)\s*:", text):
            api = keys.get(match.group(1))
            if not api:
                continue
            next_match = re.search(
                r"\n\s*(?:case\s+_MethodKeys\.|default\s*:)",
                text[match.end() :],
            )
            end = match.end() + next_match.start() if next_match else min(len(text), match.end() + 1800)
            block = text[match.start() : end]
            evidence = _sdk_evidence(block, "web")
            if "_realSdk" in block or "RealWebSdk" in block or "js_util.callMethod" in block:
                real_sdk_call = "yes"
            elif "_unsupported(" in block:
                real_sdk_call = "unsupported"
            else:
                real_sdk_call = "no"
            output[(manager, api)] = {
                "web_covered": "yes",
                "web_real_sdk_call": real_sdk_call,
                "web_file": str(path.relative_to(REPO_ROOT)),
                "web_line": str(_line_no(text, match.start())),
                "web_evidence": evidence or "入口存在；未扫描到 real_sdk 调用，可能为本地适配或状态接口。",
            }
    return output


def _cmd_values() -> dict[str, str]:
    tree = ast.parse(_read(CMD_KEYS))
    values: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "Cmd":
            for stmt in node.body:
                if (
                    isinstance(stmt, ast.Assign)
                    and stmt.targets
                    and isinstance(stmt.targets[0], ast.Name)
                    and isinstance(stmt.value, ast.Constant)
                    and isinstance(stmt.value.value, str)
                ):
                    values[stmt.targets[0].id] = stmt.value.value
    return values


def _infer_manager(path: Path, api_name: str) -> str | None:
    parts = set(path.parts)
    if "client" in parts:
        return "Client"
    if "contact" in parts:
        return "ContactManager"
    if "chatroom" in parts:
        return "ChatRoomManager"
    if "group" in parts:
        return "GroupManager"
    if "presence" in parts:
        return "PresenceManager"
    if "push" in parts:
        return "PushManager"
    if "user_info" in parts:
        return "UserInfoManager"
    if "chat" in parts:
        if api_name in CONVERSATION_APIS:
            return "ConversationManager"
        if api_name in MESSAGE_APIS:
            return "MessageManager"
        if api_name in THREAD_APIS:
            return "ChatThreadManager"
        return "ChatManager"
    return None


def _pytest_function_blocks(text: str) -> list[tuple[int, int, str]]:
    matches = list(re.finditer(r"^def\s+test_[A-Za-z0-9_]+\s*\(", text, re.M))
    if not matches:
        return [(0, len(text), text)]
    blocks: list[tuple[int, int, str]] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append((start, end, text[start:end]))
    return blocks


def _is_automation_scan_excluded(path: Path) -> bool:
    try:
        parts = path.relative_to(ROOT).parts
    except ValueError:
        parts = path.parts
    return any(tuple(parts[: len(excluded)]) == excluded for excluded in AUTOMATION_SCAN_EXCLUDED_PARTS)


def _automation_evidence_kind(block: str, cmd: str, api_name: str | None = None) -> str:
    cmd_tokens = [cmd]
    if api_name:
        cmd_tokens.append(f"Cmd.{api_name}.value")
    if not any(token in block for token in cmd_tokens):
        return "unknown"
    cmd_pos = min(pos for token in cmd_tokens if (pos := block.find(token)) >= 0)
    prefix = block[max(0, cmd_pos - 120) : cmd_pos]
    local_context = block[max(0, cmd_pos - 260) : cmd_pos + 360].lower()
    if any(token in local_context for token in ("nonexistent", "invalid", "error")):
        return "error_only"
    response_var = ""
    assign_match = re.search(r"(\w+)\s*=\s*[^\n]{0,120}$", prefix)
    if assign_match:
        response_var = assign_match.group(1)

    if response_var and re.search(rf"\bassert_api\.assert_error\(\s*{re.escape(response_var)}\b", block):
        has_error_for_cmd = True
    else:
        has_error_for_cmd = bool(
            re.search(
                rf"assert_api\.assert_error\([\s\S]{{0,220}}(?:Cmd\.\w+\.value|['\"]){re.escape(cmd)}",
                block,
            )
        )

    has_success_for_cmd = False
    if response_var:
        success_patterns = (
            rf"\bassert_api\.assert_response_matches\(\s*{re.escape(response_var)}\b",
            rf"\bassert_group_snapshot\(\s*[^,\n]+,\s*{re.escape(response_var)}\b",
            rf"\bassert_group_list_response\(\s*[^,\n]+,\s*{re.escape(response_var)}\b",
            rf"\bassert_group_members_exact\(\s*{re.escape(response_var)}\b",
            rf"\bmember_count\(\s*{re.escape(response_var)}\b",
            rf"\b{re.escape(response_var)}\.get\(\s*['\"]result['\"]",
        )
        has_success_for_cmd = any(re.search(pattern, block) for pattern in success_patterns)

    cmd_success_pattern = re.search(
        rf"assert_response_matches\([\s\S]{{0,500}}['\"]cmd['\"]\s*:\s*(?:Cmd\.\w+\.value|['\"]{re.escape(cmd)}['\"])",
        block,
    )
    if cmd_success_pattern:
        has_success_for_cmd = True

    helper_success_patterns = (
        rf"_assert_chat_response\([\s\S]{{0,260}}(?:Cmd\.\w+\.value|['\"]{re.escape(cmd)}['\"])[\s\S]{{0,160}}\bTrue\b",
        rf"_assert_download_api_with_progress\([\s\S]{{0,260}}cmd\s*=\s*(?:Cmd\.{re.escape(api_name or '')}\.value|['\"]{re.escape(cmd)}['\"])",
    )
    if any(re.search(pattern, block) for pattern in helper_success_patterns):
        has_success_for_cmd = True

    if has_success_for_cmd:
        return "positive"
    if has_error_for_cmd:
        return "error_only"
    return "unknown"


def _record_automation_ref(
    pairs: dict[tuple[str, str], dict[str, Any]],
    manager: str,
    cmd: str,
    path: Path,
    block: str,
    count: int = 1,
    kind: str | None = None,
    api_name: str | None = None,
) -> None:
    if count <= 0:
        return
    item = pairs[(manager, cmd)]
    item["files"].add(str(path.relative_to(REPO_ROOT)))
    item["refs"] += count
    kind = kind or _automation_evidence_kind(block, cmd, api_name=api_name)
    if kind not in AUTOMATION_EVIDENCE_KINDS:
        kind = "unknown"
    item["evidence_kinds"][kind] += count


def _direct_e2e_case_state(
    *,
    requires_positive_case: bool,
    has_automation_refs: bool,
    positive_refs: int,
) -> tuple[str, bool]:
    has_required_automation = positive_refs > 0 if requires_positive_case else has_automation_refs
    conclusion = "covered_by_case" if has_required_automation else "case_required"
    return conclusion, has_required_automation


def scan_automation() -> dict[tuple[str, str], dict[str, Any]]:
    cmd_values = _cmd_values()
    pairs: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"files": set(), "refs": 0, "evidence_kinds": Counter()}
    )
    for root in TEST_DIRS:
        for path in root.rglob("*.py"):
            if "__pycache__" in path.parts:
                continue
            if _is_automation_scan_excluded(path):
                continue
            text = _read(path)
            for _, _, block in _pytest_function_blocks(text):
                for match in re.finditer(
                    r"\.call\(\s*['\"]([^'\"]+)['\"]\s*,\s*(?:['\"]([^'\"]+)['\"]|Cmd\.(\w+)\.value)",
                    block,
                ):
                    manager = match.group(1)
                    cmd = match.group(2) or cmd_values.get(match.group(3) or "")
                    if cmd:
                        _record_automation_ref(pairs, manager, cmd, path, block)
                for match in re.finditer(
                    r"['\"]manager['\"]\s*:\s*['\"]([^'\"]+)['\"][\s\S]{0,260}?['\"]cmd['\"]\s*:\s*(?:['\"]([^'\"]+)['\"]|Cmd\.(\w+)\.value)",
                    block,
                ):
                    manager = match.group(1)
                    cmd = match.group(2) or cmd_values.get(match.group(3) or "")
                    if cmd:
                        _record_automation_ref(pairs, manager, cmd, path, block)
                for api_name, cmd in cmd_values.items():
                    count = block.count(f"Cmd.{api_name}.value")
                    if count:
                        manager = _infer_manager(path, api_name)
                        if manager:
                            _record_automation_ref(pairs, manager, cmd, path, block, count, api_name=api_name)
    return pairs


def build_rows() -> list[dict[str, str]]:
    review_config = _load_review_config()
    native_android = _native_android_methods()
    android = scan_android()
    ios = scan_ios()
    web = scan_web()
    automation = scan_automation()
    native_call_to_wrappers: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for wrapper_key, android_info in android.items():
        for item in android_info.get("android_native_calls", "").split("; "):
            if not item or "." not in item:
                continue
            manager, method = item.split(".", 1)
            native_call_to_wrappers[(manager, method)].append(
                {
                    "manager": wrapper_key[0],
                    "api": wrapper_key[1],
                    "android_file": android_info.get("android_file", ""),
                    "android_line": android_info.get("android_line", ""),
                }
            )
    for native_key, aliases in NATIVE_ANDROID_EQUIVALENT_WRAPPERS.items():
        for alias in aliases:
            wrapper_key = (alias["manager"], alias["api"])
            android_info = android.get(wrapper_key)
            if not android_info:
                continue
            native_call_to_wrappers[native_key].append(
                {
                    "manager": wrapper_key[0],
                    "api": wrapper_key[1],
                    "android_file": android_info.get("android_file", ""),
                    "android_line": android_info.get("android_line", ""),
                    "equivalent_reason_zh": alias.get("reason_zh", ""),
                }
            )

    all_keys = sorted(set(android) | set(ios) | set(web))
    rows: list[dict[str, str]] = []
    for manager, api in all_keys:
        android_info = android.get((manager, api), {})
        ios_info = ios.get((manager, api), {})
        web_info = web.get((manager, api), {})
        automation_info = automation.get((manager, api))
        automation_evidence = automation_info.get("evidence_kinds", Counter()) if automation_info else Counter()
        rows.append(
            {
                "manager": manager,
                "api": api,
                "row_kind": "wrapper_api",
                "native_test_requirement": "",
                "coverage_semantics_group": "",
                "coverage_conclusion": "",
                "coverage_reason_zh": "",
                "review_action": "",
                "review_priority": "",
                "review_batch": "",
                "review_requires_positive_case": "",
                "target_case": "",
                "covered_by_wrapper_api": f"{manager}.{api}" if android_info else "",
                "native_android_api_exists": "yes" if (manager, api) in native_android else "no",
                "native_android_class": native_android.get((manager, api), {}).get("native_android_class", ""),
                "native_android_method": native_android.get((manager, api), {}).get("native_android_method", ""),
                "native_android_signature": native_android.get((manager, api), {}).get("native_android_signature", ""),
                "native_android_artifact": native_android.get((manager, api), {}).get("native_android_artifact", ""),
                "android_covered": "yes" if android_info else "no",
                "android_wrapper_sdk_call_evidence": android_info.get("android_wrapper_sdk_call_evidence", ""),
                "android_native_calls": android_info.get("android_native_calls", ""),
                "android_file": android_info.get("android_file", ""),
                "android_line": android_info.get("android_line", ""),
                "android_handler": android_info.get("android_handler", ""),
                "android_evidence": android_info.get("android_evidence", "Android 未扫描到同 manager/api 可调入口。"),
                "ios_covered": "yes" if ios_info else "no",
                "ios_real_sdk_call": ios_info.get("ios_real_sdk_call", ""),
                "ios_file": ios_info.get("ios_file", ""),
                "ios_line": ios_info.get("ios_line", ""),
                "ios_evidence": ios_info.get("ios_evidence", "iOS 未扫描到同 manager/api 可调入口。"),
                "web_covered": "yes" if web_info else "no",
                "web_real_sdk_call": web_info.get("web_real_sdk_call", ""),
                "web_file": web_info.get("web_file", ""),
                "web_line": web_info.get("web_line", ""),
                "web_evidence": web_info.get("web_evidence", "Web 未扫描到同 manager/api 可调入口。"),
                "automation_covered": "yes" if automation_info else "no",
                "automation_refs": str(automation_info["refs"]) if automation_info else "0",
                "automation_positive_refs": str(automation_evidence.get("positive", 0)),
                "automation_error_only_refs": str(automation_evidence.get("error_only", 0)),
                "automation_unknown_refs": str(automation_evidence.get("unknown", 0)),
                "automation_files": "; ".join(sorted(automation_info["files"])[:12]) if automation_info else "",
            }
        )
    for manager, method in sorted(native_android):
        wrappers = native_call_to_wrappers.get((manager, method), [])
        wrapper_apis = list(dict.fromkeys(f"{item['manager']}.{item['api']}" for item in wrappers))
        wrapper_files = list(dict.fromkeys(f"{item['android_file']}:{item['android_line']}" for item in wrappers))
        automation_infos = [
            automation[(item["manager"], item["api"])]
            for item in wrappers
            if (item["manager"], item["api"]) in automation
        ]
        automation_positive_refs = sum(int(item.get("evidence_kinds", {}).get("positive", 0)) for item in automation_infos)
        automation_error_only_refs = sum(int(item.get("evidence_kinds", {}).get("error_only", 0)) for item in automation_infos)
        automation_unknown_refs = sum(int(item.get("evidence_kinds", {}).get("unknown", 0)) for item in automation_infos)
        assessment = _native_coverage_assessment(manager, method, wrappers, automation_infos)
        equivalent_reasons = [
            item.get("equivalent_reason_zh", "")
            for item in wrappers
            if item.get("equivalent_reason_zh")
        ]
        if equivalent_reasons:
            assessment = {
                **assessment,
                "coverage_reason_zh": "；".join(equivalent_reasons),
            }
        review_key = f"{manager}.{method}"
        review = review_config.get(review_key, {})
        if review:
            action = review.get("action", "")
            if action not in ALLOWED_REVIEW_ACTIONS:
                raise ValueError(f"Unsupported review action: {review_key} action={action}")
            if review.get("reason_zh") and not equivalent_reasons:
                assessment = {**assessment, "coverage_reason_zh": review["reason_zh"]}
        if review.get("action") == "direct_e2e_case" and wrappers:
            requires_positive_case = review.get("requires_positive_case", "").lower() == "true"
            conclusion, has_required_automation = _direct_e2e_case_state(
                requires_positive_case=requires_positive_case,
                has_automation_refs=bool(automation_infos),
                positive_refs=automation_positive_refs,
            )
            assessment = {
                **assessment,
                "native_test_requirement": "direct_e2e",
                "coverage_conclusion": conclusion,
            }
        elif review.get("action") == "listener_registration_internal":
            assessment = {
                **assessment,
                "native_test_requirement": "indirect_e2e",
                "coverage_semantics_group": "listener",
                "coverage_conclusion": "indirect_covered_by_case",
            }
        elif review.get("action") in {"indirect_e2e_only", "model_property_covered", "manager_getter_internal"}:
            assessment = {
                **assessment,
                "native_test_requirement": "indirect_e2e",
                "coverage_conclusion": "indirect_covered_by_case",
            }
        elif review.get("action") in {"not_applicable", "platform_native_missing"}:
            assessment = {
                **assessment,
                "native_test_requirement": "not_applicable",
                "coverage_conclusion": "not_applicable",
            }
        automation_refs = sum(int(item["refs"]) for item in automation_infos)
        automation_files = sorted({file for item in automation_infos for file in item["files"]})
        indirect_files = _indirect_coverage_files(manager, assessment["coverage_semantics_group"])
        requires_positive_case = review.get("requires_positive_case", "").lower() == "true"
        if requires_positive_case:
            is_automation_covered = has_required_automation if review.get("action") == "direct_e2e_case" and wrappers else automation_positive_refs > 0
        else:
            is_automation_covered = bool(automation_infos) or assessment["coverage_conclusion"] == "indirect_covered_by_case"
        rows.append(
            {
                "manager": manager,
                "api": method,
                "row_kind": "native_android_api",
                **assessment,
                "review_action": review.get("action", ""),
                "review_priority": review.get("priority", ""),
                "review_batch": review.get("batch", ""),
                "review_requires_positive_case": review.get("requires_positive_case", "").lower(),
                "target_case": review.get("target_case", ""),
                "covered_by_wrapper_api": "; ".join(wrapper_apis),
                **native_android[(manager, method)],
                "android_covered": "yes" if wrappers else "no",
                "android_wrapper_sdk_call_evidence": "yes" if wrappers else "no",
                "android_native_calls": f"{manager}.{method}",
                "android_file": "; ".join(wrapper_files),
                "android_line": "",
                "android_handler": "; ".join(wrapper_apis),
                "android_evidence": "Android wrapper handler 调用了该原生 SDK API。"
                if wrappers
                else "Android 原生 SDK 存在该 API，但未扫描到 Flutter Android wrapper 调用。",
                "ios_covered": "",
                "ios_real_sdk_call": "",
                "ios_file": "",
                "ios_line": "",
                "ios_evidence": "原生 Android API 行不直接判断 iOS；请看对应 wrapper_api 行做三端对齐。",
                "web_covered": "",
                "web_real_sdk_call": "",
                "web_file": "",
                "web_line": "",
                "web_evidence": "原生 Android API 行不直接判断 Web；请看对应 wrapper_api 行做三端对齐。",
                "automation_covered": "yes" if is_automation_covered else "no",
                "automation_refs": str(automation_refs),
                "automation_positive_refs": str(automation_positive_refs),
                "automation_error_only_refs": str(automation_error_only_refs),
                "automation_unknown_refs": str(automation_unknown_refs),
                "automation_files": "; ".join(automation_files[:12]) or review.get("target_case", "") or indirect_files,
            }
        )
    return rows


def summarize(rows: list[dict[str, str]]) -> dict[str, Any]:
    wrapper_rows = [row for row in rows if row["row_kind"] == "wrapper_api"]
    native_rows = [row for row in rows if row["row_kind"] == "native_android_api"]
    android_keys = {(row["manager"], row["api"]) for row in wrapper_rows if row["android_covered"] == "yes"}
    ios_keys = {(row["manager"], row["api"]) for row in wrapper_rows if row["ios_covered"] == "yes"}
    web_keys = {(row["manager"], row["api"]) for row in wrapper_rows if row["web_covered"] == "yes"}
    return {
        "baseline": "Android native SDK API 4.23.0 plus Flutter wrapper platform API union",
        "total_native_android_api": len(native_rows),
        "native_android_api_wrapper_coverage": dict(Counter(row["android_covered"] for row in native_rows)),
        "native_android_api_automation_coverage": dict(Counter(row["automation_covered"] for row in native_rows)),
        "native_android_api_requirement": dict(Counter(row["native_test_requirement"] for row in native_rows)),
        "native_android_api_conclusion": dict(Counter(row["coverage_conclusion"] for row in native_rows)),
        "native_android_api_semantics_group": dict(Counter(row["coverage_semantics_group"] for row in native_rows)),
        "native_android_api_review_action": dict(Counter(row["review_action"] or "unclassified" for row in native_rows)),
        "total_platform_union_api": len(wrapper_rows),
        "total_android_api": len(android_keys),
        "android_wrapper_sdk_call_evidence": dict(
            Counter(row["android_wrapper_sdk_call_evidence"] or "missing" for row in wrapper_rows if row["android_covered"] == "yes")
        ),
        "ios_platform_coverage_against_android": {
            "covered": len(android_keys & ios_keys),
            "missing": len(android_keys - ios_keys),
        },
        "web_platform_coverage_against_android": {
            "covered": len(android_keys & web_keys),
            "missing": len(android_keys - web_keys),
        },
        "android_missing_against_ios": {
            "ios_has_android_missing": len(ios_keys - android_keys),
        },
        "android_missing_against_web": {
            "web_has_android_missing": len(web_keys - android_keys),
        },
        "automation_coverage_against_android_wrapper": dict(Counter(row["automation_covered"] for row in wrapper_rows if row["android_covered"] == "yes")),
        "missing_ios_by_manager": dict(Counter(row["manager"] for row in wrapper_rows if row["android_covered"] == "yes" and row["ios_covered"] == "no")),
        "missing_web_by_manager": dict(Counter(row["manager"] for row in wrapper_rows if row["android_covered"] == "yes" and row["web_covered"] == "no")),
        "missing_android_by_manager": dict(Counter(row["manager"] for row in wrapper_rows if row["android_covered"] == "no")),
        "missing_automation_by_manager": dict(
            Counter(row["manager"] for row in wrapper_rows if row["android_covered"] == "yes" and row["automation_covered"] == "no")
        ),
        "missing_native_android_wrapper_by_manager": dict(
            Counter(row["manager"] for row in native_rows if row["coverage_conclusion"] == "wrapper_missing")
        ),
        "missing_native_android_automation_by_manager": dict(Counter(row["manager"] for row in native_rows if row["automation_covered"] == "no")),
    }


FIELDS = [
    "manager",
    "api",
    "row_kind",
    "native_test_requirement",
    "coverage_semantics_group",
    "coverage_conclusion",
    "coverage_reason_zh",
    "review_action",
    "review_priority",
    "review_batch",
    "review_requires_positive_case",
    "target_case",
    "covered_by_wrapper_api",
    "native_android_api_exists",
    "native_android_class",
    "native_android_method",
    "native_android_signature",
    "native_android_artifact",
    "android_covered",
    "android_wrapper_sdk_call_evidence",
    "android_native_calls",
    "android_file",
    "android_line",
    "android_handler",
    "android_evidence",
    "ios_covered",
    "ios_real_sdk_call",
    "ios_file",
    "ios_line",
    "ios_evidence",
    "web_covered",
    "web_real_sdk_call",
    "web_file",
    "web_line",
    "web_evidence",
    "automation_covered",
    "automation_refs",
    "automation_positive_refs",
    "automation_error_only_refs",
    "automation_unknown_refs",
    "automation_files",
]


def _rows_by_kind(rows: list[dict[str, str]], row_kind: str) -> list[dict[str, str]]:
    return [row for row in rows if row.get("row_kind") == row_kind]


def render_csv(rows: list[dict[str, str]]) -> str:
    from io import StringIO

    output = StringIO()
    writer = csv.DictWriter(output, FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def _write_wrapper_missing_backlog(rows: list[dict[str, str]], out_dir: Path) -> None:
    backlog = [
        row
        for row in rows
        if row.get("row_kind") == "native_android_api" and row.get("coverage_conclusion") == "wrapper_missing"
    ]
    fields = [
        "manager",
        "api",
        "native_android_class",
        "native_android_method",
        "native_android_signature",
        "coverage_semantics_group",
        "native_test_requirement",
        "review_action",
        "review_priority",
        "review_batch",
        "target_case",
        "coverage_reason_zh",
    ]
    path = out_dir / "android-4.23-wrapper-missing-backlog.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in sorted(backlog, key=lambda r: (r["manager"], r["api"])):
            writer.writerow({field: row.get(field, "") for field in fields})


def _badge(value: str, positive: str = "yes") -> str:
    cls = "ok" if value == positive else "bad"
    label = {"yes": "有", "no": "缺", "unsupported": "不支持", "": "-"}.get(value, value)
    return f'<span class="badge {cls}">{html.escape(label)}</span>'


def render_html(rows: list[dict[str, str]], summary: dict[str, Any], *, title: str, description: str) -> str:
    managers = sorted({row["manager"] for row in rows})
    manager_options = "".join(f'<option value="{html.escape(item)}">{html.escape(item)}</option>' for item in managers)
    trs: list[str] = []
    for row in rows:
        search = " ".join(str(row.get(field, "")) for field in FIELDS).lower()
        trs.append(
            "<tr "
            f'data-kind="{row["row_kind"]}" '
            f'data-manager="{html.escape(row["manager"])}" '
            f'data-android="{row["android_covered"]}" '
            f'data-ios="{row["ios_covered"]}" '
            f'data-web="{row["web_covered"]}" '
            f'data-auto="{row["automation_covered"]}" '
            f'data-search="{html.escape(search)}">'
            f"<td>{html.escape(row['manager'])}</td>"
            f"<td><code>{html.escape(row['api'])}</code></td>"
            f"<td>{html.escape(row['row_kind'])}</td>"
            f"<td>{html.escape(row['native_test_requirement'])}</td>"
            f"<td>{html.escape(row['coverage_conclusion'])}</td>"
            f"<td>{html.escape(row['review_action'] or '-')}</td>"
            f"<td>{html.escape(row['review_priority'] or '-')}</td>"
            f"<td>{html.escape(row['review_batch'] or '-')}</td>"
            f"<td>{_badge(row['native_android_api_exists'])}</td>"
            f"<td>{_badge(row['android_covered'])}</td>"
            f"<td>{_badge(row['ios_covered'])}</td>"
            f"<td>{_badge(row['web_covered'])}</td>"
            f"<td>{_badge(row['automation_covered'])}</td>"
            f"<td>{_badge(row['android_wrapper_sdk_call_evidence'])}</td>"
            "<td class=\"small\">"
            f"Native: {html.escape(row['native_android_class'])}.{html.escape(row['native_android_method'])}<br>"
            f"Android: {html.escape(row['android_file'])}:{html.escape(row['android_line'])}<br>"
            f"iOS: {html.escape(row['ios_file'])}:{html.escape(row['ios_line'])}<br>"
            f"Web: {html.escape(row['web_file'])}:{html.escape(row['web_line'])}"
            "</td>"
            f"<td class=\"small\">{html.escape(row['automation_files'] or '-')}</td>"
            f"<td class=\"small\">{html.escape(row['target_case'] or '-')}</td>"
            "<td class=\"small\">"
            f"Android: {html.escape(row['android_evidence'])}<br>"
            f"iOS: {html.escape(row['ios_evidence'])}<br>"
            f"Web: {html.escape(row['web_evidence'])}<br>"
            f"Coverage: {html.escape(row['coverage_reason_zh'])}"
            "</td>"
            "</tr>"
        )
    android_total = summary["total_android_api"]
    ios_against_android = summary["ios_platform_coverage_against_android"]
    web_against_android = summary["web_platform_coverage_against_android"]
    automation = summary["automation_coverage_against_android_wrapper"]
    android_missing = (
        summary["android_missing_against_ios"]["ios_has_android_missing"]
        + summary["android_missing_against_web"]["web_has_android_missing"]
    )
    shown_total_label = "原生 Android API" if all(row.get("row_kind") == "native_android_api" for row in rows) else "平台 API 并集"
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
body{{margin:0;background:#f6f7f9;color:#17202a;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
header{{background:#fff;border-bottom:1px solid #d9dee7;padding:22px 28px}} h1{{margin:0 0 8px;font-size:24px}} p{{margin:0;color:#637083}}
main{{padding:18px 28px 32px}} .cards{{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:12px;margin-bottom:14px}}
.card{{background:#fff;border:1px solid #d9dee7;border-radius:8px;padding:14px}} .v{{font-size:26px;font-weight:700}} .n{{color:#637083;font-size:12px}}
.toolbar{{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(5,minmax(120px,1fr));gap:10px;background:#fff;border:1px solid #d9dee7;border-radius:8px;padding:12px;margin-bottom:12px}}
input,select{{height:36px;border:1px solid #d9dee7;border-radius:6px;padding:0 10px;font:inherit;background:#fff}}
.table{{background:#fff;border:1px solid #d9dee7;border-radius:8px;overflow:auto}} table{{border-collapse:collapse;width:100%;min-width:1620px}}
th,td{{border-bottom:1px solid #d9dee7;padding:9px 10px;text-align:left;vertical-align:top}} th{{position:sticky;top:0;background:#f9fafc;font-size:12px}}
code{{font-size:12px}} .small{{font-size:12px;color:#4d5a69}} .badge{{display:inline-flex;min-width:34px;justify-content:center;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:650}}
.ok{{color:#147a4b;background:#e6f5ed}} .bad{{color:#a12b2b;background:#fae7e7}} tr.hidden{{display:none}}
</style></head><body>
<header><h1>{html.escape(title)}</h1><p>{html.escape(description)}</p></header>
<main>
<div class="cards">
<section class="card"><div class="v">{summary['total_native_android_api']}</div><div>Android 原生 API</div><div class="n">来自 4.23.0 api.jar</div></section>
<section class="card"><div class="v">{android_total}</div><div>Android 基准 API</div><div class="n">来自 Android wrapper 可调入口</div></section>
<section class="card"><div class="v">{ios_against_android['covered']}</div><div>iOS 覆盖 Android</div><div class="n">缺 {ios_against_android['missing']}</div></section>
<section class="card"><div class="v">{web_against_android['covered']}</div><div>Web 覆盖 Android</div><div class="n">缺 {web_against_android['missing']}</div></section>
<section class="card"><div class="v">{automation.get('yes', 0)}</div><div>自动化覆盖 Android</div><div class="n">缺 {automation.get('no', 0)}</div></section>
<section class="card"><div class="v">{android_missing}</div><div>Android 相对缺失</div><div class="n">其他平台有但 Android 缺</div></section>
</div>
<div class="toolbar">
<input id="q" placeholder="搜索 manager/api/证据/case">
<select id="kind"><option value="">全部行</option><option value="native_android_api">原生 Android API</option><option value="wrapper_api">Wrapper API</option></select>
<select id="m"><option value="">全部 Manager</option>{manager_options}</select>
<select id="android"><option value="">Android 全部</option><option value="yes">Android 有</option><option value="no">Android 缺</option></select>
<select id="ios"><option value="">iOS 全部</option><option value="yes">iOS 有</option><option value="no">iOS 缺</option></select>
<select id="web"><option value="">Web 全部</option><option value="yes">Web 有</option><option value="no">Web 缺</option></select>
<select id="auto"><option value="">自动化全部</option><option value="yes">自动化有</option><option value="no">自动化缺</option></select>
</div>
<div class="n"><span id="count">{len(rows)}</span> / {len(rows)} 条{shown_total_label}</div>
<div class="table"><table><thead><tr><th>Manager</th><th>API</th><th>行类型</th><th>测试要求</th><th>覆盖结论</th><th>Review Action</th><th>优先级</th><th>Review Batch</th><th>原生 Android</th><th>Android wrapper</th><th>iOS</th><th>Web</th><th>自动化</th><th>Wrapper SDK 调用证据</th><th>源码位置</th><th>自动化文件</th><th>目标 Case</th><th>扫描证据</th></tr></thead><tbody>{''.join(trs)}</tbody></table></div>
</main><script>
const rows=[...document.querySelectorAll('tbody tr')]; const count=document.getElementById('count');
function f(){{const q=document.getElementById('q').value.toLowerCase().trim(),kind=document.getElementById('kind').value,m=document.getElementById('m').value,a=document.getElementById('android').value,ios=document.getElementById('ios').value,web=document.getElementById('web').value,auto=document.getElementById('auto').value;let n=0;for(const r of rows){{let ok=(!q||r.dataset.search.includes(q))&&(!kind||r.dataset.kind===kind)&&(!m||r.dataset.manager===m)&&(!a||r.dataset.android===a)&&(!ios||r.dataset.ios===ios)&&(!web||r.dataset.web===web)&&(!auto||r.dataset.auto===auto);r.classList.toggle('hidden',!ok);if(ok)n++;}}count.textContent=n;}}
for(const e of document.querySelectorAll('input,select')) e.addEventListener('input',f);
</script></body></html>"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "out/android-4.23-native-api-coverage.html")
    parser.add_argument("--csv-output", type=Path, default=ROOT / "out/android-4.23-native-api-coverage.csv")
    parser.add_argument("--json-output", type=Path, default=ROOT / "out/android-4.23-native-api-coverage-summary.json")
    parser.add_argument(
        "--wrapper-output",
        type=Path,
        default=ROOT / "out/android-4.23-wrapper-platform-alignment.html",
    )
    parser.add_argument(
        "--wrapper-csv-output",
        type=Path,
        default=ROOT / "out/android-4.23-wrapper-platform-alignment.csv",
    )
    args = parser.parse_args()

    rows = build_rows()
    summary = summarize(rows)
    native_rows = _rows_by_kind(rows, "native_android_api")
    wrapper_rows = _rows_by_kind(rows, "wrapper_api")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        render_html(
            native_rows,
            summary,
            title="Android 4.23 原生 API 覆盖统计",
            description="一行表示一个 Android 原生 SDK API；统计该原生 API 是否被 Flutter Android wrapper 封装，以及 native-auto-test 是否覆盖。",
        ),
        encoding="utf-8",
    )
    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    args.csv_output.write_text(render_csv(native_rows), encoding="utf-8")
    _write_wrapper_missing_backlog(rows, args.csv_output.parent)
    args.wrapper_output.parent.mkdir(parents=True, exist_ok=True)
    args.wrapper_output.write_text(
        render_html(
            wrapper_rows,
            summary,
            title="Android 4.23 Wrapper 三端对齐辅助统计",
            description="一行表示一个 Flutter wrapper 可调 API；仅用于 Android/iOS/Web 对齐分析，不作为原生 SDK API 主覆盖表。",
        ),
        encoding="utf-8",
    )
    args.wrapper_csv_output.parent.mkdir(parents=True, exist_ok=True)
    args.wrapper_csv_output.write_text(render_csv(wrapper_rows), encoding="utf-8")
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    print(f"html: {args.output}")
    print(f"csv: {args.csv_output}")
    print(f"wrapper_html: {args.wrapper_output}")
    print(f"wrapper_csv: {args.wrapper_csv_output}")
    print(f"backlog: {args.csv_output.parent / 'android-4.23-wrapper-missing-backlog.csv'}")
    print(f"json: {args.json_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
