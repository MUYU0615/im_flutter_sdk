"""Run Android API regression with local relay and a clean test app launch."""
from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.parse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import yaml

from .config import get_topic_prefix, load_config
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


class _LifecyclePhaseError(RuntimeError):
    def __init__(self, phase: str, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.phase = phase
        self.details = details or {"message": message}


def _default_run_id() -> str:
    return "android-" + datetime.now().strftime("%Y%m%d-%H%M%S")


def _repo_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def _is_emulator_device(device_id: str) -> bool:
    return device_id.startswith("emulator-") or device_id.startswith("127.0.0.1:")


def _bridge_url_for_device(device_id: str, default_url: str) -> str:
    if not _is_emulator_device(device_id):
        return default_url
    parsed = default_url.replace("ws://127.0.0.1", "ws://10.0.2.2")
    parsed = parsed.replace("ws://localhost", "ws://10.0.2.2")
    return parsed


def _relay_bind_host(device_ids: list[str], default_host: str) -> str:
    if any(_is_emulator_device(device_id) for device_id in device_ids):
        return "0.0.0.0"
    return default_host


def _find_free_tcp_port(host: str) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


def _host_ws_base_url(*, host: str, port: int, bridge_url: str) -> str:
    parsed = urllib.parse.urlparse(bridge_url)
    scheme = parsed.scheme or "ws"
    path = parsed.path or "/iov/websocket/dual"
    return f"{scheme}://{host}:{port}{path}"


def _load_run_context(path: str) -> dict:
    if not path:
        return {}
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}


def _write_client_lifecycle(context_path: Path | None, client_name: str, updates: dict) -> None:
    if not context_path:
        return
    data = yaml.safe_load(context_path.read_text(encoding="utf-8")) or {}
    lifecycle = data.setdefault("clients", {}).setdefault(client_name, {}).setdefault("lifecycle", {})
    lifecycle.update(updates)
    context_path.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def _safe_bridge_error(message: str, response: dict | None = None) -> dict:
    details: dict = {"message": message}
    if not isinstance(response, dict):
        return details

    source = response.get("error")
    include_error_text = isinstance(source, dict)
    if not isinstance(source, dict):
        source = response
    for key in ("code", "description", "error"):
        value = source.get(key)
        if value is None:
            continue
        if key == "error" and not include_error_text:
            continue
        if isinstance(value, (str, int, float, bool)):
            details[key] = value
    return details


def _android_clients_from_context(context: dict) -> list[dict]:
    clients = []
    for name, raw in (context.get("clients") or {}).items():
        if raw.get("platform") != "android":
            continue
        clients.append(
            {
                "name": name,
                "device_id": raw["device"]["id"],
                "topic": raw["relay"]["topic"],
                "account": raw["account"],
                "user_id": raw["user_id"],
            }
        )
    return clients


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
    device_names: list[str] | None = None,
    topics: list[str] | None = None,
) -> AndroidE2ECommands:
    env = os.environ.copy()
    env["NATIVE_AUTO_TEST_RUN_ID"] = run_id
    env.setdefault("NATIVE_AUTO_TEST_RESPONSE_TIMEOUT", "90.0")
    env["NATIVE_AUTO_TEST_WS_BASE_URL"] = _host_ws_base_url(
        host="127.0.0.1",
        port=port,
        bridge_url=app_url_device,
    )
    test_results_dir = output_root / "test-results"
    env["NATIVE_AUTO_TEST_CASE_RESULTS_JSON"] = str(test_results_dir / f"{run_id}-case-results.json")
    env["NATIVE_AUTO_TEST_CASE_RESULTS_CSV"] = str(test_results_dir / f"{run_id}-case-results.csv")
    device_names = device_names or [
        f"device{chr(ord('A') + index)}" for index in range(len(device_ids))
    ]
    topics = topics or [
        f"{get_topic_prefix()}-{run_id}-{device_name}" for device_name in device_names
    ]
    for device_name, device_id in zip(device_names, device_ids):
        env[f"NATIVE_AUTO_TEST_ANDROID_SERIAL_{device_name.upper()}"] = device_id
    bridge_urls = [
        _bridge_url_for_device(device_id, app_url_device) for device_id in device_ids
    ]
    reverse_commands = [
        [
            "adb",
            "-s",
            device_id,
            "reverse",
            f"tcp:{port}",
            f"tcp:{port}",
        ]
        for device_id in device_ids
        if not _is_emulator_device(device_id)
    ]
    relay_host = _relay_bind_host(device_ids, host)
    return AndroidE2ECommands(
        env=env,
        relay=[
            "python3",
            "-m",
            "src.tools.local_ws_relay",
            "--host",
            relay_host,
            "--port",
            str(port),
        ],
        reverse=reverse_commands,
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
                f"--dart-define=IM_BRIDGE_URL={bridge_url}",
                f"--dart-define=IM_BRIDGE_DEVICE={device_name}",
                f"--dart-define=IM_BRIDGE_TOPIC={topic}",
            ]
            for device_id, device_name, topic, bridge_url in zip(
                device_ids,
                device_names,
                topics,
                bridge_urls,
            )
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


