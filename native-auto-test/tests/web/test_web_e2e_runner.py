from __future__ import annotations

from pathlib import Path
import pytest

from src.tools import web_e2e_runner
from src.tools.web_e2e_runner import (
    _build_commands,
    _default_run_id,
    _init_web_bridge_devices,
    _pytest_args_with_html_report,
    _run_platform_api_support_report,
    _temporary_env,
    _wait_for_tcp,
)

pytestmark = [pytest.mark.no_global_login]


def test_default_run_id_is_stable_timestamp_shape():
    run_id = _default_run_id()

    assert run_id.startswith("web-")
    assert len(run_id) == len("web-20260618-120102")


def test_build_commands_wires_relay_web_server_headless_and_pytest():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="web-test-run",
        app_url="http://127.0.0.1:8080",
        host="127.0.0.1",
        port=2000,
        pytest_args=["tests/web", "--target-platform", "web", "-v"],
        headless_startup_wait=1.5,
        web_sdk_mode=None,
        web_sdk_runtime=None,
        chrome_headed=False,
        chrome_verbose=False,
    )

    assert commands.relay == [
        "python3",
        "-m",
        "src.tools.local_ws_relay",
        "--host",
        "127.0.0.1",
        "--port",
        "2000",
    ]
    assert commands.web_server == [
        "flutter",
        "run",
        "-d",
        "web-server",
        "--web-hostname",
        "127.0.0.1",
        "--web-port",
        "8080",
    ]
    assert commands.headless == [
        "python3",
        "-m",
        "src.tools.web_headless_clients",
        "--app-url",
        "http://127.0.0.1:8080",
        "--bridge-url",
        "ws://127.0.0.1:2000/iov/websocket/dual",
        "--startup-wait",
        "1.5",
    ]
    assert commands.pytest == [
        "pytest",
        "tests/web",
        "--target-platform",
        "web",
        "-v",
    ]
    assert commands.env["NATIVE_AUTO_TEST_RUN_ID"] == "web-test-run"


def test_pytest_args_append_html_report_under_out_by_default(tmp_path):
    native_auto_test_dir = tmp_path / "native-auto-test"
    args = _pytest_args_with_html_report(
        ["tests/web", "--target-platform", "web", "-q"],
        native_auto_test_dir=native_auto_test_dir,
        run_id="web-test-run",
        target_platform="web",
        html_report=True,
    )

    assert args == [
        "tests/web",
        "--target-platform",
        "web",
        "-q",
        "--html",
        str(native_auto_test_dir / "out" / "log" / "web" / "web-test-run-web-pytest.html"),
        "--self-contained-html",
    ]
    assert (native_auto_test_dir / "out" / "log" / "web").is_dir()


def test_pytest_args_keep_explicit_html_report():
    args = _pytest_args_with_html_report(
        ["tests/web", "--html=out/custom.html", "-q"],
        native_auto_test_dir=Path("/repo/native-auto-test"),
        run_id="web-test-run",
        target_platform="web",
        html_report=True,
    )

    assert args == ["tests/web", "--html=out/custom.html", "-q"]


def test_build_commands_can_force_real_web_sdk_mode():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="web-real-run",
        app_url="http://127.0.0.1:8080",
        host="127.0.0.1",
        port=2000,
        pytest_args=["tests/web_real"],
        headless_startup_wait=1.5,
        web_sdk_mode="real_sdk",
        web_sdk_runtime=None,
        chrome_headed=False,
        chrome_verbose=False,
    )

    assert commands.headless[-4:] == [
        "--web-sdk-mode",
        "real_sdk",
        "--web-sdk-runtime",
        "imsdk",
    ]
    assert commands.pytest == [
        "pytest",
        "tests/web_real",
        "--target-platform",
        "web",
        "--web-sdk-runtime",
        "imsdk",
    ]


def test_build_commands_promotes_real_sdk_runtime_to_imsdk_by_default():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="web-real-run",
        app_url="http://127.0.0.1:8080",
        host="127.0.0.1",
        port=2000,
        pytest_args=["tests/web_real"],
        headless_startup_wait=1.5,
        web_sdk_mode="real_sdk",
        web_sdk_runtime=None,
        chrome_headed=False,
        chrome_verbose=False,
    )

    assert commands.headless[-4:] == [
        "--web-sdk-mode",
        "real_sdk",
        "--web-sdk-runtime",
        "imsdk",
    ]
    assert commands.pytest == [
        "pytest",
        "tests/web_real",
        "--target-platform",
        "web",
        "--web-sdk-runtime",
        "imsdk",
    ]


