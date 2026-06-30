# Web Real E2E Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Web local-adapter-only coverage claim with Android/iOS-parity real Web SDK service E2E coverage for every API, with no API omitted from tracking.

**Architecture:** Keep `native-auto-test -> WebSocket -> im_flutter_test -> Client.instance` as the test control plane, but make `im_flutter_sdk_web` call the real Web IM SDK and real IM service for supported APIs. Coverage reporting is split into local bridge coverage and real service E2E coverage, with an API matrix that fails if any API lacks a real E2E status.

**Tech Stack:** Flutter Web, `im_flutter_sdk_interface`, `im_flutter_sdk_web`, real Web IM SDK JavaScript/Dart interop, Python pytest, local WebSocket relay, REST user provisioning, pytest-html, Allure, YAML/Markdown coverage manifests.

---

## Current Truth

The current Web test suite verifies this path:

```text
native-auto-test
-> local WebSocket relay
-> im_flutter_test Web app
-> Client.instance / manager
-> im_flutter_sdk_web local adapter
-> local result/event
```

This is not equivalent to Android/iOS native-auto-test real service E2E. In particular, `sendMessage` currently writes to the sender Web adapter memory and emits sender-local `onMessagesReceived`; it does not verify:

```text
webA real SDK -> IM service -> webB real SDK
```

From this plan forward, `supported` in real E2E means the API passed through the real Web SDK and real IM service when the API is service-backed. Local adapter-only behavior remains useful for bridge smoke tests but cannot satisfy real E2E parity.

## File Ownership

### New Files

- `native-auto-test/config/web_real_e2e_coverage.yaml`
  - Source of truth for real Web SDK E2E status.
  - One entry per manager/cmd.
  - Allows only `supported`, `not_applicable`, `blocked`, `pending`.

- `native-auto-test/src/tools/web_real_e2e_matrix.py`
  - Builds the API matrix from `Cmd`, interface method keys, current bridge manifest, and real E2E manifest.
  - Fails on missing APIs, invalid statuses, missing tests for supported APIs, missing reasons for non-supported APIs.

- `native-auto-test/src/tools/web_real_e2e_report.py`
  - Generates Markdown summary and strict status counts for real Web E2E.
  - Outputs `native-auto-test/docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md`.

- `native-auto-test/tests/web_real/conftest.py`
  - Real Web SDK fixture layer.
  - Requires `target-platform=web`, real SDK mode, real users, and cleanup.

- `native-auto-test/tests/web_real/test_real_web_client.py`
  - Real Web SDK client/session smoke tests.

- `native-auto-test/tests/web_real/test_real_web_chat_message.py`
  - First hard gate: `webA -> IM service -> webB` text message delivery.

- `native-auto-test/docs/agents/web/WEB_REAL_E2E_API_MATRIX.md`
  - Generated matrix with every API and parity status.

- `native-auto-test/docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md`
  - Generated real E2E coverage summary.

### Modified Files

- `im_flutter_sdk_web/pubspec.yaml`
  - Add the real Web SDK dependency or JS interop support required by the selected SDK package.

- `im_flutter_sdk_web/lib/src/client_web.dart`
  - Replace local memory behavior for Client/session APIs with real SDK calls in real mode.
  - Keep local adapter path only for bridge smoke mode.

- `im_flutter_sdk_web/lib/src/managers/*.dart`
  - Migrate API groups from memory implementation to real Web SDK calls.

- `im_flutter_test/lib/bridge/im_websocket_bridge.dart`
  - Keep routing through `Client.instance`.
  - Do not add SDK behavior here.
  - Bridge-only control commands must be named `bridge.*` and excluded from SDK API coverage.

- `native-auto-test/Makefile`
  - Add `web-real-e2e`, `web-real-report`, and `web-real-matrix` targets.

- `native-auto-test/tests/web/test_web_coverage_manifest.py`
  - Keep bridge/local coverage tests separate from real E2E coverage tests.

- `native-auto-test/tests/web_real/test_real_web_coverage_manifest.py`
  - Validate real E2E manifest and matrix.

---

## Status Model

Every Web API must have exactly one real E2E status:

```yaml
ChatManager:
  sendMessage:
    real_e2e_status: supported
    tests:
      - tests/web_real/test_real_web_chat_message.py::test_web_a_send_text_web_b_receives
    verified_by:
      - real_web_sdk
      - real_im_server
      - cross_device_delivery
    reason: webA sends a text message through the real Web SDK and webB receives it from the real IM service.
```

