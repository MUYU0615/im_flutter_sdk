# Web SDK Parallel Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current Web SDK adapter into manager-scoped files, then use parallel agents to add the remaining Web API coverage with real headless JSON bridge regression tests.

**Architecture:** `native-auto-test` drives the Web app through WebSocket JSON commands. The app calls `Client.instance.<manager>.callNativeMethod`, and `im_flutter_sdk_web` supplies the Web manager implementations. Coverage is recorded as `json_bridge + client_instance_manager`; public Dart API verification remains `public_api_verified: false` unless a later task explicitly adds public API tests.

**Tech Stack:** Dart/Flutter Web, `im_flutter_sdk_interface`, pytest, local WebSocket relay, headless Chromium, YAML coverage manifest.

---

### Task 1: Split Web Adapter By Manager Without Behavior Changes

**Files:**
- Modify: `im_flutter_sdk_web/lib/src/client_web.dart`
- Create: `im_flutter_sdk_web/lib/src/method_keys.dart`
- Create: `im_flutter_sdk_web/lib/src/web_helpers.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/chat_manager_web.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/chat_room_manager_web.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/contact_manager_web.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/conversation_manager_web.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/group_manager_web.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/presence_manager_web.dart`
- Create: `im_flutter_sdk_web/lib/src/managers/user_info_manager_web.dart`

- [ ] **Step 1: Extract `_MethodKeys` into a part file**

Create `im_flutter_sdk_web/lib/src/method_keys.dart` with:

```dart
part of 'client_web.dart';

class _MethodKeys {
  // Move the existing _MethodKeys body here without changing constants.
}
```

Replace the original `_MethodKeys` block in `client_web.dart` with:

```dart
part 'method_keys.dart';
```

- [ ] **Step 2: Extract helper functions into a part file**

Create `im_flutter_sdk_web/lib/src/web_helpers.dart` with:

```dart
part of 'client_web.dart';

Map<String, dynamic> _asMap(dynamic params) {
  // Move the existing helper implementation here unchanged.
}
```

Add to `client_web.dart`:

```dart
part 'web_helpers.dart';
```

- [ ] **Step 3: Extract each manager into a manager part file**

For each manager class, move the existing class body unchanged:

```dart
part of '../client_web.dart';

class ContactManagerWeb extends ContactManager {
  // Existing implementation unchanged.
}
```

Add these part directives to `client_web.dart`:

```dart
part 'managers/chat_manager_web.dart';
part 'managers/chat_room_manager_web.dart';
part 'managers/contact_manager_web.dart';
part 'managers/conversation_manager_web.dart';
part 'managers/group_manager_web.dart';
part 'managers/presence_manager_web.dart';
part 'managers/user_info_manager_web.dart';
```

- [ ] **Step 4: Format and analyze**

Run:

```bash
dart format im_flutter_sdk_web/lib/src/client_web.dart im_flutter_sdk_web/lib/src/method_keys.dart im_flutter_sdk_web/lib/src/web_helpers.dart im_flutter_sdk_web/lib/src/managers
dart analyze im_flutter_sdk_web/lib/src/client_web.dart
```

Expected:

```text
No issues found!
```

- [ ] **Step 5: Prove behavior is unchanged**

Run:

```bash
cd native-auto-test
make web-e2e ARGS="--run-id web-manager-split -- tests/web --target-platform web -v"
python3 -m src.tools.web_coverage_report --strict
pytest tests/web --collect-only -q --skip-global-login
cd ..
git diff --check
```

Expected:

```text
75 passed
blocked: 0
different: 0
pending: 0
75 tests collected
```

### Task 2: Parallel ChatRoom Moderation Coverage

**Files:**
- Modify: `im_flutter_sdk_web/lib/src/managers/chat_room_manager_web.dart`
- Create: `native-auto-test/tests/web/test_web_chat_room_moderation.py`

- [ ] **Step 1: Write failing Web E2E tests**

