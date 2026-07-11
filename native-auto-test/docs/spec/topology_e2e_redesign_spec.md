# Native Auto Test Topology E2E Redesign Spec

## 1. Background

`native-auto-test` currently relies on a two-client mental model such as `deviceA/deviceB` and `user_a/user_b`. That model is no longer expressive enough for complete SDK E2E verification.

The Android target case is already a three-client topology:

- `primary_a`: Android SDK client, logged in as account 1.
- `primary_b`: Android SDK client, logged in as account 1.
- `remote_c`: a real SDK client, logged in as account 2.

For a message sent by account 2 to account 1, both `primary_a` and `primary_b` should receive the message. For a message sent by `primary_a` to account 2, `remote_c` should receive the message and `primary_b` should receive same-account synchronization for account 1. For account-local operations such as conversation pinning, `primary_b` should receive the account-state sync and `remote_c` should not receive that internal state event.

The current model also makes event assertions unstable. Events can arrive before command responses, multiple clients can produce callbacks concurrently, queues can contain events from previous cases, and test accounts can receive third-party messages outside the test system. Some operations, such as contact and device-control events, may not expose a stable independent id.

## 2. Goals

- Make topology the formal entrypoint for real E2E runs.
- Separate account, client, device, platform, and coverage role.
- Support same-account multi-device verification on the platform under test.
- Support a separate remote account for peer interaction.
- Allow future mixed topology runs such as Android/Web, iOS/Web, and Web/Web.
- Let cases declare required interaction shape through pytest markers.
- Let preflight decide whether a case can run under the current topology.
- Provide a `topology` fixture so cases do not depend on `device_a/device_b`.
- Add event-group assertions that support multiple clients, unordered events, ignored pollution, forbidden events, and weak correlation windows.
- Make Allure reports manually reproducible with Chinese numbered steps and topology evidence.
- Classify selected, skipped, failed, un-migrated, and unsupported cases separately in reports.

## 3. Non-Goals

- Do not keep the old `--client android:a@... --client android:b@...` formal run model.
- Do not keep long-term dual runners for the same official suite.
- Do not treat wrapper mapping, fixture, local adapter, or unit tests as real SDK E2E coverage.
- Do not optimize for minimum runtime in the first version. Start all clients declared by the topology unless a later optimization is explicitly designed.
- Do not require all existing cases to be migrated in one code change. The migration should be staged but should not become a permanent dual model.

## 4. Topology Model

The topology YAML is the only formal run entrypoint. It describes platforms under test, accounts, clients, minimum requirements, and coverage intent.

Initial topology file:

```text
native-auto-test/config/topologies/android-primary-dual-remote.yaml
```

Example:

```yaml
schema_version: 1
name: android_primary_dual_remote
description: Android SDK multi-device real E2E topology.

platforms_under_test:
  - android

accounts:
  primary:
    user_ref: a
    purpose: account under test
  remote:
    user_ref: b
    purpose: interaction counterparty

clients:
  primary_a:
    platform: android
    sdk_version: "4.23.0"
    account: primary
    device:
      mode: auto
    roles:
      - primary
      - same_account_member

  primary_b:
    platform: android
    sdk_version: "4.23.0"
    account: primary
    device:
      mode: auto
    roles:
      - primary
      - same_account_member

  remote_c:
    platform: android
    sdk_version: "4.23.0"
    account: remote
    device:
      mode: auto
    roles:
      - remote
      - counterparty

requirements:
  accounts:
    primary:
      min_clients: 2
    remote:
      min_clients: 1

coverage:
  subject_clients:
    - primary_a
    - primary_b
  helper_clients:
    - remote_c
```

`primary` means the account whose SDK behavior is being verified. `remote` means the peer account used to create account-to-account interaction. Multi-device means one account logged into multiple clients. Those clients are not required to be on the same platform unless the topology says so. When testing Android specifically, the first Android topology uses two Android clients for the primary account so Android SDK evidence exists on both same-account clients.

Sensitive values such as passwords, app secrets, REST secrets, and tokens remain in local `config.yaml`. Topology files reference accounts through `user_ref`.

The official command shape becomes:

```bash
cd native-auto-test
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --run-id <run_id> --install-mode clean"
```

Optional device override:

```bash
--device primary_a=emulator-5554 --device primary_b=emulator-5558 --device remote_c=emulator-5560
```

## 5. Run Context

Prepare resolves topology into a run context consumed by runner, pytest, and reports.

Generated files:

```text
native-auto-test/out/run/<run_id>/context.yaml
native-auto-test/out/run/<run_id>/topology.resolved.yaml
native-auto-test/out/run/<run_id>/preflight.json
```

`context.yaml` is the stable machine contract. It must include run id, topology source, relay details, report directories, accounts, clients, resolved devices, relay topics, SDK versions, and lifecycle state.

