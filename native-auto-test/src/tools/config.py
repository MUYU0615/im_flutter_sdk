"""加载 config.yaml 中的 WebSocket 配置。"""
import json
import os
from pathlib import Path
import ssl
from typing import Any
import urllib.error
import urllib.request

import yaml

_CONFIG: dict[str, Any] | None = None
_REST_AUTH_TOKEN_CACHE: str | None = None
_HERE = Path(__file__).resolve()
# 尝试定位仓库根目录（包含 config.yaml 的目录）
for cand in (_HERE.parent, _HERE.parent.parent, _HERE.parent.parent.parent):
    if (cand / "config.yaml").exists():
        _ROOT = cand
        break
else:
    _ROOT = _HERE.parent.parent.parent  # 回退到 native-auto-test


def load_config() -> dict[str, Any]:
    global _CONFIG
    if _CONFIG is None:
        config_path = _ROOT / "config.yaml"
        if config_path.exists():
            with open(config_path, encoding="utf-8") as f:
                _CONFIG = yaml.safe_load(f) or {}
        else:
            _CONFIG = {
                "websocket": {
                    "base_url": "ws://127.0.0.1:2000/iov/websocket/dual",
                    "default_topic": "adc",
                    "topic_prefix": "im-auto",
                    "connect_timeout": 10,
                    "response_timeout": 30,
                }
            }
    return _CONFIG


