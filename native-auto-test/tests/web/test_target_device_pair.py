import pytest

from src.tools.target_platforms import TARGET_PLATFORMS, target_device_pair_for_platform


def test_target_platform_matches_option(pytestconfig, target_platform):
    assert target_platform == pytestconfig.getoption("--target-platform")


@pytest.mark.parametrize(
    ("platform", "expected_pair"),
    [
        ("android", ("deviceA", "deviceB")),
        ("ios", ("deviceA", "deviceB")),
        ("mobile", ("deviceA", "deviceB")),
        ("web", ("webA", "webB")),
    ],
)
def test_target_platform_supports_explicit_platform_choices(platform, expected_pair):
    assert platform in TARGET_PLATFORMS
    assert target_device_pair_for_platform(platform) == expected_pair


def test_web_device_pair_fixture(target_platform, target_device_pair):
    if target_platform != "web":
        return
    assert target_device_pair == ("webA", "webB")


def test_mobile_device_pair_fixture_is_compatibility_alias(target_platform, target_device_pair):
    if target_platform != "mobile":
        return
    assert target_device_pair == ("deviceA", "deviceB")
