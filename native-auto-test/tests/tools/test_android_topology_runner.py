from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

from src.tools.android_e2e_runner import (
    _LifecyclePhaseError,
    _login_context_client,
    _login_payload_for_client,
    _write_client_lifecycle,
    run,
)


pytestmark = pytest.mark.no_global_login


def test_login_payload_for_context_client_uses_user_ref_without_secret_in_context():
    context = {
        "accounts": {
            "primary": {"user_ref": "a", "user_id": "user1"},
        },
        "clients": {
            "primary_a": {"account": "primary", "user_id": "user1"},
        },
    }
    config = {"accounts": {"default_password": "pwd"}}

    payload = _login_payload_for_client(context, config, "primary_a")

    assert payload == {"userId": "user1", "password": "pwd"}


def test_write_client_lifecycle_updates_context(tmp_path):
    context_path = tmp_path / "context.yaml"
    context_path.write_text(
        yaml.safe_dump(
            {
                "run_id": "run-1",
                "clients": {
                    "primary_a": {
                        "lifecycle": {
                            "install": "pending",
                            "init": "pending",
                            "login": "pending",
                            "start_callback": "pending",
                        }
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    _write_client_lifecycle(
        context_path,
        "primary_a",
        {"install": "success", "init": "success", "login": "failed", "login_error": {"code": 110}},
    )

    updated = yaml.safe_load(context_path.read_text(encoding="utf-8"))
    assert updated["clients"]["primary_a"]["lifecycle"]["install"] == "success"
    assert updated["clients"]["primary_a"]["lifecycle"]["login"] == "failed"
    assert updated["clients"]["primary_a"]["lifecycle"]["login_error"]["code"] == 110


def _write_context(path: Path) -> None:
    path.write_text(
        yaml.safe_dump(
            {
                "run_id": "run-1",
                "clients": {
                    "primary_a": {
                        "platform": "android",
                        "device": {"id": "emulator-5554"},
                        "relay": {"topic": "topic-a"},
                        "account": {"username": "user-a"},
                        "user_id": "user-a",
                        "lifecycle": {
                            "install": "pending",
                            "init": "pending",
                            "login": "pending",
                            "start_callback": "pending",
                        },
                    }
                },
            }
        ),
        encoding="utf-8",
    )


def _runner_args(context_path: Path, tmp_path: Path) -> SimpleNamespace:
    return SimpleNamespace(
        run_context=str(context_path),
        run_id=None,
        output_root=str(tmp_path / "out"),
        device_ids=[],
        package_name="com.easemob.im_flutter_test",
        host="127.0.0.1",
        relay_port=2000,
        auto_relay_port=False,
        bridge_url="ws://127.0.0.1:2000/iov/websocket/dual",
        startup_timeout=1.0,
        flutter_timeout=1.0,
        bridge_timeout=1.0,
        html_report=False,
        allure_report=False,
        pytest_args=["tests/client/test_client_single_device_smoke.py", "--skip-global-login", "-q"],
    )


def _patch_runner_runtime(
    monkeypatch,
    *,
    init_error: Exception | None = None,
    login_error: Exception | None = None,
    login_effect=None,
    patch_login: bool = True,
    bridge_ready=None,
    popen=None,
) -> None:
    class _FakeProcess:
        stdout = None

        def poll(self):
            return 0

    monkeypatch.setattr(
        "src.tools.android_e2e_runner._popen",
        popen or (lambda *args, **kwargs: _FakeProcess()),
    )
    monkeypatch.setattr("src.tools.android_e2e_runner._wait_for_tcp", lambda *args, **kwargs: None)
    monkeypatch.setattr("src.tools.android_e2e_runner._wait_for_output", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        "src.tools.android_e2e_runner._wait_for_bridge_logs",
        bridge_ready or (lambda *args, **kwargs: None),
    )
    monkeypatch.setattr("src.tools.android_e2e_runner._terminate", lambda processes: None)
    monkeypatch.setattr("src.tools.android_e2e_runner._run", lambda *args, **kwargs: 0)

    def _fake_init(*args, **kwargs):
        if init_error:
            raise init_error

    monkeypatch.setattr("src.tools.android_e2e_runner._init_bridge_device", _fake_init)

    def _fake_login(*args, **kwargs):
        if login_effect:
            return login_effect(*args, **kwargs)
        if login_error:
            raise login_error

    if patch_login:
        monkeypatch.setattr("src.tools.android_e2e_runner._login_context_client", _fake_login)
    monkeypatch.setattr(
        "src.tools.android_e2e_runner.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0),
    )


def test_android_runner_records_context_lifecycle_for_runner_owned_login(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    _patch_runner_runtime(monkeypatch)

    assert run(_runner_args(context_path, tmp_path)) == 0

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "success"
    assert lifecycle["init"] == "success"
    assert lifecycle["login"] == "success"
    assert lifecycle["start_callback"] == "success"


def test_android_runner_records_install_success_after_startup_readiness(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)

    def _bridge_ready(*args, **kwargs):
        lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"][
            "primary_a"
        ]["lifecycle"]
        assert lifecycle["install"] == "pending"

    _patch_runner_runtime(monkeypatch, bridge_ready=_bridge_ready)

    assert run(_runner_args(context_path, tmp_path)) == 0

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "success"


def test_android_runner_records_install_failure_when_bridge_readiness_fails(
    tmp_path, monkeypatch
):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    _patch_runner_runtime(
        monkeypatch,
        bridge_ready=lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("bridge down")),
    )

    with pytest.raises(RuntimeError, match="bridge down"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "failed"
    assert lifecycle["install_error"] == {"message": "bridge down"}
    assert lifecycle["init"] == "pending"


def test_android_runner_records_install_failure_when_flutter_launch_fails(
    tmp_path, monkeypatch
):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)

    class _FakeProcess:
        stdout = None

        def poll(self):
            return 0

    def _popen(command, *args, **kwargs):
        if command[:2] == ["flutter", "run"]:
            raise FileNotFoundError("flutter missing")
        return _FakeProcess()

    _patch_runner_runtime(monkeypatch, popen=_popen)

    with pytest.raises(FileNotFoundError, match="flutter missing"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "failed"
    assert lifecycle["install_error"] == {"message": "flutter missing"}
    assert lifecycle["init"] == "pending"


def test_android_runner_records_init_failure_and_stops_before_pytest(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    _patch_runner_runtime(monkeypatch, init_error=RuntimeError("bad init"))

    def _fail_pytest(*args, **kwargs):
        raise AssertionError("pytest should not run after init failure")

    monkeypatch.setattr("src.tools.android_e2e_runner.subprocess.run", _fail_pytest)

    with pytest.raises(RuntimeError, match="bad init"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "success"
    assert lifecycle["init"] == "failed"
    assert lifecycle["init_error"] == {"message": "bad init"}
    assert lifecycle["login"] == "pending"
    assert lifecycle["start_callback"] == "pending"


def test_android_runner_records_login_failure_and_stops_before_pytest(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    _patch_runner_runtime(monkeypatch, login_error=RuntimeError("bad login"))

    def _fail_pytest(*args, **kwargs):
        raise AssertionError("pytest should not run after login failure")

    monkeypatch.setattr("src.tools.android_e2e_runner.subprocess.run", _fail_pytest)

    with pytest.raises(RuntimeError, match="bad login"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "success"
    assert lifecycle["init"] == "success"
    assert lifecycle["login"] == "failed"
    assert lifecycle["login_error"] == {"message": "bad login"}
    assert lifecycle["start_callback"] == "pending"


def test_android_runner_records_start_callback_failure_after_login_success(
    tmp_path, monkeypatch
):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)

    def _fail_start_callback(*args, **kwargs):
        raise _LifecyclePhaseError(
            "start_callback",
            "startCallback failed",
            {"message": "startCallback failed"},
        )

    _patch_runner_runtime(monkeypatch, login_effect=_fail_start_callback)

    def _fail_pytest(*args, **kwargs):
        raise AssertionError("pytest should not run after startCallback failure")

    monkeypatch.setattr("src.tools.android_e2e_runner.subprocess.run", _fail_pytest)

    with pytest.raises(RuntimeError, match="startCallback failed"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["install"] == "success"
    assert lifecycle["init"] == "success"
    assert lifecycle["login"] == "success"
    assert lifecycle["start_callback"] == "failed"
    assert lifecycle["start_callback_error"] == {"message": "startCallback failed"}
    assert "login_error" not in lifecycle


def test_android_runner_sanitizes_login_failure_response_in_context(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    context = yaml.safe_load(context_path.read_text(encoding="utf-8"))
    context["accounts"] = {"primary": {"user_ref": "a", "user_id": "user-a"}}
    context["clients"]["primary_a"]["account"] = "primary"
    context_path.write_text(yaml.safe_dump(context), encoding="utf-8")
    config = {"accounts": {"users": {"a": {"password": "config-secret"}}}}

    class _FakeConnection:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            pass

        def stop(self):
            pass

        def call(self, manager, cmd, info=None, timeout=None):
            if cmd == "init":
                return {"success": True}
            if cmd == "login":
                return {
                    "success": False,
                    "error": {
                        "code": 401,
                        "description": "bad credentials",
                        "password": "leaked-password",
                        "token": "leaked-token",
                    },
                }
            raise AssertionError(f"unexpected command: {cmd}")

    _patch_runner_runtime(monkeypatch, patch_login=False)
    monkeypatch.setattr("src.tools.android_e2e_runner.load_config", lambda: config)
    monkeypatch.setattr("src.tools.android_e2e_runner.DeviceConnection", _FakeConnection)

    with pytest.raises(RuntimeError, match="login failed"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["login"] == "failed"
    assert lifecycle["login_error"] == {
        "message": "login failed",
        "code": 401,
        "description": "bad credentials",
    }
    serialized = yaml.safe_dump(lifecycle, allow_unicode=True)
    assert "leaked-password" not in serialized
    assert "leaked-token" not in serialized
    assert "config-secret" not in serialized


def test_android_runner_drops_scalar_login_error_text_from_context(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    context = yaml.safe_load(context_path.read_text(encoding="utf-8"))
    context["accounts"] = {"primary": {"user_ref": "a", "user_id": "user-a"}}
    context["clients"]["primary_a"]["account"] = "primary"
    context_path.write_text(yaml.safe_dump(context), encoding="utf-8")
    config = {"accounts": {"users": {"a": {"password": "config-secret"}}}}

    class _FakeConnection:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            pass

        def stop(self):
            pass

        def call(self, manager, cmd, info=None, timeout=None):
            if cmd == "init":
                return {"success": True}
            if cmd == "login":
                return {"success": False, "error": "token=abc password=secret"}
            raise AssertionError(f"unexpected command: {cmd}")

    _patch_runner_runtime(monkeypatch, patch_login=False)
    monkeypatch.setattr("src.tools.android_e2e_runner.load_config", lambda: config)
    monkeypatch.setattr("src.tools.android_e2e_runner.DeviceConnection", _FakeConnection)

    with pytest.raises(RuntimeError, match="login failed"):
        run(_runner_args(context_path, tmp_path))

    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["login"] == "failed"
    assert lifecycle["login_error"] == {"message": "login failed"}
    serialized = yaml.safe_dump(lifecycle, allow_unicode=True)
    assert "token=abc" not in serialized
    assert "password=secret" not in serialized
    assert "config-secret" not in serialized


def test_android_runner_drops_nested_scalar_error_text_from_context(tmp_path, monkeypatch):
    context_path = tmp_path / "context.yaml"
    _write_context(context_path)
    context = yaml.safe_load(context_path.read_text(encoding="utf-8"))
    context["accounts"] = {"primary": {"user_ref": "a", "user_id": "user-a"}}
    context["clients"]["primary_a"]["account"] = "primary"
    context_path.write_text(yaml.safe_dump(context), encoding="utf-8")
    config = {"accounts": {"users": {"a": {"password": "config-secret"}}}}

    class _FakeConnection:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            pass

        def stop(self):
            pass

        def call(self, manager, cmd, info=None, timeout=None):
            if cmd == "init":
                return {"success": True}
            if cmd == "login":
                return {
                    "success": False,
                    "error": {
                        "code": 401,
                        "description": "unauthorized",
                        "error": "token=abc password=secret",
                    },
                }
            raise AssertionError(f"unexpected command: {cmd}")

    _patch_runner_runtime(monkeypatch, patch_login=False)
    monkeypatch.setattr("src.tools.android_e2e_runner.load_config", lambda: config)
    monkeypatch.setattr("src.tools.android_e2e_runner.DeviceConnection", _FakeConnection)

    with pytest.raises(_LifecyclePhaseError, match="login failed") as exc_info:
        run(_runner_args(context_path, tmp_path))

    assert exc_info.value.details == {
        "message": "login failed",
        "code": 401,
        "description": "unauthorized",
    }
    lifecycle = yaml.safe_load(context_path.read_text(encoding="utf-8"))["clients"]["primary_a"][
        "lifecycle"
    ]
    assert lifecycle["login"] == "failed"
    assert lifecycle["login_error"] == {
        "message": "login failed",
        "code": 401,
        "description": "unauthorized",
    }
    serialized = yaml.safe_dump(lifecycle, allow_unicode=True)
    assert "token=abc" not in serialized
    assert "password=secret" not in serialized
    assert "config-secret" not in serialized


def test_login_context_client_sanitizes_bridge_failure_response(monkeypatch):
    context = {
        "accounts": {
            "primary": {"user_ref": "a", "user_id": "user1"},
        },
        "clients": {
            "primary_a": {
                "account": "primary",
                "relay": {"topic": "topic-a"},
            },
        },
    }
    config = {"accounts": {"users": {"a": {"password": "config-secret"}}}}

    class _FakeConnection:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            pass

        def stop(self):
            pass

        def call(self, manager, cmd, info=None, timeout=None):
            assert cmd == "login"
            return {
                "success": False,
                "error": {
                    "code": 401,
                    "description": "bad credentials",
                    "password": "leaked-password",
                    "token": "leaked-token",
                },
            }

    monkeypatch.setattr("src.tools.android_e2e_runner.load_config", lambda: config)
    monkeypatch.setattr("src.tools.android_e2e_runner.DeviceConnection", _FakeConnection)

    with pytest.raises(RuntimeError) as exc_info:
        _login_context_client("primary_a", context)

    message = str(exc_info.value)
    assert message == "login failed"
    assert "leaked-password" not in message
    assert "leaked-token" not in message
