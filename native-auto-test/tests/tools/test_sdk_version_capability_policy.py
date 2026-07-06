from __future__ import annotations

import pytest

from src.tools.sdk_version_capability_policy import SdkVersionCapabilityPolicy


pytestmark = pytest.mark.no_global_login


def test_expected_apis_are_accumulated_by_version_delta():
    policy = SdkVersionCapabilityPolicy.from_dict(
        {
            "test_versions": {
                "platforms": {
                    "android": {"version": "4.12.0", "enabled": True, "role": "baseline"}
                }
            },
            "api_changes": {
                "4.10.0": {
                    "android": {
                        "added": ["ChatManager.sendMessage", "ChatManager.getMessage"],
                    }
                },
                "4.11.0": {
                    "android": {
                        "added": ["ChatManager.modifyMessage"],
                        "removed": ["ChatManager.getMessage"],
                    }
                },
                "4.12.0": {
                    "android": {
                        "added": [
                            {
                                "api": "ChatManager.saveMessage",
                                "native": "EMChatManager.saveMessage",
                            }
                        ],
                    }
                },
                "4.13.0": {
                    "android": {
                        "added": ["ChatManager.futureApi"],
                    }
                },
            },
        }
    )

    assert policy.expected_apis("android") == {
        "ChatManager.sendMessage",
        "ChatManager.modifyMessage",
        "ChatManager.saveMessage",
    }


def test_policy_finds_version_gap_reason_for_platform():
    policy = SdkVersionCapabilityPolicy.from_dict(
        {
            "test_versions": {
                "platforms": {
                    "web": {"version": "4.22.0", "enabled": True, "role": "target"}
                }
            },
            "api_policy": {
                "ChatManager.saveMessage": {
                    "introduced": {"android": "4.23.0", "web": None},
                    "status": {
                        "web": {
                            "status": "version_gap",
                            "reason": "Web 当前版本未提供该真实 SDK 能力。",
                        }
                    },
                }
            },
        }
    )

    entry = policy.find("web", "ChatManager", "saveMessage")

    assert entry is not None
    assert entry.status == "version_gap"
    assert entry.target_version == "4.22.0"
    assert entry.reason == "Web 当前版本未提供该真实 SDK 能力。"


def test_sdk_source_keeps_download_and_docs_metadata():
    policy = SdkVersionCapabilityPolicy.from_dict(
        {
            "test_versions": {
                "platforms": {
                    "tablet": {
                        "version": "1.0.0",
                        "enabled": True,
                        "role": "target",
                        "source_ref": "tablet-1.0.0",
                    }
                }
            },
            "sdk_sources": {
                "tablet": {
                    "artifact": "com.hyphenate:hyphenate-chat-tablet",
                    "source_dir": "im_flutter_sdk_tablet/",
                    "download_url_template": "https://example.com/{version}",
                    "docs_url": "https://example.com/docs",
                    "versions": {
                        "tablet-1.0.0": {
                            "version": "1.0.0",
                            "download_url": "https://example.com/1.0.0",
                            "local_artifact_hint": "gradle cache",
                        }
                    },
                }
            }
        }
    )

    source = policy.sdk_source("tablet")

    assert source.artifact == "com.hyphenate:hyphenate-chat-tablet"
    assert source.source_dir == "im_flutter_sdk_tablet/"
    assert source.download_url_template == "https://example.com/{version}"
    assert source.docs_url == "https://example.com/docs"
    assert source.version == "1.0.0"
    assert source.download_url == "https://example.com/1.0.0"
    assert source.local_artifact_hint == "gradle cache"


def test_enabled_platforms_return_current_test_versions():
    policy = SdkVersionCapabilityPolicy.from_dict(
        {
            "test_versions": {
                "platforms": {
                    "android": {"version": "4.23.0", "enabled": True, "role": "baseline"},
                    "ios": {"version": "4.22.0", "enabled": False, "role": "target"},
                    "web": {"version": "4.21.0", "enabled": True, "role": "target"},
                }
            }
        }
    )

    enabled = policy.enabled_platforms()

    assert [(item.platform, item.version, item.role) for item in enabled] == [
        ("android", "4.23.0", "baseline"),
        ("web", "4.21.0", "target"),
    ]
    assert policy.target_version("ios") == "4.22.0"


def test_policy_rejects_unknown_status():
    with pytest.raises(ValueError, match="unexpected"):
        SdkVersionCapabilityPolicy.from_dict(
            {
                "api_policy": {
                    "ChatManager.saveMessage": {
                        "status": {
                            "web": {
                                "status": "unexpected",
                                "reason": "invalid",
                            }
                        }
                    }
                }
            }
        )
