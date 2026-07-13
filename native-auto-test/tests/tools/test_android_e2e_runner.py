from pathlib import Path
from types import SimpleNamespace

import pytest

from src.tools.android_e2e_runner import (
    ANDROID_DEFAULT_TEST_PATHS,
    _build_commands,
    _bridge_url_for_device,
    _connected_android_devices,
    _default_android_pytest_args,
    _find_free_tcp_port,
    _init_bridge_device,
    _is_emulator_device,
    _normalize_android_pytest_args,
    _pytest_args_with_allure_report,
    _pytest_args_with_html_report,
    _relay_bind_host,
    _required_device_count,
    _wait_for_bridge_logs,
)
from tests.conftest import pytest_collection_modifyitems


pytestmark = pytest.mark.no_global_login


def test_android_runner_builds_clean_install_reverse_and_pytest_commands():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="android-contact",
        app_url_device="ws://127.0.0.1:2000/iov/websocket/dual",
        host="127.0.0.1",
        port=2000,
        device_ids=["emulator-5554"],
        package_name="com.easemob.im_flutter_test",
        pytest_args=["tests/contact/test_contact.py", "--target-platform", "android", "-q"],
        output_root=Path("/repo/native-auto-test/out"),
    )

    assert commands.relay == [
        "python3",
        "-m",
        "src.tools.local_ws_relay",
        "--host",
        "0.0.0.0",
        "--port",
        "2000",
    ]
    assert commands.reverse == []
    assert commands.uninstall[0] == [
        "adb",
        "-s",
        "emulator-5554",
        "uninstall",
        "com.easemob.im_flutter_test",
    ]
    assert commands.flutter_run[0][:4] == ["flutter", "run", "-d", "emulator-5554"]
    assert "--dart-define=IM_BRIDGE_AUTOCONNECT=true" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_URL=ws://10.0.2.2:2000/iov/websocket/dual" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_DEVICE=deviceA" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_TOPIC=im-auto-android-contact-deviceA" in commands.flutter_run[0]
    assert commands.env["NATIVE_AUTO_TEST_RESPONSE_TIMEOUT"] == "90.0"
    assert commands.env["NATIVE_AUTO_TEST_WS_BASE_URL"] == "ws://127.0.0.1:2000/iov/websocket/dual"
    assert commands.env["NATIVE_AUTO_TEST_ANDROID_SERIAL_DEVICEA"] == "emulator-5554"
    assert commands.env["NATIVE_AUTO_TEST_CASE_RESULTS_JSON"] == (
        "/repo/native-auto-test/out/test-results/android-contact-case-results.json"
    )
    assert commands.env["NATIVE_AUTO_TEST_CASE_RESULTS_CSV"] == (
        "/repo/native-auto-test/out/test-results/android-contact-case-results.csv"
    )
    assert commands.pytest == [
        "pytest",
        "tests/contact/test_contact.py",
        "--target-platform",
        "android",
        "-q",
    ]


def test_android_runner_builds_two_device_launch_commands():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="android-contact",
        app_url_device="ws://127.0.0.1:2000/iov/websocket/dual",
        host="127.0.0.1",
        port=2000,
        device_ids=["emulator-5554", "emulator-5556"],
        package_name="com.easemob.im_flutter_test",
        pytest_args=["tests/contact/test_contact.py", "--target-platform", "android", "-q"],
        output_root=Path("/repo/native-auto-test/out"),
    )

    assert commands.reverse == []
    assert len(commands.uninstall) == 2
    assert len(commands.flutter_run) == 2
    assert commands.flutter_run[0][:4] == ["flutter", "run", "-d", "emulator-5554"]
    assert commands.flutter_run[1][:4] == ["flutter", "run", "-d", "emulator-5556"]
    assert commands.env["NATIVE_AUTO_TEST_ANDROID_SERIAL_DEVICEA"] == "emulator-5554"
    assert commands.env["NATIVE_AUTO_TEST_ANDROID_SERIAL_DEVICEB"] == "emulator-5556"
    assert "--dart-define=IM_BRIDGE_DEVICE=deviceA" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_TOPIC=im-auto-android-contact-deviceA" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_DEVICE=deviceB" in commands.flutter_run[1]
    assert "--dart-define=IM_BRIDGE_TOPIC=im-auto-android-contact-deviceB" in commands.flutter_run[1]
    assert "--dart-define=IM_BRIDGE_URL=ws://10.0.2.2:2000/iov/websocket/dual" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_URL=ws://10.0.2.2:2000/iov/websocket/dual" in commands.flutter_run[1]


