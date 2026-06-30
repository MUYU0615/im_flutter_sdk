"""Launch im_flutter_test Web clients in headless Chrome."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.parse
import uuid
from pathlib import Path

import websockets

from .config import get_topic, get_ws_base_url, get_run_id, get_topic_prefix
from .web_launch_urls import _build_url


_DEFAULT_MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def _find_chrome(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    env_path = os.getenv("NATIVE_AUTO_TEST_CHROME")
    if env_path:
        return env_path
    for name in ("google-chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return found
    if Path(_DEFAULT_MAC_CHROME).exists():
        return _DEFAULT_MAC_CHROME
    raise FileNotFoundError(
        "Chrome/Chromium not found. Set NATIVE_AUTO_TEST_CHROME or pass --chrome."
    )


def _chrome_args(
    chrome: str,
    url: str,
    user_data_dir: str,
    *,
    remote_debugging_port: int = 0,
    verbose: bool = False,
    headed: bool = False,
) -> list[str]:
    args = [
        chrome,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required",
        f"--remote-debugging-port={remote_debugging_port}",
        f"--user-data-dir={user_data_dir}",
        url,
    ]
    if headed:
        args.insert(1, "--disable-gpu")
    else:
        args.insert(1, "--headless=new")
        args.insert(2, "--disable-gpu")
    if verbose:
        args.insert(-3, "--enable-logging=stderr")
        args.insert(-3, "--v=1")
    return args


def _terminate(processes: list[subprocess.Popen[bytes]]) -> None:
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()
    deadline = time.monotonic() + 5
    for proc in processes:
        if proc.poll() is not None:
            continue
        timeout = max(0.1, deadline - time.monotonic())
        try:
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()


def _is_ready_response(raw: str, *, request_id: str, device: str) -> bool:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return False
    if not isinstance(payload, dict):
        return False
    if "result" not in payload and "error" not in payload:
        return False
    if payload.get("id") != request_id and payload.get("sequence") != request_id:
        return False
    if payload.get("device") not in (None, device):
        return False
    return payload.get("manager") in (None, "Client") and payload.get("cmd") in (
        None,
        "isConnected",
    )


def _topic_url(bridge_url: str, topic: str) -> str:
    separator = "&" if "?" in bridge_url else "?"
    return f"{bridge_url}{separator}topic={urllib.parse.quote(topic)}"


async def _probe_device_ready_once(
    *,
    bridge_url: str,
    topic: str,
    device: str,
    timeout: float,
) -> bool:
    request_id = f"ready-{device}-{uuid.uuid4().hex}"
    request = {
        "manager": "Client",
        "cmd": "isConnected",
        "info": {},
        "id": request_id,
        "device": device,
    }
    try:
        async with websockets.connect(_topic_url(bridge_url, topic), open_timeout=timeout) as ws:
            await ws.send(json.dumps(request))
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                remaining = max(0.1, deadline - time.monotonic())
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                if _is_ready_response(raw, request_id=request_id, device=device):
                    return True
    except Exception:
        return False
    return False


def _wait_for_bridge_ready(
    *,
    bridge_url: str,
    devices: list[str],
    timeout: float,
) -> None:
    deadline = time.monotonic() + timeout
    pending = set(devices)
    while pending and time.monotonic() < deadline:
        for device in list(pending):
            topic = get_topic(device)
            if asyncio.run(
                _probe_device_ready_once(
                    bridge_url=bridge_url,
                    topic=topic,
                    device=device,
                    timeout=2.0,
                )
            ):
                print(f"{device} bridge ready", flush=True)
                pending.remove(device)
        if pending:
            time.sleep(0.2)
    if pending:
        missing = ", ".join(sorted(pending))
        raise TimeoutError(f"headless bridge did not respond for: {missing}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--app-url",
        default="http://localhost:8080",
        help="Base URL where im_flutter_test Web is served.",
    )
    parser.add_argument(
        "--bridge-url",
        default=None,
        help="Override websocket.base_url for generated links.",
    )
    parser.add_argument(
        "--devices",
        nargs="+",
        default=["webA", "webB"],
        help="Device names to launch.",
    )
    parser.add_argument(
        "--web-sdk-mode",
        choices=["local_adapter", "real_sdk"],
        default=None,
        help="Override im_flutter_test Web SDK mode via URL query.",
    )
    parser.add_argument(
        "--web-sdk-runtime",
        choices=["legacy_webim", "imsdk"],
        default=None,
        help="Override im_flutter_test Web SDK runtime bundle via URL query.",
    )
    parser.add_argument(
        "--chrome",
        default=None,
        help="Chrome/Chromium executable path. Defaults to PATH or macOS Chrome.",
    )
    parser.add_argument(
        "--startup-wait",
        type=float,
        default=30.0,
        help="Max seconds to wait for launched clients to answer bridge probes.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print Chrome stderr instead of discarding it.",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Launch visible Chrome windows instead of headless mode.",
    )
    args = parser.parse_args()

    chrome = _find_chrome(args.chrome)
    bridge_url = args.bridge_url or get_ws_base_url()
    run_id = get_run_id()
    if run_id:
        print(f"run_id={run_id}", flush=True)
        print(f"topic_prefix={get_topic_prefix()}", flush=True)

    temp_root = tempfile.TemporaryDirectory(prefix="im-web-headless-")
    processes: list[subprocess.Popen[bytes]] = []

    def _handle_signal(signum, _frame) -> None:
        print(f"received signal {signum}, stopping headless clients", flush=True)
        _terminate(processes)
        temp_root.cleanup()
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        for device in args.devices:
            topic = get_topic(device)
            url = _build_url(
                args.app_url,
                bridge_url=bridge_url,
                topic=topic,
                device=device,
                web_sdk_mode=args.web_sdk_mode,
                web_sdk_runtime=args.web_sdk_runtime,
            )
            profile_dir = str(Path(temp_root.name) / device)
            stderr = None if args.verbose else subprocess.DEVNULL
            proc = subprocess.Popen(
                _chrome_args(
                    chrome,
                    url,
                    profile_dir,
                    verbose=args.verbose,
                    headed=args.headed,
                ),
                stdout=subprocess.DEVNULL,
                stderr=stderr,
            )
            processes.append(proc)
            print(f"{device} topic={topic}", flush=True)
            print(f"{device} pid={proc.pid}", flush=True)
            print(url, flush=True)

        failed = [proc.pid for proc in processes if proc.poll() is not None]
        if failed:
            print(f"headless clients exited early: {failed}", file=sys.stderr, flush=True)
            return 1
        try:
            _wait_for_bridge_ready(
                bridge_url=bridge_url,
                devices=list(args.devices),
                timeout=args.startup_wait,
            )
        except TimeoutError as exc:
            print(str(exc), file=sys.stderr, flush=True)
            return 1
        print("headless clients ready", flush=True)
        while True:
            failed = [proc.pid for proc in processes if proc.poll() is not None]
            if failed:
                print(f"headless clients exited: {failed}", file=sys.stderr, flush=True)
                return 1
            time.sleep(1)
    finally:
        _terminate(processes)
        temp_root.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
