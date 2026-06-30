part of '../client_web.dart';

class ChatThreadManagerWeb extends ChatThreadManager {
  ChatThreadManagerWeb(this._chatManager);

  final ChatManagerWeb _chatManager;
  Future<dynamic> Function(MethodCall call)? _handler;
  String? currentUser;
  int _threadSequence = 0;
  final Map<String, Map<String, dynamic>> _threads = {};
  final Set<String> _joinedThreadIds = {};

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
  }

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    final client = Client.instance;
    final realSdk =
        client is ClientWeb && client._sdkMode == 'real_sdk'
            ? client._realSdk
            : null;
    switch (method) {
      case _MethodKeys.createChatThread:
        if (realSdk != null) {
          return {method: await realSdk.createChatThread(map)};
        }
        return {method: _createThread(map)};
      case _MethodKeys.fetchChatThreadDetail:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatThreadDetail(
              map['threadId']?.toString() ?? '',
            ),
          };
        }
        return {method: _threadById(map['threadId'])};
      case _MethodKeys.fetchJoinedChatThreads:
        if (realSdk != null) {
          return {
            method: await realSdk.getJoinedChatThreads(
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _threadPage(map, joinedOnly: true)};
      case _MethodKeys.fetchChatThreadsWithParentId:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatThreads(
              parentId: map['parentId']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _threadPage(map, parentId: map['parentId'])};
      case _MethodKeys.fetchJoinedChatThreadsWithParentId:
        if (realSdk != null) {
          final page = await realSdk.getJoinedChatThreads(
            pageSize: _asInt(map['pageSize']) ?? 20,
            cursor: map['cursor']?.toString() ?? '',
          );
          final parentId = map['parentId']?.toString() ?? '';
          final list = _asMapList(page['list']).where((item) {
            if (parentId.isEmpty) {
              return true;
            }
            return item['parentId']?.toString() == parentId;
          }).toList();
          return {
            method: {
              'cursor': page['cursor']?.toString() ?? '',
              'list': list,
            },
          };
        }
        return {
          method: _threadPage(
            map,
            parentId: map['parentId'],
            joinedOnly: true,
          ),
        };
      case _MethodKeys.fetchChatThreadMember:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatThreadMembers(
              threadId: map['threadId']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _memberPage(map)};
      case _MethodKeys.fetchLastMessageWithChatThreads:
        if (realSdk != null) {
          return {
            method: await realSdk.getLastMessagesWithChatThreads(
              _asStringList(map['threadIds']),
            ),
          };
        }
        return {method: _lastMessagesForThreads(map)};
      case _MethodKeys.joinChatThread:
        if (realSdk != null) {
          return {
            method: await realSdk.joinChatThread(
              map['threadId']?.toString() ?? '',
            ),
          };
        }
        return {method: _joinThread(map)};
      case _MethodKeys.leaveChatThread:
        if (realSdk != null) {
          await realSdk.leaveChatThread(map['threadId']?.toString() ?? '');
          return {method: null};
        }
        _leaveThread(map);
        return {method: null};
      case _MethodKeys.removeMemberFromChatThread:
        if (realSdk != null) {
          await realSdk.removeChatThreadMember(
            threadId: map['threadId']?.toString() ?? '',
            memberId: map['memberId']?.toString() ?? '',
          );
          return {method: null};
        }
        _removeMember(map);
        return {method: null};
      case _MethodKeys.updateChatThreadSubject:
        if (realSdk != null) {
          await realSdk.changeChatThreadName(
            threadId: map['threadId']?.toString() ?? '',
            name:
                map['name']?.toString() ??
                map['threadName']?.toString() ??
                '',
          );
          return {method: null};
        }
        _updateThreadName(map);
        return {method: null};
      case _MethodKeys.destroyChatThread:
        if (realSdk != null) {
          await realSdk.destroyChatThread(map['threadId']?.toString() ?? '');
          return {method: null};
        }
        final threadId = map['threadId']?.toString() ?? '';
        _threads.remove(threadId);
        _joinedThreadIds.remove(threadId);
        return {method: null};
      default:
        return _unsupported('ChatThreadManager', method);
    }
  }

  Future<void> emitChatThreadEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  void reset() {
    _threadSequence = 0;
    _threads.clear();
    _joinedThreadIds.clear();
  }

  Map<String, dynamic> _createThread(Map<String, dynamic> map) {
    _threadSequence += 1;
    final now = DateTime.now().millisecondsSinceEpoch;
    final threadId =
        map['threadId']?.toString() ?? 'web-thread-$now-$_threadSequence';
    final owner = map['owner']?.toString() ?? currentUser ?? 'web-owner';
    final members = <String>{owner}.toList()..sort();
    final thread = {
      'threadId': threadId,
      'threadName':
          map['name']?.toString() ?? map['threadName']?.toString() ?? threadId,
      'owner': owner,
      'msgId': map['msgId']?.toString() ?? map['messageId']?.toString() ?? '',
      'parentId': map['parentId']?.toString() ?? '',
      'memberCount': members.length,
      'messageCount': 0,
      'createAt': now,
      'memberList': members,
    };
    _threads[threadId] = thread;
    _joinedThreadIds.add(threadId);
    return _publicThread(thread);
  }

  Map<String, dynamic>? _threadById(dynamic rawThreadId) {
    final thread = _threads[rawThreadId?.toString()];
    return thread == null ? null : _publicThread(thread);
  }

  Map<String, dynamic>? _threadByMessageId(dynamic rawMsgId) {
    final msgId = rawMsgId?.toString() ?? '';
    if (msgId.isEmpty) {
      return null;
    }
    for (final thread in _threads.values) {
      if (thread['msgId']?.toString() == msgId) {
        return _publicThread(thread);
      }
    }
    return null;
  }

  Map<String, dynamic>? _joinThread(Map<String, dynamic> map) {
    final thread = _threads[map['threadId']?.toString()];
    if (thread == null) {
      return null;
    }
    final userId = map['userId']?.toString() ?? currentUser;
    if (userId != null && userId.isNotEmpty) {
      final members = _stringSet(thread['memberList'])..add(userId);
      thread['memberList'] = _sortedStrings(members);
      thread['memberCount'] = members.length;
    }
    _joinedThreadIds.add(thread['threadId']?.toString() ?? '');
    return _publicThread(thread);
  }

  void _leaveThread(Map<String, dynamic> map) {
    final threadId = map['threadId']?.toString() ?? '';
    _joinedThreadIds.remove(threadId);
    final thread = _threads[threadId];
    final userId = currentUser;
    if (thread == null || userId == null || userId.isEmpty) {
      return;
    }
    final members = _stringSet(thread['memberList'])..remove(userId);
    thread['memberList'] = _sortedStrings(members);
    thread['memberCount'] = members.length;
  }

  void _removeMember(Map<String, dynamic> map) {
    final thread = _threads[map['threadId']?.toString()];
    final memberId = map['memberId']?.toString();
    if (thread == null || memberId == null || memberId.isEmpty) {
      return;
    }
    final members = _stringSet(thread['memberList'])..remove(memberId);
    thread['memberList'] = _sortedStrings(members);
    thread['memberCount'] = members.length;
  }

  void _updateThreadName(Map<String, dynamic> map) {
    final thread = _threads[map['threadId']?.toString()];
    final name = map['name']?.toString() ?? map['threadName']?.toString();
    if (thread != null && name != null && name.isNotEmpty) {
      thread['threadName'] = name;
    }
  }

  Map<String, dynamic> _threadPage(
    Map<String, dynamic> map, {
    dynamic parentId,
    bool joinedOnly = false,
  }) {
    final parent = parentId?.toString();
    final threads = _threads.values
        .where((thread) {
          if (joinedOnly &&
              !_joinedThreadIds
                  .contains(thread['threadId']?.toString() ?? '')) {
            return false;
          }
          if (parent != null &&
              parent.isNotEmpty &&
              thread['parentId'] != parent) {
            return false;
          }
          return true;
        })
        .map(_publicThread)
        .toList();
    threads.sort((a, b) => (a['threadId'] ?? '')
        .toString()
        .compareTo((b['threadId'] ?? '').toString()));
    final pageSize = _asInt(map['pageSize']) ?? threads.length;
    final cursor = _asInt(map['cursor']) ?? 0;
    final end = (cursor + pageSize).clamp(cursor, threads.length);
    return {
      'cursor': end >= threads.length ? '' : end.toString(),
      'list': threads.sublist(cursor, end),
    };
  }

  Map<String, dynamic> _memberPage(Map<String, dynamic> map) {
    final members =
        _asStringList(_threads[map['threadId']?.toString()]?['memberList']);
    final pageSize = _asInt(map['pageSize']) ?? members.length;
    final cursor = _asInt(map['cursor']) ?? 0;
    final end = (cursor + pageSize).clamp(cursor, members.length);
    return {
      'cursor': end >= members.length ? '' : end.toString(),
      'list': members.sublist(cursor, end),
    };
  }

  Map<String, dynamic> _lastMessagesForThreads(Map<String, dynamic> map) {
    return {
      for (final threadId in _asStringList(map['threadIds']))
        if (_lastMessageForThread(threadId) != null)
          threadId: _lastMessageForThread(threadId),
    };
  }

  Map<String, dynamic>? _lastMessageForThread(String threadId) {
    final msgId = _threads[threadId]?['msgId']?.toString() ?? '';
    if (msgId.isEmpty) {
      return null;
    }
    return _chatManager._messageById(msgId);
  }

  Map<String, dynamic> _publicThread(Map<String, dynamic> thread) {
    return {
      'threadId': thread['threadId'],
      'threadName': thread['threadName'],
      'owner': thread['owner'],
      'msgId': thread['msgId'],
      'parentId': thread['parentId'],
      'memberCount': thread['memberCount'],
      'messageCount': thread['messageCount'],
      'createAt': thread['createAt'],
    };
  }
}
