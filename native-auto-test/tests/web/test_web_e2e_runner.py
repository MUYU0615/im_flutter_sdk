from __future__ import annotations

from pathlib import Path

from src.tools import web_e2e_runner
from src.tools.web_e2e_runner import (
    _build_commands,
    _default_run_id,
    _pytest_args_with_html_report,
    _run_platform_api_support_report,
    _wait_for_tcp,
)


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
    )

    assert commands.headless[-2:] == ["--web-sdk-mode", "real_sdk"]


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
