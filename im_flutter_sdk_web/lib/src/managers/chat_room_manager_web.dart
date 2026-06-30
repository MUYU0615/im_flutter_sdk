part of '../client_web.dart';

class ChatRoomManagerWeb extends ChatRoomManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  String? currentUser;
  int _roomSequence = 0;
  final Map<String, Map<String, dynamic>> _rooms = {};
  final Set<String> _joinedRoomIds = {};
  final Map<String, Map<String, String>> _roomAttributes = {};

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
      case _MethodKeys.createChatRoom:
        if (realSdk != null) {
          return {method: await realSdk.createChatRoom(map)};
        }
        return {method: _createChatRoom(map)};
      case _MethodKeys.fetchPublicChatRoomsFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatRooms(
              pageNum: _asInt(map['pageNum']) ?? 1,
              pageSize: _asInt(map['pageSize']) ?? 20,
            ),
          };
        }
        return {method: _publicRoomsPage(map)};
      case _MethodKeys.fetchChatRoomInfoFromServer:
      case _MethodKeys.getChatRoom:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatRoom(
              map['roomId']?.toString() ?? map['chatRoomId']?.toString() ?? '',
            ),
          };
        }
        return {method: _roomById(map['roomId'])};
      case _MethodKeys.getAllChatRooms:
        if (realSdk != null) {
          return {method: await realSdk.getJoinedChatRooms()};
        }
        return {method: _joinedRooms()};
      case _MethodKeys.joinChatRoom:
        if (realSdk != null) {
          return {
            method: await realSdk.joinChatRoom(
              roomId: map['roomId']?.toString() ?? '',
              leaveOtherRooms: map['leaveOtherRooms'] == true,
              ext: map['ext']?.toString(),
            ),
          };
        }
        return {method: _joinChatRoom(map)};
      case _MethodKeys.leaveChatRoom:
        if (realSdk != null) {
          await realSdk.leaveChatRoom(map['roomId']?.toString() ?? '');
          return {method: null};
        }
        _leaveChatRoom(map);
        return {method: null};
      case _MethodKeys.changeChatRoomSubject:
        if (realSdk != null) {
          await realSdk.modifyChatRoom(
            roomId: map['roomId']?.toString() ?? '',
            name: map['subject']?.toString() ?? map['name']?.toString(),
          );
          return {method: null};
        }
        _setRoomValue(map, 'name', map['subject'] ?? map['name']);
        return {method: null};
      case _MethodKeys.changeChatRoomDescription:
        if (realSdk != null) {
          await realSdk.modifyChatRoom(
            roomId: map['roomId']?.toString() ?? '',
            description:
                map['description']?.toString() ?? map['desc']?.toString(),
          );
          return {method: null};
        }
        _setRoomValue(
          map,
          'desc',
          map['description'] ?? map['desc'],
        );
        return {method: null};
      case _MethodKeys.fetchChatRoomMembers:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatRoomMembers(
              roomId: map['roomId']?.toString() ?? '',
              cursor: map['cursor']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 50,
            ),
          };
        }
        return {method: _memberListPage(map)};
      case _MethodKeys.muteChatRoomMembers:
        if (realSdk != null) {
          await realSdk.muteChatRoomMembers(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['muteMembers'] ?? map['members']),
            duration: _asInt(map['duration']) ?? 60000,
          );
          return {method: null};
        }
        _addToRoomList(map, 'muteList', listKey: 'muteMembers');
        return {method: null};
      case _MethodKeys.unMuteChatRoomMembers:
        if (realSdk != null) {
          await realSdk.unmuteChatRoomMembers(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['unMuteMembers'] ?? map['members']),
          );
          return {method: null};
        }
        _removeFromRoomList(map, 'muteList', listKey: 'unMuteMembers');
        return {method: null};
      case _MethodKeys.changeChatRoomOwner:
        if (realSdk != null) {
          await realSdk.changeChatRoomOwner(
            roomId: map['roomId']?.toString() ?? '',
            newOwner:
                map['newOwner']?.toString() ?? map['owner']?.toString() ?? '',
          );
          return {method: null};
        }
        _changeOwner(map);
        return {method: null};
      case _MethodKeys.addChatRoomAdmin:
        if (realSdk != null) {
          await realSdk.addChatRoomAdmin(
            roomId: map['roomId']?.toString() ?? '',
            admin: map['admin']?.toString() ?? '',
          );
          return {method: null};
        }
        _addRoomListValue(map, 'adminList', 'admin');
        return {method: null};
      case _MethodKeys.removeChatRoomAdmin:
        if (realSdk != null) {
          await realSdk.removeChatRoomAdmin(
            roomId: map['roomId']?.toString() ?? '',
            admin: map['admin']?.toString() ?? '',
          );
          return {method: null};
        }
        _removeRoomListValue(map, 'adminList', 'admin');
        return {method: null};
      case _MethodKeys.fetchChatRoomMuteList:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatRoomMuteList(
              roomId: map['roomId']?.toString() ?? '',
            ),
          };
        }
        return {method: _stringListPage(map, 'muteList')};
      case _MethodKeys.removeChatRoomMembers:
        if (realSdk != null) {
          await realSdk.removeChatRoomMembers(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: null};
        }
        _removeMembers(map);
        return {method: null};
      case _MethodKeys.blockChatRoomMembers:
        if (realSdk != null) {
          await realSdk.blockChatRoomMembers(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: null};
        }
        _blockMembers(map);
        return {method: null};
      case _MethodKeys.unBlockChatRoomMembers:
        if (realSdk != null) {
          await realSdk.unblockChatRoomMembers(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: null};
        }
        _removeFromRoomList(map, 'blockList');
        return {method: null};
      case _MethodKeys.fetchChatRoomBlockList:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatRoomBlockList(
              roomId: map['roomId']?.toString() ?? '',
            ),
          };
        }
        return {method: _stringListPage(map, 'blockList')};
      case _MethodKeys.updateChatRoomAnnouncement:
        if (realSdk != null) {
          await realSdk.updateChatRoomAnnouncement(
            roomId: map['roomId']?.toString() ?? '',
            announcement: map['announcement']?.toString() ?? '',
          );
          return {method: null};
        }
        _setRoomValue(map, 'announcement', map['announcement']);
        return {method: null};
      case _MethodKeys.fetchChatRoomAnnouncement:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchChatRoomAnnouncement(
              map['roomId']?.toString() ?? '',
            ),
          };
        }
        return {method: _rooms[map['roomId']?.toString()]?['announcement']};
      case _MethodKeys.addMembersToChatRoomWhiteList:
        if (realSdk != null) {
          await realSdk.addChatRoomWhiteList(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: null};
        }
        _addToRoomList(map, 'whiteList');
        _updateCurrentUserWhitelistFlag(map);
        return {method: null};
      case _MethodKeys.removeMembersFromChatRoomWhiteList:
        if (realSdk != null) {
          await realSdk.removeChatRoomWhiteList(
            roomId: map['roomId']?.toString() ?? '',
            members: _asStringList(map['members']),
          );
          return {method: null};
        }
        _removeFromRoomList(map, 'whiteList');
        _updateCurrentUserWhitelistFlag(map);
        return {method: null};
      case _MethodKeys.fetchChatRoomWhiteListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatRoomWhiteList(
              map['roomId']?.toString() ?? '',
            ),
          };
        }
        return {method: _roomStringList(map, 'whiteList')};
      case _MethodKeys.isMemberInChatRoomWhiteListFromServer:
        if (realSdk != null) {
          return {
            method: await realSdk.isInChatRoomWhiteList(
              roomId: map['roomId']?.toString() ?? '',
              userId: currentUser ?? '',
            ),
          };
        }
        return {method: _isCurrentUserInList(map, 'whiteList')};
      case _MethodKeys.muteAllChatRoomMembers:
        if (realSdk != null) {
          await realSdk.muteAllChatRoomMembers(
            map['roomId']?.toString() ?? '',
          );
          return {method: null};
        }
        _setRoomValue(map, 'isAllMemberMuted', true);
        return {method: null};
      case _MethodKeys.unMuteAllChatRoomMembers:
        if (realSdk != null) {
          await realSdk.unmuteAllChatRoomMembers(
            map['roomId']?.toString() ?? '',
          );
          return {method: null};
        }
        _setRoomValue(map, 'isAllMemberMuted', false);
        return {method: null};
      case _MethodKeys.fetchChatRoomAttributes:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchChatRoomAttributes(
              roomId: map['roomId']?.toString() ?? '',
              keys: _asStringList(map['keys']),
            ),
          };
        }
        return {method: _fetchAttributes(map)};
      case _MethodKeys.setChatRoomAttributes:
        if (realSdk != null) {
          return {
            method: await realSdk.setChatRoomAttributes(
              roomId: map['roomId']?.toString() ?? '',
              attributes: _asMap(map['attributes']),
              force: map['force'] == true || map['forced'] == true,
              autoDelete:
                  map['autoDelete'] == true || map['deleteWhenLeft'] == true,
            ),
          };
        }
        _setAttributes(map);
        return {method: <String, int>{}};
      case _MethodKeys.removeChatRoomAttributes:
        if (realSdk != null) {
          return {
            method: await realSdk.removeChatRoomAttributes(
              roomId: map['roomId']?.toString() ?? '',
              keys: _asStringList(map['keys']),
              force: map['force'] == true || map['forced'] == true,
            ),
          };
        }
        _removeAttributes(map);
        return {method: <String, int>{}};
      case _MethodKeys.isMemberInChatRoomMuteList:
        if (realSdk != null) {
          return {
            method: await realSdk.isInChatRoomMuteList(
              roomId: map['roomId']?.toString() ?? '',
              userId: currentUser ?? '',
            ),
          };
        }
        return {method: _isCurrentUserInList(map, 'muteList')};
      case _MethodKeys.destroyChatRoom:
        final roomId = map['roomId']?.toString() ?? '';
        if (realSdk != null) {
          await realSdk.destroyChatRoom(roomId);
          return {method: null};
        }
        _rooms.remove(roomId);
        _joinedRoomIds.remove(roomId);
        _roomAttributes.remove(roomId);
        return {method: null};
      default:
        return _unsupported('ChatRoomManager', method);
    }
  }

  Future<void> emitChatRoomEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  Future<void> emitRealChatRoomEvent(
      String method, Map<String, dynamic> event) async {
    await _handler?.call(MethodCall(method, event));
  }

  void reset() {
    _roomSequence = 0;
    _rooms.clear();
    _joinedRoomIds.clear();
    _roomAttributes.clear();
  }

  Map<String, dynamic> _createChatRoom(Map<String, dynamic> map) {
    _roomSequence += 1;
    final now = DateTime.now().millisecondsSinceEpoch;
    final roomId = map['roomId']?.toString() ?? 'web-room-$now-$_roomSequence';
    final owner = map['owner']?.toString() ?? currentUser ?? 'web-owner';
    final memberList = <String>{
      owner,
      ..._asStringList(map['members']),
    }.toList()
      ..sort();
    final room = {
      'roomId': roomId,
      'name': map['subject']?.toString() ?? map['name']?.toString() ?? roomId,
      'desc': map['desc']?.toString() ?? map['description']?.toString(),
      'owner': owner,
      'memberCount': memberList.length,
      'maxUsers': _asInt(map['maxUserCount']) ?? _asInt(map['maxUsers']) ?? 300,
      'adminList': <String>[],
      'memberList': memberList,
      'blockList': <String>[],
      'muteList': <String>[],
      'whiteList': <String>[],
      'announcement': null,
      'isAllMemberMuted': false,
      'permissionType': 0,
      'isInWhitelist': false,
      'createTimestamp': now,
      'muteExpireTimestamp': 0,
    };
    _rooms[roomId] = room;
    _joinedRoomIds.add(roomId);
    return Map<String, dynamic>.from(room);
  }

  Map<String, dynamic> _publicRoomsPage(Map<String, dynamic> map) {
    final rooms = _sortedRooms()
        .map((room) => {
              'roomId': room['roomId'],
              'name': room['name'],
              'desc': room['desc'],
              'owner': room['owner'],
              'memberCount': room['memberCount'],
              'maxUsers': room['maxUsers'],
            })
        .toList();
    final pageNum = _asInt(map['pageNum']) ?? 1;
    final pageSize = _asInt(map['pageSize']) ?? rooms.length;
    final start =
        (((pageNum - 1).clamp(0, pageNum)) * pageSize).clamp(0, rooms.length);
    final end = (start + pageSize).clamp(start, rooms.length);
    return {
      'pageNum': pageNum,
      'pageSize': pageSize,
      'totalSize': rooms.length,
      'list': rooms.sublist(start, end),
    };
  }

  Map<String, dynamic>? _roomById(dynamic rawRoomId) {
    final room = _rooms[rawRoomId?.toString()];
    return room == null ? null : Map<String, dynamic>.from(room);
  }

  List<Map<String, dynamic>> _joinedRooms() {
    final rooms = _joinedRoomIds
        .map(_roomById)
        .whereType<Map<String, dynamic>>()
        .toList();
    rooms.sort((a, b) => (a['roomId'] ?? '')
        .toString()
        .compareTo((b['roomId'] ?? '').toString()));
    return rooms;
  }

  Map<String, dynamic>? _joinChatRoom(Map<String, dynamic> map) {
    final roomId = map['roomId']?.toString() ?? '';
    final room = _rooms[roomId];
    if (room == null) {
      return null;
    }
    if (map['leaveOtherRooms'] == true) {
      _joinedRoomIds.clear();
    }
    _joinedRoomIds.add(roomId);
    final userId = currentUser;
    if (userId != null && userId.isNotEmpty) {
      final members = _stringSet(room['memberList'])..add(userId);
      room['memberList'] = _sortedStrings(members);
      room['memberCount'] = members.length;
    }
    return Map<String, dynamic>.from(room);
  }

  void _leaveChatRoom(Map<String, dynamic> map) {
    final roomId = map['roomId']?.toString() ?? '';
    _joinedRoomIds.remove(roomId);
    final userId = currentUser;
    final room = _rooms[roomId];
    if (room == null || userId == null || userId.isEmpty) {
      return;
    }
    final members = _stringSet(room['memberList'])..remove(userId);
    room['memberList'] = _sortedStrings(members);
    room['memberCount'] = members.length;
  }

  void _setRoomValue(Map<String, dynamic> map, String field, dynamic value) {
    final room = _rooms[map['roomId']?.toString()];
    if (room != null && value != null) {
      room[field] = value;
    }
  }

  void _addToRoomList(
    Map<String, dynamic> map,
    String field, {
    String listKey = 'members',
  }) {
    final room = _rooms[map['roomId']?.toString()];
    if (room == null) {
      return;
    }
    final values = _stringSet(room[field]);
    values.addAll(_asStringList(map[listKey]));
    room[field] = _sortedStrings(values);
  }

  void _removeFromRoomList(
    Map<String, dynamic> map,
    String field, {
    String listKey = 'members',
  }) {
    final room = _rooms[map['roomId']?.toString()];
    if (room == null) {
      return;
    }
    final values = _stringSet(room[field]);
    values.removeAll(_asStringList(map[listKey]));
    room[field] = _sortedStrings(values);
  }

  void _addRoomListValue(
    Map<String, dynamic> map,
    String field,
    String valueKey,
  ) {
    final value = map[valueKey]?.toString();
    if (value == null || value.isEmpty) {
      return;
    }
    _addToRoomList({
      'roomId': map['roomId'],
      'members': [value],
    }, field);
  }

  void _removeRoomListValue(
    Map<String, dynamic> map,
    String field,
    String valueKey,
  ) {
    final value = map[valueKey]?.toString();
    if (value == null || value.isEmpty) {
      return;
    }
    _removeFromRoomList({
      'roomId': map['roomId'],
      'members': [value],
    }, field);
  }

  void _changeOwner(Map<String, dynamic> map) {
    final room = _rooms[map['roomId']?.toString()];
    final newOwner = map['newOwner']?.toString() ?? map['owner']?.toString();
    if (room == null || newOwner == null || newOwner.isEmpty) {
      return;
    }
    final members = _stringSet(room['memberList'])..add(newOwner);
    room['owner'] = newOwner;
    room['memberList'] = _sortedStrings(members);
    room['memberCount'] = members.length;
  }

  void _removeMembers(Map<String, dynamic> map) {
    final room = _rooms[map['roomId']?.toString()];
    if (room == null) {
      return;
    }
    final removed = _asStringList(map['members']).toSet();
    for (final field in const [
      'memberList',
      'adminList',
      'muteList',
      'whiteList',
    ]) {
      final values = _stringSet(room[field])..removeAll(removed);
      room[field] = _sortedStrings(values);
    }
    room['memberCount'] = _asStringList(room['memberList']).length;
    _updateCurrentUserWhitelistFlag(map);
  }

  void _blockMembers(Map<String, dynamic> map) {
    _addToRoomList(map, 'blockList');
    _removeMembers(map);
  }

  List<String> _stringListPage(Map<String, dynamic> map, String field) {
    final values = _roomStringList(map, field);
    final pageSize = _asInt(map['pageSize']) ?? values.length;
    final pageNum = _asInt(map['pageNum']) ?? 1;
    final start =
        (((pageNum - 1).clamp(0, pageNum)) * pageSize).clamp(0, values.length);
    final end = (start + pageSize).clamp(start, values.length);
    return values.sublist(start, end);
  }

  List<String> _roomStringList(Map<String, dynamic> map, String field) {
    final room = _rooms[map['roomId']?.toString()];
    return room == null ? const [] : _asStringList(room[field])
      ..sort();
  }

  bool _isCurrentUserInList(Map<String, dynamic> map, String field) {
    final userId = currentUser;
    if (userId == null || userId.isEmpty) {
      return false;
    }
    return _roomStringList(map, field).contains(userId);
  }

  void _updateCurrentUserWhitelistFlag(Map<String, dynamic> map) {
    final room = _rooms[map['roomId']?.toString()];
    final userId = currentUser;
    if (room == null || userId == null || userId.isEmpty) {
      return;
    }
    room['isInWhitelist'] = _asStringList(room['whiteList']).contains(userId);
  }

  Map<String, String> _fetchAttributes(Map<String, dynamic> map) {
    final attrs = _roomAttributes[map['roomId']?.toString()] ?? {};
    final keys = _asStringList(map['keys']).toSet();
    if (keys.isEmpty) {
      return Map<String, String>.from(attrs);
    }
    return {
      for (final entry in attrs.entries)
        if (keys.contains(entry.key)) entry.key: entry.value,
    };
  }

  void _setAttributes(Map<String, dynamic> map) {
    final roomId = map['roomId']?.toString() ?? '';
    if (roomId.isEmpty) {
      return;
    }
    final attrs = _roomAttributes.putIfAbsent(roomId, () => {});
    _asMap(map['attributes']).forEach((key, value) {
      if (value != null) {
        attrs[key] = value.toString();
      }
    });
  }

  void _removeAttributes(Map<String, dynamic> map) {
    final attrs = _roomAttributes[map['roomId']?.toString()];
    if (attrs == null) {
      return;
    }
    for (final key in _asStringList(map['keys'])) {
      attrs.remove(key);
    }
  }

  Map<String, dynamic> _memberListPage(Map<String, dynamic> map) {
    final members =
        _asStringList(_rooms[map['roomId']?.toString()]?['memberList']);
    final pageSize = _asInt(map['pageSize']) ?? members.length;
    final cursor = _asInt(map['cursor']) ?? 0;
    final end = (cursor + pageSize).clamp(cursor, members.length);
    return {
      'cursor': end >= members.length ? '' : end.toString(),
      'list': members.sublist(cursor, end),
    };
  }

  List<Map<String, dynamic>> _sortedRooms() {
    final rooms =
        _rooms.values.map((room) => Map<String, dynamic>.from(room)).toList();
    rooms.sort((a, b) => (a['roomId'] ?? '')
        .toString()
        .compareTo((b['roomId'] ?? '').toString()));
    return rooms;
  }
}
