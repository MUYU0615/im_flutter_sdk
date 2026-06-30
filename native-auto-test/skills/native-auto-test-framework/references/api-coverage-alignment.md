# API Coverage Alignment

## Baseline Policy

The master API baseline for `native-auto-test` must come from reconciled project evidence, not from one platform file.

Use these sources together:

- Test project coverage manifests, such as `native-auto-test/config/*.yaml`.
- Executable cases under `native-auto-test/tests/`.
- Generated or maintained reports under `native-auto-test/docs/agents/`.
- Public SDK documentation, including Web SDK docs when testing Web.
- Confirmed platform SDK behavior from Android, iOS, Web, and other targets.
- Release notes only as incremental change input.

Do not make Android `MethodKey.java` or iOS `MethodKeys.h` the master baseline. They are useful to detect native plugin exposure, but they may be older than this test project or miss APIs already covered elsewhere.

## Classification

For each API and platform, use explicit status:

- `supported`: executable case or confirmed behavior verifies the API.
- `missing`: no public API, bridge command, or callable path was found.
- `unimplemented`: API or key exists, but there is no working implementation path.
- `blocked`: callable path exists, but real E2E cannot pass because of server, permission, environment, or product limitation.
- `not_applicable`: platform does not support the scenario by design.
- `pending`: evidence is insufficient.

## Matrix Rules

When building Android/iOS/Web support reports:

1. Start from the maintained test-project API inventory when present.
2. Add APIs discovered from executable cases and public SDK docs.
3. Use Android/iOS/Web source scans as gap-detection signals.
4. Report APIs found only in platform source as candidates, not as automatic baseline truth.
5. Every unsupported status needs a reason: not found, found but unimplemented, implemented but failing, not applicable, or pending confirmation.

## Common Mistakes

- Counting only Web YAML rows and missing Android/iOS-only candidates.
- Counting only Android/iOS MethodKey values and missing newer test-project or Web-doc APIs.
- Treating release notes as a full API list.
- Treating a wrapper key as proof of implemented behavior.
