"""Run Android API regression with local relay and a clean test app launch."""
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

from .config import get_topic_prefix
from .sdk_options_resolver import resolve_sdk_init_options
from .ws_client import DeviceConnection


ANDROID_DEFAULT_TEST_PATHS = [
    "tests/client",
    "tests/contact",
    "tests/chat",
    "tests/chatroom",
    "tests/group",
    "tests/presence",
    "tests/push",
    "tests/user_info",
]


def _default_android_pytest_args() -> list[str]:
    return [*ANDROID_DEFAULT_TEST_PATHS, "--target-platform", "android", "-m", "real_e2e", "-q"]


@dataclass(frozen=True)
class AndroidE2ECommands:
    env: dict[str, str]
    relay: list[str]
    reverse: list[list[str]]
    uninstall: list[list[str]]
    flutter_run: list[list[str]]
    pytest: list[str]


def _default_run_id() -> str:
    return "android-" + datetime.now().strftime("%Y%m%d-%H%M%S")


def _repo_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def _build_commands(
    *,
    native_auto_test_dir: Path,
    im_flutter_test_dir: Path,
    run_id: str,
    output_root: Path,
    app_url_device: str,
    host: str,
    port: int,
    device_ids: list[str],
    package_name: str,
    pytest_args: list[str],
) -> AndroidE2ECommands:
    env = os.environ.copy()
    env["NATIVE_AUTO_TEST_RUN_ID"] = run_id
    env.setdefault("NATIVE_AUTO_TEST_RESPONSE_TIMEOUT", "90.0")
    test_results_dir = output_root / "test-results"
    env["NATIVE_AUTO_TEST_CASE_RESULTS_JSON"] = str(test_results_dir / f"{run_id}-case-results.json")
    env["NATIVE_AUTO_TEST_CASE_RESULTS_CSV"] = str(test_results_dir / f"{run_id}-case-results.csv")
    device_names = [f"device{chr(ord('A') + index)}" for index in range(len(device_ids))]
    topics = [f"{get_topic_prefix()}-{run_id}-{device_name}" for device_name in device_names]
    for device_name, device_id in zip(device_names, device_ids):
        env[f"NATIVE_AUTO_TEST_ANDROID_SERIAL_{device_name.upper()}"] = device_id
    return AndroidE2ECommands(
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
        reverse=[
            [
                "adb",
                "-s",
                device_id,
                "reverse",
                f"tcp:{port}",
                f"tcp:{port}",
            ]
            for device_id in device_ids
        ],
        uninstall=[
            [
                "adb",
                "-s",
                device_id,
                "uninstall",
                package_name,
            ]
            for device_id in device_ids
        ],
        flutter_run=[
            [
                "flutter",
                "run",
                "-d",
                device_id,
                "--dart-define=IM_BRIDGE_AUTOCONNECT=true",
                f"--dart-define=IM_BRIDGE_URL={app_url_device}",
                f"--dart-define=IM_BRIDGE_DEVICE={device_name}",
                f"--dart-define=IM_BRIDGE_TOPIC={topic}",
            ]
            for device_id, device_name, topic in zip(device_ids, device_names, topics)
        ],
        pytest=["pytest", *pytest_args],
    )


def _has_pytest_html_arg(pytest_args: list[str]) -> bool:
    return any(arg == "--html" or arg.startswith("--html=") for arg in pytest_args)


def _has_pytest_allure_arg(pytest_args: list[str]) -> bool:
    return any(arg == "--alluredir" or arg.startswith("--alluredir=") for arg in pytest_args)


def _pytest_args_with_html_report(
    pytest_args: list[str],
    *,
    native_auto_test_dir: Path,
    run_id: str,
    html_report: bool,
) -> list[str]:
    if not html_report or _has_pytest_html_arg(pytest_args):
        return pytest_args
    out_dir = native_auto_test_dir / "out" / "log" / "android"
    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        *pytest_args,
        "--html",
        str(out_dir / f"{run_id}-android-pytest.html"),
        "--self-contained-html",
    ]