def _wait_for_bridge_logs(
    proc: subprocess.Popen,
    device_name: str,
    *,
    timeout: float,
) -> None:
    _wait_for_output(
        proc,
        (
            "[IMWebSocketBridge] WebSocket bridge connected",
            "[WebSocketConfigPage] connect success",
        ),
        timeout=timeout,
        name=f"bridge {device_name}",
    )
    print(f"bridge {device_name} ready", flush=True)


def _init_bridge_device(
    device_name: str,
    *,
    run_id: str,
    platform: str,
    topic: str | None = None,
) -> None:
    topic = topic or f"{get_topic_prefix()}-{run_id}-{device_name}"
    print(
        f"[android_e2e_runner] init bridge device={device_name} "
        f"topic={topic} ws_base={os.getenv('NATIVE_AUTO_TEST_WS_BASE_URL')}",
        flush=True,
    )
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


def _login_payload_for_client(context: dict, config: dict, client_name: str) -> dict:
    raw_client = context["clients"][client_name]
    raw_account = context["accounts"][raw_client["account"]]
    user_id = raw_account["user_id"]
    accounts_cfg = config.get("accounts") or {}
    users_cfg = accounts_cfg.get("users") or {}
    user_ref = raw_account.get("user_ref", "")
    user_cfg = users_cfg.get(user_ref) if isinstance(users_cfg, dict) else {}
    password = ""
    if isinstance(user_cfg, dict):
        password = str(user_cfg.get("password") or "")
    password = password or str(accounts_cfg.get("default_password") or "")
    if not password:
        raise RuntimeError(f"client {client_name} 无法解析登录密码")
    return {"userId": user_id, "password": password}


def _login_context_client(client_name: str, context: dict, use_token_login: bool = False) -> None:
    if use_token_login:
        raise RuntimeError("topology token login is not implemented")
    conn = DeviceConnection(
        device=client_name,
        topic=context["clients"][client_name]["relay"]["topic"],
    )
    conn.start()
    try:
        payload = _login_payload_for_client(context, load_config(), client_name)
        resp = conn.call("Client", "login", info=payload, timeout=60.0)
        if resp.get("success") is False or resp.get("error"):
            raise _LifecyclePhaseError(
                "login",
                "login failed",
                _safe_bridge_error("login failed", resp),
            )
        cb_resp = conn.call("Client", "startCallback", info={}, timeout=30.0)
        if cb_resp.get("success") is False or cb_resp.get("error"):
            raise _LifecyclePhaseError(
                "start_callback",
                "startCallback failed",
                _safe_bridge_error("startCallback failed", cb_resp),
            )
    finally:
        conn.stop()


