import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:im_flutter_sdk_interface/im_flutter_sdk_interface.dart';

import 'bridge_socket.dart';
import 'event_bridge_handler.dart';

/// Default WebSocket server base URL (without query). Used with [topic] to build full URL.
const String kDefaultBridgeWebSocketBaseUrl =
    'ws://127.0.0.1:2000/iov/websocket/dual';

/// Default topic when using [kDefaultBridgeWebSocketBaseUrl].
const String kDefaultBridgeWebSocketTopic = 'adc';

/// Callback for each request/response pair for UI logging.
typedef OnBridgeLog = void Function(String request, String response);

/// WebSocket bridge: im_flutter_sdk connects to the same WebSocket server as cases.
/// Request format: { "manager", "cmd", "info", "id"?, "sequence"? }.
class IMWebSocketBridge {
  IMWebSocketBridge._();

  static final IMWebSocketBridge instance = IMWebSocketBridge._();

  BridgeSocket? _socket;
  StreamSubscription<String>? _subscription;
  static const String _tag = 'IMWebSocketBridge';
  static const String _login = 'login';
  static const String _loginWithAgoraToken = 'loginWithAgoraToken';
  static const String _startCallback = 'startCallback';
  static const Set<String> _mediaDownloadMethods = {
    'downloadAttachment',
    'downloadBigImage',
    'downloadThumbnail',
    'downloadMessageAttachmentInCombine',
    'downloadMessageThumbnailInCombine',
  };
  String? _deviceName;
  String _webSdkMode = 'real_sdk';

  OnBridgeLog? onLog;

  static bool _isLoginMethod(String? method) {
    return method == _login || method == _loginWithAgoraToken;
  }

  static void _logV(String message) {
    debugPrint('[$_tag] $message');
  }

  static void _logE(String message) {
    debugPrint('[$_tag][ERROR] $message');
  }

  dynamic _getManager(String managerName) {
    switch (managerName) {
      case 'Client':
        return Client.instance;
      case 'ChatManager':
        return Client.instance.chatManager;
      case 'ContactManager':
        return Client.instance.contactManager;
      case 'GroupManager':
        return Client.instance.groupManager;
      case 'ChatRoomManager':
        return Client.instance.chatRoomManager;
      case 'PushManager':
        return Client.instance.pushManager;
      case 'UserInfoManager':
        return Client.instance.userInfoManager;
      case 'PresenceManager':
        return Client.instance.presenceManager;
      case 'ChatThreadManager':
        return Client.instance.chatThreadManager;
      case 'ConversationManager':
        return Client.instance.conversationManager;
      case 'MessageManager':
        return Client.instance.messageManager;
      default:
        return null;
    }
  }

  bool _isBridgeResponseOrEvent(Map<String, dynamic> message) {
    return message['type'] == 'event' ||
        message.containsKey('result') ||
        message.containsKey('error') ||
        message.containsKey('success');
  }

  Future<void> start({String? url, String? topic, String? deviceName}) async {
    if (_socket != null) {
      _logV('WebSocket bridge already connected');
      return;
    }
    _deviceName =
        deviceName?.trim().isEmpty == true ? null : deviceName?.trim();
    final String connectUrl = url ??
        '$kDefaultBridgeWebSocketBaseUrl?topic=${Uri.encodeComponent(topic ?? kDefaultBridgeWebSocketTopic)}';
    final uri = Uri.parse(connectUrl);
    try {
      _socket = await connectBridgeSocket(uri);
      _logV('WebSocket bridge connected to $uri');
      _subscription = _socket!.messages.listen(
        _onMessage,
        onError: (e) => _logE('WebSocket error: $e'),
        onDone: () {
          _logV('WebSocket connection closed');
          _cleanup();
        },
        cancelOnError: false,
      );
      _installNativeHandlers();
    } catch (e, st) {
      _logE('WebSocket connect failed: $e\n$st');
      rethrow;
    }
  }