def _pytest_args_with_allure_report(
    pytest_args: list[str],
    *,
    native_auto_test_dir: Path,
    run_id: str,
    allure_report: bool,
) -> list[str]:
    if not allure_report or _has_pytest_allure_arg(pytest_args):
        return pytest_args
    out_dir = native_auto_test_dir / "out" / "log" / "android" / f"{run_id}-allure-results"
    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        *pytest_args,
        "--alluredir",
        str(out_dir),
    ]


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


def _wait_for_output(
    proc: subprocess.Popen,
    markers: tuple[str, ...],
    *,
    timeout: float,
    name: str,
) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"{name} exited before ready marker {markers!r}")
        line = proc.stdout.readline() if proc.stdout else ""
        if line:
            print(line, end="", flush=True)
            if any(marker in line for marker in markers):
                return
        else:
            time.sleep(0.1)
    raise TimeoutError(f"{name} did not print ready marker {markers!r} within {timeout}s")


def _popen(command: list[str], *, cwd: Path, env: dict[str, str]) -> subprocess.Popen:
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


def _run(command: list[str], *, cwd: Path, env: dict[str, str], check: bool = True) -> int:
    print("+ " + " ".join(command), flush=True)
    completed = subprocess.run(command, cwd=str(cwd), env=env)
    if check and completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command)
    return int(completed.returncode)


def _is_single_device_run(pytest_args: list[str]) -> bool:
    return "--skip-global-login" in pytest_args


def _required_device_count(pytest_args: list[str]) -> int:
    return 1 if _is_single_device_run(pytest_args) else 2