Example shape:

```yaml
schema_version: 1
run_id: android-full-e2e-20260711-001
created_at: "2026-07-11T10:30:00+08:00"

topology:
  name: android_primary_dual_remote
  source: config/topologies/android-primary-dual-remote.yaml
  platforms_under_test:
    - android

accounts:
  primary:
    user_ref: a
    user_id: test_user_1
    clients:
      - primary_a
      - primary_b
  remote:
    user_ref: b
    user_id: test_user_2
    clients:
      - remote_c

clients:
  primary_a:
    platform: android
    account: primary
    user_id: test_user_1
    sdk_version: "4.23.0"
    device:
      id: emulator-5554
      mode: auto
    relay:
      topic: android-full-e2e-20260711-001-primary_a
    lifecycle:
      install: pending
      init: pending
      login: pending
      start_callback: pending
```

The context must not contain passwords, app secrets, REST secrets, tokens, or private keys. Runner uses `user_ref` to read sensitive local configuration when needed.

Lifecycle state should be updated or recorded during runner startup. If init, login, or `startCallback` fails, the run should be classified as an environment failure instead of continuing into business API cases.

Prepare should fail before pytest if topology is invalid, accounts cannot be resolved, devices are insufficient, one Android device is assigned to multiple clients, SDK versions are missing, or relay setup cannot be made valid.

## 6. Flow and Capability Model

Each real E2E case declares one required flow. Optional assertions are enabled when the topology supports extra capabilities.

Required flows:

| Flow | Minimum topology | Purpose |
|---|---|---|
| `local_state` | primary 1 | Local write/read/cache validation. |
| `error_response` | primary 1 | Synchronous API error validation. |
| `sender_terminal_error` | primary 1 | Sender-side callback error or failed delivery. |
| `peer_interaction` | primary 1 + remote 1 | Account-to-account interaction without same-account multi-device requirement. |
| `remote_fanout` | primary 2 + remote 1 | Remote sends to primary account; all primary clients receive. |
| `primary_send_sync` | primary 2 + remote 1 | One primary client sends; same-account primary clients sync; remote receives. |
| `account_state_sync` | primary 2 | Account-local state sync, remote must not receive internal state events. |
| `client_originated_control` | primary 2 | One client affects another client in the same account, such as kick device. |
| `server_originated_control` | primary 1 or 2 + server API | Server API triggers SDK client callback or state change. |
| `callback_event_only` | event-specific | Event assertions with weak or no independent id. |

Capabilities include:

- `primary_multi_device_sync`
- `remote_multi_device_sync`
- `server_api`

A case can support multiple evidence levels. For example, a peer interaction case can run with `primary 1 + remote 1`, and add same-account sync assertions when `primary_multi_device_sync` is available.

## 7. Pytest Markers and Fixture

Every real E2E case must use `real_e2e` and one `e2e_flow` marker:

```python
@pytest.mark.real_e2e
@pytest.mark.e2e_flow("primary_send_sync")
```

Optional evidence:

```python
@pytest.mark.e2e_optional("primary_multi_device_sync", "remote_multi_device_sync")
```

Session-disruptive cases:

```python
@pytest.mark.disruptive_session
```

Server API cases:

```python
@pytest.mark.requires_server_api
```

Platform or SDK capability:

```python
@pytest.mark.requires_capability("chat.message.reaction")
```

Cases use only the `topology` fixture for client roles:

```python
primary_a = topology.primary_client(0)
primary_b = topology.primary_client(1)
remote_c = topology.remote_client(0)
```

Initial fixture API:

```python
topology.account("primary")
topology.account("remote")
topology.client("primary_a")
topology.primary_client(0)
topology.primary_client(1)
topology.remote_client(0)
topology.primary_clients()
topology.remote_clients()
topology.clients(account="primary")
topology.clients(platform="android")
topology.clients(account="primary", platform="android")
topology.require("primary_send_sync")
topology.supports("primary_multi_device_sync")
topology.marker("send-text")
```

`TopologyClient` wraps the existing device connection and exposes role metadata:

```python
client.name
client.platform
client.account_name
client.user_id
client.device_id
client.topic
client.sdk_version
client.call(...)
client.wait_event(...)
client.drain_events(...)
```

New real E2E cases must not depend on `device_a`, `device_b`, implicit `user_a/user_b`, manually built topics, case-local login, or case-local logout.

## 8. Preflight

Preflight runs after topology resolution and before business case execution. It should collect pytest case metadata and generate:

```text
out/run/<run_id>/preflight.json
```

Preflight records:

- supported flows
- supported capabilities
- selected cases
- skipped cases
- Chinese skip reasons
- disruptive cases
- server API requirements