  void _installNativeHandlers() {
    Future<dynamic> handler(MethodCall call) async {
      final arguments = call.arguments;
      final data = arguments is Map
          ? Map<String, dynamic>.from(arguments)
          : <String, dynamic>{'value': arguments};
      if (call.method == 'realWebTextMessage') {
        final body = data['body'];
        final bodyType = body is Map ? body['type'] : null;
        final isCmd = bodyType == 6 || bodyType?.toString() == '6';
        if (isCmd) {
          EventBridgeHandler.instance.emitCmdMessagesReceived(messages: [data]);
        } else {
          EventBridgeHandler.instance.emitMessagesReceived(messages: [data]);
        }
      } else if (call.method == 'realWebDeliveredAckMessage') {
        EventBridgeHandler.instance.emitMessagesDelivered(messages: [data]);
        EventBridgeHandler.instance.emitMessageDeliveryAck(message: data);
      } else if (call.method == 'realWebReadAckMessage') {
        final chatType = data['chatType'];
        if (chatType == 1) {
          final groupId = data['to']?.toString() ??
              data['groupId']?.toString() ??
              data['convId']?.toString() ??
              '';
          final msgId = data['msgId']?.toString() ?? '';
          EventBridgeHandler.instance.emitGroupMessageRead(
            acks: [Map<String, dynamic>.from(data)],
          );
          if (msgId.isNotEmpty && groupId.isNotEmpty) {
            EventBridgeHandler.instance.emitReadAckForGroupMessageUpdated(
              msgId: msgId,
              groupId: groupId,
            );
          }
        } else {
          EventBridgeHandler.instance.emitMessagesRead(messages: [data]);
          EventBridgeHandler.instance.emitMessageReadAck(message: data);
        }
      } else if (call.method == 'realWebModifiedMessage') {
        final operatorId = data['from']?.toString() ?? '';
        EventBridgeHandler.instance.emitMessageContentChanged(
          message: data,
          operatorId: operatorId,
        );
        EventBridgeHandler.instance.emitMessageChanged(message: data);
      } else if (call.method == 'realWebRecallMessage') {
        EventBridgeHandler.instance.emitMessagesRecalled(messages: [data]);
        EventBridgeHandler.instance.emitMessagesRecalledInfo(
          infos: [
            {
              'recallMsgId': data['msgId'],
              'recallBy': data['recallBy'] ?? data['from'],
              'convId': data['convId'],
              'msg': data,
              if (data['ext'] != null) 'ext': data['ext'],
            }
          ],
        );
      } else if (call.method == 'realWebMessagePinChanged') {
        EventBridgeHandler.instance.emitMessagePinChanged(
          msgId: data['msgId']?.toString() ?? '',
          convId: data['convId']?.toString() ?? '',
          operatorId: data['operatorId']?.toString() ?? '',
          pinned: data['operation']?.toString() != 'message_unpinned',
        );
      } else if (call.method == 'messageReactionDidChange') {
        sendEvent(call.method, data);
      } else if (call.method == 'onConversationUpdate') {
        sendEvent(call.method, data);
      } else if (call.method == 'onPresenceStatusChanged' ||
          call.method == 'onGroupAnnouncementChanged' ||
          call.method == 'onGroupMemberJoined' ||
          call.method == 'onRoomAnnouncementChanged') {
        sendEvent(call.method, data);
      } else if (call.method == 'onConnected' ||
          call.method == 'onDisconnected' ||
          call.method == 'onConversationHasRead') {
        sendEvent(call.method, data);
      } else {
        sendEvent(call.method, data);
      }
      return null;
    }

    for (final manager in [
      Client.instance,
      Client.instance.chatManager,
      Client.instance.contactManager,
      Client.instance.groupManager,
      Client.instance.chatRoomManager,
      Client.instance.pushManager,
      Client.instance.userInfoManager,
      Client.instance.presenceManager,
      Client.instance.chatThreadManager,
      Client.instance.conversationManager,
      Client.instance.messageManager,
    ]) {
      try {
        manager.updateNativeHandler(handler);
      } catch (e, st) {
        _logE('install native handler failed: $e\n$st');
      }
    }
  }

  void _cleanup() {
    _subscription?.cancel();
    _subscription = null;
    _socket = null;
    _deviceName = null;
  }

