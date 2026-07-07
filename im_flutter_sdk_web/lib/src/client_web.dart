import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
// ignore: deprecated_member_use
import 'dart:js_util' as js_util;

import 'package:flutter/services.dart';
import 'package:im_flutter_sdk_interface/im_flutter_sdk_interface.dart';
import 'package:web/web.dart' as web;

part 'method_keys.dart';
part 'web_helpers.dart';
part 'real_web_sdk_interop.dart';
part 'managers/chat_manager_web.dart';
part 'managers/chat_room_manager_web.dart';
part 'managers/chat_thread_manager_web.dart';
part 'managers/contact_manager_web.dart';
part 'managers/conversation_manager_web.dart';
part 'managers/group_manager_web.dart';
part 'managers/message_manager_web.dart';
part 'managers/presence_manager_web.dart';
part 'managers/push_manager_web.dart';
part 'managers/user_info_manager_web.dart';

class ClientWeb extends Client {
  static void registerWith() {
    Client.instance = ClientWeb();
  }

  ClientWeb()
      : _chatManager = ChatManagerWeb(),
        _contactManager = ContactManagerWeb(),
        _chatRoomManager = ChatRoomManagerWeb(),
        _groupManager = GroupManagerWeb(),
        _presenceManager = PresenceManagerWeb(),
        _pushManager = PushManagerWeb(),
        _userInfoManager = UserInfoManagerWeb() {
    _chatThreadManager = ChatThreadManagerWeb(_chatManager);
    _messageManager = MessageManagerWeb(_chatManager, _chatThreadManager);
    _chatManager.chatThreadManager = _chatThreadManager;
    _conversationManager = ConversationManagerWeb(_chatManager);
  }

  final ChatManagerWeb _chatManager;
  final ContactManagerWeb _contactManager;
  final ChatRoomManagerWeb _chatRoomManager;
  late final ChatThreadManagerWeb _chatThreadManager;
  final GroupManagerWeb _groupManager;
  final PresenceManagerWeb _presenceManager;
  final PushManagerWeb _pushManager;
  final UserInfoManagerWeb _userInfoManager;
  late final ConversationManagerWeb _conversationManager;
  late final MessageManagerWeb _messageManager;
  Future<dynamic> Function(MethodCall call)? _handler;
  RealWebSdkClient? _realSdk;

  String? _currentUser;
  String? _token;
  bool _connected = false;
  bool _callbackStarted = false;
  String _sdkMode = 'real_sdk';
  Map<String, dynamic>? _pendingConnectedEvent;
  Map<String, dynamic>? _pendingDisconnectedEvent;

  @override
  ChatManager get chatManager => _chatManager;

  @override
  ContactManager get contactManager => _contactManager;

  @override
  ChatRoomManager get chatRoomManager => _chatRoomManager;

  @override
  ChatThreadManager get chatThreadManager => _chatThreadManager;

  @override
  GroupManager get groupManager => _groupManager;

  @override
  UserInfoManager get userInfoManager => _userInfoManager;

  @override
  PresenceManager get presenceManager => _presenceManager;

  @override
  PushManager get pushManager => _pushManager;

  @override
  ConversationManager get conversationManager => _conversationManager;

  @override
  MessageManager get messageManager => _messageManager;

  @override
  void updateNativeHandler(handler) {
    _handler = handler;
  }

