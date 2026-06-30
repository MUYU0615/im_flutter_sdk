# Release Note Mapping

## Purpose

Release notes are incremental regression input. They help decide which existing cases to run and which new cases to add for a version range. They are not the full SDK API baseline.

## Workflow

1. Confirm the official release-note source and exact version range.
2. Extract each atomic change item by version and category.
3. Classify the item:
   - `已覆盖`: existing strict cases verify the behavior.
   - `可补充`: a stable API case can be added or extended.
   - `当前不可覆盖`: no stable API signal, demo-only change, performance-only change, infra change, or native-internal crash fix.
4. Write the matrix under `docs/`, not `tests/`.
5. Add a pytest marker only when the user needs a runnable release regression batch.

## Mapping Rules

- Prefer cases that assert business fields, events, or server state.
- Do not mark weak type-only checks as covered.
- Keep performance and internal implementation changes out of strict API gates unless a stable external signal exists.
- Follow the framework API coverage baseline for full coverage reports.

## References

- `skills/release-note-case-mapping/references/mapping-checklist.zh.md`
