from pathlib import Path

import pytest

from src.tools.android_e2e_runner import (
    _build_commands,
    _pytest_args_with_html_report,
    _required_device_count,
    _wait_for_bridge_device,
)


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
    assert commands.reverse[0] == [
        "adb",
        "-s",
        "emulator-5554",
        "reverse",
        "tcp:2000",
        "tcp:2000",
    ]
    assert commands.uninstall[0] == [
        "adb",
        "-s",
        "emulator-5554",
        "uninstall",
        "com.easemob.im_flutter_test",
    ]
    assert commands.flutter_run[0][:4] == ["flutter", "run", "-d", "emulator-5554"]
    assert "--dart-define=IM_BRIDGE_AUTOCONNECT=true" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_URL=ws://127.0.0.1:2000/iov/websocket/dual" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_DEVICE=deviceA" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_TOPIC=im-auto-android-contact-deviceA" in commands.flutter_run[0]
    assert commands.env["NATIVE_AUTO_TEST_RESPONSE_TIMEOUT"] == "90.0"
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
    )

    assert len(commands.reverse) == 2
    assert len(commands.uninstall) == 2
    assert len(commands.flutter_run) == 2
    assert commands.flutter_run[0][:4] == ["flutter", "run", "-d", "emulator-5554"]
    assert commands.flutter_run[1][:4] == ["flutter", "run", "-d", "emulator-5556"]
    assert "--dart-define=IM_BRIDGE_DEVICE=deviceA" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_TOPIC=im-auto-android-contact-deviceA" in commands.flutter_run[0]
    assert "--dart-define=IM_BRIDGE_DEVICE=deviceB" in commands.flutter_run[1]
    assert "--dart-define=IM_BRIDGE_TOPIC=im-auto-android-contact-deviceB" in commands.flutter_run[1]


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


def test_config_response_timeout_supports_env_override(monkeypatch):
    from src.tools import config

    monkeypatch.setenv("NATIVE_AUTO_TEST_RESPONSE_TIMEOUT", "75")

    assert config.get_response_timeout() == 75.0


def test_wait_for_bridge_device_polls_until_response(monkeypatch):
    calls: list[tuple[str, str, str]] = []

    class _FakeConnection:
        def __init__(self, *, device, topic):
            self.device = device
            self.topic = topic

        def call(self, manager, cmd, info, timeout):
            calls.append((self.device, self.topic, manager, cmd))
            if len(calls) == 1:
                raise TimeoutError("not connected yet")
            return {"result": ""}

        def stop(self):
            calls.append((self.device, self.topic, "stop", ""))

    monkeypatch.setattr(
        "src.tools.android_e2e_runner.DeviceConnection",
        _FakeConnection,
    )
    monkeypatch.setattr("src.tools.android_e2e_runner.time.sleep", lambda _: None)

    _wait_for_bridge_device(
        "deviceB",
        run_id="android-contact",
        timeout=1.0,
        poll_interval=0.01,
    )

    assert calls == [
        ("deviceB", "im-auto-android-contact-deviceB", "Client", "getCurrentUser"),
        ("deviceB", "im-auto-android-contact-deviceB", "Client", "getCurrentUser"),
        ("deviceB", "im-auto-android-contact-deviceB", "stop", ""),
    ]


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