def test_run_platform_api_support_report_writes_html_and_csv(monkeypatch):
    calls = []

    def fake_run(command, *, cwd, env):
        calls.append((command, cwd, env))

        class Result:
            returncode = 0

        return Result()

    monkeypatch.setattr(web_e2e_runner.subprocess, "run", fake_run)

    code = _run_platform_api_support_report(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        env={"NATIVE_AUTO_TEST_RUN_ID": "web-test-run"},
    )

    assert code == 0
    command, cwd, env = calls[0]
    assert cwd == "/repo/native-auto-test"
    assert env["NATIVE_AUTO_TEST_RUN_ID"] == "web-test-run"
    assert command == [
        "python3",
        "-m",
        "src.tools.platform_api_support_report",
        "--output",
        "out/platform-api-support.html",
        "--csv-output",
        "out/platform-api-support.csv",
    ]


def test_wait_for_tcp_returns_when_socket_connects(monkeypatch):
    attempts = []

    class FakeSocket:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def settimeout(self, timeout):
            self.timeout = timeout

        def connect_ex(self, address):
            attempts.append(address)
            return 0

    monkeypatch.setattr(web_e2e_runner.socket, "socket", lambda *_args: FakeSocket())

    _wait_for_tcp("127.0.0.1", 2000, timeout=1.0, name="relay")

    assert attempts == [("127.0.0.1", 2000)]


def test_init_web_bridge_devices_calls_client_init_for_weba_and_webb(monkeypatch):
    calls = []
    seen_env = []

    class FakeConn:
        def __init__(self, *, device, debug):
            self.device = device
            self.debug = debug

        def start(self):
            import os
            seen_env.append(
                (
                    self.device,
                    os.environ.get("NATIVE_AUTO_TEST_RUN_ID"),
                    os.environ.get("NATIVE_AUTO_TEST_WS_BASE_URL"),
                )
            )
            return None

        def call(self, manager, cmd, info):
            calls.append((self.device, manager, cmd, info))
            return {"result": True}

        def stop(self):
            return None

    monkeypatch.setattr(web_e2e_runner, "DeviceConnection", FakeConn)
    monkeypatch.setattr(
        web_e2e_runner,
        "resolve_sdk_init_options",
        lambda platform: {"appKey": "easemob#dutest"},
    )

    _init_web_bridge_devices(
        env={
            "NATIVE_AUTO_TEST_RUN_ID": "web-test-run",
            "NATIVE_AUTO_TEST_WS_BASE_URL": "ws://127.0.0.1:2002/iov/websocket/dual",
        }
    )

    assert calls == [
        (
            "webA",
            "Client",
            "init",
            {
                "appKey": "easemob#dutest",
                "webSdkMode": "real_sdk",
                "enableAutoSyncContacts": True,
            },
        ),
        (
            "webB",
            "Client",
            "init",
            {
                "appKey": "easemob#dutest",
                "webSdkMode": "real_sdk",
                "enableAutoSyncContacts": True,
            },
        ),
    ]
    assert seen_env == [
        ("webA", "web-test-run", "ws://127.0.0.1:2002/iov/websocket/dual"),
        ("webB", "web-test-run", "ws://127.0.0.1:2002/iov/websocket/dual"),
    ]


def test_build_commands_can_enable_chrome_verbose():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="web-verbose-run",
        app_url="http://127.0.0.1:8080",
        host="127.0.0.1",
        port=2000,
        pytest_args=["tests/web_real"],
        headless_startup_wait=1.5,
        web_sdk_mode="real_sdk",
        web_sdk_runtime=None,
        chrome_headed=False,
        chrome_verbose=True,
    )

    assert "--verbose" in commands.headless


def test_temporary_env_restores_original_values(monkeypatch):
    monkeypatch.setenv("NATIVE_AUTO_TEST_RUN_ID", "old-run")
    monkeypatch.delenv("NATIVE_AUTO_TEST_WS_BASE_URL", raising=False)

    with _temporary_env(
        {
            "NATIVE_AUTO_TEST_RUN_ID": "new-run",
            "NATIVE_AUTO_TEST_WS_BASE_URL": "ws://127.0.0.1:2002/iov/websocket/dual",
        }
    ):
        import os

        assert os.environ["NATIVE_AUTO_TEST_RUN_ID"] == "new-run"
        assert os.environ["NATIVE_AUTO_TEST_WS_BASE_URL"] == "ws://127.0.0.1:2002/iov/websocket/dual"

    import os

    assert os.environ["NATIVE_AUTO_TEST_RUN_ID"] == "old-run"
    assert "NATIVE_AUTO_TEST_WS_BASE_URL" not in os.environ