  Future<void> _onMessage(dynamic raw) async {
    final String text = raw;
    if (text.isEmpty) return;

    final ws = _socket;
    if (ws == null || ws.isClosed) return;

    Map<String, dynamic>? request;
    _logV('cmd request: $text');
    try {
      request = jsonDecode(text) as Map<String, dynamic>?;
    } catch (e) {
      final resp = _errorResponse(null, -1, 'Invalid JSON: $e');
      _send(ws, resp);
      onLog?.call(text, jsonEncode(resp));
      return;
    }

    if (request == null) {
      final resp = _errorResponse(null, -1, 'Empty request');
      _send(ws, resp);
      onLog?.call(text, jsonEncode(resp));
      return;
    }

    // The bridge server broadcasts responses/events back to subscribers on the
    // same topic. They are not executable SDK requests and must not be echoed.
    if (_isBridgeResponseOrEvent(request)) {
      _logV('ignore bridge response/event: $text');
      return;
    }

    final id = request['id'] ?? request['sequence'];
    final targetDevice = request['device'] as String?;
    if (_deviceName != null &&
        targetDevice != null &&
        targetDevice != _deviceName) {
      _logV(
        'ignore request for device $targetDevice, current device $_deviceName',
      );
      return;
    }
    final managerName = request['manager'] as String?;
    final method = request['cmd'] as String?;
    if (managerName == 'Client' && method == 'init') {
      final info = request['info'];
      if (info is Map) {
        _webSdkMode = info['webSdkMode']?.toString() ?? _webSdkMode;
      }
    }
    dynamic args = request['info'];
    if (managerName == null || method == null) {
      final resp = _errorResponse(id, -1, 'Missing manager or cmd');
      _logV('cmd request: ${jsonEncode(resp)}');
      _send(ws, resp);
      onLog?.call(text, jsonEncode(resp));
      return;
    }

    if (managerName == 'Client' && method == 'emitTestEvent') {
      final info =
          args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
      final eventType = info['eventType']?.toString() ?? '';
      final data = info['data'] is Map
          ? Map<String, dynamic>.from(info['data'] as Map)
          : <String, dynamic>{};
      if (eventType.isEmpty) {
        final resp = _errorResponse(id, -1, 'Missing eventType');
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
        return;
      }
      EventBridgeHandler.instance.emitTestEvent(
        eventType: eventType,
        data: data,
        deviceName: _deviceName,
      );
      final resp = _successResponse(request, {method: true}, method);
      _send(ws, resp);
      onLog?.call(text, jsonEncode(resp));
      return;
    }

    final manager = _getManager(managerName);
    if (manager == null) {
      final resp = _errorResponse(id, -1, 'Unknown manager: $managerName');
      _send(ws, resp);
      onLog?.call(text, jsonEncode(resp));
      return;
    }

    Map<String, dynamic> response = {};
    try {
      if (managerName == 'ChatManager' && method == 'realWebTextMessage') {
        final message =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final body = message['body'];
        final bodyType = body is Map ? body['type'] : null;
        final isCmd = bodyType == 6 || bodyType?.toString() == '6';
        if (isCmd) {
          EventBridgeHandler.instance
              .emitCmdMessagesReceived(messages: [message]);
        } else {
          EventBridgeHandler.instance.emitMessagesReceived(messages: [message]);
        }
        final resp = _successResponse(request, {method: true}, method);
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
        return;
      }

      Map<String, dynamic>? chatRoomBeforeDestroy;
      Map<String, dynamic>? chatRoomBeforeOwnerChange;
      if (managerName == 'ChatRoomManager' &&
          (method == 'destroyChatRoom' || method == 'changeChatRoomOwner')) {
        final detailArgs =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final detail = await manager.callNativeMethod(
          'getChatRoom',
          detailArgs,
        );
        if (detail is Map && detail['getChatRoom'] is Map) {
          final room = Map<String, dynamic>.from(detail['getChatRoom']);
          if (method == 'destroyChatRoom') {
            chatRoomBeforeDestroy = room;
          } else {
            chatRoomBeforeOwnerChange = room;
          }
        }
      }

      Map<String, dynamic>? groupBeforeDestroy;
      Map<String, dynamic>? groupBeforeOwnerChange;
      if (managerName == 'GroupManager' &&
          (method == 'destroyGroup' || method == 'updateGroupOwner')) {
        final detailArgs =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final detail = await manager.callNativeMethod(
          'getGroupWithId',
          detailArgs,
        );
        if (detail is Map && detail['getGroupWithId'] is Map) {
          final group = Map<String, dynamic>.from(detail['getGroupWithId']);
          if (method == 'destroyGroup') {
            groupBeforeDestroy = group;
          } else {
            groupBeforeOwnerChange = group;
          }
        }
      }

      Map<String, dynamic>? chatThreadBeforeDestroy;
      if (managerName == 'ChatThreadManager' &&
          (method == 'destroyChatThread' ||
              method == 'removeMemberFromChatThread')) {
        final detailArgs =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final detail = await manager.callNativeMethod(
          'fetchChatThreadDetail',
          detailArgs,
        );
        if (detail is Map && detail['fetchChatThreadDetail'] is Map) {
          chatThreadBeforeDestroy =
              Map<String, dynamic>.from(detail['fetchChatThreadDetail']);
        }
      }

      Map<String, dynamic>? messageBeforeRecallOrUnpin;
      if (managerName == 'ChatManager' &&
          (method == 'recallMessage' || method == 'unpinMessage') &&
          args is Map) {
        final msgId = args['msgId']?.toString() ?? '';
        if (msgId.isNotEmpty) {
          final detail = await manager.callNativeMethod(
            'getMessage',
            {'msgId': msgId},
          );
          if (detail is Map && detail['getMessage'] is Map) {
            messageBeforeRecallOrUnpin =
                Map<String, dynamic>.from(detail['getMessage']);
          }
        }
      }
      if (managerName == 'ChatManager' &&
          method == 'ackGroupMessageRead' &&
          args is Map) {
        final userId = await _currentUser();
        if (userId != null && userId.isNotEmpty && args['from'] == null) {
          args = {
            ...args,
            'from': userId,
          };
        }
      }

      final dynamic result = await manager.callNativeMethod(method, args);
      // 返回的 result 是 map 格式，key 是 method，value 是结果 JSON，通过 WebSocket 发送回去。
      if (result is Map<String, dynamic>) {
        response = _successResponse(request, result, method);
      } else if (result is Map) {
        response = _successResponse(
          request,
          Map<String, dynamic>.from(result),
          method,
        );
      } else {
        response = _successResponse(request, {method: result}, method);
      }
      // 登录成功后触发 startCallback，使平台插件开始向 Flutter 侧下发回调。
      if (managerName == 'Client' && _isLoginMethod(method)) {
        try {
          await Client.instance.callNativeMethod(_startCallback);
          EventBridgeHandler.instance.registerAllHandlers(
            deviceName: _deviceName,
            sendEvent: sendEvent,
            emitConnectedOnRegister: _webSdkMode != 'real_sdk',
          );
        } catch (e, st) {
          _logE('startCallback after login: $e\n$st');
        }
      }
      if (managerName == 'Client' && method == _startCallback) {
        EventBridgeHandler.instance.registerAllHandlers(
          deviceName: _deviceName,
          sendEvent: sendEvent,
          emitConnectedOnRegister: _webSdkMode != 'real_sdk',
        );
      }
      if (managerName == 'Client' &&
          (method == 'logout' || method == 'webReset')) {
        if (method == 'logout' && _webSdkMode != 'real_sdk') {
          EventBridgeHandler.instance.emitDisconnected(
            deviceName: _deviceName,
          );
        }
        EventBridgeHandler.instance.unregisterAllHandlers();
      }
      if (managerName == 'ChatRoomManager' && method == 'createChatRoom') {
        final room = response['result'];
        if (room is Map) {
          EventBridgeHandler.instance.emitChatRoomSpecificationChanged(
            room: Map<String, dynamic>.from(room),
            operation: 'create',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          method == 'destroyChatRoom' &&
          chatRoomBeforeDestroy != null) {
        EventBridgeHandler.instance.emitChatRoomDestroyed(
          room: chatRoomBeforeDestroy,
        );
      }
      if (managerName == 'ChatRoomManager' &&
          method == 'changeChatRoomSubject') {
        final detailArgs =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final detail = await manager.callNativeMethod(
          'getChatRoom',
          detailArgs,
        );
        if (detail is Map && detail['getChatRoom'] is Map) {
          EventBridgeHandler.instance.emitChatRoomSpecificationChanged(
            room: Map<String, dynamic>.from(detail['getChatRoom']),
            operation: 'update',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          method == 'updateChatRoomAnnouncement' &&
          args is Map) {
        if (_webSdkMode != 'real_sdk') {
          final roomId = args['roomId']?.toString() ?? '';
          final announcement = args['announcement']?.toString() ?? '';
          if (roomId.isNotEmpty) {
            EventBridgeHandler.instance.emitChatRoomAnnouncementChanged(
              roomId: roomId,
              announcement: announcement,
            );
          }
        }
      }
      if (managerName == 'ChatRoomManager' &&
          (method == 'addChatRoomAdmin' || method == 'removeChatRoomAdmin') &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final admin = args['admin']?.toString() ?? '';
        if (roomId.isNotEmpty && admin.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomAdminChanged(
            roomId: roomId,
            admin: admin,
            added: method == 'addChatRoomAdmin',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          (method == 'muteChatRoomMembers' ||
              method == 'unMuteChatRoomMembers') &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final rawMembers = method == 'muteChatRoomMembers'
            ? args['muteMembers']
            : args['unMuteMembers'];
        final members = _toStringList(rawMembers);
        if (roomId.isNotEmpty && members.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomMuteChanged(
            roomId: roomId,
            members: members,
            added: method == 'muteChatRoomMembers',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          (method == 'addMembersToChatRoomWhiteList' ||
              method == 'removeMembersFromChatRoomWhiteList') &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final members = _toStringList(args['members']);
        if (roomId.isNotEmpty && members.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomWhiteListChanged(
            roomId: roomId,
            members: members,
            added: method == 'addMembersToChatRoomWhiteList',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          (method == 'joinChatRoom' || method == 'leaveChatRoom') &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final participant = await _currentUser();
        if (roomId.isNotEmpty &&
            participant != null &&
            participant.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomMemberChanged(
            roomId: roomId,
            participant: participant,
            joined: method == 'joinChatRoom',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          method == 'changeChatRoomOwner' &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final newOwner =
            args['newOwner']?.toString() ?? args['owner']?.toString() ?? '';
        final oldOwner = chatRoomBeforeOwnerChange?['owner']?.toString() ?? '';
        if (roomId.isNotEmpty && newOwner.isNotEmpty && oldOwner.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomOwnerChanged(
            roomId: roomId,
            newOwner: newOwner,
            oldOwner: oldOwner,
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          (method == 'muteAllChatRoomMembers' ||
              method == 'unMuteAllChatRoomMembers') &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        if (roomId.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomAllMemberMuteChanged(
            roomId: roomId,
            isAllMuted: method == 'muteAllChatRoomMembers',
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          method == 'setChatRoomAttributes' &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final attributes = _toStringMap(args['attributes']);
        if (roomId.isNotEmpty && attributes.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomAttributesUpdated(
            roomId: roomId,
            attributes: attributes,
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          method == 'removeChatRoomAttributes' &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final keys = _toStringList(args['keys']);
        if (roomId.isNotEmpty && keys.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomAttributesRemoved(
            roomId: roomId,
            keys: keys,
          );
        }
      }
      if (managerName == 'ChatRoomManager' &&
          (method == 'removeChatRoomMembers' ||
              method == 'blockChatRoomMembers') &&
          args is Map) {
        final roomId = args['roomId']?.toString() ?? '';
        final members = _toStringList(args['members']);
        final operator = await _currentUser();
        if (roomId.isNotEmpty &&
            members.isNotEmpty &&
            operator != null &&
            operator.isNotEmpty) {
          EventBridgeHandler.instance.emitChatRoomRemoved(
            roomId: roomId,
            participants: members,
            operator: operator,
            reason: method == 'blockChatRoomMembers' ? 'blocked' : 'removed',
          );
        }
      }
      if (managerName == 'GroupManager' && method == 'createGroup') {
        final group = response['result'];
        if (group is Map) {
          EventBridgeHandler.instance.emitGroupSpecificationChanged(
            group: Map<String, dynamic>.from(group),
            operation: 'create',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          method == 'destroyGroup' &&
          groupBeforeDestroy != null) {
        EventBridgeHandler.instance.emitGroupDestroyed(
          group: groupBeforeDestroy,
        );
      }
      if (managerName == 'GroupManager' && method == 'updateGroupSubject') {
        final detailArgs =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final detail = await manager.callNativeMethod(
          'getGroupWithId',
          detailArgs,
        );
        if (detail is Map && detail['getGroupWithId'] is Map) {
          EventBridgeHandler.instance.emitGroupSpecificationChanged(
            group: Map<String, dynamic>.from(detail['getGroupWithId']),
            operation: 'update',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          method == 'updateGroupAnnouncement' &&
          args is Map) {
        if (_webSdkMode != 'real_sdk') {
          final groupId = args['groupId']?.toString() ?? '';
          final announcement = args['announcement']?.toString() ?? '';
          if (groupId.isNotEmpty) {
            EventBridgeHandler.instance.emitGroupAnnouncementChanged(
              groupId: groupId,
              announcement: announcement,
            );
          }
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'addAdmin' || method == 'removeAdmin') &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        final admin = args['admin']?.toString() ?? '';
        if (groupId.isNotEmpty && admin.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupAdminChanged(
            groupId: groupId,
            admin: admin,
            added: method == 'addAdmin',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'muteMembers' || method == 'unMuteMembers') &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        final members = _toStringList(args['members']);
        if (groupId.isNotEmpty && members.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupMuteChanged(
            groupId: groupId,
            members: members,
            added: method == 'muteMembers',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'addWhiteList' || method == 'removeWhiteList') &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        final members = _toStringList(args['members']);
        if (groupId.isNotEmpty && members.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupWhiteListChanged(
            groupId: groupId,
            members: members,
            added: method == 'addWhiteList',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'addMembers' || method == 'removeMembers') &&
          args is Map) {
        if (_webSdkMode != 'real_sdk') {
          final groupId = args['groupId']?.toString() ?? '';
          final members = _toStringList(args['members']);
          if (groupId.isNotEmpty && members.isNotEmpty) {
            EventBridgeHandler.instance.emitGroupMemberChanged(
              groupId: groupId,
              members: members,
              joined: method == 'addMembers',
            );
          }
        }
      }
      if (managerName == 'GroupManager' &&
          method == 'updateGroupOwner' &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        final newOwner = args['owner']?.toString() ?? '';
        final oldOwner = groupBeforeOwnerChange?['owner']?.toString() ?? '';
        if (groupId.isNotEmpty && newOwner.isNotEmpty && oldOwner.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupOwnerChanged(
            groupId: groupId,
            newOwner: newOwner,
            oldOwner: oldOwner,
          );
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'muteAllMembers' || method == 'unMuteAllMembers') &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        if (groupId.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupAllMemberMuteChanged(
            groupId: groupId,
            isAllMuted: method == 'muteAllMembers',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'setMemberAttributesFromGroup' ||
              method == 'removeMemberAttributesFromGroup') &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        final userId = args['userId']?.toString() ?? await _currentUser() ?? '';
        final removed = method == 'removeMemberAttributesFromGroup';
        final attributes = removed ? null : _toStringMap(args['attributes']);
        final keys = removed ? _toStringList(args['keys']) : null;
        if (groupId.isNotEmpty &&
            userId.isNotEmpty &&
            ((attributes != null && attributes.isNotEmpty) ||
                (keys != null && keys.isNotEmpty))) {
          EventBridgeHandler.instance.emitGroupMemberAttributesChanged(
            groupId: groupId,
            userId: userId,
            attributes: attributes,
            keys: keys,
            removed: removed,
          );
        }
      }
      if (managerName == 'GroupManager' &&
          method == 'blockMembers' &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        final members = _toStringList(args['members']);
        final operator = await _currentUser();
        if (groupId.isNotEmpty &&
            members.isNotEmpty &&
            operator != null &&
            operator.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupUserRemoved(
            groupId: groupId,
            members: members,
            operator: operator,
            reason: 'blocked',
          );
        }
      }
      if (managerName == 'GroupManager' &&
          (method == 'blockGroup' || method == 'unblockGroup') &&
          args is Map) {
        final groupId = args['groupId']?.toString() ?? '';
        if (groupId.isNotEmpty) {
          EventBridgeHandler.instance.emitGroupStateChanged(
            groupId: groupId,
            messageBlocked: method == 'blockGroup',
          );
        }
      }
      if (_webSdkMode != 'real_sdk') {
        if (managerName == 'ContactManager' && method == 'addContact') {
          final userId = response['result']?.toString();
          if (userId != null && userId.isNotEmpty) {
            EventBridgeHandler.instance.emitContactAdded(userId: userId);
          }
        }
        if (managerName == 'ContactManager' && method == 'deleteContact') {
          final userId = response['result']?.toString();
          if (userId != null && userId.isNotEmpty) {
            EventBridgeHandler.instance.emitContactDeleted(userId: userId);
          }
        }
      }
      if (managerName == 'PresenceManager' &&
          method == 'publishPresenceWithDescription' &&
          response['result'] == null) {
        if (_webSdkMode != 'real_sdk') {
          final userId = await _currentUser();
          if (userId != null && userId.isNotEmpty) {
            final detail = await manager.callNativeMethod(
              'fetchPresenceStatus',
              {
                'members': [userId],
              },
            );
            final presences =
                detail is Map ? detail['fetchPresenceStatus'] : null;
            if (presences is List) {
              EventBridgeHandler.instance.emitPresenceStatusChanged(
                presences: presences
                    .whereType<Map>()
                    .map((item) => Map<String, dynamic>.from(item))
                    .toList(),
              );
            }
          }
        }
      }
      if (managerName == 'ChatManager' &&
          (method == 'sendMessage' || method == 'sendMessageWithType')) {
        final message = response['result'];
        if (_webSdkMode != 'real_sdk' && message is Map) {
          final normalized = Map<String, dynamic>.from(message);
          final body = normalized['body'];
          final bodyType = body is Map ? body['type'] : null;
          if (normalized['streamChunk'] != null) {
            EventBridgeHandler.instance.emitStreamMessagesReceived(
              messages: [normalized],
            );
          } else if (bodyType == 6) {
            EventBridgeHandler.instance.emitCmdMessagesReceived(
              messages: [normalized],
            );
          } else {
            EventBridgeHandler.instance.emitMessagesReceived(
              messages: [normalized],
            );
          }
          EventBridgeHandler.instance.emitMessageSuccess(message: normalized);
        }
      }
      if (managerName == 'ChatManager' &&
          _mediaDownloadMethods.contains(method) &&
          args is Map &&
          response['result'] == null) {
        final message = _messageFromDownloadArgs(args);
        final localId = message['msgId']?.toString() ?? '';
        if (localId.isNotEmpty) {
          EventBridgeHandler.instance.emitMessageProgress(
            localId: localId,
            progress: 100,
          );
        }
      }
      if (managerName == 'ChatManager' &&
          method == 'recallMessage' &&
          messageBeforeRecallOrUnpin != null &&
          response['result'] == true) {
        EventBridgeHandler.instance.emitMessagesRecalled(
          messages: [messageBeforeRecallOrUnpin],
        );
        final operator = await _currentUser();
        EventBridgeHandler.instance.emitMessagesRecalledInfo(
          infos: [
            {
              'recallMsgId': messageBeforeRecallOrUnpin['msgId'],
              'recallBy': operator,
              'convId': messageBeforeRecallOrUnpin['convId'],
              'msg': messageBeforeRecallOrUnpin,
              if (args is Map && args['ext'] != null) 'ext': args['ext'],
            }
          ],
        );
      }
      if (managerName == 'ChatManager' && method == 'resendMessage') {
        final message = response['result'];
        if (message is Map) {
          final normalized = Map<String, dynamic>.from(message);
          EventBridgeHandler.instance.emitMessagesDelivered(
            messages: [normalized],
          );
          EventBridgeHandler.instance.emitMessageDeliveryAck(
            message: normalized,
          );
        }
      }
      if (managerName == 'ChatManager' &&
          method == 'ackMessageRead' &&
          args is Map &&
          response['result'] == 1) {
        final msgId = args['msgId']?.toString() ?? '';
        if (msgId.isNotEmpty) {
          final detail = await manager.callNativeMethod(
            'getMessage',
            {'msgId': msgId},
          );
          if (detail is Map && detail['getMessage'] is Map) {
            final message = Map<String, dynamic>.from(detail['getMessage']);
            message['hasReadAck'] = true;
            EventBridgeHandler.instance.emitMessagesRead(messages: [message]);
            EventBridgeHandler.instance.emitMessageReadAck(message: message);
          }
        }
      }
      if (managerName == 'ChatManager' &&
          method == 'ackGroupMessageRead' &&
          args is Map &&
          response['result'] == 1 &&
          _webSdkMode != 'real_sdk') {
        final msgId = args['msgId']?.toString() ?? '';
        final groupId = args['groupId']?.toString() ??
            args['group_id']?.toString() ??
            args['to']?.toString() ??
            '';
        if (msgId.isNotEmpty && groupId.isNotEmpty) {
          final userId = await _currentUser();
          EventBridgeHandler.instance.emitGroupMessageRead(
            acks: [
              {
                'msgId': msgId,
                if (userId != null && userId.isNotEmpty) 'from': userId,
                'content': args['content']?.toString(),
                'count': 1,
                'timestamp': DateTime.now().millisecondsSinceEpoch,
              }
            ],
          );
          EventBridgeHandler.instance.emitReadAckForGroupMessageUpdated(
            msgId: msgId,
            groupId: groupId,
          );
        }
      }
      if (managerName == 'ChatManager' &&
          method == 'ackConversationRead' &&
          args is Map &&
          response['result'] == 1 &&
          _webSdkMode != 'real_sdk') {
        final convId = args['convId']?.toString() ??
            args['conversationId']?.toString() ??
            '';
        if (convId.isNotEmpty) {
          EventBridgeHandler.instance.emitConversationHasRead(convId: convId);
        }
      }
      if (managerName == 'ChatManager' && method == 'modifyMessage') {
        final message = response['result'];
        final operator = await _currentUser();
        if (message is Map && operator != null && operator.isNotEmpty) {
          EventBridgeHandler.instance.emitMessageContentChanged(
            message: Map<String, dynamic>.from(message),
            operatorId: operator,
          );
          EventBridgeHandler.instance.emitMessageChanged(
            message: Map<String, dynamic>.from(message),
          );
        }
      }
      if (managerName == 'ChatManager' &&
          (method == 'addReaction' || method == 'removeReaction') &&
          args is Map &&
          response['result'] == true &&
          _webSdkMode != 'real_sdk') {
        final msgId = args['msgId']?.toString() ?? '';
        final reaction = args['reaction']?.toString() ?? '';
        final userId = await _currentUser();
        if (msgId.isNotEmpty &&
            reaction.isNotEmpty &&
            userId != null &&
            userId.isNotEmpty) {
          EventBridgeHandler.instance.emitMessageReactionChanged(
            msgId: msgId,
            reaction: reaction,
            userId: userId,
            added: method == 'addReaction',
          );
        }
      }
      if (managerName == 'ChatManager' &&
          (method == 'pinMessage' || method == 'unpinMessage') &&
          args is Map &&
          response['result'] == true) {
        final msgId = args['msgId']?.toString() ?? '';
        final operator = await _currentUser();
        Map<String, dynamic>? message;
        if (method == 'pinMessage') {
          final detail = await manager.callNativeMethod(
            'getMessage',
            {'msgId': msgId},
          );
          if (detail is Map && detail['getMessage'] is Map) {
            message = Map<String, dynamic>.from(detail['getMessage']);
          }
        } else {
          message = messageBeforeRecallOrUnpin;
        }
        final convId = message?['convId']?.toString() ?? '';
        if (msgId.isNotEmpty &&
            convId.isNotEmpty &&
            operator != null &&
            operator.isNotEmpty) {
          EventBridgeHandler.instance.emitMessagePinChanged(
            msgId: msgId,
            convId: convId,
            operatorId: operator,
            pinned: method == 'pinMessage',
          );
        }
      }
      if (managerName == 'ChatManager' &&
          method == 'pinConversation' &&
          args is Map &&
          response['result'] == true &&
          _webSdkMode != 'real_sdk') {
        final convId = args['convId']?.toString() ??
            args['conversationId']?.toString() ??
            '';
        if (convId.isNotEmpty) {
          EventBridgeHandler.instance.emitConversationUpdate(
            convId: convId,
            isPinned: args['isPinned'] == true,
            operation: args['isPinned'] == true
                ? 'conversation_pinned'
                : 'conversation_unpinned',
          );
        }
      }
      if (managerName == 'ChatManager' &&
          (method == 'deleteConversation' ||
              method == 'deleteRemoteConversation') &&
          args is Map &&
          response['result'] == true &&
          _webSdkMode != 'real_sdk') {
        final convId = args['convId']?.toString() ?? '';
        if (convId.isNotEmpty) {
          EventBridgeHandler.instance.emitConversationUpdate(
            convId: convId,
            deleteMessages: args['deleteMessages'] == true ||
                args['isDeleteRemoteMessage'] == true,
            operation: 'conversation_deleted',
          );
        }
      }
      if (_webSdkMode != 'real_sdk' &&
          managerName == 'ChatThreadManager' &&
          method == 'createChatThread') {
        final thread = response['result'];
        if (thread is Map) {
          EventBridgeHandler.instance.emitChatThreadCreated(
            thread: Map<String, dynamic>.from(thread),
          );
        }
      }
      if (_webSdkMode != 'real_sdk' &&
          managerName == 'ChatThreadManager' &&
          method == 'updateChatThreadSubject') {
        final detailArgs =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        final detail = await manager.callNativeMethod(
          'fetchChatThreadDetail',
          detailArgs,
        );
        if (detail is Map && detail['fetchChatThreadDetail'] is Map) {
          EventBridgeHandler.instance.emitChatThreadCreated(
            thread: Map<String, dynamic>.from(detail['fetchChatThreadDetail']),
            operation: 'update',
          );
        }
      }
      if (_webSdkMode != 'real_sdk' &&
          managerName == 'ChatThreadManager' &&
          method == 'destroyChatThread' &&
          chatThreadBeforeDestroy != null) {
        EventBridgeHandler.instance.emitChatThreadCreated(
          thread: chatThreadBeforeDestroy,
          operation: 'destroy',
        );
      }
      if (_webSdkMode != 'real_sdk' &&
          managerName == 'ChatThreadManager' &&
          method == 'removeMemberFromChatThread' &&
          args is Map &&
          chatThreadBeforeDestroy != null) {
        final memberId = args['memberId']?.toString() ?? '';
        final currentUser = await _currentUser();
        if (memberId.isNotEmpty && memberId == currentUser) {
          EventBridgeHandler.instance.emitChatThreadCreated(
            thread: chatThreadBeforeDestroy,
            operation: 'user_kicked',
            userId: memberId,
          );
        }
      }
      _logV('cmd response: ${jsonEncode(response)}');
      _send(ws, response);
    } catch (e, st) {
      _logE('callNativeMethod error: $e\n$st');
      if (managerName == 'ChatManager' &&
          _mediaDownloadMethods.contains(method) &&
          args is Map) {
        final message = _messageFromDownloadArgs(args);
        final localId = message['msgId']?.toString() ?? '';
        if (localId.isNotEmpty) {
          EventBridgeHandler.instance.emitMessageError(
            localId: localId,
            message: message,
            description: e.toString(),
          );
        }
      }
      response = _errorResponse(id, -1, e.toString());
      _send(ws, response);
    }
    onLog?.call(text, jsonEncode(response));
  }

  Future<String?> _currentUser() async {
    final result = await Client.instance.callNativeMethod('getCurrentUser');
    if (result is Map) {
      return result['getCurrentUser']?.toString();
    }
    return result?.toString();
  }

  static Map<String, dynamic> _messageFromDownloadArgs(Map args) {
    final message = args['message'];
    if (message is Map) {
      return Map<String, dynamic>.from(message);
    }
    return <String, dynamic>{
      if (args['msgId'] != null) 'msgId': args['msgId'],
    };
  }

  static Map<String, dynamic> _toStringMap(dynamic value) {
    if (value is! Map) {
      return <String, dynamic>{};
    }
    return value.map((key, item) => MapEntry(key?.toString() ?? '', item))
      ..removeWhere((key, _) => key.isEmpty);
  }

  static List<String> _toStringList(dynamic value) {
    if (value is Iterable) {
      return value
          .map((item) => item?.toString() ?? '')
          .where((item) => item.isNotEmpty)
          .toList();
    }
    final item = value?.toString() ?? '';
    return item.isEmpty ? <String>[] : <String>[item];
  }

  static dynamic _toJsonSafe(dynamic value) {
    if (value == null) return null;
    if (value is num || value is bool || value is String) return value;
    if (value is Map) {
      return value.map((k, v) => MapEntry(k?.toString(), _toJsonSafe(v)));
    }
    if (value is List) return value.map(_toJsonSafe).toList();
    return value.toString();
  }

  void _send(BridgeSocket ws, Map<String, dynamic> payload) {
    if (ws.isClosed) {
      _logV('WebSocket closed, payload not sent');
      return;
    }
    try {
      final encoded = jsonEncode(payload);
      ws.add(encoded);
    } catch (e) {
      _logE('Failed to send payload: $e');
    }
  }

  Map<String, dynamic> _successResponse(
    Map<String, dynamic> request,
    Map<String, dynamic> result,
    String method,
  ) {
    final data = Map<String, dynamic>.from(request);
    if (result.containsKey('error')) {
      data['result'] = result['error'];
    } else {
      data['result'] = result[method];
    }
    data.remove('info');
    return data;
  }

  Map<String, dynamic> _errorResponse(
    dynamic id,
    int code,
    String description,
  ) {
    final map = <String, dynamic>{
      'success': false,
      'error': {'code': code, 'description': description},
    };
    if (id != null) map['id'] = id;
    return map;
  }

  Future<void> stop() async {
    EventBridgeHandler.instance.unregisterAllHandlers();
    await _subscription?.cancel();
    await _socket?.close();
    _cleanup();
    _logV('WebSocket bridge disconnected');
  }

  bool get isConnected => _socket != null && !_socket!.isClosed;

  /// Send event data to WebSocket server (e.g. contact/group events from EventBridgeHandler).
  void sendEvent(String eventType, Map<String, dynamic> data) {
    final ws = _socket;
    if (ws == null || ws.isClosed) {
      _logV('WebSocket not connected, event $eventType not sent');
      return;
    }
    try {
      final payload = {
        'type': 'event',
        'eventType': eventType,
        'data': _toJsonSafe(data),
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      };
      _send(ws, payload);
      _logV('Sent payload: ${jsonEncode(payload)}');
      onLog?.call('Event: $eventType', jsonEncode(payload));
    } catch (e, st) {
      _logE('sendEvent $eventType failed: $e\n$st');
    }
  }
}
