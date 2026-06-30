"""Web not-applicable API bridge behavior regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web]


def test_web_client_not_applicable_api_returns_stable_result_error(primary_device, assert_api, require_capability):
    require_capability("Client", Cmd.changeAppKey.value)

    resp = primary_device.call(
        "Client",
        Cmd.changeAppKey.value,
        info={},
    )

    assert_api.assert_error(resp, code=900001, description="Unsupported on Web: Client.changeAppKey")
