import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:im_flutter_sdk/im_flutter_sdk.dart';
import 'package:im_flutter_sdk_interface/im_flutter_sdk_interface.dart';
import 'package:path_provider/path_provider.dart';

import 'bridge_timeout.dart';
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
  final String _webSdkMode = 'real_sdk';

  OnBridgeLog? onLog;
  int _realWebTextMessageCalls = 0;
  int _messagesReceivedEventsSent = 0;
  String? _lastBridgeMessageId;
  String? _lastBridgeEventType;
  int? _nativeHandlerHashCode;
  int _nativeHandlerInstallCount = 0;
  Timer? _webRealTextFlushTimer;
  bool _webRealTextFlushInFlight = false;
  final Set<String> _flushedWebRealTextMsgIds = <String>{};
  final Set<String> _flushedWebRealSuccessMsgIds = <String>{};
  final Set<String> _flushedWebRealClientEventKeys = <String>{};

  static bool _isLoginMethod(String? method) {
    return method == _login || method == _loginWithAgoraToken;
  }

  Future<Map<String, dynamic>> _prepareTestMediaAsset(
    Map<String, dynamic> info,
  ) async {
    final assetName = info['assetName']?.toString() ?? '';
    if (assetName.isEmpty) {
      throw PlatformException(
        code: 'invalid_args',
        message: 'prepareTestMediaAsset requires assetName',
      );
    }
    final assetPath = 'assets/media/$assetName';
    final data = await rootBundle.load(assetPath);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$assetName');
    await file.writeAsBytes(
      Uint8List.sublistView(data),
      flush: true,
    );
    return {
      'assetName': assetName,
      'assetPath': assetPath,
      'localPath': file.path,
      'fileSize': await file.length(),
    };
  }

  EMOptions _optionsFromInitInfo(Map<String, dynamic> info) {
    final appKey = info['appKey']?.toString() ?? '';
    if (appKey.isEmpty) {
      throw ArgumentError('Client.init requires appKey');
    }
    return EMOptions.withAppKey(
      appKey,
      autoLogin: info['autoLogin'] as bool? ?? true,
      debugMode: info['debugModel'] as bool? ?? false,
      acceptInvitationAlways: info['acceptInvitationAlways'] as bool? ?? false,
      autoAcceptGroupInvitation:
          info['autoAcceptGroupInvitation'] as bool? ?? false,
      requireAck: info['requireAck'] as bool? ?? true,
      requireDeliveryAck: info['requireDeliveryAck'] as bool? ?? false,
      deleteMessagesAsExitGroup:
          info['deleteMessagesAsExitGroup'] as bool? ?? true,
      deleteMessagesAsExitChatRoom:
          info['deleteMessagesAsExitChatRoom'] as bool? ?? true,
      isChatRoomOwnerLeaveAllowed:
          info['isChatRoomOwnerLeaveAllowed'] as bool? ?? true,
      sortMessageByServerTime: info['sortMessageByServerTime'] as bool? ?? true,
      usingHttpsOnly: info['usingHttpsOnly'] as bool? ?? false,
      serverTransfer: info['serverTransfer'] as bool? ?? true,
      isAutoDownloadThumbnail: info['isAutoDownload'] as bool? ?? true,
      enableDNSConfig: info['enableDNSConfig'] as bool? ?? true,
      enableAutoSyncContacts: info['enableAutoSyncContacts'] as bool? ?? false,
      enableUserInfo: info['enableUserInfo'] as bool?,
      dnsUrl: info['dnsUrl']?.toString(),
      restServer: info['restServer']?.toString(),
      imPort: info['imPort'] as int?,
      imServer: info['imServer']?.toString(),
      webSocketServer: info['webSocketServer']?.toString(),
      webSocketPort: info['webSocketPort'] as int?,
      syncDataWebSocketServer: info['syncDataWebSocketServer']?.toString(),
      syncDataWebSocketPort: info['syncDataWebSocketPort'] as int?,
      chatAreaCode: info['areaCode'] as int?,
      enableEmptyConversation: info['loadEmptyConversations'] as bool? ?? false,
      deviceName: info['deviceName']?.toString(),
      osType: info['osType'] as int?,
      useReplacedMessageContents:
          info['useReplacedMessageContents'] as bool? ?? false,
      enableTLS: info['enableTLS'] as bool? ?? false,
      messagesReceiveCallbackIncludeSend:
          info['messagesReceiveCallbackIncludeSend'] as bool? ?? false,
      regardImportMessagesAsRead:
          info['regardImportMessagesAsRead'] as bool? ?? false,
    );
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

  Map<String, dynamic> _bridgeState() {
    return {
      'deviceName': _deviceName,
      'webSdkMode': _webSdkMode,
      'socketConnected': _socket != null && !(_socket?.isClosed ?? true),
      'nativeHandlerRegistered': EventBridgeHandler.instance.isRegistered,
      'nativeHandlerHashCode': _nativeHandlerHashCode,
      'nativeHandlerInstallCount': _nativeHandlerInstallCount,
      'realWebTextMessageCalls': _realWebTextMessageCalls,
      'messagesReceivedEventsSent': _messagesReceivedEventsSent,
      'lastBridgeMessageId': _lastBridgeMessageId,
      'lastBridgeEventType': _lastBridgeEventType,
    };
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
    _logV('start requested uri=$uri device=$_deviceName');
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
      _logV('native handlers installed');
      sendEvent('onBridgeReady', {
        'device': _deviceName,
        'connected': true,
        'bridgeUrl': uri.toString(),
      });
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
        await _handleBridgeRealWebTextMessage(data);
      } else if (call.method == 'realWebMessageSuccess') {
        _logV('received realWebMessageSuccess: ${jsonEncode(data)}');
        EventBridgeHandler.instance.emitMessageSuccess(message: data);
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
        final pinned = data['operation']?.toString() != 'message_unpinned';
        EventBridgeHandler.instance.emitMessagePinChanged(
          messageId: data['msgId']?.toString() ?? '',
          conversationId: data['convId']?.toString() ?? '',
          pinOperation:
              pinned ? MessagePinOperation.Pin : MessagePinOperation.Unpin,
          pinInfo: {
            'operatorId': data['operatorId']?.toString() ?? '',
          },
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

    _nativeHandlerHashCode = handler.hashCode;
    _nativeHandlerInstallCount += 1;
    _logV(
      'install native handler hash=$_nativeHandlerHashCode count=$_nativeHandlerInstallCount',
    );

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
    _stopWebRealTextFlush();
    _subscription?.cancel();
    _subscription = null;
    _socket = null;
    _deviceName = null;
  }

  void _startWebRealTextFlush() {
    if (!kIsWeb) return;
    if (_webSdkMode != 'real_sdk') return;
    _webRealTextFlushTimer ??= Timer.periodic(
      const Duration(milliseconds: 500),
      (_) => _flushPendingWebRealTextMessages(),
    );
  }

  void _stopWebRealTextFlush() {
    _webRealTextFlushTimer?.cancel();
    _webRealTextFlushTimer = null;
    _flushedWebRealTextMsgIds.clear();
    _flushedWebRealSuccessMsgIds.clear();
    _flushedWebRealClientEventKeys.clear();
  }

  Future<void> _flushPendingWebRealTextMessages() async {
    if (!kIsWeb) return;
    if (_socket == null || _socket!.isClosed) return;
    if (_webSdkMode != 'real_sdk') return;
    if (_webRealTextFlushInFlight) return;
    _webRealTextFlushInFlight = true;
    try {
      final result = await Client.instance.chatManager.callNativeMethod(
        'getPendingRealTextMessages',
        <String, dynamic>{},
      );
      final map = result is Map<String, dynamic>
          ? result
          : result is Map
              ? Map<String, dynamic>.from(result)
              : const <String, dynamic>{};
      final rawList = map['getPendingRealTextMessages'];
      if (rawList is! List) return;
      for (final item in rawList) {
        if (item is! Map) continue;
        final message = Map<String, dynamic>.from(item);
        final msgId = message['msgId']?.toString();
        if (msgId == null || msgId.isEmpty) continue;
        if (_flushedWebRealTextMsgIds.contains(msgId)) continue;
        _flushedWebRealTextMsgIds.add(msgId);
        _logV('flush pending real web text message: $msgId');
        await _handleBridgeRealWebTextMessage(message);
      }

      final successResult = await Client.instance.chatManager.callNativeMethod(
        'getPendingRealSuccessMessages',
        <String, dynamic>{},
      );
      final successMap = successResult is Map<String, dynamic>
          ? successResult
          : successResult is Map
              ? Map<String, dynamic>.from(successResult)
              : const <String, dynamic>{};
      final successList = successMap['getPendingRealSuccessMessages'];
      if (successList is! List) return;
      for (final item in successList) {
        if (item is! Map) continue;
        final message = Map<String, dynamic>.from(item);
        final msgId = message['msgId']?.toString();
        if (msgId == null || msgId.isEmpty) continue;
        if (_flushedWebRealSuccessMsgIds.contains(msgId)) continue;
        _flushedWebRealSuccessMsgIds.add(msgId);
        _logV('flush pending real web success message: $msgId');
        EventBridgeHandler.instance.emitMessageSuccess(message: message);
      }

      final clientEventResult = await Client.instance.callNativeMethod(
        'getPendingRealClientEvents',
        <String, dynamic>{},
      );
      final clientEventMap = clientEventResult is Map<String, dynamic>
          ? clientEventResult
          : clientEventResult is Map
              ? Map<String, dynamic>.from(clientEventResult)
              : const <String, dynamic>{};
      final clientEventList = clientEventMap['getPendingRealClientEvents'];
      if (clientEventList is! List) return;
      for (final item in clientEventList) {
        if (item is! Map) continue;
        final entry = Map<String, dynamic>.from(item);
        final method = entry['method']?.toString();
        final event =
            entry['event'] is Map
                ? Map<String, dynamic>.from(entry['event'])
                : <String, dynamic>{};
        if (method == null || method.isEmpty || event.isEmpty) continue;
        final dedupeKey = jsonEncode(<String, dynamic>{
          'method': method,
          'operation': event['operation'],
          'category': event['category'],
          'target': event['target'],
          'convId': event['convId'],
          'event': event['event'],
        });
        if (_flushedWebRealClientEventKeys.contains(dedupeKey)) continue;
        _flushedWebRealClientEventKeys.add(dedupeKey);
        _logV('flush pending real web client event: $method');
        sendEvent(method, event);
      }
    } catch (e, st) {
      _logE('flush pending real web text messages: $e\n$st');
    } finally {
      _webRealTextFlushInFlight = false;
    }
  }

  Future<void> _handleBridgeRealWebTextMessage(Map<String, dynamic> data) async {
    _realWebTextMessageCalls += 1;
    _lastBridgeMessageId = data['msgId']?.toString();
    _logV('received realWebTextMessage: ${jsonEncode(data)}');
    final body = data['body'];
    final bodyType = body is Map ? body['type'] : null;
    final isCmd = bodyType == 6 || bodyType?.toString() == '6';
    if (isCmd) {
      EventBridgeHandler.instance.emitCmdMessagesReceived(messages: [data]);
    } else {
      EventBridgeHandler.instance.emitMessagesReceived(messages: [data]);
    }
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
    dynamic args = request['info'];
    if (managerName == null || method == null) {
      final resp = _errorResponse(id, -1, 'Missing manager or cmd');
      _logV('cmd request: ${jsonEncode(resp)}');
      _send(ws, resp);
      onLog?.call(text, jsonEncode(resp));
      return;
    }

    if (managerName == 'Client' && method == 'init') {
      final info =
          args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
      try {
        await EMClient.getInstance.init(_optionsFromInitInfo(info));
        final resp = _successResponse(request, {'init': true}, method);
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
      } catch (e) {
        final resp = _errorResponse(id, -1, 'Client.init failed: $e');
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
      }
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

    if (managerName == 'Client' && method == 'prepareTestMediaAsset') {
      final info =
          args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
      try {
        final result = await _prepareTestMediaAsset(info);
        final resp = _successResponse(request, {method: result}, method);
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
      } catch (e) {
        final resp = _errorResponse(id, -1, 'prepareTestMediaAsset failed: $e');
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
      }
      return;
    }

    if (managerName == 'Client' && method == 'getBridgeState') {
      final resp = _successResponse(request, {method: _bridgeState()}, method);
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
        _logV('bridge cmd realWebTextMessage: ${jsonEncode(message)}');
        await _handleBridgeRealWebTextMessage(message);
        final resp = _successResponse(request, {method: true}, method);
        _send(ws, resp);
        onLog?.call(text, jsonEncode(resp));
        return;
      }
      if (managerName == 'ChatManager' && method == 'realWebMessageSuccess') {
        final message =
            args is Map ? Map<String, dynamic>.from(args) : <String, dynamic>{};
        _logV('bridge cmd realWebMessageSuccess: ${jsonEncode(message)}');
        EventBridgeHandler.instance.emitMessageSuccess(message: message);
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
        final detail = await withBridgeTimeout(
          manager.callNativeMethod('getChatRoom', detailArgs),
          managerName: managerName,
          method: 'getChatRoom',
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
        final detail = await withBridgeTimeout(
          manager.callNativeMethod('getGroupWithId', detailArgs),
          managerName: managerName,
          method: 'getGroupWithId',
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
        final detail = await withBridgeTimeout(
          manager.callNativeMethod('fetchChatThreadDetail', detailArgs),
          managerName: managerName,
          method: 'fetchChatThreadDetail',
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
          final detail = await withBridgeTimeout(
            manager.callNativeMethod('getMessage', {'msgId': msgId}),
            managerName: managerName,
            method: 'getMessage',
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

      final dynamic result;
      if (managerName == 'ChatManager' && method == 'sendMessageWithType') {
        final typeStr = args['type']?.toString();
        final payloadRaw = args['payload'];
        if (typeStr == null || payloadRaw is! Map) {
          throw PlatformException(
            code: 'invalid_args',
            message: 'sendMessageWithType requires type and payload',
          );
        }
        final type = EMSendMessageType.values.byName(typeStr);
        final payload = Map<String, dynamic>.from(payloadRaw);
        final message = await withBridgeTimeout(
          EMClient.getInstance.chatManager.sendMessageWithType(
            type,
            payload,
          ),
          managerName: managerName,
          method: method,
        );
        result = {method: message.toJson()};
      } else {
        result = await withBridgeTimeout(
          manager.callNativeMethod(method, args),
          managerName: managerName,
          method: method,
        );
      }
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
          await withBridgeTimeout(
            Client.instance.callNativeMethod(_startCallback),
            managerName: 'Client',
            method: _startCallback,
          );
          EventBridgeHandler.instance.registerAllHandlers(
            deviceName: _deviceName,
            sendEvent: sendEvent,
            emitConnectedOnRegister: _webSdkMode != 'real_sdk',
          );
          _startWebRealTextFlush();
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
        _startWebRealTextFlush();
      }
      if (managerName == 'Client' &&
          (method == 'logout' || method == 'webReset')) {
        _stopWebRealTextFlush();
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
        final detail = await withBridgeTimeout(
          manager.callNativeMethod('getChatRoom', detailArgs),
          managerName: managerName,
          method: 'getChatRoom',
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
        final detail = await withBridgeTimeout(
          manager.callNativeMethod('getGroupWithId', detailArgs),
          managerName: managerName,
          method: 'getGroupWithId',
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
            final detail = await withBridgeTimeout(
              manager.callNativeMethod('fetchPresenceStatus', {
                'members': [userId],
              }),
              managerName: managerName,
              method: 'fetchPresenceStatus',
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
        if (message is Map) {
          final normalized = Map<String, dynamic>.from(message);
          if (_webSdkMode != 'real_sdk') {
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
          final detail = await withBridgeTimeout(
            manager.callNativeMethod('getMessage', {'msgId': msgId}),
            managerName: managerName,
            method: 'getMessage',
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
          final detail = await withBridgeTimeout(
            manager.callNativeMethod('getMessage', {'msgId': msgId}),
            managerName: managerName,
            method: 'getMessage',
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
            messageId: msgId,
            conversationId: convId,
            pinOperation: method == 'pinMessage'
                ? MessagePinOperation.Pin
                : MessagePinOperation.Unpin,
            pinInfo: {
              'operatorId': operator,
            },
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
        final detail = await withBridgeTimeout(
          manager.callNativeMethod('fetchChatThreadDetail', detailArgs),
          managerName: managerName,
          method: 'fetchChatThreadDetail',
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
    final result = await withBridgeTimeout(
      Client.instance.callNativeMethod('getCurrentUser'),
      managerName: 'Client',
      method: 'getCurrentUser',
    );
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

  static Map<String, dynamic> _normalizeEventData(
    String eventType,
    Map<String, dynamic> data,
  ) {
    final normalized = Map<String, dynamic>.from(data);
    if (eventType == 'onMessageSuccess' || eventType == 'onMessageError') {
      final message = normalized['msg'] ?? normalized['message'];
      if (message is Map) {
        normalized['msg'] = Map<String, dynamic>.from(message);
      }
      final localId = normalized['msgId'] ?? normalized['localId'];
      if (localId != null) {
        normalized['msgId'] = localId.toString();
      }
      normalized.remove('message');
      normalized.remove('localId');
    } else if (eventType == 'onMessageProgress' ||
        eventType == 'onMessageProgressUpdate') {
      final localId = normalized['msgId'] ?? normalized['localId'];
      if (localId != null) {
        normalized['msgId'] = localId.toString();
      }
      normalized.remove('localId');
    }
    return normalized;
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
      _lastBridgeEventType = eventType;
      if (eventType == 'onMessagesReceived') {
        _messagesReceivedEventsSent += 1;
      }
      final eventData = _normalizeEventData(eventType, data);
      final payload = {
        'type': 'event',
        'eventType': eventType,
        'data': _toJsonSafe(eventData),
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
