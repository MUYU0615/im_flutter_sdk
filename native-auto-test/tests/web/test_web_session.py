def test_web_session_devices_are_logged_in(
    primary_device,
    secondary_device,
    user_a,
    user_b,
    assert_api,
):
    resp_a = primary_device.call("Client", "getCurrentUser", info={})
    resp_b = secondary_device.call("Client", "getCurrentUser", info={})

    assert_api.assert_result_equals(resp_a, user_a)
    assert_api.assert_result_equals(resp_b, user_b)
