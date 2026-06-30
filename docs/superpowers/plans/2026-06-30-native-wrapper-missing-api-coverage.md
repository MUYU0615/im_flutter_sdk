# Native Wrapper Missing API Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 Android 4.23 原生 SDK 中存在、当前 Flutter Android wrapper 不存在的 API，并把这些 API 纳入跨端一致性统计和 native-auto-test E2E 覆盖。

**Architecture:** 以 Android 4.23 原生 SDK public API 为基准，先由统计脚本生成 `wrapper_missing` 队列，再按 manager 分批补齐 MethodKey、Android wrapper、Dart/interface 调用契约、iOS/Web 对齐状态和 Python E2E case。每一批都必须重新生成 `native-auto-test/out/android-4.23-api-coverage.*`，用报告确认 `wrapper_missing` 数量下降、case 覆盖或不适用原因明确。

**Tech Stack:** Java Android plugin wrapper, Objective-C iOS plugin wrapper, Dart Flutter SDK/interface, Python pytest/native-auto-test, Gradle `hyphenate-chat:4.23.0`, `javap` SDK API 扫描。

---

## Current Baseline

当前基线来自 `native-auto-test/out/android-4.23-api-coverage-summary.json`：

- Android 4.23 原生 public API：475
- 原生 API 已被 Android wrapper 覆盖：232
- 原生 API 缺 Android wrapper：243
- 原生 API 结论为 `wrapper_missing`：161
- 原生 API 已有自动化覆盖或间接覆盖：313
- wrapper 已存在但缺 case：1，当前为 `MessageManager.pinnedInfo -> MessageManager.getPinInfo`

`wrapper_missing` 按 manager 分布：

- `GroupManager`：47
- `ChatRoomManager`：25
- `MessageManager`：23
- `Client`：20
- `ChatManager`：19
- `ContactManager`：12
- `ConversationManager`：6
- `UserInfoManager`：5
- `PushManager`：3
- `PresenceManager`：1

本计划的核心原则：

- 原生 SDK public API 只要存在，就必须有统计结论。
- 能暴露给 Flutter SDK 用户的能力要补 wrapper，并补 E2E。
- 仅 getter、listener 注册、内部 singleton、manager getter、对象构造、模型属性类 API 不一定需要独立 wrapper，但必须写入中文原因并绑定间接覆盖或不适用结论。
- 不允许为了让报告变绿而伪造真实 SDK 能力。

## File Structure

### Coverage and Planning

- Modify: `native-auto-test/src/tools/android_423_api_coverage_report.py`
  - 负责扫描 Android 原生 SDK、Android/iOS/Web wrapper、自动化 case。
  - 增加缺口队列输出、人工分类输入、批次维度和统计字段。
- Create: `native-auto-test/config/android_423_native_api_review.yaml`
  - 记录每个 `wrapper_missing` API 的处理策略、优先级、批次、中文原因和目标 case 文件。
- Create: `native-auto-test/out/android-4.23-wrapper-missing-backlog.csv`
  - 由脚本生成，不提交；用于执行批次排期。
- Modify: `native-auto-test/skills/android-api-coverage/SKILL.md`
  - 补充“补 wrapper 执行流程”和分类口径。

### Android Wrapper

- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`
  - 为需要暴露的 API 增加 MethodKey，命名以 Android 原生语义为基准，同时保持既有 Dart 命名风格。
- Modify per manager:
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ChatManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ChatRoomManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ContactManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ConversationWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/GroupManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MessageWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PresenceManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PushManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/UserInfoManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ClientWrapper.java`
  - 负责 `MethodKey` 分发、参数严格校验、真实 SDK 调用、结果序列化。
