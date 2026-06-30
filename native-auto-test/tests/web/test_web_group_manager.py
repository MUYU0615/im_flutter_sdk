"""Web GroupManager local state regression cases."""

from __future__ import annotations

import contextlib
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.group]


@contextlib.contextmanager
def _download_server(content: bytes):
    hits: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, format, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server, hits
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_web_group_manager_local_lifecycle_and_metadata(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.getGroupWithId,
        Cmd.getJoinedGroups,
        Cmd.fetchJoinedGroupCount,
        Cmd.updateGroupSubject,
        Cmd.updateDescription,
        Cmd.leaveGroup,
        Cmd.destroyGroup,
    ):
        require_capability("GroupManager", cmd.value)

    group_name = f"web-group-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={
            "groupName": group_name,
            "desc": "web group initial",
            "inviteMembers": [user_b],
            "options": {"maxUserCount": 200, "style": 0},
        },
    )
    group = assert_api.get_result(create)
    group_id = group["groupId"]
    assert group["name"] == group_name
    assert group["desc"] == "web group initial"
    assert group["owner"] == user_a
    assert user_b in group["memberList"]

    fetched = primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    assert_api.assert_result_matches(fetched, groupId=group_id, name=group_name, desc="web group initial")

    joined = primary_device.call("GroupManager", Cmd.getJoinedGroups.value, info={})
    joined_ids = [item["groupId"] for item in assert_api.get_result(joined)]
    assert group_id in joined_ids

    count = primary_device.call("GroupManager", Cmd.fetchJoinedGroupCount.value, info={})
    assert assert_api.get_result(count) >= 1

    update_name = primary_device.call(
        "GroupManager",
        Cmd.updateGroupSubject.value,
        info={"groupId": group_id, "name": "web group renamed"},
    )
    assert_api.assert_result_equals(update_name, None)

    update_desc = primary_device.call(
        "GroupManager",
        Cmd.updateDescription.value,
        info={"groupId": group_id, "desc": "web group updated desc"},
    )
    assert_api.assert_result_equals(update_desc, None)

    updated = primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    assert_api.assert_result_matches(
        updated,
        groupId=group_id,
        name="web group renamed",
        desc="web group updated desc",
    )

    leave = primary_device.call("GroupManager", Cmd.leaveGroup.value, info={"groupId": group_id})
    assert_api.assert_result_equals(leave, None)
    after_leave = primary_device.call("GroupManager", Cmd.getJoinedGroups.value, info={})
    assert group_id not in [item["groupId"] for item in assert_api.get_result(after_leave)]

    # destroyGroup must still remove the local group object even after the current
    # user has left the joined set.
    destroy = primary_device.call("GroupManager", Cmd.destroyGroup.value, info={"groupId": group_id})
    assert_api.assert_result_equals(destroy, None)
    removed = primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    assert_api.assert_result_equals(removed, None)