Allowed statuses:

- `supported`: real Web SDK/service behavior is verified by at least one E2E test.
- `not_applicable`: the API is platform-native only or has no browser Web meaning.
- `blocked`: the API should be testable but is blocked by missing Web SDK surface, server entitlement, account config, or environment capability.
- `pending`: temporary planning state. Strict CI fails on this status after Phase 3.

Rules:

- `supported` requires non-empty `tests` and `verified_by`.
- `not_applicable` requires a platform-specific reason.
- `blocked` requires a concrete blocker and owner/Jira reference when known.
- `pending` is allowed only before Phase 3 closes.

---

## Phase 0: Rename Current Coverage Semantics

**Purpose:** Prevent the existing local adapter report from being mistaken for real IM E2E.

### Task 0.1: Add Local Coverage Terminology

**Files:**
- Modify: `native-auto-test/docs/agents/web/WEB_API_COVERAGE_REPORT.md`
- Modify: `native-auto-test/src/tools/web_coverage_report.py`
- Test: `native-auto-test/tests/web/test_web_coverage_manifest.py`

- [ ] **Step 1: Write failing report title test**

Add this assertion to `test_web_coverage_report_contains_summary_and_reason_groups`:

```python
assert "# Web Bridge / Local Adapter API Coverage Report" in report
assert "This report does not prove real IM service E2E delivery." in report
```

- [ ] **Step 2: Run red test**

```bash
cd native-auto-test
pytest tests/web/test_web_coverage_manifest.py::test_web_coverage_report_contains_summary_and_reason_groups -q --skip-global-login
```

Expected: fails because the report still says `# Web API Coverage Report`.

- [ ] **Step 3: Update report generator**

Change `_markdown_report()` heading and intro:

```python
lines = [
    "# Web Bridge / Local Adapter API Coverage Report",
    "",
    "This report verifies the local Web test bridge and Web adapter behavior.",
    "This report does not prove real IM service E2E delivery.",
    "",
]
```

- [ ] **Step 4: Regenerate report and verify**

```bash
make web-coverage-report
pytest tests/web/test_web_coverage_manifest.py -q --skip-global-login
```

Expected: all tests pass.

---

## Phase 1: Real E2E Manifest And Matrix

**Purpose:** Ensure no API can be missed while migrating to real Web SDK E2E.

### Task 1.1: Create Real E2E Manifest Skeleton

**Files:**
- Create: `native-auto-test/config/web_real_e2e_coverage.yaml`
- Create: `native-auto-test/tests/web_real/test_real_web_coverage_manifest.py`

- [ ] **Step 1: Write failing manifest test**

Create `native-auto-test/tests/web_real/test_real_web_coverage_manifest.py`:

```python
from src.tools.web_real_e2e_matrix import load_real_manifest, validate_real_manifest


def test_web_real_e2e_manifest_is_valid():
    errors = validate_real_manifest(load_real_manifest())
    assert errors == []
```

- [ ] **Step 2: Run red test**

```bash
cd native-auto-test
pytest tests/web_real/test_real_web_coverage_manifest.py -q --skip-global-login
```

Expected: import or file-not-found failure.

- [ ] **Step 3: Add minimal manifest**

Create `native-auto-test/config/web_real_e2e_coverage.yaml`:

```yaml
web_real_e2e:
  Client:
    init:
      real_e2e_status: pending
      tests: []
      verified_by: []
      reason: Real Web SDK init smoke is not implemented yet.
```

- [ ] **Step 4: Implement loader validation**

Create `native-auto-test/src/tools/web_real_e2e_matrix.py`:

```python
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[2]
REAL_MANIFEST = ROOT / "config" / "web_real_e2e_coverage.yaml"
ALLOWED = {"supported", "not_applicable", "blocked", "pending"}


def load_real_manifest() -> dict[str, Any]:
    if not REAL_MANIFEST.exists():
        return {"web_real_e2e": {}}
    with REAL_MANIFEST.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {"web_real_e2e": {}}


def validate_real_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    root = manifest.get("web_real_e2e")
    if not isinstance(root, dict):
        return ["missing web_real_e2e mapping"]
    for manager, commands in root.items():
        if not isinstance(commands, dict):
            errors.append(f"{manager}: commands must be mapping")
            continue
        for cmd, info in commands.items():
            if not isinstance(info, dict):
                errors.append(f"{manager}.{cmd}: info must be mapping")
                continue
            status = info.get("real_e2e_status")
            if status not in ALLOWED:
                errors.append(f"{manager}.{cmd}: invalid real_e2e_status {status!r}")
            tests = info.get("tests", [])
            if status == "supported" and not tests:
                errors.append(f"{manager}.{cmd}: supported requires tests")
            reason = str(info.get("reason") or "").strip()
            if status in {"not_applicable", "blocked", "pending"} and not reason:
                errors.append(f"{manager}.{cmd}: {status} requires reason")
    return errors
```

