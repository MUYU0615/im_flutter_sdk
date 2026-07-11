# Task 6 Report: Lifecycle Reporting And Environment Failure Handling

## Status

DONE

## Summary

- Added `_write_client_lifecycle` to update per-client lifecycle fields in `context.yaml` while preserving existing context data and key order.
- Wired Android topology runner startup to record `install: success` after uninstall/install preparation completes for context clients.
- Wired SDK init lifecycle handling:
  - Records `init: success` after `_init_bridge_device` succeeds.
  - Records `init: failed` plus `init_error.message` and re-raises when `_init_bridge_device` fails.
  - Stops before pytest when init fails through the existing exception flow.
- Recorded `login: external` and `start_callback: external` after init success because runner-owned login/startCallback belongs to Task 7 and current login remains delegated to pytest fixtures.
- Preserved legacy behavior when `--run-context` is absent by making lifecycle writes no-op without a context path.

## Tests

Command:

```bash
cd native-auto-test
pytest -q tests/tools/test_android_topology_runner.py
```

Result:

```text
3 passed, 1 warning in 0.09s
```

## Notes

- The first RED run failed on import as expected because `_write_client_lifecycle` did not exist.
- After implementing the helper, the test initially attempted the global login fixture. I marked the tool test module with `pytest.mark.no_global_login`, consistent with existing tool tests, so it remains a local unit-style runner test.
- No files outside the task ownership were edited.