Cover:

```text
muteChatRoomMembers
unMuteChatRoomMembers
changeChatRoomOwner
addChatRoomAdmin
removeChatRoomAdmin
fetchChatRoomMuteList
removeChatRoomMembers
blockChatRoomMembers
unBlockChatRoomMembers
fetchChatRoomBlockList
addMembersToChatRoomWhiteList
removeMembersFromChatRoomWhiteList
fetchChatRoomWhiteListFromServer
isMemberInChatRoomWhiteListFromServer
muteAllChatRoomMembers
unMuteAllChatRoomMembers
isMemberInChatRoomMuteList
```

Run:

```bash
cd native-auto-test
make web-e2e ARGS="--run-id web-chatroom-moderation-red -- tests/web/test_web_chat_room_moderation.py --target-platform web -v"
```

Expected: fail with Web unsupported result or missing implementation.

- [ ] **Step 2: Implement local state**

Update `ChatRoomManagerWeb` so room maps maintain:

```dart
'owner': owner,
'adminList': <String>[],
'memberList': <String>[],
'blockList': <String>[],
'muteList': <String>[],
'whiteList': <String>[],
'isAllMemberMuted': false,
```

Return shapes must follow existing Dart manager JSON expectations:

```dart
{'cursor': '', 'list': values}
```

for cursor pages, and sorted `List<String>` for page-number list APIs.

- [ ] **Step 3: Verify green**

Run:

```bash
cd native-auto-test
make web-e2e ARGS="--run-id web-chatroom-moderation-green -- tests/web/test_web_chat_room_moderation.py --target-platform web -v"
```

Expected: new tests pass.

### Task 3: Parallel ChatRoom Attribute Coverage

**Files:**
- Modify: `im_flutter_sdk_web/lib/src/managers/chat_room_manager_web.dart`
- Create: `native-auto-test/tests/web/test_web_chat_room_attributes.py`

- [ ] **Step 1: Write failing Web E2E tests**

Cover:

```text
setChatRoomAttributes
fetchChatRoomAttributes
removeChatRoomAttributes
```

Run:

```bash
cd native-auto-test
make web-e2e ARGS="--run-id web-chatroom-attributes-red -- tests/web/test_web_chat_room_attributes.py --target-platform web -v"
```

Expected: fail with Web unsupported result or missing implementation.

- [ ] **Step 2: Implement local attribute state**

Store attributes per room:

```dart
final Map<String, Map<String, String>> _roomAttributes = {};
```

`setChatRoomAttributes` merges keys, `fetchChatRoomAttributes` filters requested keys when provided, and `removeChatRoomAttributes` removes requested keys.

- [ ] **Step 3: Verify green**

Run:

```bash
cd native-auto-test
make web-e2e ARGS="--run-id web-chatroom-attributes-green -- tests/web/test_web_chat_room_attributes.py --target-platform web -v"
```

Expected: new tests pass.

### Task 4: Parallel ChatThread Feasibility And MVP

**Files:**
- Create: `im_flutter_sdk_web/lib/src/managers/chat_thread_manager_web.dart` if the interface exposes a manager
- Create: `native-auto-test/tests/web/test_web_chat_thread_manager.py`
- Otherwise modify only coverage manifest in Task 7

- [ ] **Step 1: Check interface support**

Run:

```bash
rg -n "chatThreadManager|class .*ChatThread" im_flutter_sdk_interface im_flutter_sdk im_flutter_sdk_web
```

Expected: identify whether `Client.instance.chatThreadManager` exists in the interface.

- [ ] **Step 2: If supported by interface, add local MVP tests and implementation**

Cover only local state APIs that can be represented without server events or real remote delivery.

- [ ] **Step 3: If not supported by interface, record unsupported reason**

Reason:

```text
The Web interface layer does not expose a callable Client.instance.chatThreadManager entry point, so this API cannot be covered by the JSON bridge until the interface adds the manager.
```