def test_android_runner_uses_reverse_for_physical_device_only():
    commands = _build_commands(
        native_auto_test_dir=Path("/repo/native-auto-test"),
        im_flutter_test_dir=Path("/repo/im_flutter_test"),
        run_id="android-contact",
        app_url_device="ws://127.0.0.1:2000/iov/websocket/dual",
        host="127.0.0.1",
        port=2000,
        device_ids=["R58N123ABC"],
        package_name="com.easemob.im_flutter_test",
        pytest_args=["tests/contact/test_contact.py", "--target-platform", "android", "-q"],
        output_root=Path("/repo/native-auto-test/out"),
    )

    assert commands.reverse == [[
        "adb",
        "-s",
        "R58N123ABC",
        "reverse",
        "tcp:2000",
        "tcp:2000",
    ]]
    assert commands.relay == [
        "python3",
        "-m",
        "src.tools.local_ws_relay",
        "--host",
        "127.0.0.1",
        "--port",
        "2000",
    ]
    assert "--dart-define=IM_BRIDGE_URL=ws://127.0.0.1:2000/iov/websocket/dual" in commands.flutter_run[0]


def test_android_runner_bridge_url_helpers_distinguish_emulator_and_physical():
    assert _is_emulator_device("emulator-5554") is True
    assert _is_emulator_device("127.0.0.1:5555") is True
    assert _is_emulator_device("R58N123ABC") is False
    assert _bridge_url_for_device("emulator-5554", "ws://127.0.0.1:2000/iov/websocket/dual") == (
        "ws://10.0.2.2:2000/iov/websocket/dual"
    )
    assert _bridge_url_for_device("R58N123ABC", "ws://127.0.0.1:2000/iov/websocket/dual") == (
        "ws://127.0.0.1:2000/iov/websocket/dual"
    )
    assert _relay_bind_host(["emulator-5554"], "127.0.0.1") == "0.0.0.0"
    assert _relay_bind_host(["R58N123ABC"], "127.0.0.1") == "127.0.0.1"


def test_host_ws_base_url_uses_localhost_side_of_relay():
    from src.tools.android_e2e_runner import _host_ws_base_url

    assert _host_ws_base_url(
        host="127.0.0.1",
        port=24567,
        bridge_url="ws://10.0.2.2:24567/iov/websocket/dual",
    ) == "ws://127.0.0.1:24567/iov/websocket/dual"


def test_find_free_tcp_port_uses_bound_socket(monkeypatch):
    class _FakeSocket:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def bind(self, address):
            self.bound = address

        def getsockname(self):
            return ("127.0.0.1", 24567)

    monkeypatch.setattr("src.tools.android_e2e_runner.socket.socket", lambda *args, **kwargs: _FakeSocket())

    assert _find_free_tcp_port("127.0.0.1") == 24567


def test_connected_android_devices_parses_only_online_devices(monkeypatch):
    class _Completed:
        returncode = 0
        stdout = """List of devices attached
emulator-5554\tdevice
emulator-5556\toffline
emulator-5560\tdevice product:sdk
"""
        stderr = ""

    monkeypatch.setattr("src.tools.android_e2e_runner.subprocess.run", lambda *_, **__: _Completed())

    assert _connected_android_devices() == ["emulator-5554", "emulator-5560"]


