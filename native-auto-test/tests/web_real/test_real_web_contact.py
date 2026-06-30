"""Real Web SDK/service ContactManager E2E cases."""

from __future__ import annotations

import pytest

from src import Cmd, ContactChangeEvent


pytestmark = [pytest.mark.web, pytest.mark.contact, pytest.mark.real_web]


def test_real_web_contact_changed_events_imsdk_runtime(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    try:
        primary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_b, "keepConversation": True},
        )
        secondary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_a, "keepConversation": True},
        )
    except Exception:
        pass

    primary_device.call("Client", Cmd.startCallback.value, info={})
    secondary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.5)
    secondary_device.drain_events(timeout=0.5)

    invited = secondary_device.receive_message(
        match_event_type=Cmd.onContactChanged.value,
        timeout=1.0,
    )
    assert invited is None

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "real-web-contact-event"},
    )
    assert_api.assert_result_equals(add, user_b)

    invited = secondary_device.receive_message(
        match_event_type=Cmd.onContactChanged.value,
        timeout=10.0,
    )
    if invited is None:
        debug_b = assert_api.get_result(
            secondary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(f"missing onContactInvited event; debug={debug_b!r}")
    invited_data = invited.get("data")
    assert isinstance(invited_data, dict)
    assert invited_data.get("userId") == user_a
    assert invited_data.get("type") == "onContactInvited"

    accept = secondary_device.call(
        "ContactManager",
        Cmd.acceptInvitation.value,
        info={"userId": user_a},
    )
    assert_api.assert_result_equals(accept, True)

    accepted = primary_device.receive_message(
        match_event_type=Cmd.onContactChanged.value,
        timeout=10.0,
    )
    if accepted is None:
        debug_a = assert_api.get_result(
            primary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(f"missing onContactAgreed event; debug={debug_a!r}")
    accepted_data = accepted.get("data")
    assert isinstance(accepted_data, dict)
    assert accepted_data.get("userId") == user_b
    assert accepted_data.get("type") == "onFriendRequestAccepted"

    delete = primary_device.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": user_b, "keepConversation": True},
    )
    assert_api.assert_result_equals(delete, user_b)

    deleted = secondary_device.receive_message(
        match_event_type=Cmd.onContactChanged.value,
        timeout=10.0,
    )
    if deleted is None:
        debug_b = assert_api.get_result(
            secondary_device.call("Client", "getRealSdkDebug", info={})
        )
        pytest.fail(f"missing onContactDeleted event; debug={debug_b!r}")
    assert deleted is not None
    assert deleted.get("eventType") == Cmd.onContactChanged.value
    deleted_data = deleted.get("data")
    assert isinstance(deleted_data, dict)
    assert deleted_data.get("type") == ContactChangeEvent.CONTACT_DELETE.value
    assert deleted_data.get("userId") == user_a


def test_real_web_contact_add_accept_list_delete(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    try:
        primary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_b, "keepConversation": True},
        )
        secondary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_a, "keepConversation": True},
        )
    except Exception:
        pass

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "real-web-contact"},
    )
    assert_api.assert_result_equals(add, user_b)

    accept = secondary_device.call(
        "ContactManager",
        Cmd.acceptInvitation.value,
        info={"userId": user_a},
    )
    assert_api.assert_result_equals(accept, True)

    contacts_a = primary_device.call(
        "ContactManager",
        Cmd.getAllContactsFromServer.value,
        info={},
    )
    result_a = assert_api.get_result(contacts_a)
    assert isinstance(result_a, list)
    assert user_b in result_a

    contacts_b = secondary_device.call(
        "ContactManager",
        Cmd.getAllContactsFromServer.value,
        info={},
    )
    result_b = assert_api.get_result(contacts_b)
    assert isinstance(result_b, list)
    assert user_a in result_b

    all_contacts = primary_device.call(
        "ContactManager",
        Cmd.fetchAllContacts.value,
        info={},
    )
    all_result = assert_api.get_result(all_contacts)
    assert isinstance(all_result, list)
    assert any(
        isinstance(contact, dict) and contact.get("userId") == user_b
        for contact in all_result
    )

    for cmd in (Cmd.fetchAllContactIds, Cmd.getAllContactIds):
        contact_ids = primary_device.call(
            "ContactManager",
            cmd.value,
            info={},
        )
        ids_result = assert_api.get_result(contact_ids)
        assert isinstance(ids_result, list)
        assert user_b in ids_result

    delete = primary_device.call(
        "ContactManager",
        Cmd.deleteContact.value,
        info={"userId": user_b, "keepConversation": True},
    )
    assert_api.assert_result_equals(delete, user_b)

    contacts_after_delete = primary_device.call(
        "ContactManager",
        Cmd.getAllContactsFromServer.value,
        info={},
    )
    result_after_delete = assert_api.get_result(contacts_after_delete)
    assert isinstance(result_after_delete, list)
    assert user_b not in result_after_delete