- [ ] **Step 5: Run green test**

```bash
pytest tests/web_real/test_real_web_coverage_manifest.py -q --skip-global-login
```

Expected: pass.

### Task 1.2: Build No-Omission Matrix

**Files:**
- Modify: `native-auto-test/src/tools/web_real_e2e_matrix.py`
- Modify: `native-auto-test/tests/web_real/test_real_web_coverage_manifest.py`

- [ ] **Step 1: Write failing API completeness test**

Add:

```python
from src.tools.web_real_e2e_matrix import missing_real_e2e_entries


def test_every_bridge_api_has_real_e2e_status():
    missing = missing_real_e2e_entries()
    assert missing == []
```

- [ ] **Step 2: Run red test**

```bash
pytest tests/web_real/test_real_web_coverage_manifest.py::test_every_bridge_api_has_real_e2e_status -q --skip-global-login
```

Expected: fails with many missing APIs.

- [ ] **Step 3: Implement matrix diff against bridge manifest**

Add:

```python
from src.tools.web_coverage import load_manifest


def missing_real_e2e_entries() -> list[str]:
    bridge = load_manifest().get("web", {})
    real = load_real_manifest().get("web_real_e2e", {})
    missing: list[str] = []
    for manager, commands in bridge.items():
        for cmd in commands:
            if cmd not in real.get(manager, {}):
                missing.append(f"{manager}.{cmd}")
    return sorted(missing)
```

- [ ] **Step 4: Generate initial full manifest**

Write a one-time script command:

```bash
python3 - <<'PY'
from pathlib import Path
import yaml
from src.tools.web_coverage import load_manifest

bridge = load_manifest()["web"]
real = {"web_real_e2e": {}}
for manager, commands in bridge.items():
    real["web_real_e2e"][manager] = {}
    for cmd, info in commands.items():
        status = info.get("status")
        if status == "not_applicable":
            real_status = "not_applicable"
            reason = info.get("reason", "Not applicable to browser Web.")
        else:
            real_status = "pending"
            reason = "Real Web SDK/service E2E has not been implemented yet."
        real["web_real_e2e"][manager][cmd] = {
            "real_e2e_status": real_status,
            "tests": [],
            "verified_by": [],
            "reason": reason,
        }
Path("config/web_real_e2e_coverage.yaml").write_text(
    yaml.safe_dump(real, allow_unicode=True, sort_keys=False),
    encoding="utf-8",
)
PY
```

- [ ] **Step 5: Run green completeness test**

```bash
pytest tests/web_real/test_real_web_coverage_manifest.py -q --skip-global-login
```

Expected: pass.

---

## Phase 2: Real Web SDK Mode

**Purpose:** Add a real SDK mode without breaking existing bridge smoke tests.

### Task 2.1: Add Real SDK Mode Config Gate

**Files:**
- Modify: `native-auto-test/config.yaml.template`
- Modify: `native-auto-test/src/tools/config.py`
- Modify: `im_flutter_test/lib/sdk_config_loader.dart`
- Test: `native-auto-test/tests/web/test_rest_auth_config.py`

- [ ] **Step 1: Add failing config test**

Add:

```python
def test_web_sdk_mode_defaults_to_local_adapter(monkeypatch):
    from src.tools import config
    monkeypatch.setattr(config, "load_config", lambda: {})
    assert config.get_web_sdk_mode() == "local_adapter"


def test_web_sdk_mode_accepts_real_sdk(monkeypatch):
    from src.tools import config
    monkeypatch.setattr(config, "load_config", lambda: {"web": {"sdk_mode": "real_sdk"}})
    assert config.get_web_sdk_mode() == "real_sdk"
```

- [ ] **Step 2: Run red test**