### Task 5: Parallel PushManager Classification

**Files:**
- Create: `im_flutter_sdk_web/lib/src/managers/push_manager_web.dart` if local read APIs are feasible
- Create: `native-auto-test/tests/web/test_web_push_manager.py` if any APIs become supported
- Otherwise modify only coverage manifest in Task 7

- [ ] **Step 1: Classify push APIs**

Classify each `PushManager` API into:

```text
supported-local-read
unsupported-browser-platform
unsupported-interface-default
```

- [ ] **Step 2: Add local read tests only when behavior is stable**

Do not mark device token, vendor push, APNs, FCM, or notification permission APIs supported unless the Web plugin has a real browser implementation.

### Task 6: Parallel Message/Event API Classification

**Files:**
- Modify: `im_flutter_test/lib/bridge/event_bridge_handler.dart` only if event forwarding can be verified
- Create: `native-auto-test/tests/web/test_web_message_events.py` only for real event forwarding tests
- Otherwise modify only coverage manifest in Task 7

- [ ] **Step 1: Identify event-only APIs**

Event-only APIs stay unsupported unless a deterministic Web event can be emitted and observed through JSON bridge.

- [ ] **Step 2: Add event tests only for deterministic events**

Every event test must assert:

```text
type == "event"
eventType
stable data fields
```

### Task 7: Main-Flow Coverage Manifest Integration

**Files:**
- Modify: `native-auto-test/config/web_api_coverage.yaml`
- Modify: `native-auto-test/docs/agents/web/WEB_API_COVERAGE_REPORT.md`
- Modify: `native-auto-test/tests/web/test_capabilities.py`
- Modify: `native-auto-test/tests/web/test_web_unsupported_api.py`

- [ ] **Step 1: Update supported entries**

Every newly supported entry must include:

```yaml
verified_by:
  - json_bridge
  - client_instance_manager
public_api_verified: false
```

- [ ] **Step 2: Keep unsupported entries explicit**

Every remaining unsupported entry must include a reason that names the blocker:

```text
missing Web manager
browser platform unavailable
event-only API without deterministic event forwarding
file/media storage not available
server-backed behavior not implemented in local MVP
```

- [ ] **Step 3: Regenerate report and verify manifest**

Run:

```bash
cd native-auto-test
make web-coverage-report
python3 -m src.tools.web_coverage_report --strict
pytest tests/web/test_web_coverage_manifest.py tests/web/test_capabilities.py tests/web/test_web_unsupported_api.py -q --skip-global-login
```

Expected: no pending/blocked/different and no manifest failures.

### Task 8: Final Client-Level Regression

**Files:**
- Modify or create focused tests under `native-auto-test/tests/web/`

- [ ] **Step 1: Verify Client manager getters**

Add or confirm tests prove JSON calls no longer hit interface defaults for supported managers:

```text
Client.chatManager
Client.contactManager
Client.conversationManager
Client.groupManager
Client.chatRoomManager
Client.presenceManager
Client.userInfoManager
```

- [ ] **Step 2: Verify session state propagation**

Confirm:

```text
login sets current user into managers that require currentUser
logout clears current user
webReset clears local manager state while preserving current login where expected
```

- [ ] **Step 3: Run final full verification**

Run:

```bash
dart analyze im_flutter_sdk_web/lib/src/client_web.dart
cd native-auto-test
python3 -m src.tools.web_coverage_report --strict
make web-e2e ARGS="--run-id web-full-parallel-coverage -- tests/web --target-platform web -v"
pytest tests/web --collect-only -q --skip-global-login
lsof -iTCP:2000 -sTCP:LISTEN || true
lsof -iTCP:8080 -sTCP:LISTEN || true
cd ..
git diff --check
```

Expected:

```text
No analyzer issues
No pending/blocked/different coverage entries
All Web E2E tests pass
No leftover listener on 2000 or 8080
No diff whitespace errors
```