  @override
  Future<dynamic> callNativeMethod(String method, [dynamic params]) async {
    final map = _asMap(params);
    switch (method) {
      case _MethodKeys.init:
        _sdkMode = map['webSdkMode']?.toString() ?? 'real_sdk';
        if (_sdkMode == 'real_sdk') {
          _realSdk = RealWebSdkClient(
            onTextMessage: _emitRealTextMessage,
            onMessageSuccess: _emitRealMessageSuccess,
            onDeliveredAckMessage: _emitRealDeliveredAckMessage,
            onReadAckMessage: _emitRealReadAckMessage,
            onModifiedMessage: _emitRealModifiedMessage,
            onRecallMessage: _emitRealRecallMessage,
            onMessagePinChanged: _emitRealMessagePinChanged,
            onReactionChanged: _chatManager.emitRealReactionChanged,
            onConversationUpdated: _chatManager.emitRealConversationUpdated,
            onPresenceStatusChanged:
                _presenceManager.emitRealPresenceStatusChanged,
            onContactEvent: _contactManager.emitContactEvent,
            onUserInfoEvent: _userInfoManager.emitUserInfoEvent,
            onGroupEvent: _groupManager.emitRealGroupEvent,
            onChatRoomEvent: _chatRoomManager.emitRealChatRoomEvent,
            onClientEvent: _emitRealClientEvent,
            onConnected: _emitRealConnected,
            onDisconnected: _emitRealDisconnected,
            onConversationRead: _chatManager.emitRealConversationRead,
          );
          _realSdk!.recordExternalDebugEvent('bridge_init_requested', {
            'sdkMode': _sdkMode,
            'appKeyPresent': (map['appKey']?.toString().isNotEmpty ?? false),
          });
          await _realSdk!.init(map);
          _realSdk!.recordExternalDebugEvent('bridge_init_completed', {
            'sdkMode': _sdkMode,
          });
        }
        return {method: true};
      case 'getSdkMode':
        return {method: _sdkMode};
      case 'getNativeHandlerState':
        return {
          method: {
            'chatManagerHasHandler': _chatManager.hasNativeHandler,
            'chatManagerHandlerInstallCount': _chatManager.handlerInstallCount,
            'chatManagerHandlerHashCode': _chatManager.handlerHashCode,
            'contactManagerHasHandler': _contactManager.hasNativeHandler,
            'contactManagerHandlerInstallCount': _contactManager.handlerInstallCount,
            'contactManagerHandlerHashCode': _contactManager.handlerHashCode,
          },
        };
      case 'getRealSdkStatus':
        return {method: realWebSdkStatus()};
      case 'getRealSdkDebug':
        return {method: _realSdk?.debugEvents() ?? <Map<String, dynamic>>[]};
      case 'getRealSdkContactSnapshot':
        return {
          method: _realSdk?.dumpContactSnapshot() ?? <String, dynamic>{},
        };
      case 'getRealSdkContactCacheState':
        return {
          method: _realSdk?.dumpContactCacheState() ?? <String, dynamic>{},
        };
      case 'getRealSdkSyncState':
        return {
          method: realWebSdkSyncState(_realSdk?.rawClient),
        };
      case 'dumpRealSdkContactManagerMethods':
        return {method: _realSdk?.dumpContactManagerMethods() ?? <String>[]};
      case 'dumpRealSdkChatRoomManagerMethods':
        return {method: _realSdk?.dumpChatRoomManagerMethods() ?? <String>[]};
      case _MethodKeys.createAccount:
        if (_sdkMode == 'real_sdk') {
          final userId = map['userId']?.toString() ?? '';
          await _realSdk!.registerUser(
            userId: userId,
            password: map['password']?.toString() ?? '',
          );
          return {method: userId};
        }
        return {method: map['userId']?.toString()};
      case _MethodKeys.login:
        if (_sdkMode == 'real_sdk') {
          final userId = map['userId']?.toString();
          final token = map['pwdOrToken']?.toString();
          await _realSdk!.login(
            userId: userId,
            secret: token,
            isPassword: map['isPassword'] == true,
          );
          _setCurrentSession(userId, token);
          return {method: _currentUser};
        }
        _currentUser = map['userId']?.toString();
        _token = map['pwdOrToken']?.toString();
        _connected = _currentUser != null && _currentUser!.isNotEmpty;
        _userInfoManager.currentUser = _currentUser;
        _chatRoomManager.currentUser = _currentUser;
        _chatThreadManager.currentUser = _currentUser;
        _groupManager.currentUser = _currentUser;
        _presenceManager.currentUser = _currentUser;
        _pushManager.currentUser = _currentUser;
        return {method: _currentUser};
      case _MethodKeys.loginWithAgoraToken:
        if (_sdkMode == 'real_sdk') {
          final userId = map['userId']?.toString();
          final token = map['agoraToken']?.toString();
          await _realSdk!.login(
            userId: userId,
            secret: token,
            isPassword: false,
          );
          _setCurrentSession(userId, token);
          return {method: _currentUser};
        }
        _currentUser = map['userId']?.toString();
        _token = map['agoraToken']?.toString();
        _connected = _currentUser != null && _currentUser!.isNotEmpty;
        _userInfoManager.currentUser = _currentUser;
        _chatRoomManager.currentUser = _currentUser;
        _chatThreadManager.currentUser = _currentUser;
        _groupManager.currentUser = _currentUser;
        _presenceManager.currentUser = _currentUser;
        _pushManager.currentUser = _currentUser;
        return {method: _currentUser};
      case _MethodKeys.renewToken:
        final token =
            map['agora_token']?.toString() ?? map['agoraToken']?.toString();
        if (_sdkMode == 'real_sdk') {
          await _realSdk!.renewToken(token ?? '');
        }
        _token = token;
        return {method: true};
      case _MethodKeys.uploadLog:
        return {method: true};
      case _MethodKeys.compressLogs:
        return {method: 'web-logs.zip'};
      case _MethodKeys.getLoggedInDevicesFromServer:
        return {method: <Map<String, dynamic>>[]};
      case _MethodKeys.kickDevice:
      case _MethodKeys.kickAllDevices:
        return {method: true};
      case _MethodKeys.logout:
        if (_sdkMode == 'real_sdk') {
          await _realSdk?.logout();
        }
        _currentUser = null;
        _token = null;
        _connected = false;
        _callbackStarted = false;
        _userInfoManager.currentUser = null;
        _chatRoomManager.currentUser = null;
        _chatThreadManager.currentUser = null;
        _groupManager.currentUser = null;
        _presenceManager.currentUser = null;
        _pushManager.currentUser = null;
        return {method: true};
      case _MethodKeys.getCurrentUser:
        return {method: _currentUser};
      case _MethodKeys.getToken:
        return {method: _token};
      case _MethodKeys.getCurrentDeviceId:
        if (_sdkMode == 'real_sdk') {
          return {
            method: {'deviceUUID': _realSdk?.deviceId() ?? 'web-device'},
          };
        }
        return {
          method: {'deviceUUID': 'web-device'},
        };
      case _MethodKeys.isLoggedInBefore:
        return {method: _currentUser != null && _currentUser!.isNotEmpty};
      case _MethodKeys.isConnected:
        if (_sdkMode == 'real_sdk') {
          return {method: _realSdk?.isConnected() ?? false};
        }
        return {method: _connected};
      case _MethodKeys.startCallback:
        _callbackStarted = true;
        if (_sdkMode == 'real_sdk') {
          if (_connected && _pendingConnectedEvent != null) {
            await _emitRealConnected(_pendingConnectedEvent);
          } else if (!_connected && _pendingDisconnectedEvent != null) {
            await _emitRealDisconnected(_pendingDisconnectedEvent);
          }
        }
        return {method: _callbackStarted};
      case _MethodKeys.webReset:
        _chatManager.reset();
        _contactManager.reset();
        _chatRoomManager.reset();
        _chatThreadManager.reset();
        _groupManager.reset();
        _presenceManager.reset();
        _pushManager.reset();
        _userInfoManager.reset(keepUserId: _currentUser);
        return {method: true};
      default:
        return _unsupported('Client', method);
    }
  }