def _connected_android_devices() -> list[str]:
    completed = subprocess.run(
        ["adb", "devices"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return []
    devices: list[str] = []
    for line in completed.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            devices.append(parts[0])
    return devices


def _wait_for_bridge_device(
    device_name: str,
    *,
    run_id: str,
    timeout: float,
    poll_interval: float = 1.0,
) -> None:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    topic = f"{get_topic_prefix()}-{run_id}-{device_name}"
    conn = DeviceConnection(device=device_name, topic=topic)
    try:
        while time.monotonic() < deadline:
            try:
                conn.call(
                    "Client",
                    "getCurrentUser",
                    info={},
                    timeout=min(5.0, max(0.5, deadline - time.monotonic())),
                )
                print(f"bridge {device_name} ready", flush=True)
                return
            except Exception as exc:
                last_error = exc
                time.sleep(poll_interval)
        raise TimeoutError(
            f"bridge {device_name} did not respond within {timeout}s"
        ) from last_error
    finally:
        conn.stop()


def _init_bridge_device(
    device_name: str,
    *,
    run_id: str,
    platform: str,
) -> None:
    topic = f"{get_topic_prefix()}-{run_id}-{device_name}"
    conn = DeviceConnection(device=device_name, topic=topic)
    try:
        options = resolve_sdk_init_options(platform)
        resp = conn.call("Client", "init", info=options, timeout=30.0)
        if resp.get("success") is False or resp.get("error"):
            raise RuntimeError(f"SDK init failed for {device_name}: {resp}")
        result = resp.get("result")
        if isinstance(result, dict):
            body = result.get("init")
            if body is False:
                raise RuntimeError(f"SDK init failed for {device_name}: {resp}")
            if isinstance(body, dict) and ("code" in body or "description" in body):
                raise RuntimeError(f"SDK init failed for {device_name}: {resp}")
        elif result not in (None, "", True, 1):
            # Most platform init wrappers return null/empty on success. Keep this
            # permissive for wrappers that return a truthy success marker.
            pass
        print(f"sdk init {device_name} ready", flush=True)
    finally:
        conn.stop()


def run(args: argparse.Namespace) -> int:
    repo_dir = _repo_dir()
    native_auto_test_dir = repo_dir / "native-auto-test"
    im_flutter_test_dir = repo_dir / "im_flutter_test"
    run_id = args.run_id or _default_run_id()
    pytest_args = args.pytest_args or _default_android_pytest_args()
    pytest_args = _pytest_args_with_html_report(
        pytest_args,
        native_auto_test_dir=native_auto_test_dir,
        run_id=run_id,
        html_report=args.html_report,
    )
    pytest_args = _pytest_args_with_allure_report(
        pytest_args,
        native_auto_test_dir=native_auto_test_dir,
        run_id=run_id,
        allure_report=args.allure_report,
    )
    commands = _build_commands(
        native_auto_test_dir=native_auto_test_dir,
        im_flutter_test_dir=im_flutter_test_dir,
        run_id=run_id,
        output_root=Path(args.output_root),
        app_url_device=args.bridge_url,
        host=args.host,
        port=args.relay_port,
        device_ids=args.device_ids,
        package_name=args.package_name,
        pytest_args=pytest_args,
    )
    required_device_count = _required_device_count(pytest_args)
    if len(args.device_ids) < required_device_count:
        raise RuntimeError(
            f"Android E2E requires {required_device_count} device(s), got {len(args.device_ids)}: "
            f"{', '.join(args.device_ids) or '(none)'}. "
            "Use --device-ids for full deviceA/deviceB runs, or pass --skip-global-login for single-device smoke."
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

        for reverse in commands.reverse[:required_device_count]:
            _run(reverse, cwd=native_auto_test_dir, env=commands.env)
        for uninstall in commands.uninstall[:required_device_count]:
            _run(uninstall, cwd=native_auto_test_dir, env=commands.env, check=False)

        for index, flutter_run in enumerate(commands.flutter_run[:required_device_count]):
            device_name = f"device{chr(ord('A') + index)}"
            app = _popen(flutter_run, cwd=im_flutter_test_dir, env=commands.env)
            processes.append(app)
            _wait_for_output(
                app,
                ("Flutter run key commands", "An Observatory debugger", "The Flutter DevTools debugger"),
                timeout=args.flutter_timeout,
                name=f"flutter android {device_name}",
            )
            _wait_for_bridge_device(
                device_name,
                run_id=run_id,
                timeout=args.bridge_timeout,
            )
            _init_bridge_device(
                device_name,
                run_id=run_id,
                platform="android",
            )

        print("+ " + " ".join(commands.pytest), flush=True)
        completed = subprocess.run(
            commands.pytest,
            cwd=str(native_auto_test_dir),
            env=commands.env,
        )
        return int(completed.returncode)
    finally:
        _terminate(processes)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--output-root", default="out")
    parser.add_argument(
        "--device-ids",
        nargs="+",
        default=None,
        help="Android device ids. Provide two ids for full deviceA/deviceB E2E.",
    )
    parser.add_argument("--device-id", default=None, help="Compatibility alias for one Android device id.")
    parser.add_argument("--package-name", default="com.easemob.im_flutter_test")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--relay-port", type=int, default=2000)
    parser.add_argument("--bridge-url", default="ws://127.0.0.1:2000/iov/websocket/dual")
    parser.add_argument("--startup-timeout", type=float, default=60.0)
    parser.add_argument("--flutter-timeout", type=float, default=180.0)
    parser.add_argument("--bridge-timeout", type=float, default=60.0)
    parser.add_argument(
        "--no-html-report",
        dest="html_report",
        action="store_false",
        default=True,
        help="Do not append pytest-html output under native-auto-test/out/log/android.",
    )
    parser.add_argument(
        "--no-allure-report",
        dest="allure_report",
        action="store_false",
        default=True,
        help="Do not append pytest allure output under native-auto-test/out/log/android.",
    )
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.pytest_args and args.pytest_args[0] == "--":
        args.pytest_args = args.pytest_args[1:]
    if args.device_ids is None:
        args.device_ids = [args.device_id] if args.device_id else _connected_android_devices()
    elif args.device_id:
        args.device_ids = [args.device_id, *args.device_ids]
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
