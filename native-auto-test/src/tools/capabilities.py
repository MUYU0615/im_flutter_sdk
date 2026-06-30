from __future__ import annotations

from .config import load_capabilities
from .web_coverage import load_manifest


def api_status(platform: str, manager: str, cmd: str) -> str:
    if platform == "web":
        manifest = load_manifest()
        info = manifest.get("web", {}).get(manager, {}).get(cmd)
        if isinstance(info, dict) and info.get("status"):
            return str(info["status"])
    cfg = load_capabilities()
    return cfg.get(platform, {}).get(manager, {}).get(cmd, "pending")


def should_run_api(platform: str, manager: str, cmd: str) -> bool:
    status = api_status(platform, manager, cmd)
    return status in {"supported", "unsupported", "different"}