  Future<void> emitClientEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  Future<void> _emitRealTextMessage(Map<String, dynamic> message) async {
    _realSdk?.recordExternalDebugEvent('client_emit_real_text_message_begin', {
      'msgId': message['msgId'],
      'from': message['from'],
      'to': message['to'],
      'bodyType': _asMap(message['body'])['type'],
    });
    await _chatManager.emitRealTextMessage(message);
    _realSdk?.recordExternalDebugEvent('client_emit_real_text_message_end', {
      'msgId': message['msgId'],
    });
  }

  Future<void> _emitRealMessageSuccess(Map<String, dynamic> message) async {
    await _chatManager.emitRealMessageSuccess(message);
  }

  Future<void> _emitRealDeliveredAckMessage(
      Map<String, dynamic> message) async {
    await _chatManager.emitRealDeliveredAckMessage(message);
  }

  Future<void> _emitRealReadAckMessage(Map<String, dynamic> message) async {
    await _chatManager.emitRealReadAckMessage(message);
  }

  Future<void> _emitRealModifiedMessage(Map<String, dynamic> message) async {
    await _chatManager.emitRealModifiedMessage(message);
  }

  Future<void> _emitRealRecallMessage(Map<String, dynamic> message) async {
    await _chatManager.emitRealRecallMessage(message);
  }

  Future<void> _emitRealMessagePinChanged(Map<String, dynamic> event) async {
    await _chatManager.emitRealMessagePinChanged(event);
  }

  Future<void> _emitRealClientEvent(
    String method,
    Map<String, dynamic> event,
  ) async {
    if (!_callbackStarted) return;
    await emitClientEvent(method, event);
  }

  Future<void> _emitRealConnected([Map<String, dynamic>? event]) async {
    final payload = {
      'device': event?['device'] ?? 'web',
      'connected': true,
      if (event?['reason'] != null) 'reason': event!['reason'],
    };
    _connected = true;
    _pendingConnectedEvent = Map<String, dynamic>.from(payload);
    _pendingDisconnectedEvent = null;
    if (!_callbackStarted) return;
    await emitClientEvent(
      'onConnected',
      payload,
    );
  }

  Future<void> _emitRealDisconnected([Map<String, dynamic>? event]) async {
    final payload = {
      'device': event?['device'] ?? 'web',
      'connected': false,
      if (event?['reason'] != null) 'reason': event!['reason'],
    };
    _connected = false;
    _pendingDisconnectedEvent = Map<String, dynamic>.from(payload);
    _pendingConnectedEvent = null;
    if (!_callbackStarted) return;
    await emitClientEvent(
      'onDisconnected',
      payload,
    );
  }

  void _setCurrentSession(String? userId, String? token) {
    _currentUser = userId;
    _token = token;
    _connected = _currentUser != null && _currentUser!.isNotEmpty;
    _userInfoManager.currentUser = _currentUser;
    _chatRoomManager.currentUser = _currentUser;
    _chatThreadManager.currentUser = _currentUser;
    _groupManager.currentUser = _currentUser;
    _presenceManager.currentUser = _currentUser;
    _pushManager.currentUser = _currentUser;
  }
}
