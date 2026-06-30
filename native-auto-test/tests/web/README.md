# Flutter Web Regression

These cases target Flutter Web bridge devices and align Web with the same
session lifecycle used by Android/iOS.

Online Web regression requires two Flutter Web test clients:

- `webA`: connects to the topic generated for device `webA`
- `webB`: connects to the topic generated for device `webB`

Generate launch URLs:

```bash
export NATIVE_AUTO_TEST_RUN_ID="$(date +%Y%m%d-%H%M%S)"
python -m src.tools.web_launch_urls --app-url http://localhost:8080
```

Or launch the two Web clients in headless Chrome:

```bash
export NATIVE_AUTO_TEST_RUN_ID="$(date +%Y%m%d-%H%M%S)"
python -m src.tools.web_headless_clients --app-url http://localhost:8080
```

Run online regression:

```bash
pytest tests/web --target-platform web -m web -v
```

Or use the local one-command runner, which starts the relay, Flutter web-server,
headless `webA`/`webB`, runs pytest, and then cleans up processes:

```bash
make web-e2e ARGS="-- tests/web --target-platform web -v"
```

Before each online Web case, the pytest fixture calls `Client.webReset` on
`webA` and `webB`. This clears Web-only in-memory SDK state such as local
messages, conversations, contacts, block list, and user info, while keeping the
session login created by the global fixture.

Offline checks that do not require Web clients:

```bash
pytest tests/web/test_web_fixture.py tests/web/test_capabilities.py tests/web/test_target_device_pair.py --skip-global-login -q
```

Test roles:

- `test_web_fixture.py`: validates Web fixture wiring.
- `test_capabilities.py`: validates Web API capability status.
- `test_target_device_pair.py`: validates mobile/web device-pair selection.
- `test_capability_gate.py`: validates pending API skip behavior.
- `test_web_session.py`: validates Web session login parity with Android/iOS.
- `test_web_smoke.py`: validates basic Client APIs after Web session login.
- `test_web_unsupported_api.py`: validates representative unsupported behavior
  for Web adapter APIs with explicit event, file, platform, or server-backed
  blockers.