@pytest.mark.parametrize(
    ("pytest_args", "expected"),
    [
        (["tests/contact/test_contact.py", "--target-platform", "android", "-q"], 2),
        (
            [
                "tests/client/test_client_single_device_smoke.py",
                "--target-platform",
                "android",
                "--skip-global-login",
                "-q",
            ],
            1,
        ),
    ],
)
def test_android_runner_requires_two_devices_unless_global_login_is_skipped(pytest_args, expected):
    assert _required_device_count(pytest_args) == expected


def test_android_default_test_paths_exclude_web_suites():
    assert "tests/web" not in ANDROID_DEFAULT_TEST_PATHS
    assert "tests/web_real" not in ANDROID_DEFAULT_TEST_PATHS


def test_default_android_pytest_args_use_only_android_directories():
    assert _default_android_pytest_args() == [
        "tests/client",
        "tests/contact",
        "tests/chat",
        "tests/chatroom",
        "tests/group",
        "tests/presence",
        "tests/push",
        "tests/user_info",
        "--target-platform",
        "android",
        "-m",
        "real_e2e",
        "-q",
    ]


def test_android_runner_normalizes_option_only_args_to_default_android_scope():
    assert _normalize_android_pytest_args(["--target-platform", "android"]) == [
        "tests/client",
        "tests/contact",
        "tests/chat",
        "tests/chatroom",
        "tests/group",
        "tests/presence",
        "tests/push",
        "tests/user_info",
        "--target-platform",
        "android",
        "-m",
        "real_e2e",
        "-q",
    ]


def test_android_runner_keeps_explicit_test_selection():
    args = [
        "tests/chat/test_chat_crud.py::test_chat_send_and_received",
        "--target-platform",
        "android",
        "-q",
    ]

    assert _normalize_android_pytest_args(args) == args


def test_android_target_does_not_promote_real_web_cases_to_real_e2e():
    class _FakeConfig:
        def getoption(self, name):
            if name == "--target-platform":
                return "android"
            if name == "--run-context":
                return ""
            raise AssertionError(name)

    class _FakeItem:
        def __init__(self):
            self.path = SimpleNamespace(as_posix=lambda: "/tmp/tests/web_real/test_real_web_chat_room.py")
            self._markers = {"real_web": object()}
            self.added_markers = []

        def get_closest_marker(self, name):
            return self._markers.get(name)

        def add_marker(self, marker):
            self.added_markers.append(marker)

    item = _FakeItem()
    pytest_collection_modifyitems(_FakeConfig(), [item])

    assert item.added_markers == []


def test_direct_chat_send_success_event_ignores_android_423_optional_message_fields():
    from tests.chat.test_chat_crud import _ANDROID_MESSAGE_OPTIONAL_KEYS

    assert {
        "broadcast",
        "onlineState",
        "targetLanguages",
        "deliverOnlineOnly",
    }.issubset(_ANDROID_MESSAGE_OPTIONAL_KEYS)
    assert "tests/client" in ANDROID_DEFAULT_TEST_PATHS
    assert "tests/group" in ANDROID_DEFAULT_TEST_PATHS


def test_config_response_timeout_supports_env_override(monkeypatch):
    from src.tools import config

    monkeypatch.setenv("NATIVE_AUTO_TEST_RESPONSE_TIMEOUT", "75")

    assert config.get_response_timeout() == 75.0


def test_config_ws_base_url_supports_env_override(monkeypatch):
    from src.tools import config

    monkeypatch.setenv("NATIVE_AUTO_TEST_WS_BASE_URL", "ws://127.0.0.1:24567/iov/websocket/dual")

    assert config.get_ws_base_url() == "ws://127.0.0.1:24567/iov/websocket/dual"


def test_wait_for_bridge_logs_waits_for_bridge_ready_markers(monkeypatch):
    calls = []
    proc = object()

    def _fake_wait_for_output(proc, markers, *, timeout, name):
        calls.append((proc, markers, timeout, name))

    monkeypatch.setattr("src.tools.android_e2e_runner._wait_for_output", _fake_wait_for_output)

    _wait_for_bridge_logs(proc, "deviceB", timeout=12.0)

    assert calls == [(
        proc,
        (
            "[IMWebSocketBridge] WebSocket bridge connected",
            "[WebSocketConfigPage] connect success",
        ),
        12.0,
        "bridge deviceB",
    )]


