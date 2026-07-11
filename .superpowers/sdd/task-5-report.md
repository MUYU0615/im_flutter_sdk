Status: DONE

Commits created:
- a6dfae8 feat: add scoped event group waiter

Files changed:
- native-auto-test/src/tools/case_scope.py
- native-auto-test/src/tools/event_group_waiter.py
- native-auto-test/src/tools/topology_fixture.py
- native-auto-test/tests/tools/test_event_group_waiter.py
- native-auto-test/tests/tools/test_topology_fixture.py

Implementation summary:
- Added CaseScope with marker, started_at, client list, and pre-case event draining with Allure attachment on drain errors.
- Added EventExpectation, ForbiddenEvent, EventGroupResult, and wait_event_group for unordered expected event matching, ignored event capture, missing event assertions, and forbidden event assertions.
- Added Topology.case_scope(label, clients=None), using Topology.marker(label), defaulting to all topology clients, and draining before returning the scope.
- Added focused tests covering unordered matching, ignored pollution, forbidden event failure, and topology.case_scope integration.

Verification:
- Red run before implementation: `pytest -q tests/tools/test_event_group_waiter.py tests/tools/test_topology_fixture.py` failed with `ModuleNotFoundError: No module named 'src.tools.event_group_waiter'`.
- Final run: `pytest -q tests/tools/test_event_group_waiter.py tests/tools/test_topology_fixture.py`
- Result: 4 passed, 1 warning in 0.10s.

Notes:
- Added `pytestmark = pytest.mark.no_global_login` to the new unit-level waiter test so it does not invoke the repo's real device global login fixture.
- The only warning in focused verification was the existing `websockets.legacy` deprecation warning from the environment.

Review fix:
- Fixed `_poll_client` so only `TimeoutError` is treated as no event; unexpected receive exceptions are captured in `EventGroupResult.errors`, attached to Allure, and fail as `事件接收异常`.
- Implemented `EventExpectation(required=False)` observation: optional expectations are matched and recorded when seen during the wait window, but absent optional events do not fail the group.
- Expanded missing-event failures to include missing names, matched evidence names, and ignored-event counts.
- Added Allure JSON attachment redaction for sensitive keys: `token`, `password`, `secret`, `authorization`, `client_secret`, and `private_key`.
- Added regression tests for optional event matching/absence, unexpected receive errors, and missing-timeout failures with partial matched/ignored evidence.

Review fix verification:
- Red run before fix: `pytest -q tests/tools/test_event_group_waiter.py` failed 3 tests covering optional evidence, unexpected receive errors, and missing-event detail.
- Required run: `pytest -q tests/tools/test_event_group_waiter.py tests/tools/test_topology_fixture.py`
- Result: 8 passed, 1 warning in 0.11s.
- Warning: existing `websockets.legacy` deprecation warning from the environment.

Re-review fix:
- Changed `CaseScope.drain()` so drain failures still attach Allure evidence but re-raise the original exception instead of being swallowed.
- Reused `_redact_sensitive()` for `CaseScope._attach()` so case-scope attachments follow the same redaction behavior as event-group attachments.
- Expanded `_redact_sensitive()` to normalize key names by lowercasing and removing non-alphanumeric characters, then redact any key containing `token`, `secret`, `password`, `authorization`, `privatekey`, or `clientsecret`.
- Added regression coverage for pre-case drain failure propagation and normalized/camelCase sensitive keys including `auth_token`, `access_token`, `refresh_token`, `agoraToken`, `agora_token`, `clientSecret`, `Authorization`, `private-key`, and `PASSWORD`.

Re-review fix verification:
- Red run before fix: `pytest -q tests/tools/test_event_group_waiter.py tests/tools/test_topology_fixture.py` failed 2 tests covering normalized redaction and pre-case drain failure propagation.
- Required run: `pytest -q tests/tools/test_event_group_waiter.py tests/tools/test_topology_fixture.py`
- Result: 10 passed, 1 warning in 0.12s.
- Warning: existing `websockets.legacy` deprecation warning from the environment.
