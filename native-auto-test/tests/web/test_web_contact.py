"""Web ContactManager foundation API regression cases."""

from __future__ import annotations

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.contact]


def test_web_contact_local_lists_and_blocklist(primary_device, assert_api, user_b, user_c, require_capability):
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
        Cmd.addUserToBlockList,
        Cmd.removeUserFromBlockList,
        Cmd.getBlockListFromServer,
        Cmd.getBlockListFromDB,
        Cmd.acceptInvitation,
        Cmd.declineInvitation,
        Cmd.getSelfIdsOnOtherPlatform,
    ):
        require_capability("ContactManager", cmd.value)

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "web-contact"},
    )
    assert_api.assert_result_equals(add, user_b)

    for cmd in (Cmd.getAllContactsFromServer, Cmd.getAllContactsFromDB):
        resp = primary_device.call("ContactManager", cmd.value, info={})
        assert_api.assert_result_equals(resp, [user_b])

    remark = primary_device.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": "web-remark"},
    )
    assert_api.assert_result_equals(remark, True)

    contact = primary_device.call(
        "ContactManager",
        Cmd.getContact.value,
        info={"userId": user_b},
    )
    assert_api.assert_result_equals(
        contact,
        {"userId": user_b, "remark": "web-remark"},
    )

    for cmd in (Cmd.getAllContacts, Cmd.fetchAllContacts):
        resp = primary_device.call("ContactManager", cmd.value, info={})
        assert_api.assert_result_equals(resp, [{"userId": user_b, "remark": "web-remark"}])

    page = primary_device.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": 1},
    )
    assert_api.assert_result_equals(
        page,
        {
            "cursor": "",
            "list": [{"userId": user_b, "remark": "web-remark"}],
        },
    )

    for cmd in (Cmd.fetchAllContactIds, Cmd.getAllContactIds):
        resp = primary_device.call("ContactManager", cmd.value, info={})
        assert_api.assert_result_equals(resp, [user_b])

    block = primary_device.call(
        "ContactManager",
        Cmd.addUserToBlockList.value,
        info={"userId": user_c},
    )
    assert_api.assert_result_equals(block, user_c)

    for cmd in (Cmd.getBlockListFromServer, Cmd.getBlockListFromDB):
        resp = primary_device.call("ContactManager", cmd.value, info={})
        assert_api.assert_result_equals(resp, [user_c])

    unblock = primary_device.call(
        "ContactManager",
        Cmd.removeUserFromBlockList.value,
        info={"userId": user_c},
    )
    assert_api.assert_result_equals(unblock, user_c)

    block_db = primary_device.call("ContactManager", Cmd.getBlockListFromDB.value, info={})
    assert_api.assert_result_equals(block_db, [])

    accept = primary_device.call("ContactManager", Cmd.acceptInvitation.value, info={"userId": user_b})
    assert_api.assert_result_equals(accept, True)

    decline = primary_device.call("ContactManager", Cmd.declineInvitation.value, info={"userId": user_c})
    assert_api.assert_result_equals(decline, True)

    self_ids = primary_device.call(
        "ContactManager",
        Cmd.getSelfIdsOnOtherPlatform.value,
        info={},
    )
    assert_api.assert_result_equals(self_ids, [])

    delete = primary_device.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": user_b, "keepConversation": True},
    )
    assert_api.assert_result_equals(delete, user_b)

    empty = primary_device.call("ContactManager", Cmd.getAllContactsFromDB.value, info={})
    assert_api.assert_result_equals(empty, [])