def test_init_bridge_device_sends_resolved_sdk_options(monkeypatch):
    calls: list[tuple[str, str, str, dict]] = []

    class _FakeConnection:
        def __init__(self, *, device, topic):
            self.device = device
            self.topic = topic

        def call(self, manager, cmd, info, timeout):
            calls.append((self.device, self.topic, f"{manager}.{cmd}", info))
            return {"result": {"init": None}}

        def stop(self):
            calls.append((self.device, self.topic, "stop", {}))

    monkeypatch.setattr(
        "src.tools.android_e2e_runner.DeviceConnection",
        _FakeConnection,
    )
    monkeypatch.setattr(
        "src.tools.android_e2e_runner.resolve_sdk_init_options",
        lambda platform: {"appKey": "easemob#dutest", "enableDNSConfig": False},
    )

    _init_bridge_device("deviceA", run_id="android-init", platform="android")

    assert calls == [
        (
            "deviceA",
            "im-auto-android-init-deviceA",
            "Client.init",
            {"appKey": "easemob#dutest", "enableDNSConfig": False},
        ),
        ("deviceA", "im-auto-android-init-deviceA", "stop", {}),
    ]


def test_init_bridge_device_fails_on_error_response(monkeypatch):
    class _FakeConnection:
        def __init__(self, *, device, topic):
            self.device = device
            self.topic = topic

        def call(self, manager, cmd, info, timeout):
            return {"success": False, "error": {"code": -1, "description": "bad init"}}

        def stop(self):
            pass

    monkeypatch.setattr(
        "src.tools.android_e2e_runner.DeviceConnection",
        _FakeConnection,
    )
    monkeypatch.setattr(
        "src.tools.android_e2e_runner.resolve_sdk_init_options",
        lambda platform: {"appKey": "easemob#dutest"},
    )

    with pytest.raises(RuntimeError, match="SDK init failed"):
        _init_bridge_device("deviceA", run_id="android-init", platform="android")


def test_android_pytest_html_report_uses_platform_log_dir(tmp_path):
    native_auto_test_dir = tmp_path / "native-auto-test"

    args = _pytest_args_with_html_report(
        ["tests/contact/test_contact.py", "--target-platform", "android", "-q"],
        native_auto_test_dir=native_auto_test_dir,
        run_id="android-contact",
        html_report=True,
    )

    assert args[-3:] == [
        "--html",
        str(native_auto_test_dir / "out" / "log" / "android" / "android-contact-android-pytest.html"),
        "--self-contained-html",
    ]
    assert (native_auto_test_dir / "out" / "log" / "android").is_dir()


def test_android_pytest_allure_report_uses_platform_log_dir(tmp_path):
    native_auto_test_dir = tmp_path / "native-auto-test"

    args = _pytest_args_with_allure_report(
        ["tests/contact/test_contact.py", "--target-platform", "android", "-q"],
        native_auto_test_dir=native_auto_test_dir,
        run_id="android-contact",
        allure_report=True,
    )

    assert args[-2:] == [
        "--alluredir",
        str(native_auto_test_dir / "out" / "log" / "android" / "android-contact-allure-results"),
    ]
    assert (native_auto_test_dir / "out" / "log" / "android" / "android-contact-allure-results").is_dir()


def test_android_pytest_allure_report_keeps_explicit_user_alluredir(tmp_path):
    native_auto_test_dir = tmp_path / "native-auto-test"

    args = _pytest_args_with_allure_report(
        ["tests/contact/test_contact.py", "--alluredir=out/custom-allure", "-q"],
        native_auto_test_dir=native_auto_test_dir,
        run_id="android-contact",
        allure_report=True,
    )

    assert args == ["tests/contact/test_contact.py", "--alluredir=out/custom-allure", "-q"]