- Modify helpers when needed:
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/HelpTool.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/EMHelper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/EnumTools.java`
  - 只补通用参数/模型转换，不放 case 逻辑。

### Dart Contract

- Modify: `im_flutter_sdk/lib/src/internal/chat_method_keys.dart`
  - 与 Android `MethodKey.java` 保持 key 一致。
- Modify manager API only when this is user-facing SDK ability:
  - `im_flutter_sdk/lib/src/managers/chat_manager.dart`
  - `im_flutter_sdk/lib/src/managers/chat_room_manager.dart`
  - `im_flutter_sdk/lib/src/managers/contact_manager.dart`
  - `im_flutter_sdk/lib/src/managers/group_manager.dart`
  - `im_flutter_sdk/lib/src/managers/client.dart`
  - `im_flutter_sdk/lib/src/managers/presence_manager.dart`
  - `im_flutter_sdk/lib/src/managers/push_manager.dart`
  - `im_flutter_sdk/lib/src/managers/user_info_manager.dart`
  - `im_flutter_sdk/lib/src/models/em_message.dart`
  - `im_flutter_sdk/lib/src/models/em_conversation.dart`
- Modify interface when needed:
  - `im_flutter_sdk_interface/lib/src/interface/platform_interface/client.dart`
  - `im_flutter_sdk_interface/lib/src/interface/manager_mixin.dart`
  - 通常 native-auto-test 可通过 `callNativeMethod(manager, cmd, info)` 直调，不要求每个 API 都先有公开 Dart convenience method；但发布 SDK 用户需要的能力必须有公开 Dart API。

### iOS and Web Alignment

- Modify iOS when native iOS SDK has equivalent ability:
  - `im_flutter_sdk_ios/ios/Classes/MethodKeys.h`
  - `im_flutter_sdk_ios/ios/Classes/*Wrapper.m`
- Modify Web when Web SDK has equivalent real ability:
  - `im_flutter_sdk_web/lib/src/method_keys.dart`
  - `im_flutter_sdk_web/lib/src/client_web.dart`
  - `im_flutter_sdk_web/lib/src/managers/*_web.dart`
- If iOS/Web lacks native capability:
  - Do not fake implementation.
  - Mark as `not_applicable` or `platform_native_missing` in `native-auto-test/config/android_423_native_api_review.yaml` with Chinese reason.

### Test Cases

- Modify or create per manager:
  - `native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py`
  - `native-auto-test/tests/chat/test_conversation_remaining_api_coverage.py`
  - `native-auto-test/tests/chat/test_chat_thread_remaining_api_coverage.py`
  - `native-auto-test/tests/chatroom/test_chatroom_*`
  - `native-auto-test/tests/contact/test_contact_remaining_api_coverage.py`
  - `native-auto-test/tests/group/test_group_remaining_api_coverage.py`
  - `native-auto-test/tests/client/test_client_remaining_api_coverage.py`
  - `native-auto-test/tests/presence/test_presence.py`
  - `native-auto-test/tests/push/test_push_remaining_api_coverage.py`
  - `native-auto-test/tests/user_info/test_user_info.py`
- Modify: `native-auto-test/src/tools/android_e2e_runner.py`
  - 确保 Android 运行前卸载旧 app，避免旧 appkey/config 污染。
- Reports:
  - `native-auto-test/out/android-4.23-api-coverage.html`
  - `native-auto-test/out/android-4.23-api-coverage.csv`
  - `native-auto-test/out/android-4.23-api-coverage-summary.json`
  - `native-auto-test/out/log/android/`

---

### Task 1: Refresh Baseline and Generate Wrapper-Missing Backlog

**Files:**
- Modify: `native-auto-test/src/tools/android_423_api_coverage_report.py`
- Create: `native-auto-test/config/android_423_native_api_review.yaml`
- Output: `native-auto-test/out/android-4.23-wrapper-missing-backlog.csv`

- [ ] **Step 1: Add review config loader**

Add a loader that reads optional manual classification:

```python
REVIEW_CONFIG = ROOT / "native-auto-test/config/android_423_native_api_review.yaml"

def _load_review_config() -> dict[str, dict[str, str]]:
    if not REVIEW_CONFIG.exists():
        return {}
    import yaml
    raw = yaml.safe_load(REVIEW_CONFIG.read_text(encoding="utf-8")) or {}
    items = raw.get("native_api_review", [])
    result: dict[str, dict[str, str]] = {}
    for item in items:
        key = f"{item['manager']}.{item['api']}"
        result[key] = {str(k): "" if v is None else str(v) for k, v in item.items()}
    return result
```

- [ ] **Step 2: Add backlog CSV writer**

Add a writer after `rows` are built:

```python
def _write_wrapper_missing_backlog(rows: list[dict[str, str]], out_dir: Path) -> None:
    backlog = [
        row for row in rows
        if row.get("row_kind") == "native_android_api"
        and row.get("coverage_conclusion") == "wrapper_missing"
    ]
    fields = [
        "manager",
        "api",
        "native_android_class",
        "native_android_method",
        "native_android_signature",
        "coverage_semantics_group",
        "native_test_requirement",
        "coverage_reason_zh",
    ]
    path = out_dir / "android-4.23-wrapper-missing-backlog.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in sorted(backlog, key=lambda r: (r["manager"], r["api"])):
            writer.writerow({field: row.get(field, "") for field in fields})
```

- [ ] **Step 3: Create initial review config**

Create `native-auto-test/config/android_423_native_api_review.yaml`:

```yaml
native_api_review:
  - manager: MessageManager
    api: pinnedInfo
    action: direct_e2e_case
    priority: P0
    batch: message_p0
    reason_zh: "Android 原生消息对象存在 pinnedInfo 能力，wrapper 已映射为 getPinInfo，当前只缺自动化 case。"
    target_case: native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py
```

- [ ] **Step 4: Run report**

Run:

```bash
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
```

Expected:

```text
native-auto-test/out/android-4.23-api-coverage.html
native-auto-test/out/android-4.23-api-coverage.csv
native-auto-test/out/android-4.23-api-coverage-summary.json
native-auto-test/out/android-4.23-wrapper-missing-backlog.csv
```

- [ ] **Step 5: Commit**

```bash
git add native-auto-test/src/tools/android_423_api_coverage_report.py native-auto-test/config/android_423_native_api_review.yaml native-auto-test/skills/android-api-coverage/SKILL.md
git commit -m "chore: add native Android wrapper missing backlog"
```

---

### Task 2: Classify Wrapper-Missing APIs Into Action Buckets

**Files:**
- Modify: `native-auto-test/config/android_423_native_api_review.yaml`
- Modify: `native-auto-test/src/tools/android_423_api_coverage_report.py`

- [ ] **Step 1: Define allowed actions in script**

Add validation:

```python
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
```

- [ ] **Step 2: Apply review action to rows**

When building native rows, override requirement and reason from config:

```python
review_key = f"{manager}.{method}"
review = review_config.get(review_key, {})
if review:
    action = review.get("action", "")
    if action not in ALLOWED_REVIEW_ACTIONS:
        raise ValueError(f"Unsupported review action: {review_key} action={action}")
    row["review_action"] = action
    row["review_priority"] = review.get("priority", "")
    row["review_batch"] = review.get("batch", "")
    row["target_case"] = review.get("target_case", "")
    if review.get("reason_zh"):
        row["coverage_reason_zh"] = review["reason_zh"]
```

- [ ] **Step 3: Add config entries by manager**

Use this exact schema for every known `wrapper_missing` API:

```yaml
  - manager: GroupManager
    api: acceptApplication
    action: expose_wrapper
    priority: P1
    batch: group_membership_p1
    reason_zh: "Android 原生 SDK 提供入群申请同意能力，属于 App 可用业务能力，需要补 Flutter wrapper 并补双端 E2E。"
    target_case: native-auto-test/tests/group/test_group_join_requests_and_invitations.py
```

Required bucket rule:

- `expose_wrapper`: 聊天、群、聊天室、联系人、用户属性、push、presence 中 App 开发者可直接使用的能力。
- `direct_e2e_case`: wrapper 已有等价入口但统计未绑定 case。
- `indirect_e2e_only`: 事件回调、状态变化或字段由现有 E2E 间接验证。
- `model_property_covered`: `EMMessage`、`EMConversation` 的 getter/setter/字段类 API，必须绑定序列化断言 case。
- `listener_registration_internal`: listener 注册/清理类 API，不独立暴露给 Flutter 用户，只通过 start callback 和事件 case 覆盖。
- `manager_getter_internal`: `EMClient.chatManager()`、`groupManager()` 这类 manager getter，不作为 Flutter wrapper API。
- `platform_native_missing`: iOS/Web 原生不支持，但 Android 需要暴露。
- `not_applicable`: Android 原生 public 但 Flutter 插件不应暴露的内部配置/诊断能力。

- [ ] **Step 4: Validate no unclassified wrapper_missing**

Run:

```bash
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
python3 - <<'PY'
import csv
rows = list(csv.DictReader(open('native-auto-test/out/android-4.23-api-coverage.csv')))
missing = [
    r for r in rows
    if r['row_kind'] == 'native_android_api'
    and r['coverage_conclusion'] == 'wrapper_missing'
    and not r.get('review_action')
]
assert not missing, "\\n".join(f"{r['manager']}.{r['api']}" for r in missing[:50])
print("all wrapper_missing rows classified")
PY
```

Expected:

```text
all wrapper_missing rows classified
```

- [ ] **Step 5: Commit**

```bash
git add native-auto-test/config/android_423_native_api_review.yaml native-auto-test/src/tools/android_423_api_coverage_report.py
git commit -m "chore: classify native Android wrapper missing APIs"
```

---

### Task 3: Fix Existing Case Gap for MessageManager.pinnedInfo

**Files:**
- Modify: `native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py`
- Modify if required: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MessageWrapper.java`

- [ ] **Step 1: Add failing E2E case**

Add a case that pins a sent message, calls `MessageManager.getPinInfo`, and checks operator:

```python
def test_message_manager_get_pin_info_after_pin(device_a, device_b, assert_api, user_a, user_b):
    content = f"message-pin-info-{uuid.uuid4().hex[:8]}"
    msg_id = _send_text_and_receive(device_a, device_b, assert_api, user_a, user_b, content)

    resp_pin = device_a.call("ChatManager", Cmd.pinMessage.value, info={"msgId": msg_id})
    assert_api.assert_response_matches(
        resp_pin,
        expected={"manager": "ChatManager", "cmd": Cmd.pinMessage.value, "device": "deviceA", "result": None},
        ignore_keys={"sequence"},
    )

    resp = device_a.call("MessageManager", Cmd.getPinInfo.value, info={"msgId": msg_id})
    result = resp.get("result") or {}
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "MessageManager",
            "cmd": Cmd.getPinInfo.value,
            "device": "deviceA",
            "result": {"operatorId": user_a},
        },
        ignore_keys={"sequence", "pinTime"},
    )
    assert result.get("pinTime"), f"pinTime 应存在: {result}"
```

- [ ] **Step 2: Run targeted case and verify failure or pass**

Run:

```bash
cd native-auto-test
pytest tests/chat/test_chat_manager_remaining_api_coverage.py::test_message_manager_get_pin_info_after_pin -v
```

Expected before fix:

```text
FAILED
```

If it passes immediately, keep the case and continue to Step 4.

- [ ] **Step 3: Fix wrapper only if response shape is wrong**

Ensure `MessageWrapper.java` returns a JSON map with:

```json
{"operatorId":"<userId>","pinTime":1234567890}
```

Do not return raw SDK object.

- [ ] **Step 4: Re-run targeted case**

Run:

```bash
cd native-auto-test
pytest tests/chat/test_chat_manager_remaining_api_coverage.py::test_message_manager_get_pin_info_after_pin -v
```

Expected:

```text
PASSED
```

- [ ] **Step 5: Re-run coverage report**

Run:

```bash
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
```

Expected:

- `native_android_api_conclusion.case_required` becomes `0` or disappears.
- `MessageManager.pinnedInfo` appears as `covered_by_case` or documented indirect coverage.

- [ ] **Step 6: Commit**

```bash
git add native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MessageWrapper.java
git commit -m "test: cover message pin info native API"
```

---

### Task 4: Implement ChatManager P1 Wrapper APIs

**Files:**
- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`
- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ChatManagerWrapper.java`
- Modify: `im_flutter_sdk/lib/src/internal/chat_method_keys.dart`
- Modify: `native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py`

- [ ] **Step 1: Select ChatManager batch**

Start with these App-facing APIs:

```text
addReaction
removeReaction
getReactionList
getReactionDetail
fetchGroupReadAcks
asyncRecallMessage
asyncFetchHistoryMessage
getAllConversations
getConversationsByType
loadAllConversations
cleanConversationsMemoryCache
```

Reason:

- 这些能力都有明确业务语义。
- 多数已有相近 MethodKey 或 case，可先统一异步原生命名和现有 Flutter 命名。
- 可以通过消息发送、群消息、reaction、会话查询产生真实 E2E 结果。

- [ ] **Step 2: Add/confirm MethodKeys**

In both key files, ensure keys exist and names use current Flutter API names when equivalent keys already exist:

```java
static final String addReaction = "addReaction";
static final String removeReaction = "removeReaction";
static final String fetchReactionList = "fetchReactionList";
static final String fetchReactionDetail = "fetchReactionDetail";
static final String asyncFetchGroupAcks = "asyncFetchGroupAcks";
static final String recallMessage = "recallMessage";
static final String fetchHistoryMessages = "fetchHistoryMessages";
static final String loadAllConversations = "loadAllConversations";
```

```dart
static const String addReaction = "addReaction";
static const String removeReaction = "removeReaction";
static const String fetchReactionList = "fetchReactionList";
static const String fetchReactionDetail = "fetchReactionDetail";
static const String asyncFetchGroupAcks = "asyncFetchGroupAcks";
static const String recallMessage = "recallMessage";
static const String fetchHistoryMessages = "fetchHistoryMessages";
static const String loadAllConversations = "loadAllConversations";
```

- [ ] **Step 3: Add strict parameter checks**

Each wrapper method must reject missing or empty required params before calling SDK:

```java
String msgId = call.argument("msgId");
if (msgId == null || msgId.length() == 0) {
    wrapperCallback.onError(ChatError.INVALID_PARAM, "msgId is required");
    return;
}
```

For paged APIs:

```java
Integer pageSize = call.argument("pageSize");
if (pageSize == null || pageSize <= 0) {
    wrapperCallback.onError(ChatError.INVALID_PARAM, "pageSize must be greater than 0");
    return;
}
```

- [ ] **Step 4: Add E2E cases**

Add cases covering:

- reaction add/remove/list/detail with two users.
- recall message and receiver event.
- fetch history after sending messages.
- conversation list after sending messages.
- group read ack after sending group message with group ack enabled.

Each case must assert:

- response manager/cmd/device
- result fields
- receiver event when applicable
- invalid parameter response for at least one required field

- [ ] **Step 5: Run ChatManager targeted tests**

Run:

```bash
cd native-auto-test
pytest tests/chat/test_chat_manager_remaining_api_coverage.py tests/chat/test_chat_reaction_fetch.py -v
```

Expected:

```text
PASSED
```

- [ ] **Step 6: Re-run report and verify ChatManager count**

Run:

```bash
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
python3 - <<'PY'
import json
s=json.load(open('native-auto-test/out/android-4.23-api-coverage-summary.json'))
print(s['missing_native_android_wrapper_by_manager'].get('ChatManager', 0))
PY
```

Expected:

```text
less than 19
```

- [ ] **Step 7: Commit**

```bash
git add im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ChatManagerWrapper.java im_flutter_sdk/lib/src/internal/chat_method_keys.dart native-auto-test/tests/chat
git commit -m "feat: expose native chat manager wrapper APIs"
```

---

### Task 5: Implement Contact, UserInfo, Presence, and Push Small Batches

**Files:**
- Modify:
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ContactManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/UserInfoManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PresenceManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PushManagerWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`
  - `im_flutter_sdk/lib/src/internal/chat_method_keys.dart`
- Modify tests:
  - `native-auto-test/tests/contact/test_contact_remaining_api_coverage.py`
  - `native-auto-test/tests/user_info/test_user_info.py`
  - `native-auto-test/tests/presence/test_presence.py`
  - `native-auto-test/tests/push/test_push_remaining_api_coverage.py`

- [ ] **Step 1: Contact APIs**

Cover:

```text
asyncAddContact
asyncDeleteContact
asyncAcceptInvitation
asyncDeclineInvitation
asyncAddUserToBlackList
asyncRemoveUserFromBlackList
asyncGetAllContactsFromServer
asyncGetBlackListFromServer
asyncGetSelfIdsOnOtherPlatform
```

Use existing synchronous Flutter names when available:

```text
addContact
deleteContact
acceptInvitation
declineInvitation
addUserToBlockList
removeUserFromBlockList
getAllContactsFromServer
getBlockListFromServer
getSelfIdsOnOtherPlatform
```

- [ ] **Step 2: UserInfo APIs**

Cover:

```text
fetchSubscribedUsers
getUserInfoWithUserId
getUserInfoWithUserIds
subscribeUsersInfo
unsubscribeUsersInfo
```

Expected E2E:

- user A updates own user info.
- user B fetches A's info.
- subscribe/unsubscribe changes server-side subscription result or callback behavior.
- invalid `userIds=[]` returns parameter error.

- [ ] **Step 3: Presence API**

Classify `clearListeners` as `listener_registration_internal` unless Flutter SDK exposes explicit listener lifecycle API. Coverage must be tied to start callback + presence event cases.

- [ ] **Step 4: Push APIs**

Review:

```text
reportPushAction
updatePushDisplayStyle
updatePushNickname
```

Implement only if Android SDK exposes them as App-facing, testable methods. If not testable in emulator because push vendor token is unavailable, mark:

```yaml
action: expose_wrapper
reason_zh: "Android 原生 SDK 提供 push 配置能力，wrapper 需要暴露；E2E 在无厂商 push token 环境只能校验参数和 SDK 调用返回。"
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd native-auto-test
pytest tests/contact/test_contact_remaining_api_coverage.py tests/user_info/test_user_info.py tests/presence/test_presence.py tests/push/test_push_remaining_api_coverage.py -v
```

Expected:

```text
PASSED
```

- [ ] **Step 6: Commit**

```bash
git add im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ContactManagerWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/UserInfoManagerWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PresenceManagerWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PushManagerWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java im_flutter_sdk/lib/src/internal/chat_method_keys.dart native-auto-test/tests/contact native-auto-test/tests/user_info native-auto-test/tests/presence native-auto-test/tests/push
git commit -m "feat: expose native contact user presence push APIs"
```

---

### Task 6: Implement ChatRoomManager Wrapper APIs

**Files:**
- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ChatRoomManagerWrapper.java`
- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`
- Modify: `im_flutter_sdk/lib/src/internal/chat_method_keys.dart`
- Modify tests under: `native-auto-test/tests/chatroom/`

- [ ] **Step 1: Cover lifecycle and metadata APIs**

Start with:

```text
asyncCreateChatRoom
asyncDestroyChatRoom
asyncFetchChatRoomFromServer
asyncChangeChatRoomSubject
asyncChangeChatroomDescription
asyncFetchChatRoomAnnouncement
asyncUpdateChatRoomAnnouncement
```

Use existing Flutter names where available:

```text
createChatRoom
destroyChatRoom
fetchChatRoomInfoFromServer
changeChatRoomSubject
changeChatRoomDescription
fetchChatRoomAnnouncement
updateChatRoomAnnouncement
```

- [ ] **Step 2: Cover member/admin/block/mute APIs**

Cover:

```text
asyncAddChatRoomAdmin
asyncRemoveChatRoomAdmin
asyncMuteChatRoomMembers
asyncUnMuteChatRoomMembers
asyncBlockChatroomMembers
asyncUnBlockChatRoomMembers
asyncFetchChatRoomBlackList
asyncFetchChatRoomMembers
asyncChangeOwner
```

- [ ] **Step 3: Cover custom attribute APIs**

Cover server-visible attributes:

```text
asyncFetchChatRoomAllAttributesFromServer
asyncFetchChatRoomAttributesFromServer
asyncSetChatroomAttribute
asyncSetChatroomAttributes
asyncRemoveChatRoomAttributeFromServer
asyncRemoveChatRoomAttributesFromServer
```

- [ ] **Step 4: Add strict parameter cases**

For every chatroom API, add at least one invalid case:

- missing `roomId`
- empty `userIds`
- invalid `pageSize`
- empty attribute key

- [ ] **Step 5: Run chatroom tests**

Run:

```bash
cd native-auto-test
pytest tests/chatroom -v
```

Expected:

```text
PASSED
```

- [ ] **Step 6: Commit**

```bash
git add im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ChatRoomManagerWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java im_flutter_sdk/lib/src/internal/chat_method_keys.dart native-auto-test/tests/chatroom
git commit -m "feat: expose native chatroom manager APIs"
```

---

### Task 7: Implement GroupManager Wrapper APIs

**Files:**
- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/GroupManagerWrapper.java`
- Modify: `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`
- Modify: `im_flutter_sdk/lib/src/internal/chat_method_keys.dart`
- Modify tests under: `native-auto-test/tests/group/`

- [ ] **Step 1: Split group APIs into sub-batches**

Use these batches:

```text
group_lifecycle_p1:
  asyncCreateGroup
  asyncDestroyGroup
  asyncGetGroupFromServer
  asyncGetJoinedGroupsFromServer

group_membership_p1:
  applyJoinToGroup
  acceptApplication
  declineApplication
  asyncJoinGroup
  asyncLeaveGroup
  acceptInvitation
  declineInvitation

group_members_p1:
  asyncAddUsersToGroup
  asyncRemoveUserFromGroup
  asyncFetchGroupMembers
  asyncFetchGroupMemberAllAttributes
  asyncFetchGroupMembersAttributes
  asyncSetGroupMemberAttributes

group_roles_p1:
  addGroupAdmin
  removeGroupAdmin
  asyncBlockUser
  asyncUnblockUser
  asyncFetchGroupBlackList
  asyncMuteGroupMembers
  asyncUnMuteGroupMembers
  asyncFetchGroupMuteList

group_metadata_p1:
  asyncChangeGroupName
  asyncChangeGroupDescription
  asyncUpdateGroupAnnouncement
  asyncFetchGroupAnnouncement
  asyncUploadGroupSharedFile
  asyncFetchGroupSharedFileList
  asyncDeleteGroupSharedFile
  asyncUpdateGroupNamecard
```

- [ ] **Step 2: Implement one sub-batch at a time**

For each sub-batch:

1. Add MethodKey.
2. Add wrapper dispatch.
3. Add strict parameter validation.
4. Add serialization helper if response object is not already supported.
5. Add E2E case.
6. Run only that sub-batch tests.
7. Commit.

- [ ] **Step 3: Example strict validation**

Use this pattern for group ID and member list:

```java
String groupId = call.argument("groupId");
if (groupId == null || groupId.length() == 0) {
    wrapperCallback.onError(ChatError.INVALID_PARAM, "groupId is required");
    return;
}
List<String> userIds = call.argument("userIds");
if (userIds == null || userIds.isEmpty()) {
    wrapperCallback.onError(ChatError.INVALID_PARAM, "userIds must not be empty");
    return;
}
```

- [ ] **Step 4: Run group tests**

Run:

```bash
cd native-auto-test
pytest tests/group -v
```

Expected:

```text
PASSED
```

- [ ] **Step 5: Commit final group batch**

```bash
git add im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/GroupManagerWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java im_flutter_sdk/lib/src/internal/chat_method_keys.dart native-auto-test/tests/group
git commit -m "feat: expose native group manager APIs"
```

---

### Task 8: Classify Client, Conversation, and Message Object APIs

**Files:**
- Modify: `native-auto-test/config/android_423_native_api_review.yaml`
- Modify as needed:
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ClientWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ConversationWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MessageWrapper.java`
  - `im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`
  - `im_flutter_sdk/lib/src/internal/chat_method_keys.dart`
- Modify tests:
  - `native-auto-test/tests/client/test_client_remaining_api_coverage.py`
  - `native-auto-test/tests/chat/test_conversation_remaining_api_coverage.py`
  - `native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py`

- [ ] **Step 1: Mark manager getters as internal**

Classify these as `manager_getter_internal` unless there is a real Flutter user-facing reason:

```text
Client.chatManager
Client.groupManager
Client.contactManager
Client.chatroomManager
Client.chatThreadManager
Client.getInstance
```

Reason:

```yaml
reason_zh: "该 API 是 Android 原生 SDK manager 获取入口，Flutter SDK 已按 manager 分层暴露能力，不需要作为独立 MethodKey 暴露；覆盖由对应 manager API case 承担。"
```

- [ ] **Step 2: Review Client app-facing APIs**

Expose only app-facing, testable APIs:

```text
asyncGetRTCTokenInfoWithChannelName
asyncGetUserIdsWithRTCUids
getUserTokenFromServer
isFCMAvailable
getChatConfigPrivate
check
```

If server credential or RTC environment is required, add parameter validation case and mark runtime environment requirement in report.

- [ ] **Step 3: Conversation object APIs**

For:

```text
clear
conversationId
insertMessage
marks
msgType2ConversationType
searchCustomMsgFromDB
```

Rules:

- `conversationId` and `marks` are model properties; cover through `getConversation` and conversation serialization assertions.
- `insertMessage` and `searchCustomMsgFromDB` are App-facing local DB abilities; expose and add local DB E2E.
- `clear` must have a destructive local-state case that creates messages, clears local conversation, then asserts message count is zero.
- `msgType2ConversationType` is conversion helper; classify as internal if Flutter already accepts explicit conversation type.

- [ ] **Step 4: Message object APIs**

For message factory and body APIs:

```text
createTextSendMessage
createTxtSendMessage
createImageSendMessage
createFileSendMessage
createLocationSendMessage
createCombinedSendMessage
createReceiveMessage
createSendMessage
addBody
clone
conversationId
```

Rules:

- Factory APIs should be covered by `sendMessageWithType` and message serialization cases.
- `clone` only needs direct wrapper if Flutter SDK exposes message clone as developer API.
- `addBody` should not allow invalid or mismatched body type; if exposed, add strict body schema validation.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd native-auto-test
pytest tests/client/test_client_remaining_api_coverage.py tests/chat/test_conversation_remaining_api_coverage.py tests/chat/test_chat_manager_remaining_api_coverage.py -v
```

Expected:

```text
PASSED
```

- [ ] **Step 6: Commit**

```bash
git add native-auto-test/config/android_423_native_api_review.yaml im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ClientWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/ConversationWrapper.java im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MessageWrapper.java native-auto-test/tests/client native-auto-test/tests/chat
git commit -m "chore: classify client conversation message native APIs"
```

---

### Task 9: Add iOS and Web Alignment Tracking for Newly Exposed APIs

**Files:**
- Modify: `im_flutter_sdk_ios/ios/Classes/MethodKeys.h`
- Modify: `im_flutter_sdk_ios/ios/Classes/*Wrapper.m`
- Modify: `im_flutter_sdk_web/lib/src/method_keys.dart`
- Modify: `im_flutter_sdk_web/lib/src/managers/*_web.dart`
- Modify: `native-auto-test/config/android_423_native_api_review.yaml`

- [ ] **Step 1: Generate changed API list**

Run:

```bash
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
python3 - <<'PY'
import csv
rows=list(csv.DictReader(open('native-auto-test/out/android-4.23-api-coverage.csv')))
for r in rows:
    if r['row_kind']=='wrapper_api' and (r['ios_covered']=='no' or r['web_covered']=='no'):
        print(f"{r['manager']}.{r['api']} ios={r['ios_covered']} web={r['web_covered']}")
PY
```

- [ ] **Step 2: Implement iOS equivalents**

For each newly Android-exposed API:

- If iOS SDK has equivalent, add MethodKey and wrapper.
- If iOS SDK lacks equivalent, add review config reason:

```yaml
ios_status: platform_native_missing
ios_reason_zh: "iOS 原生 SDK 当前未暴露同语义 API，Android wrapper 已覆盖，iOS 统计为平台原生缺失。"
```

- [ ] **Step 3: Implement Web equivalents**

For each newly Android-exposed API:

- If Web SDK has real equivalent, add manager case in `im_flutter_sdk_web/lib/src/managers/*_web.dart`.
- If Web only has local adapter behavior, mark it as local-only and do not count as real SDK E2E.
- If Web SDK lacks equivalent, add review config reason:

```yaml
web_status: platform_native_missing
web_reason_zh: "Web SDK 当前未暴露同语义真实 API，不能用 local_adapter 冒充真实 E2E。"
```

- [ ] **Step 4: Run platform wrapper tests**

Run:

```bash
cd im_flutter_sdk_web && dart test
cd ../im_flutter_sdk && flutter analyze
```

Expected:

```text
All tests passed
No issues found
```

- [ ] **Step 5: Commit**

```bash
git add im_flutter_sdk_ios im_flutter_sdk_web native-auto-test/config/android_423_native_api_review.yaml
git commit -m "feat: align newly exposed native APIs across platforms"
```

---

### Task 10: Run Full Android Cross-Device E2E and Coverage Report

**Files:**
- Output only:
  - `native-auto-test/out/log/android/`
  - `native-auto-test/out/android-4.23-api-coverage.html`
  - `native-auto-test/out/android-4.23-api-coverage.csv`
  - `native-auto-test/out/android-4.23-api-coverage-summary.json`

- [ ] **Step 1: Ensure Android devices are ready**

Run:

```bash
adb devices
```

Expected:

```text
List of devices attached
<device-1>	device
<device-2>	device
```

- [ ] **Step 2: Uninstall old apps before run**

Run through runner or manually:

```bash
adb -s <device-1> uninstall com.easemob.im_flutter_test || true
adb -s <device-2> uninstall com.easemob.im_flutter_test || true
```

Expected:

```text
Success
```

or:

```text
Failure [DELETE_FAILED_INTERNAL_ERROR]
```

Only acceptable if app was not installed.

- [ ] **Step 3: Build and install test app**

Run:

```bash
cd im_flutter_test
flutter build apk --debug
```

Expected:

```text
Built build/app/outputs/flutter-apk/app-debug.apk
```

- [ ] **Step 4: Run Android full E2E**

Run:

```bash
cd native-auto-test
python3 src/tools/android_e2e_runner.py --platform android --all --log-dir out/log/android
```

Expected:

```text
pytest exit code: 0
```

- [ ] **Step 5: Generate final coverage report**

Run:

```bash
python3 native-auto-test/src/tools/android_423_api_coverage_report.py
```

Expected:

- HTML report exists at `native-auto-test/out/android-4.23-api-coverage.html`
- CSV report exists at `native-auto-test/out/android-4.23-api-coverage.csv`
- summary JSON exists at `native-auto-test/out/android-4.23-api-coverage-summary.json`
- `wrapper_missing` count is lower than baseline 161, or every remaining item has a Chinese classified reason.

- [ ] **Step 6: Record result in commit**

Commit code and config changes, not ignored generated reports unless project policy changes:

```bash
git add im_flutter_sdk im_flutter_sdk_android im_flutter_sdk_ios im_flutter_sdk_web native-auto-test im_flutter_test
git commit -m "test: expand native Android API e2e coverage"
```

---

## Execution Order

Run tasks in this order:

1. Task 1: Make backlog generation reliable.
2. Task 2: Classify all current `wrapper_missing` APIs before implementing large batches.
3. Task 3: Close the single existing `case_required` gap.
4. Task 4: ChatManager P1.
5. Task 5: Contact/UserInfo/Presence/Push small batches.
6. Task 6: ChatRoomManager.
7. Task 7: GroupManager.
8. Task 8: Client/Conversation/Message classification and selected implementation.
9. Task 9: iOS/Web alignment tracking.
10. Task 10: Full Android cross-device E2E and final coverage report.

## Definition of Done

The work is complete when:

- Every Android 4.23 native API row has one of:
  - implemented wrapper + direct E2E case
  - implemented wrapper + documented environment-limited validation
  - indirect E2E coverage with case evidence
  - Chinese not-applicable/platform-missing/internal reason
- `native-auto-test/out/android-4.23-api-coverage.html` shows both:
  - SDK 功能覆盖表
  - 测试 case 结果信息表 or linked case result report
- `wrapper_missing` count decreases for App-facing APIs.
- Remaining `wrapper_missing` items are not silent gaps; they have Chinese reasons in review config and report.
- Android full E2E has been run on two Android clients after uninstalling old apps.
- iOS/Web missing states are explicit and not counted as pass when native SDK lacks support.

## Review Checklist

Before merging each batch:

- [ ] MethodKey exists in Android and Dart key file.
- [ ] Android wrapper has a callable branch, not just a constant.
- [ ] Wrapper calls real SDK API or explicitly records why it does not.
- [ ] Required params are checked for missing, empty and invalid type/value.
- [ ] E2E case creates a real observable state change.
- [ ] E2E case includes at least one strict invalid-parameter assertion.
- [ ] Cross-device event assertions are present when the API should trigger events.
- [ ] Report regenerated.
- [ ] Remaining platform differences have Chinese reasons.
- [ ] No tokens or `native-auto-test/config.yaml` committed.

