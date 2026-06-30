part of '../client_web.dart';

class ConversationManagerWeb extends ConversationManager {
  ConversationManagerWeb(this._chatManager);

  final ChatManagerWeb _chatManager;
  Future<dynamic> Function(MethodCall call)? _handler;

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
  }

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    final realSdk = _realSdk;
    switch (method) {
      case _MethodKeys.getUnreadMsgCount:
        if (realSdk != null) {
          final conversation = await realSdk.getServerConversation(
            convId: _convId(map),
            type: _conversationType(map),
          );
          return {method: _asInt(conversation?['unreadCount']) ?? 0};
        }
        return {method: _chatManager.unreadCountForConversation(map)};
      case _MethodKeys.getLatestMessage:
        if (realSdk != null) {
          return {method: await _latestRealMessage(realSdk, map)};
        }
        return {method: _chatManager.latestMessageForConversation(map)};
      case _MethodKeys.getLatestMessageFromOthers:
        if (realSdk != null) {
          return {
            method: await _latestRealMessage(
              realSdk,
              map,
              fromOthersOnly: true,
            ),
          };
        }
        return {
          method: _chatManager.latestMessageForConversation(
            map,
            fromOthersOnly: true,
          )
        };
      case _MethodKeys.markMessageAsRead:
        _chatManager.markMessageAsReadInConversation(map);
        return {method: null};
      case _MethodKeys.markAllMessagesAsRead:
        _chatManager.markAllMessagesAsReadInConversation(map);
        return {method: null};
      case _MethodKeys.syncConversationExt:
        _chatManager.syncConversationExt(map);
        return {method: null};
      case _MethodKeys.removeMessage:
        _chatManager.removeMessageInConversation(map);
        return {method: null};
      case _MethodKeys.clearAllMessages:
        _chatManager.clearMessagesInConversation(map);
        return {method: null};
      case _MethodKeys.insertMessage:
      case _MethodKeys.appendMessage:
        _chatManager.storeMessageInConversation(map);
        return {method: null};
      case _MethodKeys.updateConversationMessage:
        _chatManager.storeMessageInConversation(map);
        return {method: null};
      case _MethodKeys.loadMsgWithId:
        if (realSdk != null) {
          return {method: await _loadRealMessageWithId(realSdk, map)};
        }
        return {method: _chatManager.loadMessageInConversation(map)};
      case _MethodKeys.loadMsgWithStartId:
        if (realSdk != null) {
          return {
            method: await _realMessagesFromStartId(
              realSdk,
              {...map, '__method': method},
            ),
          };
        }
        return {
          method: _chatManager.loadMessagesFromStartIdInConversation(map),
        };
      case _MethodKeys.loadMsgWithKeywords:
        if (realSdk != null) {
          return {
            method: await _realMessagesWithKeywords(
              realSdk,
              {...map, '__method': method},
            ),
          };
        }
        return {
          method: _chatManager.loadMessagesWithKeywordsInConversation(map),
        };
      case _MethodKeys.loadMsgWithMsgType:
        if (realSdk != null) {
          return {
            method: await _realMessagesWithType(
              realSdk,
              {...map, '__method': method},
            ),
          };
        }
        return {
          method: _chatManager.loadMessagesWithTypeInConversation(map),
        };
      case _MethodKeys.loadMsgWithTime:
        if (realSdk != null) {
          return {
            method: await _realMessagesWithTime(
              realSdk,
              {...map, '__method': method},
            ),
          };
        }
        return {
          method: _chatManager.loadMessagesWithTimeInConversation(map),
        };
      case _MethodKeys.deleteMessageByIds:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesByIds(
            convId: _convId(map),
            type: _conversationType(map),
            msgIds: _asStringList(map['messageIds'] ?? map['msgIds']),
          );
          return {method: null};
        }
        _chatManager.deleteMessagesByIdsInConversation(map);
        return {method: null};
      case _MethodKeys.deleteMessagesWithTs:
        _chatManager.deleteMessagesWithTsInConversation(map);
        return {method: null};
      case _MethodKeys.removeMsgFromServerWithTimeStamp:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesBefore(
            convId: _convId(map),
            type: _conversationType(map),
            timestamp: _asInt(map['timestamp']) ??
                _asInt(map['timeStamp']) ??
                _asInt(map['beforeTs']) ??
                0,
          );
          return {method: null};
        }
        _chatManager.removeMessagesFromServerWithTimestampInConversation(map);
        return {method: null};
      case _MethodKeys.messageCount:
        if (realSdk != null) {
          final messages = await _realMessages(realSdk, map);
          return {method: messages.length};
        }
        return {method: _chatManager.messageCountForConversation(map)};
      default:
        return _unsupported('ConversationManager', method);
    }
  }

  Future<void> emitConversationEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  RealWebSdkClient? get _realSdk {
    final client = Client.instance;
    if (client is ClientWeb && client._sdkMode == 'real_sdk') {
      return client._realSdk;
    }
    return null;
  }

  String _convId(Map<String, dynamic> map) {
    return map['convId']?.toString() ??
        map['conversationId']?.toString() ??
        '';
  }

  int _conversationType(Map<String, dynamic> map) {
    return _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
  }

  Future<List<Map<String, dynamic>>> _realMessages(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map,
  ) async {
    final convId = _convId(map);
    final type = _conversationType(map);
    final pageSize = _asInt(map['count']) ?? _asInt(map['pageSize']) ?? 20;
    final cursor = map['cursor']?.toString() ??
        map['startMsgId']?.toString() ??
        '';
    final result = await realSdk.fetchHistoryMessages(
      convId: convId,
      type: type,
      pageSize: pageSize,
      cursor: cursor,
    );
    final messages = _asMapList(result['list']);
    realSdk.recordDebugEvent('conversation_history', {
      'convId': convId,
      'type': type,
      'pageSize': pageSize,
      'cursor': cursor,
      'count': messages.length,
      'method': map['__method']?.toString() ?? '',
    });
    return messages;
  }

  List<Map<String, dynamic>> _sortByTimeAscending(
    Iterable<Map<String, dynamic>> messages,
  ) {
    final sorted = messages.map((item) => Map<String, dynamic>.from(item)).toList()
      ..sort((a, b) {
        final aTime = _asInt(a['serverTime']) ?? _asInt(a['localTime']) ?? 0;
        final bTime = _asInt(b['serverTime']) ?? _asInt(b['localTime']) ?? 0;
        return aTime.compareTo(bTime);
      });
    return sorted;
  }

  Future<Map<String, dynamic>?> _latestRealMessage(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map, {
    bool fromOthersOnly = false,
  }) async {
    final messages = await _realMessages(realSdk, map);
    final filtered = messages.where((message) {
      if (!fromOthersOnly) return true;
      return _asInt(message['direction']) == 1;
    }).toList()
      ..sort((a, b) {
        final aTime = _asInt(a['serverTime']) ?? _asInt(a['localTime']) ?? 0;
        final bTime = _asInt(b['serverTime']) ?? _asInt(b['localTime']) ?? 0;
        return bTime.compareTo(aTime);
      });
    return filtered.isEmpty ? null : filtered.first;
  }

  Future<Map<String, dynamic>?> _loadRealMessageWithId(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map,
  ) async {
    final msgId = map['msgId']?.toString() ?? '';
    if (msgId.isEmpty) return null;
    final messages = await _realMessages(realSdk, map);
    for (final message in messages) {
      if (message['msgId']?.toString() == msgId) {
        return message;
      }
    }
    return null;
  }

  Future<List<Map<String, dynamic>>> _realMessagesFromStartId(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map,
  ) async {
    final messages = _sortByTimeAscending(await _realMessages(realSdk, map));
    final startId = map['startId']?.toString() ?? '';
    final count = _asInt(map['count']) ?? 20;
    final direction = _asInt(map['direction']) ?? 0;
    var selected = messages;
    if (startId.isNotEmpty) {
      final index = messages.indexWhere(
        (message) => message['msgId']?.toString() == startId,
      );
      if (index >= 0) {
        selected = direction == 0
            ? messages.sublist(0, index).reversed.toList()
            : messages.sublist(index + 1);
      }
    } else if (direction == 0) {
      selected = messages.reversed.toList();
    }
    return selected.take(count).toList();
  }

  Future<List<Map<String, dynamic>>> _realMessagesWithKeywords(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map,
  ) async {
    final keyword = map['keywords']?.toString() ?? '';
    final count = _asInt(map['count']) ?? 20;
    return _sortByTimeAscending(await _realMessages(realSdk, map))
        .where((message) {
          final body = _asMap(message['body']);
          final content = body['content']?.toString() ?? '';
          return keyword.isEmpty || content.contains(keyword);
        })
        .take(count)
        .toList();
  }

  Future<List<Map<String, dynamic>>> _realMessagesWithType(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map,
  ) async {
    final msgType = _asInt(map['msgType']);
    final count = _asInt(map['count']) ?? 20;
    return _sortByTimeAscending(await _realMessages(realSdk, map))
        .where((message) {
          if (msgType == null) return true;
          final body = _asMap(message['body']);
          return _asInt(body['type']) == msgType;
        })
        .take(count)
        .toList();
  }

  Future<List<Map<String, dynamic>>> _realMessagesWithTime(
    RealWebSdkClient realSdk,
    Map<String, dynamic> map,
  ) async {
    final start = _asInt(map['startTime']) ?? 0;
    final end = _asInt(map['endTime']);
    final count = _asInt(map['count']) ?? 20;
    return _sortByTimeAscending(await _realMessages(realSdk, map))
        .where((message) {
          final time = _asInt(message['serverTime']) ??
              _asInt(message['localTime']) ??
              0;
          return time >= start && (end == null || time <= end);
        })
        .take(count)
        .toList();
  }
}
