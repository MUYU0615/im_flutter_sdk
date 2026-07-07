import pytest

from src.tools.platform_api_support_report import (
    PlatformStatus,
    _web_status,
    render_csv,
    render_html,
)


pytestmark = [pytest.mark.no_global_login]


def test_not_applicable_reason_is_rendered_in_chinese():
    status = _web_status(
        {
            "real_e2e_status": "not_applicable",
            "reason": "Native local SDK option; not applicable to Web memory-state adapter.",
        }
    )

    assert status == PlatformStatus(
        "not_applicable",
        "Web 不适用",
        "原生本地 SDK 配置项；浏览器 Web 运行时没有对应的本地存储适配能力。",
    )


def test_supported_reason_uses_manifest_reason_when_present():
    status = _web_status(
        {
            "real_e2e_status": "supported",
            "reason_zh": "Web 通过 bindDeviceToken 等价链路覆盖。",
        }
    )

    assert status == PlatformStatus(
        "supported",
        "支持",
        "Web 通过 bindDeviceToken 等价链路覆盖。",
    )


def test_not_applicable_csv_and_html_do_not_emit_english_reason():
    status = PlatformStatus(
        "not_applicable",
        "Web 不适用",
        "原生本地 SDK 配置项；浏览器 Web 运行时没有对应的本地存储适配能力。",
    )
    row = _fake_row(status)

    csv = render_csv([row])
    html = render_html([row])

    assert "not applicable to Web memory-state adapter" not in csv
    assert "not applicable to Web memory-state adapter" not in html
    assert "原生本地 SDK 配置项" in csv
    assert "原生本地 SDK 配置项" in html


def _fake_row(web_status):
    from src.tools.platform_api_support_report import ApiRow

    supported = PlatformStatus("supported", "支持", "wrapper 已实现。")
    return ApiRow(
        manager="Client",
        api="updateDeleteMessagesWhenLeaveGroupSetting",
        android=supported,
        ios=supported,
        web=web_status,
        web_tests=(),
    )