def test_web_group_manager_local_members_roles_and_moderation(
    primary_device,
    assert_api,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.getGroupWithId,
        Cmd.addMembers,
        Cmd.removeMembers,
        Cmd.addAdmin,
        Cmd.removeAdmin,
        Cmd.blockMembers,
        Cmd.unblockMembers,
        Cmd.muteMembers,
        Cmd.unMuteMembers,
        Cmd.muteAllMembers,
        Cmd.unMuteAllMembers,
        Cmd.addWhiteList,
        Cmd.removeWhiteList,
        Cmd.blockGroup,
        Cmd.unblockGroup,
        Cmd.isMemberInGroupMuteList,
        Cmd.destroyGroup,
    ):
        require_capability("GroupManager", cmd.value)

    group_name = f"web-group-moderation-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={"groupName": group_name, "desc": "web group moderation"},
    )
    group_id = assert_api.get_result(create)["groupId"]

    add_member = primary_device.call(
        "GroupManager",
        Cmd.addMembers.value,
        info={"groupId": group_id, "members": [user_b], "welcome": "welcome"},
    )
    assert_api.assert_result_equals(add_member, None)
    after_add = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b in after_add["memberList"]
    assert after_add["memberCount"] == len(after_add["memberList"])

    add_admin = primary_device.call("GroupManager", Cmd.addAdmin.value, info={"groupId": group_id, "admin": user_b})
    assert_api.assert_result_equals(add_admin, None)
    after_admin = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b in after_admin["adminList"]

    remove_admin = primary_device.call("GroupManager", Cmd.removeAdmin.value, info={"groupId": group_id, "admin": user_b})
    assert_api.assert_result_equals(remove_admin, None)
    after_remove_admin = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b not in after_remove_admin["adminList"]

    block_member = primary_device.call("GroupManager", Cmd.blockMembers.value, info={"groupId": group_id, "members": [user_b]})
    assert_api.assert_result_equals(block_member, None)
    after_block = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b in after_block["blockList"]
    assert user_b not in after_block["memberList"]

    unblock_member = primary_device.call("GroupManager", Cmd.unblockMembers.value, info={"groupId": group_id, "members": [user_b]})
    assert_api.assert_result_equals(unblock_member, None)

    primary_device.call("GroupManager", Cmd.addMembers.value, info={"groupId": group_id, "members": [user_b]})
    mute_member = primary_device.call(
        "GroupManager",
        Cmd.muteMembers.value,
        info={"groupId": group_id, "members": [user_b], "duration": 60000},
    )
    assert_api.assert_result_equals(mute_member, None)
    after_mute = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b in after_mute["muteList"]

    mute_check = primary_device.call("GroupManager", Cmd.isMemberInGroupMuteList.value, info={"groupId": group_id})
    assert_api.assert_result_equals(mute_check, False)

    unmute_member = primary_device.call("GroupManager", Cmd.unMuteMembers.value, info={"groupId": group_id, "members": [user_b]})
    assert_api.assert_result_equals(unmute_member, None)
    after_unmute = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b not in after_unmute["muteList"]

    mute_all = primary_device.call("GroupManager", Cmd.muteAllMembers.value, info={"groupId": group_id})
    assert_api.assert_result_equals(mute_all, None)
    after_mute_all = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert after_mute_all["isAllMemberMuted"] is True

    unmute_all = primary_device.call("GroupManager", Cmd.unMuteAllMembers.value, info={"groupId": group_id})
    assert_api.assert_result_equals(unmute_all, None)
    after_unmute_all = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert after_unmute_all["isAllMemberMuted"] is False

    add_allow = primary_device.call("GroupManager", Cmd.addWhiteList.value, info={"groupId": group_id, "members": [user_b]})
    assert_api.assert_result_equals(add_allow, None)
    after_allow = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b in after_allow["whiteList"]

    remove_allow = primary_device.call("GroupManager", Cmd.removeWhiteList.value, info={"groupId": group_id, "members": [user_b]})
    assert_api.assert_result_equals(remove_allow, None)
    after_remove_allow = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b not in after_remove_allow["whiteList"]

    block_group = primary_device.call("GroupManager", Cmd.blockGroup.value, info={"groupId": group_id})
    assert_api.assert_result_equals(block_group, None)
    after_block_group = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert after_block_group["messageBlocked"] is True

    unblock_group = primary_device.call("GroupManager", Cmd.unblockGroup.value, info={"groupId": group_id})
    assert_api.assert_result_equals(unblock_group, None)
    after_unblock_group = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert after_unblock_group["messageBlocked"] is False

    remove_member = primary_device.call("GroupManager", Cmd.removeMembers.value, info={"groupId": group_id, "members": [user_b]})
    assert_api.assert_result_equals(remove_member, None)
    after_remove = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b not in after_remove["memberList"]


