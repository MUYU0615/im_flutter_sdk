"""Versioned SDK capability policy used by coverage reports."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


VALID_POLICY_STATUSES = {
    "required",
    "covered",
    "not_in_sdk_version",
    "version_gap",
    "platform_only",
    "not_applicable",
    "known_gap",
    "blocked",
}


@dataclass(frozen=True)
class SdkSource:
    platform: str
    artifact: str = ""
    source_dir: str = ""
    download_url_template: str = ""
    docs_url: str = ""
    version: str = ""
    download_url: str = ""
    local_artifact_hint: str = ""


@dataclass(frozen=True)
class TestPlatformVersion:
    platform: str
    version: str
    enabled: bool = True
    role: str = "target"
    source_ref: str = ""


@dataclass(frozen=True)
class ApiPolicyEntry:
    api: str
    platform: str
    status: str
    reason: str
    introduced_version: str = ""
    target_version: str = ""

    @property
    def manager(self) -> str:
        return self.api.split(".", 1)[0]

    @property
    def cmd(self) -> str:
        return self.api.split(".", 1)[1] if "." in self.api else ""


class SdkVersionCapabilityPolicy:
    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data
        self._validate_policy_statuses()

    @classmethod
    def from_file(cls, path: Path) -> "SdkVersionCapabilityPolicy":
        if not path.exists():
            return cls({})
        with open(path, encoding="utf-8") as f:
            return cls(yaml.safe_load(f) or {})

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SdkVersionCapabilityPolicy":
        return cls(data)

    def target_version(self, platform: str) -> str:
        platform_version = self.test_platform_version(platform)
        return platform_version.version if platform_version else ""

    def test_platform_version(self, platform: str) -> TestPlatformVersion | None:
        versions = self._data.get("test_versions") or {}
        platforms = versions.get("platforms") or {}
        raw = platforms.get(platform)
        if not isinstance(raw, dict):
            return None
        return TestPlatformVersion(
            platform=platform,
            version=str(raw.get("version") or "").strip(),
            enabled=bool(raw.get("enabled", True)),
            role=str(raw.get("role") or "target").strip(),
            source_ref=str(raw.get("source_ref") or "").strip(),
        )

    def enabled_platforms(self) -> list[TestPlatformVersion]:
        versions = self._data.get("test_versions") or {}
        platforms = versions.get("platforms") or {}
        result: list[TestPlatformVersion] = []
        for platform in sorted(platforms):
            item = self.test_platform_version(platform)
            if item is not None and item.enabled:
                result.append(item)
        return result

    def sdk_source(self, platform: str) -> SdkSource:
        sources = self._data.get("sdk_sources") or {}
        raw = sources.get(platform) or {}
        platform_version = self.test_platform_version(platform)
        version_ref = platform_version.source_ref if platform_version else ""
        version_meta = (raw.get("versions") or {}).get(version_ref) or {}
        return SdkSource(
            platform=platform,
            artifact=str(raw.get("artifact") or ""),
            source_dir=str(raw.get("source_dir") or ""),
            download_url_template=str(raw.get("download_url_template") or ""),
            docs_url=str(raw.get("docs_url") or ""),
            version=str(version_meta.get("version") or ""),
            download_url=str(version_meta.get("download_url") or ""),
            local_artifact_hint=str(version_meta.get("local_artifact_hint") or ""),
        )

    def expected_apis(self, platform: str, version: str | None = None) -> set[str]:
        target = version or self.target_version(platform)
        if not target:
            return set()
        apis: set[str] = set()
        changes = self._data.get("api_changes") or {}
        for change_version in sorted(changes, key=_version_sort_key):
            if _version_sort_key(change_version) > _version_sort_key(target):
                continue
            platform_changes = (changes.get(change_version) or {}).get(platform) or {}
            for api in platform_changes.get("added") or []:
                apis.add(_api_name(api))
            for api in platform_changes.get("removed") or []:
                apis.discard(_api_name(api))
        return apis

    def find(self, platform: str, manager: str, cmd: str) -> ApiPolicyEntry | None:
        api = f"{manager}.{cmd}"
        raw = (self._data.get("api_policy") or {}).get(api) or {}
        statuses = raw.get("status") or {}
        platform_status = statuses.get(platform)
        if not platform_status:
            return None
        status = str(platform_status.get("status") or "").strip()
        if status not in VALID_POLICY_STATUSES:
            raise ValueError(f"Unknown SDK capability policy status: {status}")
        introduced = raw.get("introduced") or {}
        return ApiPolicyEntry(
            api=api,
            platform=platform,
            status=status,
            reason=str(platform_status.get("reason") or "").strip(),
            introduced_version=str(introduced.get(platform) or ""),
            target_version=self.target_version(platform),
        )

    def _validate_policy_statuses(self) -> None:
        for api, raw in (self._data.get("api_policy") or {}).items():
            statuses = (raw or {}).get("status") or {}
            for platform, item in statuses.items():
                status = str((item or {}).get("status") or "").strip()
                if status and status not in VALID_POLICY_STATUSES:
                    raise ValueError(
                        f"Unknown SDK capability policy status for {api}.{platform}: {status}"
                    )


def _version_sort_key(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for item in str(version).split("."):
        try:
            parts.append(int(item))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def _api_name(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("api") or "").strip()
    return str(item).strip()
