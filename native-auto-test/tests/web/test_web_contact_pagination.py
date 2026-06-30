"""Web ContactManager pagination and list boundary regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.contact]


def test_web_contact_lists_are_sorted_paginated_and_updated(
    primary_device,
    assert_api,
    user_a,
    user_b,
    user_c,
    require_capability,
):
    for cmd in (
        Cmd.addContact,
        Cmd.deleteContact,
        Cmd.getAllContactsFromServer,
        Cmd.getAllContactsFromDB,
        Cmd.getAllContacts,
        Cmd.fetchAllContacts,
        Cmd.fetchContacts,
        Cmd.fetchAllContactIds,
        Cmd.getAllContactIds,
        Cmd.setContactRemark,
        Cmd.getContact,
    ):
        require_capability("ContactManager", cmd.value)

    contact_ids = [user_c, user_b, f"{user_a}-zz-web-contact"]
    expected_ids = sorted(contact_ids)

    for user_id in contact_ids:
        add = primary_device.call(
            "ContactManager",
            Cmd.addContact.value,
            info={"userId": user_id, "reason": "web-contact-page"},
        )
        assert_api.assert_result_equals(add, user_id)

    for cmd in (Cmd.getAllContactsFromServer, Cmd.getAllContactsFromDB, Cmd.fetchAllContactIds, Cmd.getAllContactIds):
        resp = primary_device.call("ContactManager", cmd.value, info={})
        assert_api.assert_result_equals(resp, expected_ids)

    remark = primary_device.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": "web-page-remark"},
    )
    assert_api.assert_result_equals(remark, True)

    contact = primary_device.call("ContactManager", Cmd.getContact.value, info={"userId": user_b})
    assert_api.assert_result_equals(contact, {"userId": user_b, "remark": "web-page-remark"})

    full = primary_device.call("ContactManager", Cmd.fetchAllContacts.value, info={})
    full_list = assert_api.get_result(full)
    assert [item["userId"] for item in full_list] == expected_ids
    assert any(item == {"userId": user_b, "remark": "web-page-remark"} for item in full_list)

    first_page = primary_device.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": 2},
    )
    first_result = assert_api.get_result(first_page)
    assert first_result["cursor"] == "2"
    assert [item["userId"] for item in first_result["list"]] == expected_ids[:2]

    second_page = primary_device.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": first_result["cursor"], "pageSize": 2},
    )
    second_result = assert_api.get_result(second_page)
    assert second_result["cursor"] == ""
    assert [item["userId"] for item in second_result["list"]] == expected_ids[2:]

    delete = primary_device.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": user_b, "keepConversation": True},
    )
    assert_api.assert_result_equals(delete, user_b)

    after_delete = primary_device.call("ContactManager", Cmd.getAllContacts.value, info={})
    assert [item["userId"] for item in assert_api.get_result(after_delete)] == [
        user_id for user_id in expected_ids if user_id != user_b
    ]

    deleted_contact = primary_device.call("ContactManager", Cmd.getContact.value, info={"userId": user_b})
    assert_api.assert_result_equals(deleted_contact, None)