def test_web_group_manager_local_announcement_ext_avatar_members_and_clear(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.getGroupWithId,
        Cmd.addMembers,
        Cmd.updateGroupAnnouncement,
        Cmd.getGroupAnnouncementFromServer,
        Cmd.updateGroupExt,
        Cmd.updateGroupAvatar,
        Cmd.fetchGroupMembersInfo,
        Cmd.getJoinedGroups,
        Cmd.clearAllGroupsFromDB,
    ):
        require_capability("GroupManager", cmd.value)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={"groupName": f"web-group-details-{uuid.uuid4().hex[:8]}", "inviteMembers": [user_b]},
    )
    group_id = assert_api.get_result(create)["groupId"]

    announcement = f"web announcement {uuid.uuid4().hex[:8]}"
    update_announcement = primary_device.call(
        "GroupManager",
        Cmd.updateGroupAnnouncement.value,
        info={"groupId": group_id, "announcement": announcement},
    )
    assert_api.assert_result_equals(update_announcement, None)

    fetched_announcement = primary_device.call(
        "GroupManager",
        Cmd.getGroupAnnouncementFromServer.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(fetched_announcement, announcement)

    update_ext = primary_device.call(
        "GroupManager",
        Cmd.updateGroupExt.value,
        info={"groupId": group_id, "ext": "{\"web\":true}"},
    )
    assert_api.assert_result_equals(update_ext, None)

    avatar_url = f"https://example.com/group/{group_id}.png"
    update_avatar = primary_device.call(
        "GroupManager",
        Cmd.updateGroupAvatar.value,
        info={"groupId": group_id, "avatarUrl": avatar_url},
    )
    avatar_group = assert_api.get_result(update_avatar)
    assert avatar_group["groupId"] == group_id
    assert avatar_group["avatarUrl"] == avatar_url

    updated = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert updated["announcement"] == announcement
    assert updated["ext"] == "{\"web\":true}"
    assert updated["avatarUrl"] == avatar_url

    members_info = primary_device.call(
        "GroupManager",
        Cmd.fetchGroupMembersInfo.value,
        info={"groupId": group_id, "cursor": None, "limit": 10},
    )
    result = assert_api.get_result(members_info)
    assert result["cursor"] == ""
    members = result["list"]
    assert {item["userId"] for item in members} == {user_a, user_b}
    assert {item["memberId"] for item in members} == {user_a, user_b}

    clear = primary_device.call("GroupManager", Cmd.clearAllGroupsFromDB.value, info={})
    assert_api.assert_result_equals(clear, None)
    joined_after_clear = primary_device.call("GroupManager", Cmd.getJoinedGroups.value, info={})
    assert_api.assert_result_equals(joined_after_clear, [])


def test_web_group_manager_local_server_read_apis_owner_and_inviter(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.getJoinedGroupsFromServer,
        Cmd.getGroupSpecificationFromServer,
        Cmd.getGroupMemberListFromServer,
        Cmd.getGroupBlockListFromServer,
        Cmd.getGroupMuteListFromServer,
        Cmd.getGroupWhiteListFromServer,
        Cmd.isMemberInWhiteListFromServer,
        Cmd.inviterUser,
        Cmd.updateGroupOwner,
        Cmd.destroyGroup,
    ):
        require_capability("GroupManager", cmd.value)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={"groupName": f"web-group-read-{uuid.uuid4().hex[:8]}", "inviteMembers": [user_b]},
    )
    group_id = assert_api.get_result(create)["groupId"]

    joined_server = primary_device.call(
        "GroupManager",
        Cmd.getJoinedGroupsFromServer.value,
        info={"pageSize": 20, "pageNum": 0, "needMemberCount": True, "needRole": True},
    )
    assert group_id in [item["groupId"] for item in assert_api.get_result(joined_server)]

    spec = primary_device.call(
        "GroupManager",
        Cmd.getGroupSpecificationFromServer.value,
        info={"groupId": group_id, "fetchMembers": True},
    )
    assert_api.assert_result_matches(spec, groupId=group_id, owner=user_a)

    members = primary_device.call(
        "GroupManager",
        Cmd.getGroupMemberListFromServer.value,
        info={"groupId": group_id, "pageSize": 20, "cursor": None},
    )
    member_page = assert_api.get_result(members)
    assert member_page["cursor"] == ""
    assert set(member_page["list"]) == {user_a, user_b}

    primary_device.call("GroupManager", Cmd.blockMembers.value, info={"groupId": group_id, "members": [user_b]})
    block_list = primary_device.call(
        "GroupManager",
        Cmd.getGroupBlockListFromServer.value,
        info={"groupId": group_id, "pageSize": 20, "pageNum": 1},
    )
    assert_api.assert_result_equals(block_list, [user_b])

    primary_device.call("GroupManager", Cmd.unblockMembers.value, info={"groupId": group_id, "members": [user_b]})
    primary_device.call("GroupManager", Cmd.addMembers.value, info={"groupId": group_id, "members": [user_b]})
    primary_device.call("GroupManager", Cmd.muteMembers.value, info={"groupId": group_id, "members": [user_b], "duration": 60000})
    mute_list = primary_device.call(
        "GroupManager",
        Cmd.getGroupMuteListFromServer.value,
        info={"groupId": group_id, "pageSize": 20, "pageNum": 1},
    )
    assert user_b in assert_api.get_result(mute_list)

    primary_device.call("GroupManager", Cmd.addWhiteList.value, info={"groupId": group_id, "members": [user_a]})
    allow_list = primary_device.call(
        "GroupManager",
        Cmd.getGroupWhiteListFromServer.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(allow_list, [user_a])
    in_allow_list = primary_device.call(
        "GroupManager",
        Cmd.isMemberInWhiteListFromServer.value,
        info={"groupId": group_id},
    )
    assert_api.assert_result_equals(in_allow_list, True)

    invited = primary_device.call(
        "GroupManager",
        Cmd.inviterUser.value,
        info={"groupId": group_id, "members": ["web-invited-user"], "reason": "web invite"},
    )
    assert_api.assert_result_equals(invited, None)
    after_invite = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert "web-invited-user" in after_invite["memberList"]

    owner = primary_device.call(
        "GroupManager",
        Cmd.updateGroupOwner.value,
        info={"groupId": group_id, "owner": user_b},
    )
    assert_api.assert_result_equals(owner, None)
    after_owner = primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    assert_api.assert_result_matches(after_owner, groupId=group_id, owner=user_b)


def test_web_group_manager_local_member_attributes(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.setMemberAttributesFromGroup,
        Cmd.removeMemberAttributesFromGroup,
        Cmd.fetchMemberAttributesFromGroup,
        Cmd.fetchMembersAttributesFromGroup,
    ):
        require_capability("GroupManager", cmd.value)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={"groupName": f"web-group-attrs-{uuid.uuid4().hex[:8]}", "inviteMembers": [user_b]},
    )
    group_id = assert_api.get_result(create)["groupId"]

    set_attrs = primary_device.call(
        "GroupManager",
        Cmd.setMemberAttributesFromGroup.value,
        info={"groupId": group_id, "userId": user_b, "attributes": {"roleLabel": "qa", "level": "2"}},
    )
    assert_api.assert_result_equals(set_attrs, None)

    own_set_attrs = primary_device.call(
        "GroupManager",
        Cmd.setMemberAttributesFromGroup.value,
        info={"groupId": group_id, "attributes": {"self": "yes"}},
    )
    assert_api.assert_result_equals(own_set_attrs, None)

    fetched = primary_device.call(
        "GroupManager",
        Cmd.fetchMemberAttributesFromGroup.value,
        info={"groupId": group_id, "userId": user_b},
    )
    assert_api.assert_result_equals(fetched, {"roleLabel": "qa", "level": "2"})

    fetched_many = primary_device.call(
        "GroupManager",
        Cmd.fetchMembersAttributesFromGroup.value,
        info={"groupId": group_id, "userIds": [user_a, user_b], "keys": ["self", "roleLabel"]},
    )
    assert_api.assert_result_equals(
        fetched_many,
        {user_a: {"self": "yes"}, user_b: {"roleLabel": "qa"}},
    )

    remove_attrs = primary_device.call(
        "GroupManager",
        Cmd.removeMemberAttributesFromGroup.value,
        info={"groupId": group_id, "userId": user_b, "keys": ["level"]},
    )
    assert_api.assert_result_equals(remove_attrs, None)
    after_remove = primary_device.call(
        "GroupManager",
        Cmd.fetchMemberAttributesFromGroup.value,
        info={"groupId": group_id, "userId": user_b},
    )
    assert_api.assert_result_equals(after_remove, {"roleLabel": "qa"})