def test_real_web_contact_blocklist_add_query_remove(
    primary_device,
    assert_api,
    user_b,
):
    try:
        primary_device.call(
            "ContactManager",
            Cmd.removeUserFromBlockList.value,
            info={"userId": user_b},
        )
    except Exception:
        pass

    add = primary_device.call(
        "ContactManager",
        Cmd.addUserToBlockList.value,
        info={"userId": user_b},
    )
    assert_api.assert_result_equals(add, user_b)

    blocklist = primary_device.call(
        "ContactManager",
        Cmd.getBlockListFromServer.value,
        info={},
    )
    block_result = assert_api.get_result(blocklist)
    assert isinstance(block_result, list)
    assert user_b in block_result

    remove = primary_device.call(
        "ContactManager",
        Cmd.removeUserFromBlockList.value,
        info={"userId": user_b},
    )
    assert_api.assert_result_equals(remove, user_b)

    after_remove = primary_device.call(
        "ContactManager",
        Cmd.getBlockListFromServer.value,
        info={},
    )
    after_result = assert_api.get_result(after_remove)
    assert isinstance(after_result, list)
    assert user_b not in after_result


def test_real_web_contact_remark_and_paged_fetch(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    remark_text = "real-web-remark"
    try:
        primary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_b, "keepConversation": True},
        )
        secondary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_a, "keepConversation": True},
        )
    except Exception:
        pass

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "real-web-contact-remark"},
    )
    assert_api.assert_result_equals(add, user_b)

    accept = secondary_device.call(
        "ContactManager",
        Cmd.acceptInvitation.value,
        info={"userId": user_a},
    )
    assert_api.assert_result_equals(accept, True)

    set_remark = primary_device.call(
        "ContactManager",
        Cmd.setContactRemark.value,
        info={"userId": user_b, "remark": remark_text},
    )
    assert_api.assert_result_equals(set_remark, True)

    contact = primary_device.call(
        "ContactManager",
        Cmd.getContact.value,
        info={"userId": user_b},
    )
    contact_result = assert_api.get_result(contact)
    assert isinstance(contact_result, dict)
    assert contact_result.get("userId") == user_b
    assert contact_result.get("remark") == remark_text

    contacts = primary_device.call(
        "ContactManager",
        Cmd.getAllContacts.value,
        info={},
    )
    contacts_result = assert_api.get_result(contacts)
    assert any(
        isinstance(item, dict)
        and item.get("userId") == user_b
        and item.get("remark") == remark_text
        for item in contacts_result
    )

    page = primary_device.call(
        "ContactManager",
        Cmd.fetchContacts.value,
        info={"cursor": "", "pageSize": 20},
    )
    page_result = assert_api.get_result(page)
    assert isinstance(page_result, dict)
    assert any(
        isinstance(item, dict)
        and item.get("userId") == user_b
        and item.get("remark") == remark_text
        for item in page_result.get("list", [])
    )

    debug = assert_api.get_result(
        primary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "setContactRemark_success" in debug_types, debug
    assert "getAllContacts_success" in debug_types, debug
    assert "getContactsWithCursor_success" in debug_types, debug


def test_real_web_contact_decline_invitation(
    primary_device,
    secondary_device,
    assert_api,
    user_a,
    user_b,
):
    try:
        primary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_b, "keepConversation": True},
        )
        secondary_device.call(
            "ContactManager",
            Cmd.deleteContact.value,
            info={"userId": user_a, "keepConversation": True},
        )
    except Exception:
        pass

    add = primary_device.call(
        "ContactManager",
        Cmd.addContact.value,
        info={"userId": user_b, "reason": "real-web-contact-decline"},
    )
    assert_api.assert_result_equals(add, user_b)

    decline = secondary_device.call(
        "ContactManager",
        Cmd.declineInvitation.value,
        info={"userId": user_a},
    )
    assert_api.assert_result_equals(decline, True)

    contacts_b = secondary_device.call(
        "ContactManager",
        Cmd.getAllContactsFromServer.value,
        info={},
    )
    result_b = assert_api.get_result(contacts_b)
    assert isinstance(result_b, list)
    assert user_a not in result_b

    debug = assert_api.get_result(
        secondary_device.call("Client", "getRealSdkDebug", info={})
    )
    debug_types = {item.get("type") for item in debug if isinstance(item, dict)}
    assert "declineInvitation_success" in debug_types, debug
