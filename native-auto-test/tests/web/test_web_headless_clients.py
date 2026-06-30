import json

from src.tools.web_headless_clients import _chrome_args, _is_ready_response


def test_chrome_args_use_headless_and_isolated_profile():
    args = _chrome_args(
        "/path/to/chrome",
        "http://localhost:8080?device=webA",
        "/tmp/profile-webA",
    )

    assert args[0] == "/path/to/chrome"
    assert "--headless=new" in args
    assert "--disable-gpu" in args
    assert "--remote-debugging-port=0" in args
    assert "--user-data-dir=/tmp/profile-webA" in args
    assert args[-1] == "http://localhost:8080?device=webA"


def test_chrome_args_add_logging_only_when_verbose():
    quiet = _chrome_args("/path/to/chrome", "http://localhost:8080", "/tmp/profile")
    verbose = _chrome_args(
        "/path/to/chrome",
        "http://localhost:8080",
        "/tmp/profile",
        verbose=True,
    )

    assert "--enable-logging=stderr" not in quiet
    assert "--v=1" not in quiet
    assert "--enable-logging=stderr" in verbose
    assert "--v=1" in verbose


def test_is_ready_response_requires_matching_id_device_and_result():
    request_id = "ready-webA"
    payload = json.dumps(
        {
            "id": request_id,
            "device": "webA",
            "manager": "Client",
            "cmd": "isConnected",
            "result": True,
        }
    )

    assert _is_ready_response(payload, request_id=request_id, device="webA")


def test_is_ready_response_rejects_echo_or_wrong_device():
    request_id = "ready-webA"

    echo = json.dumps(
        {
            "id": request_id,
            "device": "webA",
            "manager": "Client",
            "cmd": "isConnected",
            "info": {},
        }
    )
    wrong_device = json.dumps(
        {
            "id": request_id,
            "device": "webB",
            "manager": "Client",
            "cmd": "isConnected",
            "result": True,
        }
    )

    assert not _is_ready_response(echo, request_id=request_id, device="webA")
    assert not _is_ready_response(wrong_device, request_id=request_id, device="webA")