```bash
pytest tests/web/test_rest_auth_config.py::test_web_sdk_mode_defaults_to_local_adapter tests/web/test_rest_auth_config.py::test_web_sdk_mode_accepts_real_sdk -q --skip-global-login
```

Expected: `get_web_sdk_mode` missing.

- [ ] **Step 3: Implement config accessor**

Add to `native-auto-test/src/tools/config.py`:

```python
def get_web_sdk_mode() -> str:
    mode = ((load_config().get("web") or {}).get("sdk_mode") or "local_adapter").strip()
    if mode not in {"local_adapter", "real_sdk"}:
        raise RuntimeError("web.sdk_mode must be local_adapter or real_sdk")
    return mode
```

- [ ] **Step 4: Add template config**

Add to `native-auto-test/config.yaml.template`:

```yaml
web:
  sdk_mode: local_adapter  # local_adapter | real_sdk
```

- [ ] **Step 5: Run green test**

```bash
pytest tests/web/test_rest_auth_config.py -q --skip-global-login
```

Expected: pass.

### Task 2.2: Wire Real SDK Mode Into im_flutter_test

**Files:**
- Modify: `im_flutter_test/lib/sdk_config_loader.dart`
- Modify: `im_flutter_test/lib/main.dart`
- Modify: `im_flutter_sdk_web/lib/src/client_web.dart`
- Test: `im_flutter_test/test/web_test_client_test.dart`

- [ ] **Step 1: Add failing Dart test**

Add a test that initializes with `webSdkMode: real_sdk` and expects `ClientWeb` to expose the mode through `getSdkMode`:

```dart
test('ClientWeb stores SDK mode from init options', () async {
  final previous = Client.instance;
  ClientWeb.registerWith();
  final client = Client.instance;
  addTearDown(() => Client.instance = previous);

  await client.callNativeMethod('init', {
    'webSdkMode': 'real_sdk',
  });

  expect(await client.callNativeMethod('getSdkMode'), {'getSdkMode': 'real_sdk'});
});
```

- [ ] **Step 2: Run red test**

```bash
dart test im_flutter_test/test/web_test_client_test.dart -n "ClientWeb stores SDK mode from init options"
```

Expected: unsupported `getSdkMode`.

- [ ] **Step 3: Implement mode storage**

In `ClientWeb`:

```dart
String _sdkMode = 'local_adapter';
```

In `init`:

```dart
_sdkMode = map['webSdkMode']?.toString() ?? 'local_adapter';
return {method: true};
```

Add switch branch:

```dart
case 'getSdkMode':
  return {method: _sdkMode};
```

- [ ] **Step 4: Pass config from im_flutter_test**

When building init options in `im_flutter_test/lib/main.dart`, include:

```dart
'webSdkMode': config.webSdkMode,
```

- [ ] **Step 5: Run green verification**

```bash
dart test im_flutter_test/test/web_test_client_test.dart
dart analyze im_flutter_test im_flutter_sdk_web
```

Expected: pass.

---

## Phase 3: Real Client MVP

**Purpose:** Prove real Web SDK init/login/logout/session before chat delivery.

### Task 3.1: Define Real SDK Interop Boundary

**Files:**
- Create: `im_flutter_sdk_web/lib/src/web_im_sdk/web_im_client.dart`
- Modify: `im_flutter_sdk_web/lib/src/client_web.dart`
- Test: `im_flutter_sdk_web/test/client_web_test.dart`

- [ ] **Step 1: Add failing interface test with fake client**

Add a `FakeWebImClient` test double that records `init`, `login`, `logout`, `getCurrentUser`, and `isConnected`. Verify `ClientWeb` delegates to it in `real_sdk` mode.

- [ ] **Step 2: Run red test**

```bash
dart test im_flutter_sdk_web/test/client_web_test.dart -n "delegates client session calls in real_sdk mode"
```

Expected: missing constructor injection or missing interop.

- [ ] **Step 3: Create interface**

```dart
abstract class WebImClient {
  Future<void> init(Map<String, dynamic> options);
  Future<String?> login(Map<String, dynamic> params);
  Future<bool> logout(Map<String, dynamic> params);
  Future<String?> getCurrentUser();
  Future<bool> isConnected();
  Future<String?> getToken();
  Future<void> renewToken(String token);
}
```

- [ ] **Step 4: Delegate Client methods in real mode**

