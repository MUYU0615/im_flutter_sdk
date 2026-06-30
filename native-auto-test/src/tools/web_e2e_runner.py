"""Run Flutter Web API regression with local relay and headless clients."""
from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass(frozen=True)
class WebE2ECommands:
    env: dict[str, str]
    relay: list[str]
    web_server: list[str]
    headless: list[str]
    pytest: list[str]


def _default_run_id() -> str:
    return "web-" + datetime.now().strftime("%Y%m%d-%H%M%S")


def _repo_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def _build_commands(
    *,
    native_auto_test_dir: Path,
    im_flutter_test_dir: Path,
    run_id: str,
    app_url: str,
    host: str,
    port: int,
    pytest_args: list[str],
    headless_startup_wait: float,
    web_sdk_mode: str | None,
    web_sdk_runtime: str | None,
    chrome_headed: bool,
) -> WebE2ECommands:
    env = os.environ.copy()
    env["NATIVE_AUTO_TEST_RUN_ID"] = run_id
    return WebE2ECommands(
        env=env,
        relay=[
            "python3",
            "-m",
            "src.tools.local_ws_relay",
            "--host",
            host,
            "--port",
            str(port),
        ],
        web_server=[
            "flutter",
            "run",
            "-d",
            "web-server",
            "--web-hostname",
            host,
            "--web-port",
            str(_port_from_app_url(app_url)),
        ],
        headless=[
            "python3",
            "-m",
            "src.tools.web_headless_clients",
            "--app-url",
            app_url,
            "--startup-wait",
            str(headless_startup_wait),
            *(["--headed"] if chrome_headed else []),
            *(
                ["--web-sdk-mode", web_sdk_mode]
                if web_sdk_mode
                else []
            ),
            *(
                ["--web-sdk-runtime", web_sdk_runtime]
                if web_sdk_runtime
                else []
            ),
        ],
        pytest=["pytest", *pytest_args],
    )


def _port_from_app_url(app_url: str) -> int:
    tail = app_url.rsplit(":", 1)[-1]
    port_text = tail.split("/", 1)[0]
    return int(port_text)


def _has_pytest_html_arg(pytest_args: list[str]) -> bool:
    return any(arg == "--html" or arg.startswith("--html=") for arg in pytest_args)


def _pytest_args_with_html_report(
    pytest_args: list[str],
    *,
    native_auto_test_dir: Path,
    run_id: str,
    target_platform: str,
    html_report: bool,
) -> list[str]:
    if not html_report or _has_pytest_html_arg(pytest_args):
        return pytest_args
    out_dir = native_auto_test_dir / "out" / "log" / target_platform
    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        *pytest_args,
        "--html",
        str(out_dir / f"{run_id}-{target_platform}-pytest.html"),
        "--self-contained-html",
    ]