def run(args: argparse.Namespace) -> int:
    repo_dir = _repo_dir()
    native_auto_test_dir = repo_dir / "native-auto-test"
    im_flutter_test_dir = repo_dir / "im_flutter_test"
    run_id = args.run_id or _default_run_id()
    pytest_args = args.pytest_args or _default_android_pytest_args()
    context = _load_run_context(args.run_context)
    context_path = Path(args.run_context) if args.run_context else None
    context_clients = _android_clients_from_context(context)
    if context_clients:
        run_id = context["run_id"]
        args.device_ids = [client["device_id"] for client in context_clients]
        device_names = [client["name"] for client in context_clients]
        topics = [client["topic"] for client in context_clients]
    else:
        device_names = None
        topics = None
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
    relay_host = _relay_bind_host(args.device_ids, args.host)
    relay_port = args.relay_port
    if args.auto_relay_port:
        relay_port = _find_free_tcp_port("127.0.0.1")
    bridge_url = args.bridge_url.replace(
        f":{args.relay_port}/",
        f":{relay_port}/",
    )
    commands = _build_commands(
        native_auto_test_dir=native_auto_test_dir,
        im_flutter_test_dir=im_flutter_test_dir,
        run_id=run_id,
        output_root=Path(args.output_root),
        app_url_device=bridge_url,
        host=relay_host,
        port=relay_port,
        device_ids=args.device_ids,
        package_name=args.package_name,
        pytest_args=pytest_args,
        device_names=device_names,
        topics=topics,
    )
    os.environ["NATIVE_AUTO_TEST_RUN_ID"] = commands.env["NATIVE_AUTO_TEST_RUN_ID"]
    os.environ["NATIVE_AUTO_TEST_RESPONSE_TIMEOUT"] = commands.env[
        "NATIVE_AUTO_TEST_RESPONSE_TIMEOUT"
    ]
    os.environ["NATIVE_AUTO_TEST_WS_BASE_URL"] = commands.env[
        "NATIVE_AUTO_TEST_WS_BASE_URL"
    ]
    required_device_count = (
        len(context_clients) if context_clients else _required_device_count(pytest_args)
    )
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
        _wait_for_tcp("127.0.0.1", relay_port, timeout=args.startup_timeout, name="relay")

        for reverse in commands.reverse[:required_device_count]:
            _run(reverse, cwd=native_auto_test_dir, env=commands.env)
        for uninstall in commands.uninstall[:required_device_count]:
            _run(uninstall, cwd=native_auto_test_dir, env=commands.env, check=False)

        for index, flutter_run in enumerate(commands.flutter_run[:required_device_count]):
            device_name = device_names[index] if device_names else f"device{chr(ord('A') + index)}"
            try:
                app = _popen(flutter_run, cwd=im_flutter_test_dir, env=commands.env)
                processes.append(app)
                _wait_for_output(
                    app,
                    (
                        "Flutter run key commands",
                        "An Observatory debugger",
                        "The Flutter DevTools debugger",
                    ),
                    timeout=args.flutter_timeout,
                    name=f"flutter android {device_name}",
                )
                _wait_for_bridge_logs(
                    app,
                    device_name,
                    timeout=args.bridge_timeout,
                )
            except Exception as exc:
                _write_client_lifecycle(
                    context_path,
                    device_name,
                    {"install": "failed", "install_error": {"message": str(exc)}},
                )
                raise
            _write_client_lifecycle(context_path, device_name, {"install": "success"})
            try:
                _init_bridge_device(
                    device_name,
                    run_id=run_id,
                    platform="android",
                    topic=topics[index] if topics else None,
                )
            except Exception as exc:
                _write_client_lifecycle(
                    context_path,
                    device_name,
                    {"init": "failed", "init_error": {"message": str(exc)}},
                )
                raise
            _write_client_lifecycle(
                context_path,
                device_name,
                {"init": "success"},
            )
            if context_clients:
                try:
                    _login_context_client(device_name, context)
                    _write_client_lifecycle(
                        context_path,
                        device_name,
                        {"login": "success", "start_callback": "success"},
                    )
                except _LifecyclePhaseError as exc:
                    if exc.phase == "start_callback":
                        updates = {
                            "login": "success",
                            "start_callback": "failed",
                            "start_callback_error": exc.details,
                        }
                    else:
                        updates = {
                            "login": "failed",
                            "login_error": exc.details,
                        }
                    _write_client_lifecycle(context_path, device_name, updates)
                    raise
                except Exception as exc:
                    _write_client_lifecycle(
                        context_path,
                        device_name,
                        {"login": "failed", "login_error": {"message": str(exc)}},
                    )
                    raise

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
    parser.add_argument("--run-context", default="")
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
    parser.add_argument(
        "--no-auto-relay-port",
        dest="auto_relay_port",
        action="store_false",
        default=True,
        help="Use the fixed relay port instead of choosing a free local port automatically.",
    )
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