In `ClientWeb.callNativeMethod`, for `real_sdk` mode delegate:

```dart
case _MethodKeys.login:
  return {method: await _webImClient.login(map)};
case _MethodKeys.logout:
  return {method: await _webImClient.logout(map)};
case _MethodKeys.getCurrentUser:
  return {method: await _webImClient.getCurrentUser()};
case _MethodKeys.isConnected:
  return {method: await _webImClient.isConnected()};
```

- [ ] **Step 5: Run green unit tests**

```bash
dart test im_flutter_sdk_web/test/client_web_test.dart
dart analyze im_flutter_sdk_web
```

Expected: pass.

### Task 3.2: Real Client E2E Smoke

**Files:**
- Create: `native-auto-test/tests/web_real/test_real_web_client.py`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`

- [ ] **Step 1: Write failing real client E2E**

```python
import pytest

from src import Cmd

pytestmark = [pytest.mark.web, pytest.mark.client]


def test_real_web_client_login_logout(primary_device, assert_api, user_a):
    mode = primary_device.call("Client", "getSdkMode", info={})
    assert_api.assert_result_equals(mode, "real_sdk")

    connected = primary_device.call("Client", Cmd.isConnected.value, info={})
    assert_api.assert_result_equals(connected, True)

    current = primary_device.call("Client", Cmd.getCurrentUser.value, info={})
    assert_api.assert_result_equals(current, user_a)

    logout = primary_device.call("Client", Cmd.logout.value, info={"unbindToken": False})
    assert_api.assert_result_equals(logout, True)
```

- [ ] **Step 2: Run red E2E**

```bash
make web-e2e ARGS="--run-id web-real-client-red --headless-startup-wait 90 --startup-timeout 120 -- tests/web_real/test_real_web_client.py --target-platform web -v"
```

Expected: fails until real SDK mode is configured and real SDK login works.

- [ ] **Step 3: Configure real SDK mode**

In local `native-auto-test/config.yaml`:

```yaml
web:
  sdk_mode: real_sdk
```

Ensure `sdk_options.app_key` and REST users are configured with real credentials.

- [ ] **Step 4: Implement actual Web SDK interop**

Use the real Web SDK package API selected for this repo. The implementation must live behind `WebImClient` and must not leak test bridge concepts into SDK code.

- [ ] **Step 5: Mark Client MVP APIs supported**

Update `web_real_e2e_coverage.yaml` for:

```text
Client.init
Client.login
Client.logout
Client.getCurrentUser
Client.isConnected
Client.getToken
Client.renewToken
```

- [ ] **Step 6: Run green E2E**

```bash
make web-e2e ARGS="--run-id web-real-client-green --headless-startup-wait 90 --startup-timeout 120 -- tests/web_real/test_real_web_client.py --target-platform web -v --html=out/web-real-client-report.html --self-contained-html"
```

Expected: pass and report generated.

---

## Phase 4: Real Chat Text Delivery MVP

**Purpose:** Establish the first Android/iOS-equivalent real IM behavior: webA sends, webB receives through the real service.

### Task 4.1: Real Chat Interop

**Files:**
- Create: `im_flutter_sdk_web/lib/src/web_im_sdk/web_im_chat.dart`
- Modify: `im_flutter_sdk_web/lib/src/managers/chat_manager_web.dart`
- Modify: `im_flutter_sdk_web/lib/src/client_web.dart`
- Test: `im_flutter_sdk_web/test/client_web_test.dart`

- [ ] **Step 1: Add failing unit test for real chat delegation**

```dart
test('real_sdk sendMessage delegates to WebImChat', () async {
  final fake = FakeWebImClient();
  final client = ClientWeb(webImClient: fake);
  await client.callNativeMethod('init', {'webSdkMode': 'real_sdk'});

  final result = await client.chatManager.callNativeMethod('sendMessage', {
    'from': 'web_a',
    'to': 'web_b',
    'chatType': 0,
    'body': {'type': 0, 'content': 'hello'},
  });

  expect(result['sendMessage']['body']['content'], 'hello');
  expect(fake.sentMessages.single['to'], 'web_b');
});
```

- [ ] **Step 2: Run red test**

```bash
dart test im_flutter_sdk_web/test/client_web_test.dart -n "real_sdk sendMessage delegates to WebImChat"
```

Expected: ChatManager still uses local store.

- [ ] **Step 3: Add WebImChat interface**

```dart
abstract class WebImChat {
  Future<Map<String, dynamic>> sendMessage(Map<String, dynamic> message);
  Future<Map<String, dynamic>?> getMessage(String msgId);
  Future<void> ackMessageRead(Map<String, dynamic> params);
  void onMessagesReceived(void Function(List<Map<String, dynamic>>) handler);
}
```

- [ ] **Step 4: Delegate real mode send/get/ack**

In `ChatManagerWeb`, if real mode:

```dart
case _MethodKeys.sendMessage:
  return {method: await _webImChat.sendMessage(map)};
