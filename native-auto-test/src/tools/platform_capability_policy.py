"""Compatibility wrapper for the versioned SDK capability policy."""
from __future__ import annotations

from .sdk_version_capability_policy import (
    ApiPolicyEntry,
    SdkSource,
    SdkVersionCapabilityPolicy,
    TestPlatformVersion,
    VALID_POLICY_STATUSES,
)

PlatformCapabilityPolicy = SdkVersionCapabilityPolicy
CapabilityPolicyEntry = ApiPolicyEntry
VALID_STATUSES = VALID_POLICY_STATUSES

__all__ = [
    "ApiPolicyEntry",
    "CapabilityPolicyEntry",
    "PlatformCapabilityPolicy",
    "SdkSource",
    "SdkVersionCapabilityPolicy",
    "TestPlatformVersion",
    "VALID_POLICY_STATUSES",
    "VALID_STATUSES",
]