def test_web_group_manager_local_public_join_and_invitation_flows(
    primary_device,
    assert_api,
    user_a,
    user_b,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.getPublicGroupsFromServer,
        Cmd.joinPublicGroup,
        Cmd.requestToJoinPublicGroup,
        Cmd.acceptJoinApplication,
        Cmd.declineJoinApplication,
        Cmd.acceptInvitationFromGroup,
        Cmd.declineInvitationFromGroup,
        Cmd.getGroupWithId,
    ):
        require_capability("GroupManager", cmd.value)

    group_name = f"web-public-{uuid.uuid4().hex[:8]}"
    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={"groupName": group_name, "inviteMembers": []},
    )
    group_id = assert_api.get_result(create)["groupId"]

    public_groups = primary_device.call(
        "GroupManager",
        Cmd.getPublicGroupsFromServer.value,
        info={"pageSize": 20, "cursor": None},
    )
    public_page = assert_api.get_result(public_groups)
    assert public_page["cursor"] == ""
    assert any(item["groupId"] == group_id and item["name"] == group_name for item in public_page["list"])

    join = primary_device.call("GroupManager", Cmd.joinPublicGroup.value, info={"groupId": group_id})
    assert_api.assert_result_equals(join, None)

    request = primary_device.call(
        "GroupManager",
        Cmd.requestToJoinPublicGroup.value,
        info={"groupId": group_id, "reason": "please add me"},
    )
    assert_api.assert_result_equals(request, None)

    accept_application = primary_device.call(
        "GroupManager",
        Cmd.acceptJoinApplication.value,
        info={"groupId": group_id, "userId": user_b},
    )
    assert_api.assert_result_equals(accept_application, None)
    after_accept = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert user_b in after_accept["memberList"]

    decline_application = primary_device.call(
        "GroupManager",
        Cmd.declineJoinApplication.value,
        info={"groupId": group_id, "userId": "web-declined-applicant", "reason": "no"},
    )
    assert_api.assert_result_equals(decline_application, None)
    after_decline = assert_api.get_result(
        primary_device.call("GroupManager", Cmd.getGroupWithId.value, info={"groupId": group_id})
    )
    assert "web-declined-applicant" not in after_decline["memberList"]

    accept_invitation = primary_device.call(
        "GroupManager",
        Cmd.acceptInvitationFromGroup.value,
        info={"groupId": group_id, "inviter": user_a},
    )
    accepted_group = assert_api.get_result(accept_invitation)
    assert accepted_group["groupId"] == group_id

    decline_invitation = primary_device.call(
        "GroupManager",
        Cmd.declineInvitationFromGroup.value,
        info={"groupId": group_id, "inviter": user_a, "reason": "declined"},
    )
    assert_api.assert_result_equals(decline_invitation, None)