case _MethodKeys.getMessage:
  return {method: await _webImChat.getMessage(map['msgId']?.toString() ?? '')};
case _MethodKeys.ackMessageRead:
  await _webImChat.ackMessageRead(map);
  return {method: 1};
```

- [ ] **Step 5: Run green unit tests**

```bash
dart test im_flutter_sdk_web/test/client_web_test.dart
dart analyze im_flutter_sdk_web
```

Expected: pass.

### Task 4.2: Real webA -> webB Text Message E2E

**Files:**
- Create: `native-auto-test/tests/web_real/test_real_web_chat_message.py`
- Modify: `native-auto-test/config/web_real_e2e_coverage.yaml`

- [ ] **Step 1: Write failing real delivery test**

```python
from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text

pytestmark = [pytest.mark.web, pytest.mark.chat]


def test_web_a_send_text_web_b_receives(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)
    secondary_device.drain_events(timeout=0.2)

    content = f"web-real-text-{uuid.uuid4().hex[:8]}"
    send = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )
    sent = assert_api.get_result(send)
    assert sent["from"] == user_a
    assert sent["to"] == user_b
    assert sent["body"]["content"] == content
    assert sent["msgId"]

    event = secondary_device.receive_message(
        match_event_type=Cmd.onMessagesReceived.value,
        timeout=15.0,
    )
    assert event is not None
    data = event.get("data")
    assert isinstance(data, dict)
    messages = data.get("messages")
    assert isinstance(messages, list)
    received = messages[0]
    assert received["from"] == user_a
    assert received["to"] == user_b
    assert received["body"]["content"] == content

    loaded = secondary_device.call(
        "ChatManager",
        Cmd.getMessage.value,
        info={"msgId": received["msgId"]},
    )
    loaded_msg = assert_api.get_result(loaded)
    assert loaded_msg["body"]["content"] == content
```

- [ ] **Step 2: Run red E2E**

```bash
make web-e2e ARGS="--run-id web-real-chat-red --headless-startup-wait 90 --startup-timeout 120 -- tests/web_real/test_real_web_chat_message.py --target-platform web -v"
```

Expected: fails until real SDK sends through service and webB receives.

- [ ] **Step 3: Implement Web SDK message listener mapping**

The real Web SDK receive callback must call the existing handler path:

```dart
_handler?.call(MethodCall('onMessagesReceived', {'messages': messages}));
```

`im_flutter_test/EventBridgeHandler` must forward this as WebSocket `onMessagesReceived`.

- [ ] **Step 4: Mark message APIs supported**

Update:

```yaml
ChatManager:
  sendMessage:
    real_e2e_status: supported
    tests:
      - tests/web_real/test_real_web_chat_message.py::test_web_a_send_text_web_b_receives
    verified_by:
      - real_web_sdk
      - real_im_server
      - cross_device_delivery
