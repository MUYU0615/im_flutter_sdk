"""Generate Android 4.23 based API coverage reports.

This report has two independent dimensions:

1. Platform API coverage:
   - Android callable APIs are one baseline.
   - iOS/Web callable APIs are compared with Android.
   - iOS/Web APIs that Android does not expose are also listed.
2. Automation coverage:
   - native-auto-test case references are scanned separately.

The Android baseline is not built from MethodKey alone. It scans wrapper
dispatch branches and checks whether the matched handler body references
real SDK objects such as EMClient and SDK managers.
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


def scan_automation() -> dict[tuple[str, str], dict[str, Any]]:
    cmd_values = _cmd_values()
    pairs: dict[tuple[str, str], dict[str, Any]] = defaultdict(lambda: {"files": set(), "refs": 0})
    for root in TEST_DIRS:
        for path in root.rglob("*.py"):
            if "__pycache__" in path.parts:
                continue
            text = _read(path)
            for match in re.finditer(
                r"\.call\(\s*['\"]([^'\"]+)['\"]\s*,\s*(?:['\"]([^'\"]+)['\"]|Cmd\.(\w+)\.value)",
                text,
            ):
                manager = match.group(1)
                cmd = match.group(2) or cmd_values.get(match.group(3) or "")
                if cmd:
                    pairs[(manager, cmd)]["files"].add(str(path.relative_to(REPO_ROOT)))
                    pairs[(manager, cmd)]["refs"] += 1
            for match in re.finditer(
                r"['\"]manager['\"]\s*:\s*['\"]([^'\"]+)['\"][\s\S]{0,260}?['\"]cmd['\"]\s*:\s*(?:['\"]([^'\"]+)['\"]|Cmd\.(\w+)\.value)",
                text,
            ):
                manager = match.group(1)
                cmd = match.group(2) or cmd_values.get(match.group(3) or "")
                if cmd:
                    pairs[(manager, cmd)]["files"].add(str(path.relative_to(REPO_ROOT)))
                    pairs[(manager, cmd)]["refs"] += 1
            for api_name, cmd in cmd_values.items():
                count = text.count(f"Cmd.{api_name}.value")
                if count:
                    manager = _infer_manager(path, api_name)
                    if manager:
                        pairs[(manager, cmd)]["files"].add(str(path.relative_to(REPO_ROOT)))
                        pairs[(manager, cmd)]["refs"] += count
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

    all_keys = sorted(set(android) | set(ios) | set(web))
    rows: list[dict[str, str]] = []
    for manager, api in all_keys:
        android_info = android.get((manager, api), {})
        ios_info = ios.get((manager, api), {})
        web_info = web.get((manager, api), {})
        automation_info = automation.get((manager, api))
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
                "automation_files": "; ".join(sorted(automation_info["files"])[:12]) if automation_info else "",
            }
        )
    for manager, method in sorted(native_android):
        wrappers = native_call_to_wrappers.get((manager, method), [])
        wrapper_apis = [f"{item['manager']}.{item['api']}" for item in wrappers]
        wrapper_files = [f"{item['android_file']}:{item['android_line']}" for item in wrappers]
        automation_infos = [
            automation[(item["manager"], item["api"])]
            for item in wrappers
            if (item["manager"], item["api"]) in automation
        ]
        assessment = _native_coverage_assessment(manager, method, wrappers, automation_infos)
        review_key = f"{manager}.{method}"
        review = review_config.get(review_key, {})
        if review:
            action = review.get("action", "")
            if action not in ALLOWED_REVIEW_ACTIONS:
                raise ValueError(f"Unsupported review action: {review_key} action={action}")
            if review.get("reason_zh"):
                assessment = {**assessment, "coverage_reason_zh": review["reason_zh"]}
        if review.get("action") == "direct_e2e_case" and wrappers:
            conclusion = "covered_by_case" if automation_infos else "case_required"
            assessment = {
                **assessment,
                "native_test_requirement": "direct_e2e",
                "coverage_conclusion": conclusion,
            }
        automation_refs = sum(int(item["refs"]) for item in automation_infos)
        automation_files = sorted({file for item in automation_infos for file in item["files"]})
        indirect_files = _indirect_coverage_files(manager, assessment["coverage_semantics_group"])
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
        "missing_native_android_wrapper_by_manager": dict(Counter(row["manager"] for row in native_rows if row["android_covered"] == "no")),
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
    "automation_files",
]


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


def render_html(rows: list[dict[str, str]], summary: dict[str, Any]) -> str:
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
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Android 4.23 API 覆盖统计</title>
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
<header><h1>Android 4.23 API 覆盖统计</h1><p>平台 API 覆盖与自动化覆盖是两个独立维度；Android 基准来自 wrapper 分发入口和真实 SDK 调用痕迹，不只看 MethodKey。</p></header>
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
<div class="n"><span id="count">{len(rows)}</span> / {len(rows)} 条平台 API 并集</div>
<div class="table"><table><thead><tr><th>Manager</th><th>API</th><th>行类型</th><th>测试要求</th><th>覆盖结论</th><th>Review Action</th><th>优先级</th><th>原生 Android</th><th>Android wrapper</th><th>iOS</th><th>Web</th><th>自动化</th><th>Wrapper SDK 调用证据</th><th>源码位置</th><th>自动化文件</th><th>目标 Case</th><th>扫描证据</th></tr></thead><tbody>{''.join(trs)}</tbody></table></div>
</main><script>
const rows=[...document.querySelectorAll('tbody tr')]; const count=document.getElementById('count');
function f(){{const q=document.getElementById('q').value.toLowerCase().trim(),kind=document.getElementById('kind').value,m=document.getElementById('m').value,a=document.getElementById('android').value,ios=document.getElementById('ios').value,web=document.getElementById('web').value,auto=document.getElementById('auto').value;let n=0;for(const r of rows){{let ok=(!q||r.dataset.search.includes(q))&&(!kind||r.dataset.kind===kind)&&(!m||r.dataset.manager===m)&&(!a||r.dataset.android===a)&&(!ios||r.dataset.ios===ios)&&(!web||r.dataset.web===web)&&(!auto||r.dataset.auto===auto);r.classList.toggle('hidden',!ok);if(ok)n++;}}count.textContent=n;}}
for(const e of document.querySelectorAll('input,select')) e.addEventListener('input',f);
</script></body></html>"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "out/android-4.23-api-coverage.html")
    parser.add_argument("--csv-output", type=Path, default=ROOT / "out/android-4.23-api-coverage.csv")
    parser.add_argument("--json-output", type=Path, default=ROOT / "out/android-4.23-api-coverage-summary.json")
    args = parser.parse_args()

    rows = build_rows()
    summary = summarize(rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_html(rows, summary), encoding="utf-8")
    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    args.csv_output.write_text(render_csv(rows), encoding="utf-8")
    _write_wrapper_missing_backlog(rows, args.csv_output.parent)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    print(f"html: {args.output}")
    print(f"csv: {args.csv_output}")
    print(f"backlog: {args.csv_output.parent / 'android-4.23-wrapper-missing-backlog.csv'}")
    print(f"json: {args.json_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