def test_web_group_manager_local_shared_files(
    primary_device,
    assert_api,
    user_a,
    require_capability,
):
    for cmd in (
        Cmd.createGroup,
        Cmd.getGroupFileListFromServer,
        Cmd.uploadGroupSharedFile,
        Cmd.downloadGroupSharedFile,
        Cmd.removeGroupSharedFile,
    ):
        require_capability("GroupManager", cmd.value)

    create = primary_device.call(
        "GroupManager",
        Cmd.createGroup.value,
        info={"groupName": f"web-shared-files-{uuid.uuid4().hex[:8]}"},
    )
    group_id = assert_api.get_result(create)["groupId"]
    content = b"web shared file content"
    with _download_server(content) as (server, hits):
        file_name = f"web-shared-{uuid.uuid4().hex[:8]}.txt"
        file_path = f"http://127.0.0.1:{server.server_port}/{file_name}"

        empty_list = primary_device.call(
            "GroupManager",
            Cmd.getGroupFileListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        assert_api.assert_result_equals(empty_list, [])

        upload = primary_device.call(
            "GroupManager",
            Cmd.uploadGroupSharedFile.value,
            info={"groupId": group_id, "filePath": file_path},
        )
        assert_api.assert_result_equals(upload, None)

        files = primary_device.call(
            "GroupManager",
            Cmd.getGroupFileListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        file_list = assert_api.get_result(files)
        assert len(file_list) == 1
        shared_file = file_list[0]
        assert shared_file["fileId"]
        assert shared_file["name"] == file_name
        assert shared_file["owner"] == user_a
        assert isinstance(shared_file["createTime"], int)
        assert shared_file["fileSize"] == 0

        download = primary_device.call(
            "GroupManager",
            Cmd.downloadGroupSharedFile.value,
            info={
                "groupId": group_id,
                "fileId": shared_file["fileId"],
                "savePath": f"/tmp/downloaded-{file_name}",
            },
        )
        assert_api.assert_result_equals(download, None)
        assert f"/{file_name}" in hits

        remove = primary_device.call(
            "GroupManager",
            Cmd.removeGroupSharedFile.value,
            info={"groupId": group_id, "fileId": shared_file["fileId"]},
        )
        assert_api.assert_result_equals(remove, None)

        after_remove = primary_device.call(
            "GroupManager",
            Cmd.getGroupFileListFromServer.value,
            info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
        )
        assert_api.assert_result_equals(after_remove, [])