```

Also update `MessageManager.onMessagesReceived`.

- [ ] **Step 5: Run green E2E with report**

```bash
make web-e2e ARGS="--run-id web-real-chat-green --headless-startup-wait 90 --startup-timeout 120 -- tests/web_real/test_real_web_chat_message.py --target-platform web -v --html=out/web-real-chat-message-report.html --self-contained-html"
```

Expected: pass and report generated.

---

## Phase 5: Manager-By-Manager Real E2E Migration

**Purpose:** Cover every API with real behavior or explicit non-applicability.

### Migration Order

1. `Client`
2. `ChatManager`
3. `ConversationManager`
4. `ContactManager`
5. `GroupManager`
6. `ChatRoomManager`
7. `ChatThreadManager`
8. `PresenceManager`
9. `UserInfoManager`
10. `PushManager`
11. `MessageManager` callbacks

### Required Pattern For Every API

For each cmd:

- [ ] Add or update real E2E test under `native-auto-test/tests/web_real/`.
- [ ] Run test red before implementation.
- [ ] Implement only the real SDK call or callback mapping needed.
- [ ] Run test green.
- [ ] Update `web_real_e2e_coverage.yaml`.
- [ ] Run matrix strict.
- [ ] Add cleanup if API creates server state.

### Required Cross-Device Assertions

APIs involving users, conversations, contacts, groups, rooms, threads, or presence must verify at least one observer side:

```text
actor webA performs action
observer webB receives callback or sees state through server query
actor/observer cleanup succeeds
```

Examples:

- Contact add: webA sends invite, webB receives request, webB accepts, webA receives accepted.
- Group member add: owner adds webB, webB receives group event and can fetch group.
- ChatRoom join: webA joins, webB or room member list sees webA.
- Presence publish: webA publishes, webB subscribed receives presence event.

---

## Phase 6: Cleanup And Isolation

**Purpose:** Make real E2E repeatable without accumulating server state.

### Task 6.1: Run-Scoped Test Resources

**Files:**
- Modify: `native-auto-test/tests/web_real/conftest.py`
- Modify: `native-auto-test/src/rest_api/user_api.py`

- [ ] **Step 1: Add run-scoped names**

Use:

```python
run_id = os.getenv("NATIVE_AUTO_TEST_RUN_ID", "local")
user_a = f"web_real_{run_id}_a"
user_b = f"web_real_{run_id}_b"
user_c = f"web_real_{run_id}_c"
```

- [ ] **Step 2: Add cleanup registry**

Track:

```python
created_groups: list[str]
created_rooms: list[str]
created_threads: list[str]
uploaded_files: list[tuple[str, str]]
```

- [ ] **Step 3: Cleanup after session**

Destroy/delete resources in reverse creation order. If cleanup fails, attach the failure to pytest-html/Allure and fail the session unless `WEB_REAL_ALLOW_CLEANUP_FAILURE=1`.

---

## Phase 7: Reports And CI

**Purpose:** Make the final output auditable.

### Task 7.1: Add Make Targets

**Files:**
- Modify: `native-auto-test/Makefile`

Add:

```make
web-real-e2e:
	$(PY) -m src.tools.web_e2e_runner $(ARGS)

web-real-matrix:
	$(PY) -m src.tools.web_real_e2e_matrix --strict --markdown \
	  --output docs/agents/web/WEB_REAL_E2E_API_MATRIX.md

web-real-report:
	$(PY) -m src.tools.web_real_e2e_report --strict --markdown \
	  --output docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md
```

### Task 7.2: Required CI Commands

Smoke:

```bash
make web-real-e2e ARGS="--run-id web-real-smoke --headless-startup-wait 90 --startup-timeout 120 -- tests/web_real/test_real_web_client.py tests/web_real/test_real_web_chat_message.py --target-platform web -q --html=out/web-real-smoke-report.html --self-contained-html"
make web-real-matrix
make web-real-report
```

Full:

```bash
make web-real-e2e ARGS="--run-id web-real-full --headless-startup-wait 90 --startup-timeout 120 -- tests/web_real --target-platform web -q --html=out/web-real-e2e-report.html --self-contained-html"
make web-real-matrix
make web-real-report
```

---

## Completion Criteria

The real Web E2E migration is complete only when:

- `web_real_e2e pending = 0`.
- Every API from bridge/interface/manifests appears in `web_real_e2e_coverage.yaml`.
- Every `supported` API has at least one real E2E test.
- Every service-backed `supported` API verifies real Web SDK + real IM service.
- Every cross-user API verifies observer-side delivery/state.
- Every `not_applicable` API has a platform-specific reason.
- Every `blocked` API has a concrete blocker and follow-up issue.
- `tests/web_real` full run generates HTML report.
- Server state cleanup is automatic and failures are visible.

---

## Self-Review

- Spec coverage: The plan covers redefining coverage semantics, real SDK mode, API matrix, first client/chat MVP, manager-by-manager migration, cleanup, reports, and CI gates.
- Placeholder scan: No open implementation placeholder is allowed in status tracking; places that depend on selecting the real Web SDK package are explicitly scoped to the real SDK interop task and must be resolved before Phase 3 can pass.
- Type consistency: The plan consistently uses `real_e2e_status`, `tests`, `verified_by`, `reason`, `web_real_e2e`, `real_sdk`, and `local_adapter`.