def _terminate(processes: list[subprocess.Popen]) -> None:
    for proc in reversed(processes):
        if proc.poll() is None:
            proc.terminate()
    deadline = time.monotonic() + 10
    for proc in reversed(processes):
        if proc.poll() is not None:
            continue
        try:
            proc.wait(timeout=max(0.1, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            proc.kill()


def _wait_for_output(
    proc: subprocess.Popen,
    marker: str,
    *,
    timeout: float,
    name: str,
) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"{name} exited before ready marker {marker!r}")
        line = proc.stdout.readline() if proc.stdout else ""
        if line:
            print(line, end="", flush=True)
            if marker in line:
                return
        else:
            time.sleep(0.1)
    raise TimeoutError(f"{name} did not print ready marker {marker!r} within {timeout}s")


def _wait_for_tcp(host: str, port: int, *, timeout: float, name: str) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex((host, port)) == 0:
                print(f"{name} ready on {host}:{port}", flush=True)
                return
        time.sleep(0.1)
    raise TimeoutError(f"{name} did not listen on {host}:{port} within {timeout}s")


def _popen(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
) -> subprocess.Popen:
    print("+ " + " ".join(command), flush=True)
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def _run_platform_api_support_report(
    *,
    native_auto_test_dir: Path,
    env: dict[str, str],
) -> int:
    command = [
        "python3",
        "-m",
        "src.tools.platform_api_support_report",
        "--output",
        "out/platform-api-support.html",
        "--csv-output",
        "out/platform-api-support.csv",
    ]
    print("+ " + " ".join(command), flush=True)
    completed = subprocess.run(
        command,
        cwd=str(native_auto_test_dir),
        env=env,
    )
    return int(completed.returncode)


def run(args: argparse.Namespace) -> int:
    repo_dir = _repo_dir()
    native_auto_test_dir = repo_dir / "native-auto-test"
    im_flutter_test_dir = repo_dir / "im_flutter_test"
    run_id = args.run_id or _default_run_id()
    pytest_args = _pytest_args_with_html_report(
        args.pytest_args or ["tests/web", "--target-platform", "web", "-v"],
        native_auto_test_dir=native_auto_test_dir,
        run_id=run_id,
        target_platform="web",
        html_report=args.html_report,
    )
    commands = _build_commands(
        native_auto_test_dir=native_auto_test_dir,
        im_flutter_test_dir=im_flutter_test_dir,
        run_id=run_id,
        app_url=args.app_url,
        host=args.host,
        port=args.relay_port,
        pytest_args=pytest_args,
        headless_startup_wait=args.headless_startup_wait,
        web_sdk_mode=args.web_sdk_mode,
        web_sdk_runtime=args.web_sdk_runtime,
        chrome_headed=args.chrome_headed,
    )
    processes: list[subprocess.Popen] = []

    def _handle_signal(signum, _frame) -> None:
        _terminate(processes)
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        relay = _popen(commands.relay, cwd=native_auto_test_dir, env=commands.env)
        processes.append(relay)
        _wait_for_tcp(args.host, args.relay_port, timeout=args.startup_timeout, name="relay")

        web_server = _popen(commands.web_server, cwd=im_flutter_test_dir, env=commands.env)
        processes.append(web_server)
        _wait_for_output(
            web_server,
            "is being served at",
            timeout=args.flutter_timeout,
            name="flutter web-server",
        )

        headless = _popen(commands.headless, cwd=native_auto_test_dir, env=commands.env)
        processes.append(headless)
        _wait_for_output(
            headless,
            "headless clients ready",
            timeout=args.startup_timeout,
            name="headless clients",
        )

        print("+ " + " ".join(commands.pytest), flush=True)
        completed = subprocess.run(
            commands.pytest,
            cwd=str(native_auto_test_dir),
            env=commands.env,
        )
        pytest_returncode = int(completed.returncode)
        report_returncode = _run_platform_api_support_report(
            native_auto_test_dir=native_auto_test_dir,
            env=commands.env,
        )
        return pytest_returncode or report_returncode
    finally:
        _terminate(processes)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--app-url", default="http://127.0.0.1:8080")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--relay-port", type=int, default=2000)
    parser.add_argument("--headless-startup-wait", type=float, default=30.0)
    parser.add_argument("--startup-timeout", type=float, default=60.0)
    parser.add_argument("--flutter-timeout", type=float, default=120.0)
    parser.add_argument("--web-sdk-mode", choices=["local_adapter", "real_sdk"], default=None)
    parser.add_argument(
        "--web-sdk-runtime",
        choices=["legacy_webim", "imsdk"],
        default=None,
    )
    parser.add_argument("--chrome-headed", action="store_true")
    parser.add_argument(
        "--no-html-report",
        dest="html_report",
        action="store_false",
        default=True,
        help="Do not append pytest-html output under native-auto-test/out.",
    )
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.pytest_args and args.pytest_args[0] == "--":
        args.pytest_args = args.pytest_args[1:]
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
