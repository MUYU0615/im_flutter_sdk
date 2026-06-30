part of '../client_web.dart';

class GroupManagerWeb extends GroupManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  String? currentUser;
  int _groupSequence = 0;
  int _sharedFileSequence = 0;
  final Map<String, Map<String, dynamic>> _groups = {};
  final Set<String> _joinedGroupIds = {};
  final Map<String, Map<String, Map<String, String>>> _memberAttributes = {};

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
  }

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    final client = Client.instance;
    final realSdk = client is ClientWeb && client._sdkMode == 'real_sdk'
        ? client._realSdk
        : null;
    switch (method) {
      case _MethodKeys.createGroup:
        if (realSdk != null) {
          return {method: await realSdk.createGroup(map)};
        }
        return {method: _createGroup(map)};
      case _MethodKeys.getGroupWithId:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroup(map['groupId']?.toString() ?? '')
          };
        }
        return {method: _groupById(map['groupId'])};
      case _MethodKeys.getJoinedGroups:
        if (realSdk != null) {
          return {method: await realSdk.getJoinedGroups()};
        }
        return {method: _joinedGroups()};
      case _MethodKeys.getJoinedGroupsFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getJoinedGroups(
              pageSize: _asInt(map['pageSize']) ?? 20,
              pageNum: _asInt(map['pageNum']) ?? 0,
            ),
          };
        }
        return {method: _pagedJoinedGroups(map)};
      case _MethodKeys.getPublicGroupsFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getPublicGroups(
              pageSize: _asInt(map['pageSize']) ?? 200,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _publicGroupsPage(map)};
      case _MethodKeys.getGroupSpecificationFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupInfoDetailed(
              map['groupId']?.toString() ?? '',
            ),
          };
        }
        return {method: _groupById(map['groupId'])};
      case _MethodKeys.getGroupMemberListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupMembers(
              groupId: map['groupId']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 200,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _memberListPage(map)};
      case _MethodKeys.getGroupBlockListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupBlockList(
              groupId: map['groupId']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 200,
              pageNum: _asInt(map['pageNum']) ?? 1,
            ),
          };
        }
        return {method: _stringListPage(map, 'blockList')};
      case _MethodKeys.getGroupMuteListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupMuteList(
              groupId: map['groupId']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 200,
              pageNum: _asInt(map['pageNum']) ?? 1,
            ),
          };
        }
        return {method: _muteListMap(map)};
      case _MethodKeys.getGroupWhiteListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk
                .getGroupWhiteList(map['groupId']?.toString() ?? '')
          };
        }
        return {method: _groupStringList(map, 'whiteList')};
      case _MethodKeys.isMemberInWhiteListFromServer:
        if (realSdk != null) {
          final groupId = map['groupId']?.toString() ?? '';
          final userId = currentUser ?? '';
          return {
            method: await realSdk.isInGroupWhiteList(
              groupId: groupId,
              userId: userId,
            ),
          };
        }
        return {method: _isCurrentUserInList(map, 'whiteList')};
      case _MethodKeys.getGroupFileListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupSharedFileList(
              map['groupId']?.toString() ?? '',
            ),
          };
        }
        return {method: _groupSharedFilesPage(map)};
      case _MethodKeys.fetchJoinedGroupCount:
        if (realSdk != null) {
          final groups = await realSdk.getJoinedGroups();
          return {method: groups.length};
        }
        return {method: _joinedGroupIds.length};
      case _MethodKeys.addMembers:
      case _MethodKeys.inviterUser:
        if (realSdk != null) {
          await realSdk.inviteUsersToGroup(
            groupId: map['groupId']?.toString() ?? '',
            users: _asStringList(map['members']),
            welcome: map['welcome']?.toString() ?? map['reason']?.toString(),
          );
          return {method: true};
        }
        _addGroupMembers(map);
        return {method: null};
      case _MethodKeys.removeMembers:
        if (realSdk != null) {
          await realSdk.removeGroupMembers(
            groupId: map['groupId']?.toString() ?? '',
            users: _asStringList(map['members']),
          );
          return {method: true};
        }
        _removeGroupMembers(map);
        return {method: null};
      case _MethodKeys.blockMembers:
        if (realSdk != null) {
          await realSdk.blockGroupMembers(
            groupId: map['groupId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: true};
        }
        _blockGroupMembers(map);
        return {method: null};
      case _MethodKeys.unblockMembers:
        if (realSdk != null) {
          await realSdk.unblockGroupMembers(
            groupId: map['groupId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: true};
        }
        _removeFromGroupList(map, 'blockList');
        return {method: null};
      case _MethodKeys.blockGroup:
        if (realSdk != null) {
          await realSdk.disableSendGroupMsg(map['groupId']?.toString() ?? '');
          return {method: null};
        }
        _setGroupValue(map, 'messageBlocked', true);
        return {method: null};
      case _MethodKeys.unblockGroup:
        if (realSdk != null) {
          await realSdk.enableSendGroupMsg(map['groupId']?.toString() ?? '');
          return {method: null};
        }
        _setGroupValue(map, 'messageBlocked', false);
        return {method: null};
      case _MethodKeys.updateGroupOwner:
        if (realSdk != null) {
          final groupId = map['groupId']?.toString() ?? '';
          await realSdk.changeGroupOwner(
            groupId: groupId,
            newOwner: map['owner']?.toString() ?? '',
          );
          return {
            method: await realSdk.getGroupInfoDetailed(groupId),
          };
        }
        _updateGroupOwner(map);
        return {method: null};
      case _MethodKeys.addAdmin:
        if (realSdk != null) {
          await realSdk.setGroupAdmin(
            groupId: map['groupId']?.toString() ?? '',
            admin: map['admin']?.toString() ?? '',
          );
          return {method: null};
        }
        _addGroupListValue(map, 'adminList', 'admin');
        return {method: null};
      case _MethodKeys.removeAdmin:
        if (realSdk != null) {
          await realSdk.removeGroupAdmin(
            groupId: map['groupId']?.toString() ?? '',
            admin: map['admin']?.toString() ?? '',
          );
          return {method: null};
        }
        _removeGroupListValue(map, 'adminList', 'admin');
        return {method: null};
      case _MethodKeys.muteMembers:
        if (realSdk != null) {
          await realSdk.muteGroupMembers(
            groupId: map['groupId']?.toString() ?? '',
            members: _asStringList(map['members']),
            duration: _asInt(map['duration']) ?? 60,
          );
          return {method: null};
        }
        _addToGroupList(map, 'muteList');
        return {method: null};
      case _MethodKeys.unMuteMembers:
        if (realSdk != null) {
          await realSdk.unmuteGroupMembers(
            groupId: map['groupId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: null};
        }
        _removeFromGroupList(map, 'muteList');
        return {method: null};
      case _MethodKeys.muteAllMembers:
        if (realSdk != null) {
          await realSdk.muteAllGroupMembers(map['groupId']?.toString() ?? '');
          return {method: null};
        }
        _setGroupValue(map, 'isAllMemberMuted', true);
        return {method: null};
      case _MethodKeys.unMuteAllMembers:
        if (realSdk != null) {
          await realSdk.unmuteAllGroupMembers(map['groupId']?.toString() ?? '');
          return {method: null};
        }
        _setGroupValue(map, 'isAllMemberMuted', false);
        return {method: null};
      case _MethodKeys.addWhiteList:
        if (realSdk != null) {
          await realSdk.addGroupWhiteList(
            groupId: map['groupId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: true};
        }
        _addToGroupList(map, 'whiteList');
        return {method: null};
      case _MethodKeys.removeWhiteList:
        if (realSdk != null) {
          await realSdk.removeGroupWhiteList(
            groupId: map['groupId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: true};
        }
        _removeFromGroupList(map, 'whiteList');
        return {method: null};
      case _MethodKeys.updateGroupSubject:
        if (realSdk != null) {
          await realSdk.updateGroupName(
            groupId: map['groupId']?.toString() ?? '',
            name: map['name']?.toString() ?? map['subject']?.toString() ?? '',
          );
          return {method: null};
        }
        _updateGroupName(map);
        return {method: null};
      case _MethodKeys.updateDescription:
        if (realSdk != null) {
          await realSdk.updateGroupDescription(
            groupId: map['groupId']?.toString() ?? '',
            description:
                map['desc']?.toString() ?? map['description']?.toString() ?? '',
          );
          return {method: null};
        }
        _updateGroupDescription(map);
        return {method: null};
      case _MethodKeys.updateGroupAnnouncement:
        if (realSdk != null) {
          await realSdk.updateGroupAnnouncement(
            groupId: map['groupId']?.toString() ?? '',
            announcement: map['announcement']?.toString() ?? '',
          );
          return {method: null};
        }
        _setGroupValue(map, 'announcement', map['announcement']);
        return {method: null};
      case _MethodKeys.getGroupAnnouncementFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk
                .fetchGroupAnnouncement(map['groupId']?.toString() ?? '')
          };
        }
        return {method: _groups[map['groupId']?.toString()]?['announcement']};
      case _MethodKeys.updateGroupExt:
        if (realSdk != null) {
          await realSdk.updateGroupExtension(
            groupId: map['groupId']?.toString() ?? '',
            ext: map['ext']?.toString() ?? '',
          );
          return {method: null};
        }
        _setGroupValue(map, 'ext', map['ext']);
        return {method: null};
      case _MethodKeys.setMemberAttributesFromGroup:
        if (realSdk != null) {
          await realSdk.setGroupMemberAttributes(
            groupId: map['groupId']?.toString() ?? '',
            userId: _attributeUserId(map),
            attributes: _asMap(map['attributes']).map(
              (key, value) => MapEntry(key, value?.toString() ?? ''),
            ),
          );
          return {method: null};
        }
        _setMemberAttributes(map);
        return {method: null};
      case _MethodKeys.removeMemberAttributesFromGroup:
        if (realSdk != null) {
          final keys = _asStringList(map['keys']);
          await realSdk.setGroupMemberAttributes(
            groupId: map['groupId']?.toString() ?? '',
            userId: _attributeUserId(map),
            attributes: {
              for (final key in keys) key: '',
            },
          );
          return {method: null};
        }
        _removeMemberAttributes(map);
        return {method: null};
      case _MethodKeys.fetchMemberAttributesFromGroup:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupMemberAttributes(
              groupId: map['groupId']?.toString() ?? '',
              userId: _attributeUserId(map),
              keys: _asStringList(map['keys']),
            ),
          };
        }
        return {method: _fetchMemberAttributes(map)};
      case _MethodKeys.fetchMembersAttributesFromGroup:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupMembersAttributes(
              groupId: map['groupId']?.toString() ?? '',
              userIds: _asStringList(map['userIds']),
              keys: _asStringList(map['keys']),
            ),
          };
        }
        return {method: _fetchMembersAttributes(map)};
      case _MethodKeys.joinPublicGroup:
        if (realSdk != null) {
          await realSdk.joinPublicGroup(map['groupId']?.toString() ?? '');
          return {method: null};
        }
      case _MethodKeys.requestToJoinPublicGroup:
        if (realSdk != null) {
          await realSdk.requestToJoinGroup(
            groupId: map['groupId']?.toString() ?? '',
            reason: map['reason']?.toString(),
          );
          return {method: null};
        }
        return {method: null};
      case _MethodKeys.declineJoinApplication:
        if (realSdk != null) {
          await realSdk.declineGroupJoinRequest(
            groupId: map['groupId']?.toString() ?? '',
            applicant:
                map['applicant']?.toString() ?? map['userId']?.toString() ?? '',
            reason: map['reason']?.toString(),
          );
          return {method: null};
        }
        return {method: null};
      case _MethodKeys.declineInvitationFromGroup:
        if (realSdk != null) {
          await realSdk.declineGroupInvite(
            groupId: map['groupId']?.toString() ?? '',
            invitee: currentUser ?? '',
            reason: map['reason']?.toString(),
          );
          return {method: null};
        }
        return {method: null};
      case _MethodKeys.acceptJoinApplication:
        if (realSdk != null) {
          await realSdk.acceptGroupJoinRequest(
            groupId: map['groupId']?.toString() ?? '',
            applicant:
                map['applicant']?.toString() ?? map['userId']?.toString() ?? '',
          );
          return {method: null};
        }
        _addUserIdToGroup(map);
        return {method: null};
      case _MethodKeys.acceptInvitationFromGroup:
        if (realSdk != null) {
          await realSdk.acceptGroupInvite(
            groupId: map['groupId']?.toString() ?? '',
            invitee: currentUser ?? '',
          );
          return {
            method: await realSdk.getGroup(
              map['groupId']?.toString() ?? '',
            ),
          };
        }
        _joinedGroupIds.add(map['groupId']?.toString() ?? '');
        return {method: _groupById(map['groupId'])};
      case _MethodKeys.updateGroupAvatar:
        if (realSdk != null) {
          final groupId = map['groupId']?.toString() ?? '';
          await realSdk.updateGroupAvatar(
            groupId: groupId,
            avatarUrl:
                map['avatarUrl']?.toString() ?? map['avatar']?.toString() ?? '',
          );
          return {
            method: await realSdk.getGroupInfoDetailed(groupId),
          };
        }
        return {method: _updateGroupAvatar(map)};
      case _MethodKeys.fetchGroupMembersInfo:
        if (realSdk != null) {
          return {
            method: await realSdk.getGroupMembersInfo(
              groupId: map['groupId']?.toString() ?? '',
              limit: _asInt(map['limit']) ?? _asInt(map['pageSize']) ?? 200,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _fetchGroupMembersInfo(map)};
      case _MethodKeys.uploadGroupSharedFile:
        if (realSdk != null) {
          await realSdk.uploadGroupSharedFile(
            groupId: map['groupId']?.toString() ?? '',
            filePath: map['filePath']?.toString() ?? '',
          );
          return {method: null};
        }
        _uploadGroupSharedFile(map);
        return {method: null};
      case _MethodKeys.downloadGroupSharedFile:
        if (realSdk != null) {
          await realSdk.downloadGroupSharedFile(
            groupId: map['groupId']?.toString() ?? '',
            fileId: map['fileId']?.toString() ?? '',
            secret: map['secret']?.toString(),
            fileName: _fileNameFromPath(map['savePath']?.toString() ?? ''),
          );
          return {method: null};
        }
        await _downloadGroupSharedFile(map);
        return {method: null};
      case _MethodKeys.removeGroupSharedFile:
        if (realSdk != null) {
          await realSdk.removeGroupSharedFile(
            groupId: map['groupId']?.toString() ?? '',
            fileId: map['fileId']?.toString() ?? '',
          );
          return {method: null};
        }
        _removeGroupSharedFile(map);
        return {method: null};
      case _MethodKeys.isMemberInGroupMuteList:
        if (realSdk != null) {
          return {
            method: await realSdk.isInGroupMuteList(
              groupId: map['groupId']?.toString() ?? '',
              userId: currentUser ?? '',
            ),
          };
        }
        return {method: _isCurrentUserMuted(map)};
      case _MethodKeys.leaveGroup:
        if (realSdk != null) {
          await realSdk.leaveGroup(map['groupId']?.toString() ?? '');
          return {method: null};
        }
        _joinedGroupIds.remove(map['groupId']?.toString() ?? '');
        return {method: null};
      case _MethodKeys.destroyGroup:
        if (realSdk != null) {
          await realSdk.destroyGroup(map['groupId']?.toString() ?? '');
          return {method: null};
        }
        final groupId = map['groupId']?.toString() ?? '';
        _groups.remove(groupId);
        _joinedGroupIds.remove(groupId);
        _memberAttributes.remove(groupId);
        return {method: null};
      case _MethodKeys.clearAllGroupsFromDB:
        reset();
        return {method: null};
      default:
        return _unsupported('GroupManager', method);
    }
  }

  Future<void> emitGroupEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  Future<void> emitRealGroupEvent(
      String method, Map<String, dynamic> event) async {
    await _handler?.call(MethodCall(method, event));
  }

  void reset() {
    _groupSequence = 0;
    _sharedFileSequence = 0;
    _groups.clear();
    _joinedGroupIds.clear();
    _memberAttributes.clear();
  }

  Map<String, dynamic> _createGroup(Map<String, dynamic> map) {
    _groupSequence += 1;
    final now = DateTime.now().millisecondsSinceEpoch;
    final groupId =
        map['groupId']?.toString() ?? 'web-group-$now-$_groupSequence';
    final inviteMembers = _asStringList(map['inviteMembers']);
    final owner = map['owner']?.toString() ?? currentUser ?? 'web-owner';
    final memberList = <String>{
      owner,
      ...inviteMembers,
    }.toList()
      ..sort();
    final group = {
      'groupId': groupId,
      'name':
          map['groupName']?.toString() ?? map['name']?.toString() ?? groupId,
      'desc': map['desc']?.toString() ?? map['description']?.toString(),
      'owner': owner,
      'memberList': memberList,
      'memberCount': memberList.length,
      'adminList': <String>[],
      'blockList': <String>[],
      'muteList': <String>[],
      'whiteList': <String>[],
      'sharedFiles': <Map<String, dynamic>>[],
      'messageBlocked': false,
      'isAllMemberMuted': false,
      'isDisabled': false,
    };
    _groups[groupId] = group;
    _joinedGroupIds.add(groupId);
    return Map<String, dynamic>.from(group);
  }

  Map<String, dynamic>? _groupById(dynamic rawGroupId) {
    final group = _groups[rawGroupId?.toString()];
    return group == null ? null : Map<String, dynamic>.from(group);
  }

  List<Map<String, dynamic>> _joinedGroups() {
    final groups = _joinedGroupIds
        .map(_groupById)
        .whereType<Map<String, dynamic>>()
        .toList();
    groups.sort((a, b) => (a['groupId'] ?? '')
        .toString()
        .compareTo((b['groupId'] ?? '').toString()));
    return groups;
  }

  List<Map<String, dynamic>> _pagedJoinedGroups(Map<String, dynamic> map) {
    final groups = _joinedGroups();
    final pageSize = _asInt(map['pageSize']) ?? groups.length;
    final pageNum = _asInt(map['pageNum']) ?? 0;
    final start = (pageNum * pageSize).clamp(0, groups.length);
    final end = (start + pageSize).clamp(start, groups.length);
    return groups.sublist(start, end);
  }

  Map<String, dynamic> _publicGroupsPage(Map<String, dynamic> map) {
    final groups = _groups.values
        .map((group) => {
              'groupId': group['groupId'],
              'name': group['name'],
              'desc': group['desc'],
              'owner': group['owner'],
              'memberCount': group['memberCount'],
            })
        .toList();
    groups.sort((a, b) => (a['groupId'] ?? '')
        .toString()
        .compareTo((b['groupId'] ?? '').toString()));
    final pageSize = _asInt(map['pageSize']) ?? groups.length;
    final cursor = _asInt(map['cursor']) ?? 0;
    final end = (cursor + pageSize).clamp(cursor, groups.length);
    return {
      'cursor': end >= groups.length ? '' : end.toString(),
      'list': groups.sublist(cursor, end),
    };
  }

  Map<String, dynamic> _memberListPage(Map<String, dynamic> map) {
    final members = _groupStringList(map, 'memberList');
    final pageSize = _asInt(map['pageSize']) ?? members.length;
    final cursor = _asInt(map['cursor']) ?? 0;
    final end = (cursor + pageSize).clamp(cursor, members.length);
    return {
      'cursor': end >= members.length ? '' : end.toString(),
      'list': members.sublist(cursor, end),
    };
  }

  List<String> _stringListPage(Map<String, dynamic> map, String field) {
    final values = _groupStringList(map, field);
    final pageSize = _asInt(map['pageSize']) ?? values.length;
    final pageNum = _asInt(map['pageNum']) ?? 1;
    final start =
        (((pageNum - 1).clamp(0, pageNum)) * pageSize).clamp(0, values.length);
    final end = (start + pageSize).clamp(start, values.length);
    return values.sublist(start, end);
  }

  Map<String, int> _muteListMap(Map<String, dynamic> map) {
    return {
      for (final userId in _stringListPage(map, 'muteList')) userId: -1,
    };
  }

  List<String> _groupStringList(Map<String, dynamic> map, String field) {
    final group = _groups[map['groupId']?.toString()];
    return group == null ? const [] : _asStringList(group[field]);
  }

  void _updateGroupName(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group != null) {
      group['name'] = map['name']?.toString() ??
          map['subject']?.toString() ??
          group['name'];
    }
  }

  void _updateGroupDescription(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group != null) {
      group['desc'] = map['desc']?.toString() ??
          map['description']?.toString() ??
          group['desc'];
    }
  }

  void _addGroupMembers(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    final members = _stringSet(group['memberList']);
    members.addAll(_asStringList(map['members']));
    group['memberList'] = _sortedStrings(members);
    group['memberCount'] = members.length;
  }

  void _addUserIdToGroup(Map<String, dynamic> map) {
    final userId = map['userId']?.toString();
    if (userId == null || userId.isEmpty) {
      return;
    }
    _addGroupMembers({
      'groupId': map['groupId'],
      'members': [userId],
    });
  }

  void _removeGroupMembers(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    final removed = _asStringList(map['members']).toSet();
    for (final field in const [
      'memberList',
      'adminList',
      'blockList',
      'muteList',
      'whiteList',
    ]) {
      final values = _stringSet(group[field])..removeAll(removed);
      group[field] = _sortedStrings(values);
    }
    group['memberCount'] = _asStringList(group['memberList']).length;
  }

  void _updateGroupOwner(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    final owner = map['owner']?.toString();
    if (group == null || owner == null || owner.isEmpty) {
      return;
    }
    final members = _stringSet(group['memberList'])..add(owner);
    group['owner'] = owner;
    group['memberList'] = _sortedStrings(members);
    group['memberCount'] = members.length;
  }

  void _blockGroupMembers(Map<String, dynamic> map) {
    _addToGroupList(map, 'blockList');
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    final removed = _asStringList(map['members']).toSet();
    for (final field in const [
      'memberList',
      'adminList',
      'muteList',
      'whiteList',
    ]) {
      final values = _stringSet(group[field])..removeAll(removed);
      group[field] = _sortedStrings(values);
    }
    group['memberCount'] = _asStringList(group['memberList']).length;
  }

  void _addToGroupList(Map<String, dynamic> map, String field) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    final values = _stringSet(group[field]);
    values.addAll(_asStringList(map['members']));
    group[field] = _sortedStrings(values);
  }

  void _removeFromGroupList(Map<String, dynamic> map, String field) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    final values = _stringSet(group[field]);
    values.removeAll(_asStringList(map['members']));
    group[field] = _sortedStrings(values);
  }

  void _addGroupListValue(
    Map<String, dynamic> map,
    String field,
    String valueKey,
  ) {
    final group = _groups[map['groupId']?.toString()];
    final value = map[valueKey]?.toString();
    if (group == null || value == null || value.isEmpty) {
      return;
    }
    final values = _stringSet(group[field])..add(value);
    group[field] = _sortedStrings(values);
  }

  void _removeGroupListValue(
    Map<String, dynamic> map,
    String field,
    String valueKey,
  ) {
    final group = _groups[map['groupId']?.toString()];
    final value = map[valueKey]?.toString();
    if (group == null || value == null || value.isEmpty) {
      return;
    }
    final values = _stringSet(group[field])..remove(value);
    group[field] = _sortedStrings(values);
  }

  void _setGroupValue(Map<String, dynamic> map, String field, dynamic value) {
    final group = _groups[map['groupId']?.toString()];
    if (group != null) {
      group[field] = value;
    }
  }

  Map<String, dynamic>? _updateGroupAvatar(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return null;
    }
    group['avatarUrl'] = map['avatarUrl'];
    return Map<String, dynamic>.from(group);
  }

  Map<String, dynamic> _fetchGroupMembersInfo(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    final members = group == null
        ? <Map<String, dynamic>>[]
        : _asStringList(group['memberList'])
            .map((userId) => {
                  'userId': userId,
                  'memberId': userId,
                  'role': userId == group['owner'] ? 0 : 2,
                  'joinTime': DateTime.now().millisecondsSinceEpoch,
                  'joinedTs': DateTime.now().millisecondsSinceEpoch,
                  'namecard': '',
                })
            .toList();
    final limit = _asInt(map['limit']) ?? members.length;
    final cursor = _asInt(map['cursor']) ?? 0;
    final end = (cursor + limit).clamp(cursor, members.length);
    return {
      'cursor': end >= members.length ? '' : end.toString(),
      'list': members.sublist(cursor, end),
    };
  }

  bool _isCurrentUserMuted(Map<String, dynamic> map) {
    return _isCurrentUserInList(map, 'muteList');
  }

  List<Map<String, dynamic>> _groupSharedFilesPage(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    final files = _asMapList(group?['sharedFiles']);
    files.sort((a, b) =>
        (_asInt(a['createTime']) ?? 0).compareTo(_asInt(b['createTime']) ?? 0));
    final pageSize = _asInt(map['pageSize']) ?? files.length;
    final pageNum = _asInt(map['pageNum']) ?? 1;
    final start =
        (((pageNum - 1).clamp(0, pageNum)) * pageSize).clamp(0, files.length);
    final end = (start + pageSize).clamp(start, files.length);
    return files.sublist(start, end);
  }

  void _uploadGroupSharedFile(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    _sharedFileSequence += 1;
    final now = DateTime.now().millisecondsSinceEpoch;
    final filePath = map['filePath']?.toString() ?? '';
    final fileName = _fileNameFromPath(filePath);
    final files = _asMapList(group['sharedFiles']);
    files.add({
      'fileId': 'web-shared-file-$now-$_sharedFileSequence',
      'name':
          fileName.isEmpty ? 'web-shared-file-$_sharedFileSequence' : fileName,
      'owner': currentUser ?? group['owner']?.toString() ?? 'web-owner',
      'createTime': now,
      'fileSize': _asInt(map['fileSize']) ?? _asInt(map['size']) ?? 0,
      'filePath': filePath,
    });
    group['sharedFiles'] = files;
  }

  Future<void> _downloadGroupSharedFile(Map<String, dynamic> map) async {
    final files =
        _asMapList(_groups[map['groupId']?.toString()]?['sharedFiles']);
    final fileId = map['fileId']?.toString();
    final savePath = map['savePath']?.toString();
    if (fileId == null || savePath == null) {
      return;
    }
    for (final file in files) {
      if (file['fileId'] == fileId) {
        file['lastDownloadPath'] = savePath;
        await _triggerBrowserDownload(file, savePath);
        return;
      }
    }
  }

  void _removeGroupSharedFile(Map<String, dynamic> map) {
    final group = _groups[map['groupId']?.toString()];
    if (group == null) {
      return;
    }
    final fileId = map['fileId']?.toString();
    final files = _asMapList(group['sharedFiles'])
      ..removeWhere((file) => file['fileId'] == fileId);
    group['sharedFiles'] = files;
  }

  List<Map<String, dynamic>> _asMapList(dynamic value) {
    if (value is Iterable) {
      return value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return <Map<String, dynamic>>[];
  }

  String _fileNameFromPath(String path) {
    final parts = path.split(RegExp(r'[/\\]'));
    return parts.isEmpty ? path : parts.last;
  }

  Future<void> _triggerBrowserDownload(
    Map<String, dynamic> file,
    String savePath,
  ) async {
    final filePath = file['filePath']?.toString();
    final uri = filePath == null ? null : Uri.tryParse(filePath);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return;
    }
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      return;
    }
    final response = await web.window.fetch(uri.toString().toJS).toDart;
    final blob = await response.blob().toDart;
    final objectUrl = web.URL.createObjectURL(blob);
    try {
      final anchor = web.HTMLAnchorElement()
        ..href = objectUrl
        ..download = _fileNameFromPath(savePath)
        ..style.display = 'none';
      web.document.body?.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      web.URL.revokeObjectURL(objectUrl);
    }
  }

  bool _isCurrentUserInList(Map<String, dynamic> map, String field) {
    final group = _groups[map['groupId']?.toString()];
    final userId = currentUser;
    return group != null &&
        userId != null &&
        _asStringList(group[field]).contains(userId);
  }

  void _setMemberAttributes(Map<String, dynamic> map) {
    final groupId = map['groupId']?.toString() ?? '';
    final userId = _attributeUserId(map);
    if (groupId.isEmpty || userId.isEmpty) {
      return;
    }
    final attrs = _memberAttributes
        .putIfAbsent(groupId, () => {})
        .putIfAbsent(userId, () => {});
    _asMap(map['attributes']).forEach((key, value) {
      if (value != null) {
        attrs[key] = value.toString();
      }
    });
  }

  void _removeMemberAttributes(Map<String, dynamic> map) {
    final attrs =
        _memberAttributes[map['groupId']?.toString()]?[_attributeUserId(map)];
    if (attrs == null) {
      return;
    }
    for (final key in _asStringList(map['keys'])) {
      attrs.remove(key);
    }
  }

  Map<String, String> _fetchMemberAttributes(Map<String, dynamic> map) {
    final attrs =
        _memberAttributes[map['groupId']?.toString()]?[_attributeUserId(map)];
    return attrs == null ? <String, String>{} : Map<String, String>.from(attrs);
  }

  Map<String, Map<String, String>> _fetchMembersAttributes(
    Map<String, dynamic> map,
  ) {
    final result = <String, Map<String, String>>{};
    final keys = _asStringList(map['keys']).toSet();
    final groupAttrs = _memberAttributes[map['groupId']?.toString()] ?? {};
    for (final userId in _asStringList(map['userIds'])) {
      final attrs = Map<String, String>.from(groupAttrs[userId] ?? {});
      result[userId] = keys.isEmpty
          ? attrs
          : {
              for (final entry in attrs.entries)
                if (keys.contains(entry.key)) entry.key: entry.value,
            };
    }
    return result;
  }

  String _attributeUserId(Map<String, dynamic> map) {
    return map['userId']?.toString() ?? currentUser ?? '';
  }
}