def load_capabilities() -> dict[str, Any]:
    cap_path = _ROOT / "config" / "web_capabilities.yaml"
    if not cap_path.exists():
        return {}
    with open(cap_path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def get_ws_base_url() -> str:
    return (
        os.getenv("NATIVE_AUTO_TEST_WS_BASE_URL")
        or load_config()["websocket"]["base_url"]
    )


def get_default_topic() -> str:
    return load_config()["websocket"]["default_topic"]


def get_topic_prefix() -> str:
    """动态 topic 前缀。"""
    cfg = load_config()
    ws = cfg.get("websocket") or {}
    return (
        os.getenv("NATIVE_AUTO_TEST_TOPIC_PREFIX")
        or ws.get("topic_prefix")
        or "im-auto"
    )


def get_run_id() -> str:
    """本次测试运行 ID。为空时使用 local。"""
    return (
        os.getenv("NATIVE_AUTO_TEST_RUN_ID")
        or (load_config().get("websocket") or {}).get("run_id")
        or "local"
    ).strip()


def get_connect_timeout() -> float:
    return float(load_config()["websocket"].get("connect_timeout", 10))


def get_response_timeout() -> float:
    env_timeout = os.getenv("NATIVE_AUTO_TEST_RESPONSE_TIMEOUT")
    if env_timeout:
        return float(env_timeout)
    return float(load_config()["websocket"].get("response_timeout", 30))


def get_web_sdk_mode() -> str:
    """Web SDK execution mode: local_adapter or real_sdk."""
    mode = ((load_config().get("web") or {}).get("sdk_mode") or "real_sdk").strip()
    if mode not in {"local_adapter", "real_sdk"}:
        raise RuntimeError("web.sdk_mode must be local_adapter or real_sdk")
    return mode


def get_topic(device: str | None = None) -> str:
    """多端测试时可按 device 取不同 topic。"""
    cfg = load_config()
    if device is None:
        return cfg["websocket"]["default_topic"]
    return f"{get_topic_prefix()}-{get_run_id()}-{device}"


def get_rest_base_url() -> str:
    """REST 用户管理完整 base URL（创建/删除用户）。"""
    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    raw_base = (rest.get("base_url") or "").strip().rstrip("/")
    if not raw_base:
        return ""
    app_key = get_rest_app_key()
    if not app_key:
        return raw_base
    org_name, app_name = _split_app_key(app_key)
    return f"{raw_base}/{org_name}/{app_name}"


def get_rest_app_key() -> str:
    """REST app_key，优先 rest_api.app_key，未配置时复用 sdk_options.app_key。"""
    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    return (rest.get("app_key") or get_sdk_app_key()).strip()


def _split_app_key(app_key: str) -> tuple[str, str]:
    if "#" not in app_key:
        raise RuntimeError("rest_api.app_key 或 sdk_options.app_key 必须是 org#app 格式")
    org_name, app_name = app_key.split("#", 1)
    if not org_name or not app_name:
        raise RuntimeError("rest_api.app_key 或 sdk_options.app_key 必须是 org#app 格式")
    return org_name, app_name


def get_rest_auth_token() -> str:
    """REST 用户管理 token。

    优先读取 config.yaml -> rest_api.auth_token；未配置时用
    rest_api.client_id/client_secret 请求 {base_url}/token 并缓存 access_token。
    """
    global _REST_AUTH_TOKEN_CACHE
    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    configured_token = (rest.get("auth_token") or "").strip()
    if configured_token:
        return configured_token
    if _REST_AUTH_TOKEN_CACHE:
        return _REST_AUTH_TOKEN_CACHE

    base_url = get_rest_base_url().rstrip("/")
    client_id = get_rest_client_id()
    client_secret = get_rest_client_secret()
    if not base_url or not client_id or not client_secret:
        return ""

    token_url = (rest.get("token_url") or f"{base_url}/token").strip()
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }
    req = urllib.request.Request(
        token_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        if get_rest_verify_ssl():
            resp = urllib.request.urlopen(req, timeout=30)
        else:
            resp = urllib.request.urlopen(
                req,
                timeout=30,
                context=ssl._create_unverified_context(),
            )
        with resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"获取 REST token 失败 HTTP {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"获取 REST token 失败: {e.reason!r}") from e

    data = json.loads(raw) if raw.strip() else {}
    access_token = (data.get("access_token") or data.get("token") or "").strip()
    if not access_token:
        raise RuntimeError(f"获取 REST token 失败: 响应中没有 access_token: {raw}")
    _REST_AUTH_TOKEN_CACHE = access_token
    return _REST_AUTH_TOKEN_CACHE


def get_rest_user_access_token(username: str, password: str) -> str:
    """获取指定 IM 用户的 access_token，用于 SDK token 登录类 E2E。"""
    base_url = get_rest_base_url().rstrip("/")
    client_id = get_rest_client_id()
    client_secret = get_rest_client_secret()
    if not base_url or not username or not password or not client_id or not client_secret:
        return ""

    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    token_url = (rest.get("user_token_url") or f"{base_url}/token").strip()
    payload = {
        "grant_type": "password",
        "username": username,
        "password": password,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    req = urllib.request.Request(
        token_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        if get_rest_verify_ssl():
            resp = urllib.request.urlopen(req, timeout=30)
        else:
            resp = urllib.request.urlopen(
                req,
                timeout=30,
                context=ssl._create_unverified_context(),
            )
        with resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"获取用户 access_token 失败 HTTP {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"获取用户 access_token 失败: {e.reason!r}") from e

    data = json.loads(raw) if raw.strip() else {}
    access_token = (data.get("access_token") or data.get("token") or "").strip()
    if not access_token:
        raise RuntimeError(f"获取用户 access_token 失败: 响应中没有 access_token: {raw}")
    return access_token


def get_rest_client_id() -> str:
    """REST token client_id。"""
    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    return (rest.get("client_id") or rest.get("clientId") or "").strip()


def get_rest_client_secret() -> str:
    """REST token client_secret。"""
    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    return (
        rest.get("client_secret") or rest.get("clientSecret") or ""
    ).strip()


def get_rest_authorization_header() -> str:
    """REST Authorization header value."""
    token = get_rest_auth_token()
    if not token:
        return ""
    return token if token.lower().startswith("bearer ") else f"Bearer {token}"


def get_rest_verify_ssl() -> bool:
    """
    REST HTTPS 证书校验开关。
    - True（默认）：校验证书
    - False：跳过证书校验（仅测试环境临时使用）
    """
    cfg = load_config()
    rest = cfg.get("rest_api") or {}
    return bool(rest.get("verify_ssl", True))


def get_sdk_options() -> dict:
    """返回 config.yaml 中的 sdk_options 节（Flutter SDK EMOptions 配置）。"""
    cfg = load_config()
    return cfg.get("sdk_options") or {}


def get_sdk_app_key() -> str:
    """返回 sdk_options.app_key。"""
    return get_sdk_options().get("app_key", "")


def get_account_password() -> str:
    """返回 E2E 账号默认密码，优先环境变量，其次 config.yaml。"""
    cfg = load_config()
    accounts = cfg.get("accounts") or {}
    return (
        os.getenv("NATIVE_AUTO_TEST_ACCOUNT_PASSWORD")
        or accounts.get("default_password")
        or "1"
    )


def get_configured_test_users() -> tuple[str, str, str] | None:
    """返回显式配置的 E2E 用户；未配置时返回 None。

    支持环境变量：
    - NATIVE_AUTO_TEST_USER_A
    - NATIVE_AUTO_TEST_USER_B
    - NATIVE_AUTO_TEST_USER_C

    也支持 config.yaml:
    accounts:
      users:
        a: user1
        b: user2
        c: user3
    """
    cfg = load_config()
    users = (cfg.get("accounts") or {}).get("users") or {}

    def _username(slot: str) -> str:
        value = users.get(slot)
        if isinstance(value, dict):
            value = (
                value.get("username")
                or value.get("userId")
                or value.get("user_id")
                or value.get("name")
                or ""
            )
        return str(value or "").strip()

    user_a = (os.getenv("NATIVE_AUTO_TEST_USER_A") or _username("a")).strip()
    user_b = (os.getenv("NATIVE_AUTO_TEST_USER_B") or _username("b")).strip()
    user_c = (os.getenv("NATIVE_AUTO_TEST_USER_C") or _username("c")).strip()
    if not user_a and not user_b and not user_c:
        return None
    if not user_a or not user_b:
        raise RuntimeError("显式 E2E 账号至少需要配置 user_a 和 user_b")
    return user_a, user_b, user_c or user_b
