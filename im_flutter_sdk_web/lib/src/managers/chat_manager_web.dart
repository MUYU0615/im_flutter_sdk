part of '../client_web.dart';

class ChatManagerWeb extends ChatManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  int _handlerInstallCount = 0;
  ChatThreadManagerWeb? chatThreadManager;
  int _messageSequence = 0;
  final Map<String, Map<String, dynamic>> _messages = {};
  final Map<String, Map<String, dynamic>> _conversations = {};
  final Map<String, Set<String>> _messageReactions = {};
  final Map<String, Map<String, dynamic>> _messagePins = {};
  final Map<String, List<Map<String, dynamic>>> _groupAcks = {};
  final List<Map<String, dynamic>> _pendingRealTextMessages = [];
  final List<Map<String, dynamic>> _pendingRealSuccessMessages = [];

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
    _handlerInstallCount += 1;
    final client = Client.instance;
    if (client is ClientWeb) {
      client._realSdk?.recordExternalDebugEvent(
        'chat_manager_update_native_handler',
        {
          'installCount': _handlerInstallCount,
          'hasHandler': _handler != null,
          'handlerHashCode': _handler.hashCode,
        },
      );
    }
  }

  bool get hasNativeHandler => _handler != null;
  int get handlerInstallCount => _handlerInstallCount;
  int? get handlerHashCode => _handler?.hashCode;

  Future<void> emitRealTextMessage(Map<String, dynamic> message) async {
    _pendingRealTextMessages.add(Map<String, dynamic>.from(message));
    final client = Client.instance;
    Future<dynamic> Function(MethodCall call)? handler = _handler;
    if (client is ClientWeb) {
      handler ??= client._handler;
      client._realSdk?.recordExternalDebugEvent(
        'chat_manager_emit_real_text_message_begin',
        {
          'msgId': message['msgId'],
          'from': message['from'],
          'to': message['to'],
          'bodyType': _asMap(message['body'])['type'],
          'hasHandler': _handler != null,
          'hasClientHandler': client._handler != null,
          'handlerInstallCount': _handlerInstallCount,
          'managerHandlerHashCode': _handler?.hashCode,
          'clientHandlerHashCode': client._handler?.hashCode,
        },
      );
    }
    if (handler != null) {
      final effectiveHandler = handler;
      await Future.microtask(
        () => effectiveHandler(MethodCall('realWebTextMessage', message)),
      );
    }
    if (client is ClientWeb) {
      client._realSdk?.recordExternalDebugEvent(
        'chat_manager_emit_real_text_message_end',
        {
          'msgId': message['msgId'],
        },
      );
    }
  }

  Future<void> emitRealMessageSuccess(Map<String, dynamic> message) async {
    _pendingRealSuccessMessages.add(Map<String, dynamic>.from(message));
    final client = Client.instance;
    Future<dynamic> Function(MethodCall call)? handler = _handler;
    if (client is ClientWeb) {
      handler ??= client._handler;
    }
    if (handler != null) {
      final effectiveHandler = handler;
      await Future.microtask(
        () => effectiveHandler(MethodCall('realWebMessageSuccess', message)),
      );
    }
  }

  Future<void> emitRealDeliveredAckMessage(Map<String, dynamic> message) async {
    await _handler?.call(MethodCall('realWebDeliveredAckMessage', message));
  }

  Future<void> emitRealReadAckMessage(Map<String, dynamic> message) async {
    await _handler?.call(MethodCall('realWebReadAckMessage', message));
  }

  Future<void> emitRealModifiedMessage(Map<String, dynamic> message) async {
    await _handler?.call(MethodCall('realWebModifiedMessage', message));
  }

  Future<void> emitRealRecallMessage(Map<String, dynamic> message) async {
    await _handler?.call(MethodCall('realWebRecallMessage', message));
  }

  Future<void> emitRealMessagePinChanged(Map<String, dynamic> event) async {
    await _handler?.call(MethodCall('realWebMessagePinChanged', event));
  }

  Future<void> emitRealReactionChanged(Map<String, dynamic> event) async {
    await _handler?.call(MethodCall('messageReactionDidChange', event));
  }

  Future<void> emitRealConversationUpdated(Map<String, dynamic> event) async {
    await _handler?.call(MethodCall('onConversationUpdate', event));
  }

  Future<void> emitRealConversationRead(Map<String, dynamic> event) async {
    await _handler?.call(MethodCall('onConversationHasRead', event));
  }

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    final client = Client.instance;
    final realSdk = client is ClientWeb && client._sdkMode == 'real_sdk'
        ? client._realSdk
        : null;
    switch (method) {
      case _MethodKeys.sendMessage:
        final message = _normalizeMessageInput(map);
        if (!_isSupportedMessage(message)) {
          return _unsupported('ChatManager', method);
        }
        if (realSdk != null) {
          return {method: await _sendRealMessage(realSdk, message)};
        }
        return {method: _storeMessage(_normalizeSentMessage(message))};
      case 'getPendingRealTextMessages':
        final list = _pendingRealTextMessages
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        return {method: list};
      case 'clearPendingRealTextMessages':
        _pendingRealTextMessages.clear();
        return {method: true};
      case 'getPendingRealSuccessMessages':
        final list = _pendingRealSuccessMessages
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        return {method: list};
      case 'clearPendingRealSuccessMessages':
        _pendingRealSuccessMessages.clear();
        return {method: true};
      case _MethodKeys.sendMessageWithType:
        final message = _normalizeMessageInput(map);
        if (!_isSupportedMessage(message)) {
          return _unsupported('ChatManager', method);
        }
        if (realSdk != null) {
          return {method: await _sendRealMessage(realSdk, message)};
        }
        return {method: _storeMessage(_normalizeSentMessage(message))};
      case _MethodKeys.resendMessage:
        if (realSdk != null) {
          final message =
              _asMap(map['message']).isEmpty ? map : _asMap(map['message']);
          return {method: await _resendRealMessage(realSdk, message)};
        }
        return {method: _resendMessage(map)};
      case _MethodKeys.ackGroupMessageRead:
        if (realSdk != null) {
          await realSdk.ackGroupMessageRead(
            msgId: map['msgId']?.toString() ?? '',
            groupId:
                map['group_id']?.toString() ?? map['groupId']?.toString() ?? '',
            content: map['content']?.toString(),
          );
          return {method: 1};
        }
        return {method: _ackGroupMessageRead(map)};
      case _MethodKeys.ackMessageRead:
        if (realSdk != null) {
          await realSdk.ackMessageRead(
            msgId: map['msgId']?.toString() ?? '',
            to: map['to']?.toString() ?? '',
          );
          return {method: 1};
        }
        return {method: 1};
      case _MethodKeys.ackConversationRead:
        if (realSdk != null) {
          final conversationId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          await realSdk.markConversationRead(
            conversationId: conversationId,
            type: type,
          );
          return {method: 1};
        }
        return {method: _ackConversationRead(map)};
      case _MethodKeys.recallMessage:
        if (realSdk != null) {
          await realSdk.recallMessage(
            msgId: map['msgId']?.toString() ?? '',
            ext: map['ext']?.toString() ?? '',
          );
          return {method: true};
        }
        return {method: _recallMessage(map['msgId'])};
      case _MethodKeys.getMessage:
        if (realSdk != null) {
          final msgId = map['msgId']?.toString() ?? '';
          if (msgId.isEmpty) {
            return {method: null};
          }
          final remembered = realSdk.messageById(msgId);
          if (remembered != null) {
            return {method: remembered};
          }
          final convId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          if (convId.isNotEmpty) {
            final history = await realSdk.fetchHistoryMessages(
              convId: convId,
              type: type,
              pageSize: _asInt(map['pageSize']) ?? 50,
              cursor: '',
            );
            for (final message in _asMapList(history['list'])) {
              if (message['msgId']?.toString() == msgId) {
                return {method: message};
              }
            }
          }
          final conversations =
              await realSdk.getServerConversations(pageSize: 100);
          for (final conversation in conversations) {
            final conversationId = conversation['convId']?.toString() ?? '';
            final conversationType = _asInt(conversation['type']) ?? 0;
            if (conversationId.isEmpty) {
              continue;
            }
            final history = await realSdk.fetchHistoryMessages(
              convId: conversationId,
              type: conversationType,
              pageSize: 50,
              cursor: '',
            );
            for (final message in _asMapList(history['list'])) {
              if (message['msgId']?.toString() == msgId) {
                return {method: message};
              }
            }
          }
          return {method: null};
        }
        return {method: _messageById(map['msgId'])};
      case _MethodKeys.updateChatMessage:
        if (realSdk != null) {
          final message =
              _asMap(map['message']).isEmpty ? map : _asMap(map['message']);
          return {
            method: await realSdk.modifyMessage(
              msgId: message['msgId']?.toString() ?? '',
              body: _asMap(message['body'] ?? message['msgBody']),
            ),
          };
        }
        return {method: _updateMessage(_asMap(map['message']))};
      case _MethodKeys.downloadAttachment:
        if (realSdk != null) {
          await realSdk.downloadAttachment(message: _downloadMessage(map));
          return {method: null};
        }
        await _downloadMessageMedia(map, thumbnail: false);
        return {method: null};
      case _MethodKeys.downloadBigImage:
        if (realSdk != null) {
          await realSdk.downloadAttachment(
            message: _downloadMessage(map),
            bigImageOnly: true,
          );
          return {method: null};
        }
        await _downloadMessageMedia(map, thumbnail: false);
        return {method: null};
      case _MethodKeys.downloadThumbnail:
        if (realSdk != null) {
          await realSdk.downloadAttachment(
            message: _downloadMessage(map),
            thumbnailOnly: true,
          );
          return {method: null};
        }
        await _downloadMessageMedia(map, thumbnail: true);
        return {method: null};
      case _MethodKeys.downloadMessageAttachmentInCombine:
        await _downloadMessageMedia(map, thumbnail: false);
        return {method: null};
      case _MethodKeys.downloadMessageThumbnailInCombine:
        await _downloadMessageMedia(map, thumbnail: true);
        return {method: null};
      case _MethodKeys.modifyMessage:
        if (realSdk != null) {
          return {
            method: await realSdk.modifyMessage(
              msgId: map['msgId']?.toString() ?? '',
              body: _asMap(map['body'] ?? map['msgBody']),
            ),
          };
        }
        return {method: _modifyMessage(map)};
      case _MethodKeys.translateMessage:
        if (realSdk != null) {
          return {
            method: await realSdk.translateTextMessage(
              message: _asMap(map['message']),
              targetLanguages: _asStringList(map['targetLanguages']),
            ),
          };
        }
        return {method: _translateMessage(map)};
      case _MethodKeys.importMessages:
        for (final message in _asMapList(map['messages'])) {
          _storeMessage(_normalizeSentMessage(message));
        }
        return {method: true};
      case _MethodKeys.saveMessage:
        final message = _asMap(map['message']);
        if (message.isEmpty) {
          return {method: null};
        }
        return {method: _storeMessage(_normalizeSentMessage(message))};
      case _MethodKeys.setVoiceMessageListened:
        final message = _asMap(map['message']);
        final msgId = message['msgId']?.toString() ?? '';
        final existing = _messageById(msgId);
        if (existing == null) {
          return {method: false};
        }
        existing['isListened'] = true;
        _storeMessage(existing);
        return {method: true};
      case _MethodKeys.getConversation:
        if (realSdk != null) {
          return {
            method: await realSdk.getServerConversation(
              convId: map['convId']?.toString() ??
                  map['conversationId']?.toString() ??
                  '',
              type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            ),
          };
        }
        return {method: _getConversation(map)};
      case _MethodKeys.getThreadConversation:
        if (realSdk != null) {
          final threadId = map['convId']?.toString() ?? '';
          final thread = await realSdk.getChatThreadDetail(threadId);
          if (thread == null) {
            return {method: null};
          }
          return {
            method: {
              'convId': threadId,
              'type': 0,
              'unreadCount': 0,
              'isThread': true,
              'isPinned': false,
              'pinnedTime': 0,
              'marks': <int>[],
            },
          };
        }
        return {method: _getThreadConversation(map)};
      case _MethodKeys.loadAllConversations:
      case _MethodKeys.getAllConversations:
        if (realSdk != null) {
          return {method: await realSdk.getServerConversations()};
        }
        return {method: _conversationList()};
      case _MethodKeys.getConversationsByType:
        if (realSdk != null) {
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          final all = await realSdk.getServerConversations();
          return {
            method: _asMapList(all)
                .where((item) => (_asInt(item['type']) ?? 0) == type)
                .toList(),
          };
        }
        return {
          method: _conversationList().where((item) {
            return (_asInt(item['type']) ?? 0) ==
                (_asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0);
          }).toList(),
        };
      case _MethodKeys.cleanConversationsMemoryCache:
        return {method: true};
      case _MethodKeys.getAllConversationsBySort:
      case _MethodKeys.getConversationsFromServer:
        if (realSdk != null) {
          return {method: await realSdk.getServerConversations()};
        }
        return {method: _conversationList(sortByLatestMessage: true)};
      case _MethodKeys.fetchConversationsFromServerWithPage:
        if (realSdk != null) {
          return {
            method: await realSdk.getServerConversationsPage(
              pageNum: _asInt(map['pageNum']) ?? 1,
              pageSize: _asInt(map['pageSize']) ?? 20,
            ),
          };
        }
        return {method: _conversationPage(map)};
      case _MethodKeys.getConversationsFromServerWithCursor:
        if (realSdk != null) {
          return {
            method: await realSdk.getServerConversationsWithCursor(
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _conversationCursorPage(map)};
      case _MethodKeys.fetchConversationsByOptions:
        if (realSdk != null) {
          final mark = _asInt(map['mark']);
          final pinned = map['pinned'] == true;
          if (mark != null || pinned) {
            return {
              method: {
                'cursor': '',
                'list': await realSdk.getConversationList(
                  mark: mark,
                  isPinned: pinned ? true : null,
                ),
              },
            };
          }
          return {
            method: await realSdk.getServerConversationsWithCursor(
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _conversationCursorPage(map)};
      case _MethodKeys.getPinnedConversationsFromServerWithCursor:
        if (realSdk != null) {
          return {
            method: await realSdk.getPinnedServerConversationsWithCursor(
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _conversationCursorPage(map, pinnedOnly: true)};
      case _MethodKeys.pinConversation:
        if (realSdk != null) {
          return {
            method: await realSdk.pinConversation(
              convId: map['convId']?.toString() ??
                  map['conversationId']?.toString() ??
                  '',
              type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
              isPinned: map['isPinned'] == true,
            ),
          };
        }
        return {method: _pinConversation(map)};
      case _MethodKeys.addRemoteAndLocalConversationsMark:
        if (realSdk != null) {
          await realSdk.addConversationMark(
            conversationIds: _asStringList(map['convIds']),
            mark: _asInt(map['mark']) ?? 0,
          );
          return {method: true};
        }
        return {method: _updateConversationMarks(map, add: true)};
      case _MethodKeys.deleteRemoteAndLocalConversationsMark:
        if (realSdk != null) {
          await realSdk.removeConversationMark(
            conversationIds: _asStringList(map['convIds']),
            mark: _asInt(map['mark']) ?? 0,
          );
          return {method: true};
        }
        return {method: _updateConversationMarks(map, add: false)};
      case _MethodKeys.deleteConversation:
        if (realSdk != null) {
          await realSdk.deleteConversation(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            deleteRoam: map['deleteMessages'] == true,
          );
          return {method: true};
        }
        return {method: _deleteConversation(map)};
      case _MethodKeys.deleteRemoteConversation:
        if (realSdk != null) {
          await realSdk.deleteConversation(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            deleteRoam: map['isDeleteRemoteMessage'] == true ||
                map['deleteMessages'] == true,
          );
          return {method: null};
        }
        _deleteConversation({
          'convId': map['convId'],
          'deleteMessages': map['isDeleteRemoteMessage'] == true,
        });
        return {method: null};
      case _MethodKeys.removeMessagesFromServerWithMsgIds:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesByIds(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            msgIds: _asStringList(map['msgIds']),
          );
          return {method: null};
        }
        _removeMessagesByIds(map['msgIds']);
        return {method: null};
      case _MethodKeys.conversationDeleteServerMessageWithIds:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesByIds(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            msgIds: _asStringList(map['msgIds']),
          );
          return {method: null};
        }
        _removeMessagesByIds(map['msgIds'], convId: map['convId']);
        return {method: null};
      case _MethodKeys.removeMessagesFromServerWithTs:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesBefore(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            timestamp: _asInt(map['timestamp']) ?? 0,
          );
          return {method: null};
        }
      case _MethodKeys.conversationDeleteServerMessageWithTime:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesBefore(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            timestamp: _asInt(map['timestamp']) ?? 0,
          );
          return {method: null};
        }
        _deleteMessagesBefore(map['timestamp']);
        return {method: null};
      case _MethodKeys.deleteAllMessageAndConversation:
        if (realSdk != null) {
          await realSdk.clearAllMessagesAndConversations();
          reset();
          return {method: true};
        }
        reset();
        return {method: true};
      case _MethodKeys.asyncFetchGroupAcks:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchGroupAcks(
              msgId: map['msgId']?.toString() ?? '',
              groupId: map['group_id']?.toString() ??
                  map['groupId']?.toString() ??
                  '',
              pageSize: _asInt(map['pageSize']) ?? 20,
            ),
          };
        }
        return {method: _fetchGroupAcks(map)};
      case _MethodKeys.markAllChatMsgAsRead:
        if (realSdk != null) {
          final conversations = await realSdk.getServerConversations();
          for (final conversation in conversations) {
            final convId = conversation['convId']?.toString() ?? '';
            final type = _asInt(conversation['type']) ?? 0;
            if (convId.isEmpty) {
              continue;
            }
            await realSdk.markConversationRead(
              conversationId: convId,
              type: type,
            );
          }
          return {method: 1};
        }
        for (final conversation in _conversations.values) {
          conversation['unreadCount'] = 0;
        }
        return {method: 1};
      case _MethodKeys.getUnreadMessageCount:
        if (realSdk != null) {
          final conversations = await realSdk.getServerConversations();
          return {
            method: conversations.fold<int>(
              0,
              (sum, item) => sum + (_asInt(item['unreadCount']) ?? 0),
            ),
          };
        }
        return {
          method: _conversations.values.fold<int>(
            0,
            (sum, item) => sum + (_asInt(item['unreadCount']) ?? 0),
          ),
        };
      case _MethodKeys.deleteMessagesBeforeTimestamp:
        if (realSdk != null) {
          await realSdk.removeHistoryMessagesBefore(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            timestamp: _asInt(map['timestamp']) ?? 0,
          );
          return {method: null};
        }
        _deleteMessagesBefore(map['timestamp']);
        return {method: null};
      case _MethodKeys.fetchHistoryMessages:
      case _MethodKeys.fetchHistoryMessagesByOptions:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchHistoryMessages(
              convId: map['convId']?.toString() ??
                  map['conversationId']?.toString() ??
                  '',
              type: _asInt(map['type']) ?? 0,
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ??
                  map['startMsgId']?.toString() ??
                  '',
            ),
          };
        }
        return {method: _fetchHistory(map)};
      case _MethodKeys.searchChatMsgFromDB:
      case _MethodKeys.searchMsgsByOptions:
      case _MethodKeys.conversationSearchMsgsByOptions:
        if (realSdk != null) {
          final keywords =
              map['keywords']?.toString() ?? map['keyword']?.toString() ?? '';
          final convId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          final matched = <Map<String, dynamic>>[];
          Future<void> collectFromConversation(
              String id, int conversationType) async {
            final history = await realSdk.fetchHistoryMessages(
              convId: id,
              type: conversationType,
              pageSize: _asInt(map['pageSize'] ?? map['count']) ?? 100,
              cursor: '',
            );
            matched.addAll(
              _asMapList(history['list']).where((message) {
                final body = _asMap(message['body']);
                final content = body['content']?.toString() ?? '';
                return keywords.isEmpty || content.contains(keywords);
              }),
            );
          }

          if (convId.isNotEmpty) {
            await collectFromConversation(convId, type);
          } else {
            final conversations =
                await realSdk.getServerConversations(pageSize: 100);
            for (final conversation in conversations) {
              final id = conversation['convId']?.toString() ?? '';
              final conversationType = _asInt(conversation['type']) ?? 0;
              if (id.isEmpty) {
                continue;
              }
              await collectFromConversation(id, conversationType);
            }
          }
          return {method: matched};
        }
        return {method: _searchMessages(map)};
      case _MethodKeys.addReaction:
        if (realSdk != null) {
          await realSdk.addReaction(
            msgId: map['msgId']?.toString() ?? '',
            reaction: map['reaction']?.toString() ?? '',
          );
          return {method: true};
        }
        return {method: _addReaction(map)};
      case _MethodKeys.removeReaction:
        if (realSdk != null) {
          await realSdk.removeReaction(
            msgId: map['msgId']?.toString() ?? '',
            reaction: map['reaction']?.toString() ?? '',
          );
          return {method: true};
        }
        return {method: _removeReaction(map)};
      case _MethodKeys.fetchReactionList:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchReactionList(
              msgIds: _asStringList(map['msgIds']),
              chatType: _asInt(map['chatType']) ?? 0,
              groupId: map['groupId']?.toString(),
            ),
          };
        }
        return {method: _fetchReactionList(map)};
      case _MethodKeys.fetchReactionDetail:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchReactionDetail(
              msgId: map['msgId']?.toString() ?? '',
              reaction: map['reaction']?.toString() ?? '',
              cursor: map['cursor']?.toString() ?? '',
              pageSize: _asInt(map['pageSize']) ?? 20,
            ),
          };
        }
        return {method: _fetchReactionDetail(map)};
      case _MethodKeys.reportMessage:
        if (realSdk != null) {
          await realSdk.reportMessage(
            msgId: map['msgId']?.toString() ?? '',
            tag: map['tag']?.toString() ?? '',
            reason: map['reason']?.toString() ?? '',
          );
          return {method: true};
        }
        return {method: true};
      case _MethodKeys.pinMessage:
        if (realSdk != null) {
          await realSdk.pinMessage(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            msgId: map['msgId']?.toString() ?? '',
          );
          return {method: true};
        }
        return {method: _pinMessage(map)};
      case _MethodKeys.unpinMessage:
        if (realSdk != null) {
          await realSdk.unpinMessage(
            convId: map['convId']?.toString() ??
                map['conversationId']?.toString() ??
                '',
            type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            msgId: map['msgId']?.toString() ?? '',
          );
          return {method: true};
        }
        return {method: _unpinMessage(map)};
      case _MethodKeys.getPinInfo:
        if (realSdk != null) {
          return {
            method: await realSdk.getPinInfo(
              convId: map['convId']?.toString() ??
                  map['conversationId']?.toString() ??
                  '',
              type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
              msgId: map['msgId']?.toString() ?? '',
            ),
          };
        }
        return {method: _messagePins[map['msgId']?.toString()]};
      case _MethodKeys.pinnedMessages:
        if (realSdk != null) {
          return {
            method: await realSdk.pinnedMessages(
              convId: map['convId']?.toString() ??
                  map['conversationId']?.toString() ??
                  '',
              type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
            ),
          };
        }
        return {method: _pinnedMessages(map)};
      case _MethodKeys.fetchPinnedMessages:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchPinnedMessages(
              convId: map['convId']?.toString() ??
                  map['conversationId']?.toString() ??
                  '',
              type: _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0,
              pageSize: _asInt(map['pageSize']) ?? 20,
              cursor: map['cursor']?.toString() ?? '',
            ),
          };
        }
        return {method: _fetchPinnedMessages(map)};
      case _MethodKeys.conversationRemindType:
        if (realSdk != null) {
          final convId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          final client = Client.instance;
          if (client is ClientWeb) {
            final cached =
                client._pushManager.remindTypeForConversation(convId, type);
            if (cached != 0) {
              return {method: cached};
            }
          }
          return {
            method: await realSdk.getConversationRemindType(
              conversationId: convId,
              type: type,
            ),
          };
        }
        return {method: 0};
      case _MethodKeys.conversationGetLocalMessageCount:
        if (realSdk != null) {
          final convId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          if (convId.isEmpty) {
            return {method: 0};
          }
          final history = await realSdk.fetchHistoryMessages(
            convId: convId,
            type: type,
            pageSize: _asInt(map['pageSize']) ?? 100,
            cursor: '',
          );
          return {method: _asMapList(history['list']).length};
        }
        return {method: _conversationMessageCount(map)};
      case _MethodKeys.syncSilentModels:
        return {method: true};
      case _MethodKeys.loadConversationMessagesWithKeyword:
        if (realSdk != null) {
          final convId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          final keywords =
              map['keywords']?.toString() ?? map['keyword']?.toString() ?? '';
          if (convId.isEmpty) {
            return {method: <Map<String, dynamic>>[]};
          }
          final history = await realSdk.fetchHistoryMessages(
            convId: convId,
            type: type,
            pageSize: _asInt(map['pageSize'] ?? map['count']) ?? 100,
            cursor: '',
          );
          final matched = _asMapList(history['list']).where((message) {
            final body = _asMap(message['body']);
            final content = body['content']?.toString() ?? '';
            return keywords.isEmpty || content.contains(keywords);
          }).toList();
          return {method: matched};
        }
        return {method: _searchMessages(map)};
      case _MethodKeys.fetchSupportLanguages:
        if (realSdk != null) {
          return {method: await realSdk.getSupportedLanguages()};
        }
        return {
          method: ['en', 'zh-Hans', 'ja', 'ko'],
        };
      case _MethodKeys.loadMessagesWithIds:
        if (realSdk != null) {
          final msgIds = _asStringList(map['msgIds']);
          if (msgIds.isEmpty) {
            return {method: <Map<String, dynamic>>[]};
          }
          final convId = map['convId']?.toString() ??
              map['conversationId']?.toString() ??
              '';
          final type =
              _asInt(map['type']) ?? _asInt(map['conversationType']) ?? 0;
          final matched = <Map<String, dynamic>>[];
          final seen = <String>{};
          Future<void> collectFromConversation(
              String id, int conversationType) async {
            final history = await realSdk.fetchHistoryMessages(
              convId: id,
              type: conversationType,
              pageSize: _asInt(map['pageSize']) ?? 100,
              cursor: '',
            );
            for (final message in _asMapList(history['list'])) {
              final msgId = message['msgId']?.toString() ?? '';
              if (msgIds.contains(msgId) && seen.add(msgId)) {
                matched.add(message);
              }
            }
          }

          if (convId.isNotEmpty) {
            await collectFromConversation(convId, type);
          } else {
            final conversations =
                await realSdk.getServerConversations(pageSize: 100);
            for (final conversation in conversations) {
              final id = conversation['convId']?.toString() ?? '';
              final conversationType = _asInt(conversation['type']) ?? 0;
              if (id.isEmpty) {
                continue;
              }
              await collectFromConversation(id, conversationType);
              if (seen.length == msgIds.length) {
                break;
              }
            }
          }
          return {method: matched};
        }
        return {method: _messagesWithIds(map['msgIds'])};
      case _MethodKeys.getMessageCount:
        if (realSdk != null) {
          final conversations =
              await realSdk.getServerConversations(pageSize: 100);
          var total = 0;
          for (final conversation in conversations) {
            final convId = conversation['convId']?.toString() ?? '';
            final type = _asInt(conversation['type']) ?? 0;
            if (convId.isEmpty) {
              continue;
            }
            final history = await realSdk.fetchHistoryMessages(
              convId: convId,
              type: type,
              pageSize: 100,
              cursor: '',
            );
            total += _asMapList(history['list']).length;
          }
          return {method: total};
        }
        return {method: _messages.length};
      case _MethodKeys.downloadAndParseCombineMessage:
        if (realSdk != null) {
          final message = _downloadMessage(map);
          return {
            method: await realSdk.downloadAndParseCombineMessage(message)
          };
        }
        return {method: _downloadAndParseCombineMessage(map)};
      default:
        return _unsupported('ChatManager', method);
    }
  }

  Future<void> emitChatEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  void reset() {
    _messages.clear();
    _conversations.clear();
    _messageReactions.clear();
    _messagePins.clear();
    _groupAcks.clear();
  }

  bool _isSupportedMessage(Map<String, dynamic> message) {
    final body = message['body'];
    if (body is Map<String, dynamic>) {
      return body['type'] == 0 || body['type'] == 6 || body['type'] == 8;
    }
    if (body is Map) {
      return body['type'] == 0 || body['type'] == 6 || body['type'] == 8;
    }
    return false;
  }

  Map<String, dynamic> _normalizeMessageInput(Map<String, dynamic> message) {
    if (message['body'] is Map) {
      return message;
    }
    final payload = _asMap(message['payload']);
    final targetId =
        payload['targetId']?.toString() ?? message['to']?.toString() ?? '';
    final type = message['type']?.toString() ?? '';
    if (type == 'combine') {
      return {
        ...message,
        'to': targetId,
        'convId': message['convId']?.toString() ?? targetId,
        'chatType': message['chatType'] ?? 0,
        'direction': message['direction'] ?? 0,
        'body': {
          'type': 8,
          'title': payload['title']?.toString() ?? '',
          'summary': payload['summary']?.toString() ?? '',
          'compatibleText': payload['compatibleText']?.toString() ?? '',
          'messageList':
              _asStringList(payload['msgIds'] ?? payload['messageList']),
        },
      };
    }
    if (type == 'cmd') {
      final action = payload['action']?.toString() ?? '';
      return {
        ...message,
        'to': targetId,
        'convId': message['convId']?.toString() ?? targetId,
        'chatType': message['chatType'] ?? 0,
        'direction': message['direction'] ?? 0,
        'body': {'type': 6, 'action': action},
      };
    }
    if (type != 'txt') {
      return message;
    }
    final content = payload['content']?.toString() ?? '';
    return {
      ...message,
      'to': targetId,
      'convId': message['convId']?.toString() ?? targetId,
      'chatType': message['chatType'] ?? 0,
      'direction': message['direction'] ?? 0,
      'body': {'type': 0, 'content': content},
    };
  }

  Future<Map<String, dynamic>> _sendRealMessage(
    dynamic realSdk,
    Map<String, dynamic> message,
  ) async {
    final body = _asMap(message['body']);
    final type = _asInt(body['type']) ?? 0;
    if (type == 8) {
      return await realSdk.sendCombineMessage(message);
    }
    if (type == 6) {
      return await realSdk.sendCmdMessage(message);
    }
    return await realSdk.sendTextMessage(message);
  }

  Map<String, dynamic> _normalizeSentMessage(Map<String, dynamic> message) {
    final now = DateTime.now().millisecondsSinceEpoch;
    _messageSequence += 1;
    final to = message['to'];
    return {
      'from': message['from'],
      'to': to,
      'body': _asMap(message['body']),
      'direction': message['direction'] ?? 0,
      'hasRead': message['hasRead'] ?? true,
      'hasReadAck': message['hasReadAck'] ?? false,
      'hasDeliverAck': message['hasDeliverAck'] ?? false,
      'needGroupAck': message['needGroupAck'] ?? false,
      'msgId': message['msgId'] ?? 'web-msg-$now-$_messageSequence',
      'convId': message['convId'] ?? to,
      'chatType': message['chatType'] ?? 0,
      'localTime': message['localTime'] ?? now,
      'serverTime': message['serverTime'] ?? now,
      'status': 2,
      'isThread': message['isThread'] ?? false,
      'isContentReplaced': message['isContentReplaced'] ?? false,
      if (message['streamChunk'] != null)
        'streamChunk': _asMap(message['streamChunk']),
      'deliverOnlineOnly': message['deliverOnlineOnly'] ?? false,
    };
  }

  Map<String, dynamic> _storeMessage(Map<String, dynamic> message) {
    final stored = Map<String, dynamic>.from(message);
    final msgId = stored['msgId']?.toString() ?? '';
    _messages[msgId] = stored;
    final convId =
        stored['convId']?.toString() ?? stored['to']?.toString() ?? '';
    if (convId.isNotEmpty) {
      _conversations[convId] = {
        'convId': convId,
        'type': stored['chatType'] ?? 0,
        'unreadCount': _conversations[convId]?['unreadCount'] ?? 0,
        'latestMessage': stored,
      };
    }
    return Map<String, dynamic>.from(stored);
  }

  Map<String, dynamic>? _messageById(dynamic rawMsgId) {
    final message = _messages[rawMsgId?.toString()];
    return message == null ? null : Map<String, dynamic>.from(message);
  }

  Map<String, dynamic>? _resendMessage(Map<String, dynamic> map) {
    final message =
        _asMap(map['message']).isEmpty ? map : _asMap(map['message']);
    final msgId = message['msgId']?.toString() ?? '';
    final existing = _messageById(msgId);
    if (existing == null) {
      return null;
    }
    existing['status'] = 2;
    return _storeMessage(existing);
  }

  Future<Map<String, dynamic>> _resendRealMessage(
    dynamic realSdk,
    Map<String, dynamic> message,
  ) async {
    final normalized = _normalizeMessageInput(message);
    return _sendRealMessage(realSdk, normalized);
  }

  int _ackConversationRead(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final conversation = _conversations[convId];
    if (conversation != null) {
      conversation['unreadCount'] = 0;
    }
    return 1;
  }

  bool _recallMessage(dynamic rawMsgId) {
    final msgId = rawMsgId?.toString() ?? '';
    final message = _messages.remove(msgId);
    _clearMessageSideState(msgId);
    if (message != null) {
      _rebuildConversations();
    }
    return message != null;
  }

  Map<String, dynamic> _updateMessage(Map<String, dynamic> message) {
    final msgId = message['msgId']?.toString() ?? '';
    final normalized = _normalizeSentMessage(message);
    if (msgId.isNotEmpty) {
      normalized['msgId'] = msgId;
    }
    return _storeMessage(normalized);
  }

  Future<void> _downloadMessageMedia(
    Map<String, dynamic> map, {
    required bool thumbnail,
  }) async {
    final message = _downloadMessage(map);
    final body = _asMap(message['body']);
    final remotePath = thumbnail
        ? body['thumbnailRemotePath']?.toString()
        : body['remotePath']?.toString();
    final fallbackName = thumbnail
        ? body['thumbnailLocalPath']?.toString()
        : body['localPath']?.toString();
    final displayName =
        body['displayName']?.toString() ?? fallbackName ?? 'web-media';
    await _triggerChatBrowserDownload(remotePath, displayName);
  }

  Map<String, dynamic> _downloadMessage(Map<String, dynamic> map) {
    final message = _asMap(map['message']);
    if (message.isNotEmpty) {
      return message;
    }
    final msgId = map['msgId']?.toString();
    if (msgId == null || msgId.isEmpty) {
      return const <String, dynamic>{};
    }
    return _messageById(msgId) ?? const <String, dynamic>{};
  }

  List<Map<String, dynamic>> _downloadAndParseCombineMessage(
    Map<String, dynamic> map,
  ) {
    final message = _downloadMessage(map);
    final body = _asMap(message['body']);
    final msgIds = _asStringList(body['messageList']);
    return msgIds.map(_messageById).whereType<Map<String, dynamic>>().toList();
  }

  Future<void> _triggerChatBrowserDownload(
    String? remotePath,
    String fileName,
  ) async {
    final uri = remotePath == null ? null : Uri.tryParse(remotePath);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return;
    }
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      return;
    }
    final response = await web.window.fetch(uri.toString().toJS).toDart;
    if (!response.ok) {
      throw StateError(
        'Download failed with HTTP ${response.status} ${response.statusText}',
      );
    }
    final blob = await response.blob().toDart;
    final objectUrl = web.URL.createObjectURL(blob);
    try {
      final anchor = web.HTMLAnchorElement()
        ..href = objectUrl
        ..download = _chatFileNameFromPath(fileName)
        ..style.display = 'none';
      web.document.body?.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      web.URL.revokeObjectURL(objectUrl);
    }
  }

  String _chatFileNameFromPath(String path) {
    final parts = path.split(RegExp(r'[/\\]'));
    return parts.isEmpty ? path : parts.last;
  }

  Map<String, dynamic>? _modifyMessage(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final existing = _messageById(msgId);
    if (existing == null) {
      return null;
    }
    final body = _asMap(map['body']);
    if (body.isNotEmpty) {
      existing['body'] = body;
      existing['isContentReplaced'] = true;
    }
    return _storeMessage(existing);
  }

  Map<String, dynamic> _translateMessage(Map<String, dynamic> map) {
    final message = _asMap(map['message']);
    final msgId = message['msgId']?.toString() ?? '';
    final existing = _messageById(msgId) ?? message;
    final body = _asMap(existing['body']);
    final content = body['content']?.toString() ?? '';
    final translations = <String, dynamic>{};
    for (final language in _asStringList(map['targetLanguages'])) {
      translations[language] = content;
    }
    existing['translations'] = translations;
    if (msgId.isNotEmpty) {
      _storeMessage(existing);
    }
    return Map<String, dynamic>.from(existing);
  }

  Map<String, dynamic>? _getConversation(Map<String, dynamic> map) {
    final convId = map['convId']?.toString() ?? '';
    if (convId.isEmpty) {
      return null;
    }
    final existing = _conversations[convId];
    if (existing != null) {
      return Map<String, dynamic>.from(existing);
    }
    if (map['createIfNeed'] == true) {
      final created = {
        'convId': convId,
        'type': map['type'] ?? 0,
        'unreadCount': 0,
      };
      _conversations[convId] = created;
      return Map<String, dynamic>.from(created);
    }
    return null;
  }

  Map<String, dynamic>? _getThreadConversation(Map<String, dynamic> map) {
    final threadId = map['convId']?.toString() ?? '';
    if (threadId.isEmpty || chatThreadManager?._threadById(threadId) == null) {
      return null;
    }
    return {
      'convId': threadId,
      'type': 0,
      'unreadCount': 0,
      'isThread': true,
      'isPinned': false,
      'pinnedTime': 0,
      'marks': <int>[],
    };
  }

  List<Map<String, dynamic>> _conversationList(
      {bool sortByLatestMessage = false}) {
    final items = _conversations.values
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    if (sortByLatestMessage) {
      items.sort((a, b) {
        final aTime = _conversationLatestTime(a);
        final bTime = _conversationLatestTime(b);
        final byTime = bTime.compareTo(aTime);
        if (byTime != 0) {
          return byTime;
        }
        return (a['convId'] ?? '')
            .toString()
            .compareTo((b['convId'] ?? '').toString());
      });
    } else {
      items.sort((a, b) => (a['convId'] ?? '')
          .toString()
          .compareTo((b['convId'] ?? '').toString()));
    }
    return items;
  }

  int _conversationLatestTime(Map<String, dynamic> conversation) {
    final message = _asMap(conversation['latestMessage']);
    return _asInt(message['serverTime']) ?? _asInt(message['localTime']) ?? 0;
  }

  List<Map<String, dynamic>> _conversationPage(Map<String, dynamic> map) {
    final pageSize = _asInt(map['pageSize']) ?? 20;
    final pageNum = _asInt(map['pageNum']) ?? 1;
    final all = _conversationList(sortByLatestMessage: true);
    final start = ((pageNum < 1 ? 1 : pageNum) - 1) * pageSize;
    if (start >= all.length) {
      return <Map<String, dynamic>>[];
    }
    final end = (start + pageSize).clamp(start, all.length);
    return all.sublist(start, end);
  }

  Map<String, dynamic> _conversationCursorPage(
    Map<String, dynamic> map, {
    bool pinnedOnly = false,
  }) {
    final pageSize = _asInt(map['pageSize']) ?? 20;
    final cursor = map['cursor']?.toString() ?? '';
    final start = int.tryParse(cursor) ?? 0;
    final all = _conversationList(sortByLatestMessage: true)
        .where((item) => !pinnedOnly || item['isPinned'] == true)
        .toList();
    final end = (start + pageSize).clamp(start, all.length);
    return {
      'cursor': end >= all.length ? '' : end.toString(),
      'list': all.sublist(start, end),
    };
  }

  bool _pinConversation(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    if (convId.isEmpty) {
      return false;
    }
    final conversation = _conversations.putIfAbsent(
      convId,
      () => {'convId': convId, 'type': map['type'] ?? 0, 'unreadCount': 0},
    );
    conversation['isPinned'] = map['isPinned'] == true;
    return true;
  }

  bool _updateConversationMarks(Map<String, dynamic> map, {required bool add}) {
    final mark = _asInt(map['mark']);
    if (mark == null) {
      return false;
    }
    for (final convId in _asStringList(map['convIds'])) {
      final conversation = _conversations.putIfAbsent(
        convId,
        () => {'convId': convId, 'type': map['type'] ?? 0, 'unreadCount': 0},
      );
      final marks = _asIntList(conversation['marks']).toSet();
      if (add) {
        marks.add(mark);
      } else {
        marks.remove(mark);
      }
      conversation['marks'] = marks.toList()..sort();
    }
    return true;
  }

  bool _deleteConversation(Map<String, dynamic> map) {
    final convId = map['convId']?.toString() ?? '';
    _conversations.remove(convId);
    if (map['deleteMessages'] == true) {
      final removedMsgIds = _messages.entries
          .where((entry) => entry.value['convId']?.toString() == convId)
          .map((entry) => entry.key)
          .toList();
      _messages.removeWhere((msgId, _) => removedMsgIds.contains(msgId));
      for (final msgId in removedMsgIds) {
        _clearMessageSideState(msgId);
      }
    }
    return true;
  }

  void _deleteMessagesBefore(dynamic timestamp) {
    final limit = _asInt(timestamp);
    if (limit == null) {
      return;
    }
    final removedMsgIds = _messages.entries
        .where((entry) {
          final message = entry.value;
          final time = _asInt(message['serverTime']) ??
              _asInt(message['localTime']) ??
              0;
          return time < limit;
        })
        .map((entry) => entry.key)
        .toList();
    _messages.removeWhere((msgId, _) => removedMsgIds.contains(msgId));
    for (final msgId in removedMsgIds) {
      _clearMessageSideState(msgId);
    }
    _rebuildConversations();
  }

  void _removeMessagesByIds(dynamic ids, {dynamic convId}) {
    final expectedConvId = convId?.toString() ?? '';
    for (final msgId in _asStringList(ids)) {
      final message = _messages[msgId];
      if (expectedConvId.isEmpty ||
          message?['convId']?.toString() == expectedConvId) {
        _messages.remove(msgId);
        _clearMessageSideState(msgId);
      }
    }
    _rebuildConversations();
  }

  Map<String, dynamic> _fetchHistory(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final pageSize = _asInt(map['pageSize']) ?? 20;
    final cursor = map['cursor']?.toString() ?? '';
    final all = _messages.values
        .where((message) =>
            convId.isEmpty || message['convId']?.toString() == convId)
        .map((message) => Map<String, dynamic>.from(message))
        .toList()
      ..sort((a, b) => (_asInt(a['serverTime']) ?? 0)
          .compareTo(_asInt(b['serverTime']) ?? 0));
    final start = int.tryParse(cursor) ?? 0;
    final end = (start + pageSize).clamp(start, all.length);
    return {
      'cursor': end >= all.length ? '' : end.toString(),
      'list': all.sublist(start, end),
    };
  }

  List<Map<String, dynamic>> _searchMessages(Map<String, dynamic> map) {
    final keyword =
        map['keywords']?.toString() ?? map['keyword']?.toString() ?? '';
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final hits = _messages.values
        .where((message) {
          if (convId.isNotEmpty && message['convId']?.toString() != convId) {
            return false;
          }
          final body = _asMap(message['body']);
          final content = body['content']?.toString() ?? '';
          return keyword.isEmpty || content.contains(keyword);
        })
        .map((message) => Map<String, dynamic>.from(message))
        .toList();
    hits.sort((a, b) =>
        (_asInt(a['serverTime']) ?? 0).compareTo(_asInt(b['serverTime']) ?? 0));
    return hits;
  }

  List<Map<String, dynamic>> _messagesWithIds(dynamic ids) {
    return _asStringList(ids)
        .map((id) => _messageById(id))
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  bool _addReaction(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final reaction = map['reaction']?.toString() ?? '';
    if (!_messages.containsKey(msgId) || reaction.isEmpty) {
      return false;
    }
    _messageReactions.putIfAbsent(msgId, () => <String>{}).add(reaction);
    return true;
  }

  bool _removeReaction(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final reaction = map['reaction']?.toString() ?? '';
    _messageReactions[msgId]?.remove(reaction);
    return true;
  }

  Map<String, dynamic> _fetchReactionList(Map<String, dynamic> map) {
    return {
      for (final msgId in _asStringList(map['msgIds']))
        msgId: (_messageReactions[msgId] ?? <String>{})
            .map((reaction) => {'reaction': reaction, 'count': 1})
            .toList()
    };
  }

  List<Map<String, dynamic>> _messageReactionList(dynamic rawMsgId) {
    final msgId = rawMsgId?.toString() ?? '';
    return (_messageReactions[msgId] ?? <String>{})
        .map(
          (reaction) => {
            'reaction': reaction,
            'count': 1,
            'isAddedBySelf': true,
            'userList': ['web-user'],
          },
        )
        .toList();
  }

  int _ackGroupMessageRead(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    if (msgId.isEmpty || !_messages.containsKey(msgId)) {
      return 1;
    }
    final from = map['from']?.toString() ?? 'web-user';
    final existing = _groupAcks[msgId] ?? <Map<String, dynamic>>[];
    final ack = {
      'ack_id': 'web-ack-$msgId-${existing.length + 1}',
      'msgId': msgId,
      'from': from,
      'content': map['content']?.toString(),
      'count': 1,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    _groupAcks[msgId] = [...existing, ack];
    return 1;
  }

  int _groupAckCount(dynamic rawMsgId) {
    final msgId = rawMsgId?.toString() ?? '';
    return _groupAcks[msgId]?.length ?? 0;
  }

  Map<String, dynamic> _fetchGroupAcks(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final all = (_groupAcks[msgId] ?? <Map<String, dynamic>>[])
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    final startAckId = map['ack_id']?.toString() ?? '';
    var start = 0;
    if (startAckId.isNotEmpty) {
      final index = all.indexWhere((item) => item['ack_id'] == startAckId);
      start = index < 0 ? all.length : index + 1;
    }
    final pageSize = _asInt(map['pageSize']) ?? all.length;
    final safePageSize = pageSize <= 0 ? all.length : pageSize;
    final end = (start + safePageSize).clamp(start, all.length);
    return {
      'cursor': end >= all.length ? '' : all[end - 1]['ack_id'],
      'list': all.sublist(start, end),
    };
  }

  Map<String, dynamic> _fetchReactionDetail(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final reaction = map['reaction']?.toString() ?? '';
    final hasReaction = _messageReactions[msgId]?.contains(reaction) == true;
    return {
      'cursor': '',
      'list': hasReaction
          ? [
              {'reaction': reaction, 'userId': 'web-user', 'count': 1}
            ]
          : <Map<String, dynamic>>[],
    };
  }

  bool _pinMessage(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final message = _messageById(msgId);
    if (message == null) {
      return false;
    }
    _messagePins[msgId] = {
      'msgId': msgId,
      'convId': message['convId'],
      'operatorId': message['from'],
      'pinTime': DateTime.now().millisecondsSinceEpoch,
    };
    return true;
  }

  bool _unpinMessage(Map<String, dynamic> map) {
    _messagePins.remove(map['msgId']?.toString() ?? '');
    return true;
  }

  List<Map<String, dynamic>> _pinnedMessages(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    return _messagePins.keys
        .map(_messageById)
        .whereType<Map<String, dynamic>>()
        .where((message) =>
            convId.isEmpty || message['convId']?.toString() == convId)
        .toList();
  }

  Map<String, dynamic> _fetchPinnedMessages(Map<String, dynamic> map) {
    final pageSize = _asInt(map['pageSize']) ?? 20;
    final cursor = map['cursor']?.toString() ?? '';
    final start = int.tryParse(cursor) ?? 0;
    final all = _pinnedMessages(map);
    final end = (start + pageSize).clamp(start, all.length);
    return {
      'cursor': end >= all.length ? '' : end.toString(),
      'list': all.sublist(start, end),
    };
  }

  int _conversationMessageCount(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    return _messages.values
        .where((message) =>
            convId.isEmpty || message['convId']?.toString() == convId)
        .length;
  }

  int unreadCountForConversation(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    if (convId.isEmpty) {
      return 0;
    }
    return _asInt(_conversations[convId]?['unreadCount']) ?? 0;
  }

  int messageCountForConversation(Map<String, dynamic> map) {
    return _conversationMessageCount(map);
  }

  Map<String, dynamic>? latestMessageForConversation(
    Map<String, dynamic> map, {
    bool fromOthersOnly = false,
  }) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final messages = _messages.values
        .where((message) {
          if (convId.isNotEmpty && message['convId']?.toString() != convId) {
            return false;
          }
          if (fromOthersOnly && _asInt(message['direction']) != 1) {
            return false;
          }
          return true;
        })
        .map((message) => Map<String, dynamic>.from(message))
        .toList()
      ..sort((a, b) {
        final aTime = _asInt(a['serverTime']) ?? _asInt(a['localTime']) ?? 0;
        final bTime = _asInt(b['serverTime']) ?? _asInt(b['localTime']) ?? 0;
        return bTime.compareTo(aTime);
      });
    return messages.isEmpty ? null : messages.first;
  }

  void markMessageAsReadInConversation(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final message = _messages[msgId];
    if (message != null) {
      message['hasRead'] = true;
    }
  }

  void markAllMessagesAsReadInConversation(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    for (final message in _messages.values) {
      if (convId.isEmpty || message['convId']?.toString() == convId) {
        message['hasRead'] = true;
      }
    }
    final conversation = _conversations[convId];
    if (conversation != null) {
      conversation['unreadCount'] = 0;
    }
  }

  void syncConversationExt(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    if (convId.isEmpty) {
      return;
    }
    final conversation = _conversations.putIfAbsent(
      convId,
      () => {'convId': convId, 'type': map['type'] ?? 0, 'unreadCount': 0},
    );
    conversation['ext'] = _asMap(map['ext']);
  }

  void removeMessageInConversation(Map<String, dynamic> map) {
    final msgId = map['msgId']?.toString() ?? '';
    final expectedConvId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final message = _messages[msgId];
    if (message == null) {
      return;
    }
    if (expectedConvId.isEmpty ||
        message['convId']?.toString() == expectedConvId) {
      _messages.remove(msgId);
      _clearMessageSideState(msgId);
      _rebuildConversations();
    }
  }

  void clearMessagesInConversation(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final removedMsgIds = _messages.entries
        .where((entry) =>
            convId.isEmpty || entry.value['convId']?.toString() == convId)
        .map((entry) => entry.key)
        .toList();
    _messages.removeWhere((msgId, _) => removedMsgIds.contains(msgId));
    for (final msgId in removedMsgIds) {
      _clearMessageSideState(msgId);
    }
    _rebuildConversations();
  }

  void storeMessageInConversation(Map<String, dynamic> map) {
    final message = _asMap(map['msg']).isEmpty ? map : _asMap(map['msg']);
    if (message.isEmpty) {
      return;
    }
    final normalized = _normalizeSentMessage({
      ...message,
      if (message['convId'] == null && map['convId'] != null)
        'convId': map['convId'],
      if (message['chatType'] == null && map['type'] != null)
        'chatType': map['type'],
    });
    _storeMessage(normalized);
  }

  Map<String, dynamic>? loadMessageInConversation(Map<String, dynamic> map) {
    final expectedConvId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final message = _messageById(map['msgId']);
    if (message == null) {
      return null;
    }
    if (expectedConvId.isNotEmpty &&
        message['convId']?.toString() != expectedConvId) {
      return null;
    }
    return message;
  }

  List<Map<String, dynamic>> loadMessagesFromStartIdInConversation(
    Map<String, dynamic> map,
  ) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final startId = map['startId']?.toString() ?? '';
    final count = _asInt(map['count']) ?? 20;
    final direction = _asInt(map['direction']) ?? 0;
    final all = _messagesInConversation(convId);
    var selected = all;
    if (startId.isNotEmpty) {
      final index = all.indexWhere((message) => message['msgId'] == startId);
      if (index >= 0) {
        selected = direction == 0
            ? all.sublist(0, index).reversed.toList()
            : all.sublist(index + 1);
      }
    } else if (direction == 0) {
      selected = all.reversed.toList();
    }
    return selected.take(count).toList();
  }

  List<Map<String, dynamic>> loadMessagesWithKeywordsInConversation(
    Map<String, dynamic> map,
  ) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final keyword = map['keywords']?.toString() ?? '';
    final count = _asInt(map['count']) ?? 20;
    return _messagesInConversation(convId)
        .where((message) {
          final body = _asMap(message['body']);
          final content = body['content']?.toString() ?? '';
          return keyword.isEmpty || content.contains(keyword);
        })
        .take(count)
        .toList();
  }

  List<Map<String, dynamic>> loadMessagesWithTypeInConversation(
    Map<String, dynamic> map,
  ) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final msgType = _asInt(map['msgType']);
    final count = _asInt(map['count']) ?? 20;
    return _messagesInConversation(convId)
        .where((message) {
          if (msgType == null) {
            return true;
          }
          final body = _asMap(message['body']);
          return _asInt(body['type']) == msgType;
        })
        .take(count)
        .toList();
  }

  List<Map<String, dynamic>> loadMessagesWithTimeInConversation(
    Map<String, dynamic> map,
  ) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final start = _asInt(map['startTime']) ?? 0;
    final end = _asInt(map['endTime']);
    final count = _asInt(map['count']) ?? 20;
    return _messagesInConversation(convId)
        .where((message) {
          final time = _asInt(message['serverTime']) ??
              _asInt(message['localTime']) ??
              0;
          return time >= start && (end == null || time <= end);
        })
        .take(count)
        .toList();
  }

  List<Map<String, dynamic>> _messagesInConversation(String convId) {
    final messages = _messages.values
        .where((message) =>
            convId.isEmpty || message['convId']?.toString() == convId)
        .map((message) => Map<String, dynamic>.from(message))
        .toList();
    messages.sort((a, b) {
      final aTime = _asInt(a['serverTime']) ?? _asInt(a['localTime']) ?? 0;
      final bTime = _asInt(b['serverTime']) ?? _asInt(b['localTime']) ?? 0;
      return aTime.compareTo(bTime);
    });
    return messages;
  }

  void _clearMessageSideState(String msgId) {
    _messageReactions.remove(msgId);
    _messagePins.remove(msgId);
    _groupAcks.remove(msgId);
  }

  void deleteMessagesByIdsInConversation(Map<String, dynamic> map) {
    final ids = map['messageIds'] ?? map['msgIds'];
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    _removeMessagesByIds(ids, convId: convId);
  }

  void deleteMessagesWithTsInConversation(Map<String, dynamic> map) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final start = _asInt(map['startTs']) ?? 0;
    final end = _asInt(map['endTs']);
    if (end == null) {
      return;
    }
    final removedMsgIds = _messages.entries
        .where((entry) {
          final message = entry.value;
          if (convId.isNotEmpty && message['convId']?.toString() != convId) {
            return false;
          }
          final time = _asInt(message['serverTime']) ??
              _asInt(message['localTime']) ??
              0;
          return time >= start && time <= end;
        })
        .map((entry) => entry.key)
        .toList();
    _messages.removeWhere((msgId, _) => removedMsgIds.contains(msgId));
    for (final msgId in removedMsgIds) {
      _clearMessageSideState(msgId);
    }
    _rebuildConversations();
  }

  void removeMessagesFromServerWithTimestampInConversation(
    Map<String, dynamic> map,
  ) {
    final convId =
        map['convId']?.toString() ?? map['conversationId']?.toString() ?? '';
    final limit = _asInt(map['timestamp']) ??
        _asInt(map['timeStamp']) ??
        _asInt(map['beforeTs']);
    if (limit == null) {
      return;
    }
    final removedMsgIds = _messages.entries
        .where((entry) {
          final message = entry.value;
          if (convId.isNotEmpty && message['convId']?.toString() != convId) {
            return false;
          }
          final time = _asInt(message['serverTime']) ??
              _asInt(message['localTime']) ??
              0;
          return time < limit;
        })
        .map((entry) => entry.key)
        .toList();
    _messages.removeWhere((msgId, _) => removedMsgIds.contains(msgId));
    for (final msgId in removedMsgIds) {
      _clearMessageSideState(msgId);
    }
    _rebuildConversations();
  }

  void _rebuildConversations() {
    _conversations.clear();
    final messages = _messages.values.toList()
      ..sort((a, b) => (_asInt(a['serverTime']) ?? 0)
          .compareTo(_asInt(b['serverTime']) ?? 0));
    for (final message in messages) {
      final convId = message['convId']?.toString() ?? '';
      if (convId.isNotEmpty) {
        _conversations[convId] = {
          'convId': convId,
          'type': message['chatType'] ?? 0,
          'unreadCount': 0,
          'latestMessage': Map<String, dynamic>.from(message),
        };
      }
    }
  }
}