A case whose flow cannot be satisfied by the current topology should be skipped with an explicit Chinese reason, not failed as an SDK behavior issue.

## 9. Event Isolation

Each case creates a scope before API calls:

```python
scope = topology.case_scope("chat-send-text")
```

The scope should:

- generate a unique marker
- record the case start timestamp
- drain participating clients
- retain drained events as Allure attachments
- provide default metadata for event matching

Message and state operations should include the marker in fields that the SDK preserves, such as content, extension, remark, or custom attributes.

Event correlation levels:

- `strong`: stable id or marker, such as message id, conversation id plus marker, group id, room id, request id.
- `composite`: stable field combination, such as event type, operator, target, conversation id, operation, and timestamp window.
- `weak_window`: operation window plus participant fields when no independent id exists.

The new event group waiter should support:

- multiple clients
- unordered expected events
- forbidden events
- ignored event recording
- timeout reports with missing expected events
- post-success forbidden observation window
- Allure attachments for matched, missing, ignored, and forbidden events

Example:

```python
wait_event_group(
    expected=[
        expect_send_success(primary_a, marker=marker),
        expect_same_account_message(primary_b, marker=marker),
        expect_received_message(remote_c, marker=marker),
    ],
    forbidden=[
        forbid_account_state_event(remote_c, marker=marker),
    ],
    timeout=30,
)
```

The waiter must be able to match events that arrived after case scope creation even if they arrived before the command response returned.

## 10. Session Management

Ordinary cases must not call logout. Any case that kicks a client, logs out a client, invalidates a token, disconnects a session, or otherwise changes global session state must be marked `disruptive_session`.

Disruptive cases should run in an isolated phase or at the end of a suite. The runner must either restore affected sessions before continuing or classify the remaining suite as blocked by environment/session state.

Init, login, and `startCallback` are runner responsibilities. A case may assert login-related APIs only when specifically testing login behavior and must not pollute the shared session for unrelated cases.

## 11. Allure and Result Reporting

Every migrated case should include a Chinese Allure title and Chinese numbered manual reproduction steps.

Example:

```text
1. 准备 primary_a 客户端并确认已登录。
2. 调用 MessageManager.addReaction，messageId 使用不存在的值。
3. 断言接口返回 code=600，description=Unknown server error。
4. 断言不会产生 reaction 添加成功事件。
```

Allure environment should include:

- run id
- topology name
- platforms under test
- clients and platforms
- primary account client count
- remote account client count

Each case should attach:

- involved clients
- case steps
- command response payload
- matched events
- missing events
- ignored events
- forbidden window result
- relevant adb log slice when available

Case result tables should include flow, topology, involved clients, skip reason, failure summary, report path, and log path.

API coverage should distinguish:

- real E2E covered
- topology not satisfied
- platform or version unsupported
- not migrated
- executed but failed
- environment blocked

## 12. Migration Strategy

Migration should be staged.

First build infrastructure:

1. topology loader and context generation
2. context-driven runner startup
3. topology pytest fixture and preflight
4. event group waiter and case scope
5. representative cases for every flow

Then migrate cases in this order:

1. `error_response`
2. `local_state`
3. `peer_interaction`
4. `primary_send_sync`
5. `remote_fanout`
6. `account_state_sync`
7. `callback_event_only`
8. `disruptive_session`

Cases that only validate wrapper mapping, Python helpers, fixtures, or synthetic local behavior should not be migrated into `real_e2e`. They should remain in a separate execution layer or be removed from the official real E2E suite.

Existing helper infrastructure that should be preserved and adapted:

- WebSocket relay
- device connection transport
- assertion helpers
- config loader
- SDK options resolver
- coverage and report generation

Old concepts that should be removed from the official model after migration:

- `device_a/device_b` fixtures
- implicit `user_a/user_b` assumptions
- old `android-android` special branch as the formal suite entry
- case-local startup, login, logout, and hand-built topics
- fixed-content history lookup
- single "wait next event" assertions for multi-client event flows

## 13. Acceptance Criteria

The first complete milestone is accepted when:

- `android-primary-dual-remote.yaml` can clean-install, init, login, and start callbacks for three Android clients.
- `context.yaml`, `topology.resolved.yaml`, and `preflight.json` are generated for each run.
- Representative cases cover all defined flow types.
- Cases use the `topology` fixture instead of `device_a/device_b`.
- Event assertions report matched, missing, ignored, and forbidden events.
- Ordinary cases are not polluted by logout, kick, or token invalidation.
- Allure reports show Chinese numbered steps for migrated cases.
- The Android full report separates selected, skipped by topology, unsupported, not migrated, environment blocked, and executed failed cases.
- Message cases do not pass or fail based on unrelated third-party events or old queued events.

