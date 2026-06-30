from __future__ import annotations


TARGET_PLATFORMS = ("android", "ios", "mobile", "web")


def target_device_pair_for_platform(target_platform: str) -> tuple[str, str]:
    if target_platform == "web":
        return ("webA", "webB")
    if target_platform in ("android", "ios", "mobile"):
        return ("deviceA", "deviceB")
    raise ValueError(f"unsupported target platform: {target_platform}")
