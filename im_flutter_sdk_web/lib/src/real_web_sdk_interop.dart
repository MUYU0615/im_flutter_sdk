part of 'client_web.dart';

const _realSdkGlobalNames = <String>[
  'WebIM',
  'EasemobChat',
  'Easemob',
  'IMSDK'
];

@JS('Object.keys')
external JSArray<JSAny?> _jsObjectKeys(JSAny? object);

@JS('Object.getOwnPropertyNames')
external JSArray<JSAny?> _jsGetOwnPropertyNames(JSAny? object);

@JS('Object.getPrototypeOf')
external JSAny? _jsGetPrototypeOf(JSAny? object);

Map<String, dynamic> realWebSdkStatus() {
  for (final name in _realSdkGlobalNames) {
    final sdk = globalContext.getProperty<JSAny?>(name.toJS);
    if (sdk != null && !sdk.isUndefinedOrNull) {
      return {
        'available': true,
        'globalName': name,
        'sdkMode': 'real_sdk',
      };
    }
  }
  return {
    'available': false,
    'sdkMode': 'real_sdk',
    'code': 900101,
    'description':
        'Real Web SDK is not loaded. Load easemob-websdk/Easemob-chat.js before running real_sdk E2E.',
    'checkedGlobals': _realSdkGlobalNames,
  };
}

Map<String, dynamic> realWebSdkSyncState(Object? client) {
  if (client == null) {
    return {
      'available': false,
      'reason': 'client_unavailable',
    };
  }
  final serverUrls =
      js_util.callMethod<Object?>(client, 'getServerUrlsConfig', const []);
  final sessionListSyncWsUrls = js_util.callMethod<Object?>(
    client,
    'getSessionListSyncWsUrls',
    const [],
  );
  final contactSyncWsUrls =
      js_util.getProperty<Object?>(client, 'contactSyncWsUrls');
  final contactSyncDnsResolved =
      js_util.getProperty<Object?>(client, 'contactSyncDnsResolved');
  return {
    'available': true,
    'serverUrls': _toDartMapOrNull(serverUrls),
    'sessionListSyncWsUrls': _toStringList(sessionListSyncWsUrls),
    'contactSyncWsUrls': _toStringList(contactSyncWsUrls),
    'contactSyncDnsResolved': contactSyncDnsResolved == true,
  };
}

List<String> realWebSdkBufferedLogs() {
  try {
    final loggerModule = globalContext.getProperty<JSAny?>('IMSDK'.toJS);
    if (loggerModule == null || loggerModule.isUndefinedOrNull) {
      return const <String>[];
    }
    final logs = js_util.callMethod<Object?>(
      loggerModule,
      'getBufferedLogs',
      const [],
    );
    return _toStringList(logs);
  } catch (_) {
    return const <String>[];
  }
}

Map<String, dynamic>? _toDartMapOrNull(Object? value) {
  final dart = js_util.dartify(value);
  return dart is Map ? Map<String, dynamic>.from(dart) : null;
}

List<String> _toStringList(Object? value) {
  final dart = js_util.dartify(value);
  if (dart is List) {
    return dart.map((item) => item.toString()).toList(growable: false);
  }
  return const <String>[];
}

class RealWebSdkClient {
  RealWebSdkClient({
    required this.onTextMessage,
    required this.onMessageSuccess,
    required this.onDeliveredAckMessage,
    required this.onReadAckMessage,
    required this.onModifiedMessage,
    required this.onRecallMessage,
    required this.onMessagePinChanged,
    required this.onReactionChanged,
    required this.onConversationUpdated,
    required this.onPresenceStatusChanged,
    required this.onContactEvent,
    required this.onUserInfoEvent,
    required this.onGroupEvent,
    required this.onChatRoomEvent,
    required this.onClientEvent,
    required this.onConnected,
    required this.onDisconnected,
    required this.onConversationRead,
  });

  final Future<void> Function(Map<String, dynamic> message) onTextMessage;
  final Future<void> Function(Map<String, dynamic> message) onMessageSuccess;
  final Future<void> Function(Map<String, dynamic> message)
      onDeliveredAckMessage;
  final Future<void> Function(Map<String, dynamic> message) onReadAckMessage;
  final Future<void> Function(Map<String, dynamic> message) onModifiedMessage;
  final Future<void> Function(Map<String, dynamic> message) onRecallMessage;
  final Future<void> Function(Map<String, dynamic> event) onMessagePinChanged;
  final Future<void> Function(Map<String, dynamic> event) onReactionChanged;
  final Future<void> Function(Map<String, dynamic> event) onConversationUpdated;
  final Future<void> Function(Map<String, dynamic> event)
      onPresenceStatusChanged;
  final Future<void> Function(String method, Map<String, dynamic> event)
      onContactEvent;
  final Future<void> Function(String method, dynamic arguments) onUserInfoEvent;
  final Future<void> Function(String method, Map<String, dynamic> event)
      onGroupEvent;
  final Future<void> Function(String method, Map<String, dynamic> event)
      onChatRoomEvent;
  final Future<void> Function(String method, Map<String, dynamic> event)
      onClientEvent;
  final Future<void> Function([Map<String, dynamic>? event]) onConnected;
  final Future<void> Function([Map<String, dynamic>? event]) onDisconnected;
  final Future<void> Function(Map<String, dynamic> event) onConversationRead;
  Object? _connection;
  Object? _highLevelClient;
  String? _currentUser;
  String? _configuredSyncWsFallbackUrl;
  final List<Map<String, dynamic>> _debugEvents = [];
  final Map<String, Map<String, dynamic>> _messageIndex = {};
  final Map<String, Map<String, dynamic>> _userInfoCache = {};
  final Map<String, List<Map<String, dynamic>>> _uploadedGroupSharedFiles = {};
  bool _webSocketProbeInstalled = false;

  void recordExternalDebugEvent(String type, [Map<String, dynamic>? payload]) {
    _recordDebug(type, payload ?? const <String, dynamic>{});
  }

  Future<void> init(Map<String, dynamic> options) async {
    _installWebSocketProbe();
    _recordDebug('init_enter', {
      'appKeyPresent': (options['appKey']?.toString().isNotEmpty ?? false),
      'checkedGlobals': _realSdkGlobalNames,
    });
    final imsdk = _imSdkObject();
    if (imsdk != null) {
      _recordDebug('init_runtime_selected', {'runtime': 'imsdk'});
      await _initImSdkClient(options, imsdk);
      _installEventHandler();
      return;
    }
    final webIm = _webImObject();
    if (webIm == null) {
      _recordDebug('init_runtime_missing', {});
      throw StateError(realWebSdkStatus()['description'].toString());
    }
    _recordDebug('init_runtime_selected', {'runtime': 'legacy_webim'});
    final connectionCtor = js_util.getProperty<Object?>(webIm, 'connection');
    if (connectionCtor == null) {
      _recordDebug('init_connection_ctor_missing', {'runtime': 'legacy_webim'});
      throw StateError('Real Web SDK global WebIM.connection is missing.');
    }
    final appKey = options['appKey']?.toString() ?? '';
    if (appKey.isEmpty) {
      throw StateError('Real Web SDK init requires appKey.');
    }
    final params = <String, Object?>{
      'appKey': appKey,
      'isHttpDNS': options['enableDNSConfig'] != false,
      'delivery': options['requireAck'] == true,
    };
    _putIfPresent(params, 'apiUrl', options['restServer']);
    _putIfPresent(params, 'url', options['webSocketServer']);
    _connection =
        js_util.callConstructor(connectionCtor, [js_util.jsify(params)]);
    _installEventHandler();
    _recordDebug('legacy_webim_init_success', {
      'hasConnection': _connection != null,
    });
  }

  void _installWebSocketProbe() {
    if (_webSocketProbeInstalled) {
      return;
    }
    _webSocketProbeInstalled = true;
    try {
      final original = js_util.getProperty<Object?>(globalContext, 'WebSocket');
      if (original == null) {
        _recordDebug('websocket_probe_install_skipped', {
          'reason': 'missing_global',
        });
        return;
      }
      final self = this;
      JSAny? probeFactory(JSAny? url, [JSAny? protocols]) {
        final socket = protocols == null
            ? js_util.callConstructor(
                original,
                [url],
              )
            : js_util.callConstructor(
                original,
                [url, protocols],
              );
        try {
          final rawUrl = url?.toString() ?? '';
          if (rawUrl.contains('8086') ||
              rawUrl.contains('/ws') ||
              rawUrl.contains('sync')) {
            self._recordDebug('websocket_probe_create', {
              'url': rawUrl,
            });
            js_util.callMethod(
              socket,
              'addEventListener',
              [
                'open',
                ((JSAny? _) {
                  self._recordDebug('websocket_probe_open', {
                    'url': rawUrl,
                  });
                }).toJS,
              ],
            );
            js_util.callMethod(
              socket,
              'addEventListener',
              [
                'error',
                ((JSAny? event) {
                  self._recordDebug('websocket_probe_error', {
                    'url': rawUrl,
                    'event': js_util.dartify(event),
                  });
                }).toJS,
              ],
            );
            js_util.callMethod(
              socket,
              'addEventListener',
              [
                'close',
                ((JSAny? event) {
                  final target = event!;
                  self._recordDebug('websocket_probe_close', {
                    'url': rawUrl,
                    'code': js_util.getProperty<Object?>(target, 'code'),
                    'reason': js_util.getProperty<Object?>(target, 'reason'),
                    'wasClean':
                        js_util.getProperty<Object?>(target, 'wasClean') ==
                            true,
                  });
                }).toJS,
              ],
            );
          }
        } catch (e) {
          self._recordDebug('websocket_probe_listener_error', {
            'error': _jsErrorDescription(e),
          });
        }
        return socket as JSAny?;
      }

      final wrapper = js_util.callMethod<JSAny?>(
        globalContext,
        'Function',
        [
          'factory',
          'return function WebSocket(url, protocols) { return factory(url, protocols); }',
        ],
      );
      final wrappedCtor = js_util.callMethod<Object?>(
        wrapper as Object,
        'call',
        [null, probeFactory.toJS],
      );
      if (wrappedCtor != null) {
        final originalPrototype =
            js_util.getProperty<Object?>(original, 'prototype');
        if (originalPrototype != null) {
          js_util.setProperty(wrappedCtor, 'prototype', originalPrototype);
        }
        js_util.setProperty(globalContext, 'WebSocket', wrappedCtor);
        _recordDebug('websocket_probe_installed', {});
      }
    } catch (e) {
      _recordDebug('websocket_probe_install_error', {
        'error': _jsErrorDescription(e),
      });
    }
  }

  Future<void> _initImSdkClient(
    Map<String, dynamic> options,
    Object imsdk,
  ) async {
    final chatClient = js_util.getProperty<Object?>(imsdk, 'ChatClient');
    if (chatClient == null) {
      throw StateError('Real Web SDK global IMSDK.ChatClient is missing.');
    }
    final groupManager = js_util.getProperty<Object?>(imsdk, 'GroupManager');
    final chatManager = js_util.getProperty<Object?>(imsdk, 'ChatManager');
    final chatThreadManager =
        js_util.getProperty<Object?>(imsdk, 'ChatThreadManager');
    final chatRoomManager =
        js_util.getProperty<Object?>(imsdk, 'ChatRoomManager');
    final presenceManager =
        js_util.getProperty<Object?>(imsdk, 'PresenceManager');
    final pushManager = js_util.getProperty<Object?>(imsdk, 'PushManager');
    final contactManager =
        js_util.getProperty<Object?>(imsdk, 'ContactManager');
    final userInfoManager =
        js_util.getProperty<Object?>(imsdk, 'UserInfoManager');
    final serviceConfig = _buildImSdkServiceConfig(options);
    _configuredSyncWsFallbackUrl = _normalizedWsUrl(
      options['syncDataWebSocketServer'],
      options['syncDataWebSocketPort'],
    );
    final initConfig = <String, Object?>{
      'appKey': options['appKey']?.toString() ?? '',
      if (options['enableAutoSyncContacts'] == true)
        'enableSyncData': const ['contact'],
      if (serviceConfig.isNotEmpty) 'serviceConfig': serviceConfig,
      'managers': [
        if (chatManager != null) chatManager,
        if (groupManager != null) groupManager,
        if (chatThreadManager != null) chatThreadManager,
        if (chatRoomManager != null) chatRoomManager,
        if (presenceManager != null) presenceManager,
        if (pushManager != null) pushManager,
        if (contactManager != null) contactManager,
        if (userInfoManager != null) userInfoManager,
      ],
    };
    _recordDebug('imsdk_init_config', {
      'appKey': initConfig['appKey'],
      'enableDNSConfig': options['enableDNSConfig'] != false,
      'enableSyncData': initConfig['enableSyncData'],
      'serviceConfig': serviceConfig,
    });
    final initMethod = js_util.getProperty<Object?>(chatClient, 'init');
    if (initMethod == null) {
      throw StateError('Real Web SDK IMSDK.ChatClient.init is missing.');
    }
    final client = js_util.callMethod<Object?>(
      chatClient,
      'init',
      [js_util.jsify(initConfig)],
    );
    if (client == null) {
      throw StateError('Real Web SDK IMSDK.ChatClient.init returned null.');
    }
    void useManager(Object? managerCtor) {
      if (managerCtor == null) {
        return;
      }
      try {
        js_util.callMethod<Object?>(client, 'use', [managerCtor]);
      } catch (_) {
        // Fall back to the init(managers:[...]) registration path when use() is
        // unnecessary or unsupported by the current bundle.
      }
    }

    useManager(chatManager);
    useManager(groupManager);
    useManager(chatThreadManager);
    useManager(chatRoomManager);
    useManager(presenceManager);
    useManager(pushManager);
    useManager(contactManager);
    useManager(userInfoManager);
    _highLevelClient = client;
    _connection = client;
    _installImSdkSyncWsFallback(client);
    _recordDebug('imsdk_init_success', {
      'hasChatManager': js_util.hasProperty(client, 'chatManager'),
      'hasGroupManager': js_util.hasProperty(client, 'groupManager'),
      'hasChatThreadManager': js_util.hasProperty(client, 'chatThreadManager'),
      'hasChatRoomManager': js_util.hasProperty(client, 'chatRoomManager'),
      'hasPresenceManager': js_util.hasProperty(client, 'presenceManager'),
    });
  }

  Map<String, Object?> _buildImSdkServiceConfig(Map<String, dynamic> options) {
    final restServer = options['restServer']?.toString();
    final webSocketServer = options['webSocketServer']?.toString();
    final webSocketPort = options['webSocketPort'];
    final syncWsServer = options['syncDataWebSocketServer']?.toString();
    final syncWsPort = options['syncDataWebSocketPort'];
    final dnsUrl = options['dnsUrl']?.toString();
    final enableDNSConfig = options['enableDNSConfig'] != false;

    final restApiUrl = _normalizedHttpUrl(restServer);
    final wsUrl = _normalizedWsUrl(webSocketServer, webSocketPort);
    final syncWsUrl = _normalizedWsUrl(syncWsServer, syncWsPort);

    final config = <String, Object?>{};
    if (restApiUrl != null && wsUrl != null) {
      final serverUrls = <String, Object?>{
        'restApiUrl': restApiUrl,
        'wsUrl': wsUrl,
      };
      if (syncWsUrl != null) {
        serverUrls['syncWsUrl'] = syncWsUrl;
      }
      config['serverUrls'] = serverUrls;
      config['mode'] = 'fixed';
    } else if (enableDNSConfig) {
      config['mode'] = 'dns';
      if (dnsUrl != null && dnsUrl.isNotEmpty) {
        config['dnsConfigUrls'] = [dnsUrl];
      }
    }
    return config;
  }

  void _installImSdkSyncWsFallback(Object client) {
    final fallbackUrl = _configuredSyncWsFallbackUrl;
    if (fallbackUrl == null || fallbackUrl.isEmpty) {
      return;
    }
    final serverUrls = _toDartMapOrNull(
      js_util.callMethod<Object?>(client, 'getServerUrlsConfig', const []),
    );
    if (serverUrls != null) {
      _recordDebug('imsdk_sync_ws_fallback_skipped', {
        'reason': 'fixed_server_urls_in_use',
        'fallbackUrl': fallbackUrl,
      });
      return;
    }
    try {
      js_util.setProperty(client, 'contactSyncWsUrls', [fallbackUrl]);
      js_util.setProperty(
          client, 'syncConversationListConfigWsUrls', [fallbackUrl]);
      js_util.setProperty(client, 'contactSyncDnsResolved', true);
      _recordDebug('imsdk_sync_ws_fallback_injected', {
        'fallbackUrl': fallbackUrl,
      });
    } catch (e) {
      _recordDebug('imsdk_sync_ws_fallback_error', {
        'fallbackUrl': fallbackUrl,
        'error': _jsErrorDescription(e),
      });
    }
  }

  void _reapplyImSdkSyncWsFallbackAfterLogin(Object client) {
    final fallbackUrl = _configuredSyncWsFallbackUrl;
    if (fallbackUrl == null || fallbackUrl.isEmpty) {
      return;
    }
    final serverUrls = _toDartMapOrNull(
      js_util.callMethod<Object?>(client, 'getServerUrlsConfig', const []),
    );
    if (serverUrls != null) {
      return;
    }
    final currentContactSyncWsUrls = _toStringList(
      js_util.getProperty<Object?>(client, 'contactSyncWsUrls'),
    );
    final currentSessionSyncWsUrls = _toStringList(
      js_util.getProperty<Object?>(client, 'syncConversationListConfigWsUrls'),
    );
    if (currentContactSyncWsUrls.isNotEmpty ||
        currentSessionSyncWsUrls.isNotEmpty) {
      _recordDebug('imsdk_sync_ws_fallback_reapply_skipped', {
        'reason': 'runtime_urls_already_present',
        'contactSyncWsUrls': currentContactSyncWsUrls,
        'sessionSyncWsUrls': currentSessionSyncWsUrls,
      });
      return;
    }
    try {
      js_util.setProperty(client, 'contactSyncWsUrls', [fallbackUrl]);
      js_util.setProperty(
          client, 'syncConversationListConfigWsUrls', [fallbackUrl]);
      js_util.setProperty(client, 'contactSyncDnsResolved', true);
      _recordDebug('imsdk_sync_ws_fallback_reapplied_after_login', {
        'fallbackUrl': fallbackUrl,
      });
    } catch (e) {
      _recordDebug('imsdk_sync_ws_fallback_reapply_error', {
        'fallbackUrl': fallbackUrl,
        'error': _jsErrorDescription(e),
      });
    }
  }

  String? _normalizedHttpUrl(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return 'https://$value';
  }

  String? _normalizedWsUrl(Object? rawHost, Object? rawPort) {
    final host = rawHost?.toString().trim();
    if (host == null || host.isEmpty) {
      return null;
    }
    if (host.startsWith('ws://') || host.startsWith('wss://')) {
      return host;
    }
    final port =
        rawPort is int ? rawPort : int.tryParse(rawPort?.toString() ?? '');
    final scheme = port == 443 ? 'wss' : 'ws';
    if (port != null && port > 0) {
      return '$scheme://$host:$port';
    }
    return '$scheme://$host';
  }

  Future<void> login({
    required String? userId,
    required String? secret,
    required bool isPassword,
  }) async {
    if (userId == null || userId.isEmpty) {
      throw StateError('Real Web SDK login requires userId.');
    }
    if (secret == null || secret.isEmpty) {
      throw StateError('Real Web SDK login requires password or accessToken.');
    }
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      _recordDebug('login_attempt', {
        'userId': userId,
        'runtime': 'imsdk',
        'tokenLength': secret.length,
      });
      final promise = js_util.callMethod<Object?>(
        highLevelClient,
        'login',
        [
          js_util.jsify({
            'userId': userId,
            'token': secret,
          }),
        ],
      );
      try {
        await js_util.promiseToFuture<Object?>(promise as Object);
      } catch (e) {
        _recordDebug('login_error', {'error': _jsErrorDescription(e)});
        throw StateError(
            'Real Web SDK login failed: ${_jsErrorDescription(e)}');
      }
      _currentUser = userId;
      await _waitForHighLevelConnected();
      _reapplyImSdkSyncWsFallbackAfterLogin(highLevelClient);
      _recordDebug('login_success', {
        'userId': userId,
        'runtime': 'imsdk',
        'hasChatManager': js_util.hasProperty(highLevelClient, 'chatManager'),
        'hasGroupManager': js_util.hasProperty(highLevelClient, 'groupManager'),
        'hasChatThreadManager':
            js_util.hasProperty(highLevelClient, 'chatThreadManager'),
        'hasChatRoomManager':
            js_util.hasProperty(highLevelClient, 'chatRoomManager'),
        'hasPresenceManager':
            js_util.hasProperty(highLevelClient, 'presenceManager'),
        'connectionState': js_util.callMethod<Object?>(
          highLevelClient,
          'getConnectionState',
          const [],
        )?.toString(),
      });
      return;
    }
    final conn = _requireConnection();
    final loginOptions = <String, Object?>{'user': userId};
    if (isPassword) {
      loginOptions['pwd'] = secret;
    } else {
      loginOptions['accessToken'] = secret;
    }
    final promise = js_util.callMethod<Object?>(
      conn,
      'open',
      [js_util.jsify(loginOptions)],
    );
    try {
      await js_util.promiseToFuture<Object?>(promise as Object);
    } catch (e) {
      _recordDebug('login_error', {'error': _jsErrorDescription(e)});
      throw StateError('Real Web SDK login failed: ${_jsErrorDescription(e)}');
    }
    _currentUser = userId;
    _recordDebug('login_success', {'userId': userId});
  }

  Future<void> registerUser({
    required String userId,
    required String password,
  }) async {
    final conn = _requireConnection();
    final promise = js_util.callMethod<Object?>(
      conn,
      'registerUser',
      [
        js_util.jsify({
          'username': userId,
          'password': password,
        }),
      ],
    );
    try {
      await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug('registerUser_success', {'userId': userId});
    } catch (e) {
      _recordDebug('registerUser_error', {'error': _jsErrorDescription(e)});
      throw StateError(
        'Real Web SDK registerUser failed: ${_jsErrorDescription(e)}',
      );
    }
  }

  Future<void> renewToken(String token) async {
    if (token.isEmpty) {
      throw StateError('Real Web SDK renewToken requires accessToken.');
    }
    final conn = _requireConnection();
    final promise = js_util.callMethod<Object?>(
      conn,
      'renewToken',
      [token],
    );
    try {
      await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug('renewToken_success', {'tokenLength': token.length});
    } catch (e) {
      _recordDebug('renewToken_error', {'error': _jsErrorDescription(e)});
      throw StateError(
        'Real Web SDK renewToken failed: ${_jsErrorDescription(e)}',
      );
    }
  }

  Future<void> logout() async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final result = js_util.callMethod<Object?>(
        highLevelClient,
        'logout',
        const [],
      );
      await _awaitMaybePromise(result);
      _currentUser = null;
      return;
    }
    final conn = _connection;
    if (conn != null) {
      js_util.callMethod<Object?>(conn, 'close', const []);
    }
    _currentUser = null;
  }

  bool isConnected() {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final result = js_util.callMethod<Object?>(
        highLevelClient,
        'getConnectionState',
        const [],
      );
      return result?.toString() == 'connected';
    }
    final conn = _connection;
    if (conn == null) return false;
    final result = js_util.callMethod<Object?>(conn, 'isOpened', const []);
    return result == true;
  }

  Future<void> _waitForHighLevelConnected({
    Duration timeout = const Duration(seconds: 10),
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient == null) {
      return;
    }
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      final state = js_util.callMethod<Object?>(
        highLevelClient,
        'getConnectionState',
        const [],
      )?.toString();
      if (state == 'connected') {
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    final state = js_util.callMethod<Object?>(
      highLevelClient,
      'getConnectionState',
      const [],
    )?.toString();
    throw StateError(
      'Real Web SDK ChatClient did not reach connected state within ${timeout.inSeconds}s (state=$state).',
    );
  }

  String? deviceId() {
    final conn = _connection;
    if (conn == null) return null;
    return js_util.getProperty<Object?>(conn, 'deviceId')?.toString();
  }

  String? deviceIdFromConnection() {
    final conn = _connection;
    if (conn == null) return null;
    for (final key in const ['clientResource', 'deviceId']) {
      final value = js_util.getProperty<Object?>(conn, key);
      final text = value?.toString();
      if (text != null && text.isNotEmpty && text != 'null') {
        return text;
      }
    }
    return null;
  }

  Future<Map<String, dynamic>> sendTextMessage(Map<String, dynamic> map) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      await _waitForHighLevelConnected();
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final body = _asMap(map['body']);
      final to = map['to']?.toString() ?? '';
      final content = body['content']?.toString() ?? '';
      final createResult = js_util.callMethod<Object?>(
        chatManager,
        'createTextMessage',
        [
          js_util.jsify({
            'conversationId': to,
            'conversationType': _webChatType(map['chatType']),
            'content': content,
            if (map['needGroupAck'] == true) 'needGroupReadReceipt': true,
          }),
        ],
      );
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'sendMessage',
        [createResult as Object],
      );
      Object? result;
      try {
        result = await js_util.promiseToFuture<Object?>(promise as Object);
      } catch (e) {
        _recordDebug('send_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK sendTextMessage failed: ${_jsErrorDescription(e)}',
        );
      }
      final sent = _normalizeRealTextMessage(
        js_util.dartify(result),
        fallback: map,
        content: content,
      );
      _rememberMessage(sent);
      _recordDebug('send_success_bridge_emit_begin', {
        'runtime': 'imsdk',
        'msgId': sent['msgId'],
        'bodyType': _asMap(sent['body'])['type'],
      });
      await onMessageSuccess(sent);
      _recordDebug('send_success_bridge_emit_end', {
        'runtime': 'imsdk',
        'msgId': sent['msgId'],
      });
      return sent;
    }
    final conn = _requireConnection();
    final webIm = _webImObject();
    if (webIm == null) {
      throw StateError('Real Web SDK global WebIM is missing.');
    }
    final messageApi = js_util.getProperty<Object?>(webIm, 'message');
    if (messageApi == null) {
      throw StateError('Real Web SDK global WebIM.message is missing.');
    }
    final body = _asMap(map['body']);
    final to = map['to']?.toString() ?? '';
    final content = body['content']?.toString() ?? '';
    final messageOptions = {
      'chatType': _webChatType(map['chatType']),
      'type': 'txt',
      'to': to,
      'msg': content,
      if (map['needGroupAck'] == true) 'msgConfig': {'allowGroupAck': true},
    };
    final message = js_util.callMethod<Object?>(
      messageApi,
      'create',
      [js_util.jsify(messageOptions)],
    );
    final promise = js_util.callMethod<Object?>(conn, 'send', [message]);
    Object? result;
    try {
      result = await js_util.promiseToFuture<Object?>(promise as Object);
    } catch (e) {
      _recordDebug('send_error', {'error': _jsErrorDescription(e)});
      throw StateError(
          'Real Web SDK sendTextMessage failed: ${_jsErrorDescription(e)}');
    }
    final sent = _normalizeRealTextMessage(
      js_util.dartify(result),
      fallback: map,
      content: content,
    );
    _rememberMessage(sent);
    return sent;
  }

  Future<Map<String, dynamic>> sendCmdMessage(Map<String, dynamic> map) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      await _waitForHighLevelConnected();
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final body = _asMap(map['body']);
      final to = map['to']?.toString() ?? '';
      final action = body['action']?.toString() ?? '';
      final createResult = js_util.callMethod<Object?>(
        chatManager,
        'createCmdMessage',
        [
          js_util.jsify({
            'conversationId': to,
            'conversationType': _webChatType(map['chatType']),
            'action': action,
          }),
        ],
      );
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'sendMessage',
        [createResult as Object],
      );
      Object? result;
      try {
        result = await js_util.promiseToFuture<Object?>(promise as Object);
      } catch (e) {
        _recordDebug('send_cmd_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK sendCmdMessage failed: ${_jsErrorDescription(e)}',
        );
      }
      final sent = _normalizeRealIncomingMessage(
        js_util.dartify(result),
        fallback: map,
      );
      _rememberMessage(sent);
      _recordDebug('send_success_bridge_emit_begin', {
        'runtime': 'imsdk',
        'msgId': sent['msgId'],
        'bodyType': _asMap(sent['body'])['type'],
      });
      await onMessageSuccess(sent);
      _recordDebug('send_success_bridge_emit_end', {
        'runtime': 'imsdk',
        'msgId': sent['msgId'],
      });
      return sent;
    }
    return sendTextMessage(map);
  }

  Future<Map<String, dynamic>> sendCombineMessage(
      Map<String, dynamic> map) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final body = _asMap(map['body']);
      final to = map['to']?.toString() ?? '';
      final chatType = _webChatType(map['chatType']);
      final msgIds = _asStringList(body['messageList']);
      final messageList = <Map<String, dynamic>>[];
      for (final msgId in msgIds) {
        final message = _messageIndex[msgId];
        if (message != null) {
          messageList.add(_toImSdkMessage(message));
        }
      }
      try {
        final createParams = {
          'conversationId': to,
          'conversationType': chatType,
          'title': body['title']?.toString() ?? '',
          'summary': body['summary']?.toString() ?? '',
          'compatibleText': body['compatibleText']?.toString() ?? '',
          'messageList': messageList,
        };
        _recordDebug('send_combine_create_params', {
          'runtime': 'imsdk',
          'params': createParams,
        });
        final created = js_util.callMethod<Object?>(
          chatManager,
          'createCombineMessage',
          [
            js_util.jsify(createParams),
          ],
        );
        if (created == null) {
          throw StateError('Real Web SDK createCombineMessage returned null.');
        }
        _recordDebug('send_combine_created', {
          'runtime': 'imsdk',
          'created': js_util.dartify(created),
        });
        final sentRaw = await js_util.promiseToFuture<Object?>(
          js_util.callMethod<Object?>(
            chatManager,
            'sendMessage',
            [created],
          ) as Object,
        );
        _recordDebug('send_combine_sent_raw', {
          'runtime': 'imsdk',
          'raw': js_util.dartify(sentRaw),
        });
        final sent = _normalizeRealCombineMessage(js_util.dartify(sentRaw),
            fallback: map);
        _rememberMessage(sent);
        _recordDebug('send_success_bridge_emit_begin', {
          'runtime': 'imsdk',
          'msgId': sent['msgId'],
          'bodyType': _asMap(sent['body'])['type'],
        });
        await onMessageSuccess(sent);
        _recordDebug('send_success_bridge_emit_end', {
          'runtime': 'imsdk',
          'msgId': sent['msgId'],
        });
        return sent;
      } catch (e) {
        _recordDebug('send_combine_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK sendCombineMessage failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    final conn = _requireConnection();
    final webIm = _webImObject();
    if (webIm == null) {
      throw StateError('Real Web SDK global WebIM is missing.');
    }
    final messageApi = js_util.getProperty<Object?>(webIm, 'message');
    if (messageApi == null) {
      throw StateError('Real Web SDK global WebIM.message is missing.');
    }
    final body = _asMap(map['body']);
    final to = map['to']?.toString() ?? '';
    final messageList = _asStringList(body['messageList']);
    final messageOptions = {
      'chatType': _webChatType(map['chatType']),
      'type': 'combine',
      'to': to,
      'title': body['title']?.toString() ?? '',
      'summary': body['summary']?.toString() ?? '',
      'compatibleText': body['compatibleText']?.toString() ?? '',
      'messageList': messageList,
    };
    final message = js_util.callMethod<Object?>(
      messageApi,
      'create',
      [js_util.jsify(messageOptions)],
    );
    final promise = js_util.callMethod<Object?>(conn, 'send', [message]);
    Object? result;
    try {
      result = await js_util
          .promiseToFuture<Object?>(promise as Object)
          .timeout(const Duration(seconds: 15));
    } catch (e) {
      _recordDebug('send_combine_error', {'error': _jsErrorDescription(e)});
      throw StateError(
        'Real Web SDK sendCombineMessage failed: ${_jsErrorDescription(e)}',
      );
    }
    final raw = js_util.dartify(result);
    final sent = _normalizeRealCombineMessage(raw, fallback: map);
    _rememberMessage(sent);
    return sent;
  }

  Map<String, dynamic> _toImSdkMessage(Map<String, dynamic> message) {
    final body = _asMap(message['body']);
    final typeCode = _asInt(body['type']) ?? 0;
    final envelope = _toImSdkMessageEnvelope(message);
    switch (typeCode) {
      case 0:
        return {
          ...envelope,
          'type': 'text',
          'body': {
            'content': body['content']?.toString() ?? '',
          },
        };
      default:
        throw StateError(
          'Real Web SDK combine mapping does not yet support body.type=$typeCode.',
        );
    }
  }

  Map<String, dynamic> _toImSdkMessageEnvelope(Map<String, dynamic> message) {
    final rawConversationType = message['conversationType']?.toString();
    final chatType = rawConversationType == null || rawConversationType.isEmpty
        ? _webChatType(message['chatType'])
        : rawConversationType;
    final conversationId =
        message['convId']?.toString() ?? message['to']?.toString() ?? '';
    final msgId = message['msgId']?.toString() ?? '';
    final msgServerId =
        message['msgServerId']?.toString() ?? (msgId.isEmpty ? '' : msgId);
    final from = message['from']?.toString() ?? '';
    final direct = message['direct']?.toString() ??
        ((from == _currentUser) ? 'SEND' : 'RECEIVE');
    final timestamp = _asInt(message['serverTime']) ??
        _asInt(message['localTime']) ??
        _asInt(message['timestamp']) ??
        DateTime.now().millisecondsSinceEpoch;
    return {
      'id': msgId,
      'msgId': msgId,
      'msgServerId': msgServerId,
      'msgLocalId': message['msgLocalId']?.toString() ?? msgId,
      'from': from,
      'to': message['to']?.toString() ?? '',
      'sender': {
        'userId': from,
      },
      'conversationId': conversationId,
      'conversationType': chatType,
      'chatType': chatType,
      'direct': direct,
      'status': message['status']?.toString() ?? 'sent',
      'ext': _asMap(message['attributes']).isNotEmpty
          ? _asMap(message['attributes'])
          : _asMap(message['ext']),
      'timestamp': timestamp,
    };
  }

  Future<List<Map<String, dynamic>>> downloadAndParseCombineMessage(
    Map<String, dynamic> message,
  ) async {
    final body = _asMap(message['body']);
    final remotePath = body['remotePath']?.toString() ??
        body['url']?.toString() ??
        body['combineUrl']?.toString() ??
        '';
    final secret = body['secret']?.toString() ?? '';
    if (remotePath.isEmpty || secret.isEmpty) {
      throw StateError(
          'Real Web SDK combine message missing remotePath/secret.');
    }
    final highLevelClient = _highLevelClient;
    Object? result;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      result = await js_util.promiseToFuture<Object?>(
        js_util.callMethod<Object?>(
          chatManager,
          'downloadAndParseCombineMessage',
          [
            js_util.jsify({
              'message': {
                'type': 'combine',
                'body': {
                  'url': remotePath,
                  'secret': secret,
                },
              },
            }),
          ],
        ) as Object,
      );
    } else {
      result = await _callRealSdk('downloadAndParseCombineMessage', [
        {'url': remotePath, 'secret': secret},
      ]);
    }
    final raw = js_util.dartify(result);
    final parsed = _asMapList(raw).map((item) {
      final normalized = _normalizeRealIncomingMessage(item);
      _rememberMessage(normalized);
      return normalized;
    }).toList();
    return parsed;
  }

  Future<void> ackMessageRead({
    required String msgId,
    required String to,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final currentUser = _currentUser ?? '';
      final message = {
        'msgServerId': msgId,
        'msgLocalId': msgId,
        'from': to,
        'to': currentUser,
        'sender': {'userId': to},
        'conversationId': to,
        'conversationType': 'singleChat',
        'type': 'text',
        'status': 'sent',
        'ext': {},
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        'body': {'content': ''},
        'direct': 'RECEIVE',
      };
      try {
        final value = await js_util.promiseToFuture<Object?>(
          js_util.callMethod<Object?>(
            chatManager,
            'markMessageRead',
            [
              js_util.jsify({
                'messages': [
                  {'message': message}
                ],
              }),
            ],
          ) as Object,
        );
        _recordDebug('ackMessageRead_success', {
          'runtime': 'imsdk',
          'result': js_util.dartify(value),
          'msgId': msgId,
          'to': to,
        });
        return;
      } catch (e) {
        _recordDebug('ackMessageRead_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
            'Real Web SDK ackMessageRead failed: ${_jsErrorDescription(e)}');
      }
    }
    final conn = _requireConnection();
    final webIm = _webImObject();
    final messageApi =
        webIm == null ? null : js_util.getProperty<Object?>(webIm, 'message');
    if (messageApi == null) {
      throw StateError('Real Web SDK global WebIM.message is missing.');
    }
    final message = js_util.callMethod<Object?>(
      messageApi,
      'create',
      [
        js_util.jsify({
          'type': 'read',
          'to': to,
          'id': msgId,
          'chatType': 'singleChat',
        }),
      ],
    );
    final promise = js_util.callMethod<Object?>(conn, 'send', [message]);
    try {
      if (promise != null) {
        final value = await js_util.promiseToFuture<Object?>(promise);
        _recordDebug(
            'ackMessageRead_success', {'result': js_util.dartify(value)});
      }
    } catch (e) {
      _recordDebug('ackMessageRead_error', {'error': _jsErrorDescription(e)});
      throw StateError(
          'Real Web SDK ackMessageRead failed: ${_jsErrorDescription(e)}');
    }
  }

  Future<void> markConversationRead({
    required String conversationId,
    required int type,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'markConversationRead',
        [
          js_util.jsify({
            'conversationId': conversationId,
            'conversationType': _webChatType(type),
          }),
        ],
      );
      try {
        await js_util.promiseToFuture<Object?>(promise as Object);
        _recordDebug('markConversationRead_success', {
          'runtime': 'imsdk',
          'conversationId': conversationId,
          'conversationType': _webChatType(type),
        });
        return;
      } catch (e) {
        _recordDebug('markConversationRead_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK markConversationRead failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    throw StateError(
        'Real Web SDK markConversationRead is unavailable on legacy runtime.');
  }

  Future<void> addConversationMark({
    required List<String> conversationIds,
    required int mark,
  }) async {
    if (_highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final conversations = conversationIds
          .where((id) => id.isNotEmpty)
          .map((id) => {
                'conversationId': id,
                'conversationType': 'singleChat',
              })
          .toList();
      try {
        final promise = js_util.callMethod<Object?>(
          chatManager,
          'addConversationMark',
          [
            js_util.jsify({
              'conversations': conversations,
              'mark': mark,
            }),
          ],
        );
        await js_util.promiseToFuture<Object?>(promise as Object);
        _recordDebug('addConversationMark_success', {
          'runtime': 'imsdk',
          'conversationIds': conversationIds,
          'mark': mark,
        });
        return;
      } catch (e) {
        _recordDebug('addConversationMark_error', {
          'runtime': 'imsdk',
          'conversationIds': conversationIds,
          'mark': mark,
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK addConversationMark failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    throw StateError(
        'Real Web SDK addConversationMark is unavailable on legacy runtime.');
  }

  Future<void> removeConversationMark({
    required List<String> conversationIds,
    required int mark,
  }) async {
    if (_highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final conversations = conversationIds
          .where((id) => id.isNotEmpty)
          .map((id) => {
                'conversationId': id,
                'conversationType': 'singleChat',
              })
          .toList();
      try {
        final promise = js_util.callMethod<Object?>(
          chatManager,
          'removeConversationMark',
          [
            js_util.jsify({
              'conversations': conversations,
              'mark': mark,
            }),
          ],
        );
        await js_util.promiseToFuture<Object?>(promise as Object);
        _recordDebug('removeConversationMark_success', {
          'runtime': 'imsdk',
          'conversationIds': conversationIds,
          'mark': mark,
        });
        return;
      } catch (e) {
        _recordDebug('removeConversationMark_error', {
          'runtime': 'imsdk',
          'conversationIds': conversationIds,
          'mark': mark,
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK removeConversationMark failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    throw StateError(
        'Real Web SDK removeConversationMark is unavailable on legacy runtime.');
  }

  Future<void> clearAllMessagesAndConversations() async {
    if (_highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      try {
        final promise = js_util.callMethod<Object?>(
          chatManager,
          'clearAllMessagesAndConversations',
          const [],
        );
        await js_util.promiseToFuture<Object?>(promise as Object);
        _recordDebug('clearAllMessagesAndConversations_success', {
          'runtime': 'imsdk',
        });
        _messageIndex.clear();
        return;
      } catch (e) {
        _recordDebug('clearAllMessagesAndConversations_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK clearAllMessagesAndConversations failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    throw StateError(
      'Real Web SDK clearAllMessagesAndConversations is unavailable on legacy runtime.',
    );
  }

  Future<Map<String, dynamic>> downloadAttachment({
    required Map<String, dynamic> message,
    bool thumbnailOnly = false,
    bool bigImageOnly = false,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'downloadAttachment',
        [
          js_util.jsify({
            'message': _toImSdkDownloadableMessage(
              message,
              thumbnailOnly: thumbnailOnly,
              bigImageOnly: bigImageOnly,
            ),
          }),
        ],
      );
      try {
        final value = await js_util.promiseToFuture<Object?>(promise as Object);
        final normalized = _normalizeAttachmentDownloadResult(value);
        _recordDebug('downloadAttachment_success', {
          'runtime': 'imsdk',
          'result': normalized,
        });
        return normalized;
      } catch (e) {
        _recordDebug('downloadAttachment_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK downloadAttachment failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    throw StateError(
        'Real Web SDK downloadAttachment is unavailable on legacy runtime.');
  }

  Future<void> ackGroupMessageRead({
    required String msgId,
    required String groupId,
    String? content,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final indexed = _messageIndex[msgId] ?? const <String, dynamic>{};
      final readableMessage = _toImSdkMessage({
        ...indexed,
        'msgId': indexed['msgServerId']?.toString() ?? msgId,
        'msgServerId': indexed['msgServerId']?.toString() ?? msgId,
        'convId': indexed['convId']?.toString() ?? groupId,
        'conversationId': indexed['convId']?.toString() ?? groupId,
        'conversationType': 'groupChat',
        'to': indexed['to']?.toString() ?? groupId,
        'chatType': indexed['chatType'] ?? 1,
        'direct': indexed['direct']?.toString() ?? 'RECEIVE',
      });
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'markMessageRead',
        [
          js_util.jsify({
            'messages': [
              js_util.jsify({
                'message': readableMessage,
                if (content != null && content.isNotEmpty)
                  'ackContent': content,
              }),
            ],
          }),
        ],
      );
      try {
        await js_util.promiseToFuture<Object?>(promise as Object);
        _recordDebug('ackGroupMessageRead_success', {
          'runtime': 'imsdk',
          'msgId': msgId,
          'groupId': groupId,
        });
        return;
      } catch (e) {
        _recordDebug('ackGroupMessageRead_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK ackGroupMessageRead failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    final conn = _requireConnection();
    final webIm = _webImObject();
    final messageApi =
        webIm == null ? null : js_util.getProperty<Object?>(webIm, 'message');
    if (messageApi == null) {
      throw StateError('Real Web SDK global WebIM.message is missing.');
    }
    final message = js_util.callMethod<Object?>(
      messageApi,
      'create',
      [
        js_util.jsify({
          'type': 'read',
          'to': groupId,
          'id': msgId,
          'chatType': 'groupChat',
          if (content != null && content.isNotEmpty) 'ackContent': content,
        }),
      ],
    );
    final promise = js_util.callMethod<Object?>(conn, 'send', [message]);
    try {
      if (promise != null) {
        final value = await js_util.promiseToFuture<Object?>(promise);
        _recordDebug(
            'ackGroupMessageRead_success', {'result': js_util.dartify(value)});
      }
    } catch (e) {
      _recordDebug(
          'ackGroupMessageRead_error', {'error': _jsErrorDescription(e)});
      throw StateError(
          'Real Web SDK ackGroupMessageRead failed: ${_jsErrorDescription(e)}');
    }
  }

  Map<String, dynamic> _toImSdkDownloadableMessage(
    Map<String, dynamic> message, {
    bool thumbnailOnly = false,
    bool bigImageOnly = false,
  }) {
    final body = _asMap(message['body']);
    final type = switch (_asInt(body['type']) ?? -1) {
      1 => 'image',
      2 => 'video',
      3 => 'voice',
      4 => 'file',
      _ => 'unknown',
    };
    final remoteUrl = body['remotePath']?.toString() ??
        body['url']?.toString() ??
        body['originalImageUrl']?.toString() ??
        '';
    final thumbnailUrl = body['thumbnailRemotePath']?.toString() ??
        body['thumbnailUrl']?.toString() ??
        '';
    final imageUrl = thumbnailOnly
        ? thumbnailUrl
        : (bigImageOnly
            ? body['bigImageUrl']?.toString() ?? remoteUrl
            : remoteUrl);
    return {
      ..._toImSdkMessageEnvelope(message),
      'type': type,
      'body': {
        'url': imageUrl,
        if (type == 'image') 'isOriginalImage': body['isOriginalImage'] == true,
        if (type == 'image') 'originalImageUrl': imageUrl,
        if (type == 'image') 'bigImageUrl': bigImageOnly ? imageUrl : remoteUrl,
        'thumbnailUrl': thumbnailUrl,
        'secret': body['secret']?.toString() ?? body['secretKey']?.toString(),
        'fileLength': _asInt(body['fileSize']) ?? _asInt(body['fileLength']),
        'fileSize': _asInt(body['fileSize']) ?? _asInt(body['fileLength']),
        'filetype': body['filetype']?.toString() ??
            body['mimeType']?.toString() ??
            'application/octet-stream',
        'filename': body['displayName']?.toString() ?? 'attachment',
        if (body['width'] != null) 'width': body['width'],
        if (body['height'] != null) 'height': body['height'],
        if (body['duration'] != null) 'duration': body['duration'],
        if (body['thumbnailRemotePath'] != null)
          'thumbnailRemotePath': body['thumbnailRemotePath']?.toString(),
      },
    };
  }

  Map<String, dynamic> _normalizeAttachmentDownloadResult(Object? value) {
    final dartified = js_util.dartify(value);
    final map = _asMap(dartified);
    final data = map['data'];
    int? length;
    if (data is List) {
      length = data.length;
    } else if (data != null) {
      final byteLength = js_util.getProperty<Object?>(value as Object, 'data');
      final byteLengthMap = js_util.dartify(byteLength);
      if (byteLengthMap is List) {
        length = byteLengthMap.length;
      }
    }
    return {
      'filename': map['filename']?.toString() ?? 'attachment',
      'mimeType': map['mimeType']?.toString() ?? 'application/octet-stream',
      'size': _asInt(map['size']) ?? length ?? 0,
      'downloadUrl': map['downloadUrl']?.toString() ?? '',
      'dataLength': length ?? _asInt(map['size']) ?? 0,
    };
  }

  Future<Map<String, dynamic>> createGroup(Map<String, dynamic> map) async {
    if (_highLevelClient != null) {
      final groupManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'groupManager');
      if (groupManager == null) {
        throw StateError('Real Web SDK groupManager is not available.');
      }
      final options = _asMap(map['options']);
      final style = options['style'];
      final groupName = map['groupName']?.toString() ??
          map['name']?.toString() ??
          'web-real-group-${DateTime.now().millisecondsSinceEpoch}';
      final description =
          map['desc']?.toString() ?? map['description']?.toString() ?? '';
      final members = _asStringList(map['inviteMembers'] ?? map['members']);
      final normalizedMembers =
          members.isEmpty ? <String>[_currentUser ?? ''] : members;
      final params = <String, Object?>{
        'name': groupName,
        'description': description,
        'memberIds': normalizedMembers,
        'public': _groupStyleIsPublic(style),
        'joinApprovalRequired': options.containsKey('joinNeedApproval')
            ? options['joinNeedApproval'] == true
            : _groupStyleNeedsApproval(style),
        'allowInvites': options['inviteNeedConfirm'] != true,
        'inviteNeedConfirm': options['inviteNeedConfirm'] == true,
        'maxMembers': _asInt(options['maxCount'] ?? options['maxUsers']) ?? 200,
      };
      final promise = js_util.callMethod<Object?>(
        groupManager,
        'createGroup',
        [js_util.jsify(params)],
      );
      try {
        final result =
            await js_util.promiseToFuture<Object?>(promise as Object);
        final raw = js_util.dartify(result);
        final rawMap = _asMap(raw);
        final groupId = rawMap['groupId']?.toString() ??
            rawMap['id']?.toString() ??
            rawMap['groupid']?.toString() ??
            result?.toString() ??
            '';
        _recordDebug('createGroup_success', {
          'runtime': 'imsdk',
          'groupId': groupId,
          'raw': raw,
        });
        return {
          'groupId': groupId,
          'groupName': groupName,
          'desc': description,
          'permissionType': _groupStyleNeedsApproval(style)
              ? 2
              : _groupStyleIsPublic(style)
                  ? 1
                  : 0,
        };
      } catch (e) {
        _recordDebug('createGroup_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
            'Real Web SDK createGroup failed: ${_jsErrorDescription(e)}');
      }
    }
    final options = _asMap(map['options']);
    final style = options['style'];
    final result = await _callRealSdk('createGroupVNext', [
      {
        'groupName': map['groupName']?.toString() ??
            map['name']?.toString() ??
            'web-real-group-${DateTime.now().millisecondsSinceEpoch}',
        'description':
            map['desc']?.toString() ?? map['description']?.toString() ?? '',
        'members': _asStringList(map['inviteMembers'] ?? map['members']),
        'isPublic': _groupStyleIsPublic(style),
        'needApprovalToJoin': options.containsKey('joinNeedApproval')
            ? options['joinNeedApproval'] == true
            : _groupStyleNeedsApproval(style),
        'allowMemberToInvite': options['inviteNeedConfirm'] != true,
        'inviteNeedConfirm': options['inviteNeedConfirm'] == true,
        'maxMemberCount':
            _asInt(options['maxCount'] ?? options['maxUsers']) ?? 200,
        'extension': options['ext']?.toString() ?? map['ext']?.toString() ?? '',
      },
    ]);
    return _normalizeRealGroup(js_util.dartify(result), map);
  }

  Future<void> destroyGroup(String groupId) async {
    await _callRealSdkVoid('destroyGroup', [
      {'groupId': groupId},
    ]);
  }

  Future<Map<String, dynamic>?> getGroup(String groupId) async {
    if (groupId.isEmpty) {
      return null;
    }
    final result = await _callRealSdk('getGroup', [
      {'groupId': groupId},
    ]);
    return _normalizeRealGroupDetail(
      js_util.dartify(result),
      fallback: {'groupId': groupId},
    );
  }

  Future<Map<String, dynamic>?> getGroupInfoDetailed(String groupId) async {
    if (groupId.isEmpty) {
      return null;
    }
    if (_highLevelClient != null) {
      final groupManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'groupManager');
      if (groupManager == null) {
        throw StateError('Real Web SDK groupManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        groupManager,
        'getGroupInfo',
        [
          js_util.jsify({'groupId': groupId})
        ],
      );
      final result = await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug('getGroupInfo_raw', {
        'runtime': 'imsdk',
        'groupId': groupId,
        'raw': js_util.dartify(result),
      });
      final normalized = _normalizeRealGroupDetail(
        js_util.dartify(result),
        fallback: {'groupId': groupId},
      );
      if (normalized == null) {
        return null;
      }
      try {
        final admins = await getGroupAdmins(groupId);
        normalized['adminList'] = admins;
      } catch (_) {}
      return normalized;
    }
    final result = await _callRealSdk('getGroupInfo', [
      {'groupId': groupId},
    ]);
    final normalized = _normalizeRealGroupDetail(
      js_util.dartify(result),
      fallback: {'groupId': groupId},
    );
    if (normalized == null) {
      return null;
    }
    try {
      final admins = await getGroupAdmins(groupId);
      normalized['adminList'] = admins;
    } catch (_) {}
    return normalized;
  }

  Future<List<Map<String, dynamic>>> getJoinedGroups({
    int pageSize = 200,
    int pageNum = 0,
  }) async {
    final result = await _callRealSdk('getJoinedGroups', [
      {
        'pageSize': pageSize,
        'pageNum': pageNum,
      },
    ]);
    final raw = js_util.dartify(result);
    final source = _groupListSource(raw);
    return source.map((item) => _normalizeRealGroup(item, const {})).toList();
  }

  Future<Map<String, dynamic>> getPublicGroups({
    int pageSize = 200,
    String cursor = '',
  }) async {
    final result = await _callRealSdk('getPublicGroups', [
      {
        'limit': pageSize,
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = _groupListSource(raw);
    return {
      'cursor':
          rawMap['cursor']?.toString() ?? data['cursor']?.toString() ?? '',
      'list': source.map(_normalizeRealGroupInfo).toList(),
    };
  }

  Future<Map<String, dynamic>> getGroupMembers({
    required String groupId,
    int pageSize = 200,
    String cursor = '',
  }) async {
    final result = await _callRealSdk('getGroupMembers', [
      {
        'groupId': groupId,
        'pageSize': pageSize,
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['members'] is List
        ? data['members']
        : data['data'] is List
            ? data['data']
            : data['list'] is List
                ? data['list']
                : rawMap['data'] is List
                    ? rawMap['data']
                    : rawMap['entities'] is List
                        ? rawMap['entities']
                        : const [];
    return {
      'cursor': data['cursor']?.toString() ??
          _asMap(rawMap['properties'])['cursor']?.toString() ??
          rawMap['cursor']?.toString() ??
          '',
      'list': _normalizeUserIdList(source),
    };
  }

  Future<Map<String, dynamic>> getGroupMembersInfo({
    required String groupId,
    int limit = 200,
    String cursor = '',
  }) async {
    final result = await _callRealSdk('getGroupMembers', [
      {
        'groupId': groupId,
        'pageSize': limit,
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['entities'] is List
        ? data['entities']
        : rawMap['entities'] is List
            ? rawMap['entities']
            : data['data'] is List
                ? data['data']
                : data['members'] is List
                    ? data['members']
                    : data['affiliations'] is List
                        ? data['affiliations']
                        : const [];
    return {
      'cursor': data['cursor']?.toString() ??
          _asMap(rawMap['properties'])['cursor']?.toString() ??
          rawMap['cursor']?.toString() ??
          '',
      'list': _normalizeGroupMemberInfoList(source),
    };
  }

  Future<void> updateGroupName({
    required String groupId,
    required String name,
  }) async {
    await _callRealSdkVoid('modifyGroup', [
      {
        'groupId': groupId,
        'groupName': name,
      },
    ]);
  }

  Future<void> updateGroupDescription({
    required String groupId,
    required String description,
  }) async {
    await _callRealSdkVoid('modifyGroup', [
      {
        'groupId': groupId,
        'description': description,
      },
    ]);
  }

  Future<void> updateGroupAvatar({
    required String groupId,
    required String avatarUrl,
  }) async {
    await _callRealSdkVoid('modifyGroup', [
      {
        'groupId': groupId,
        'avatar': avatarUrl,
      },
    ]);
  }

  Future<void> updateGroupExtension({
    required String groupId,
    required String ext,
  }) async {
    await _callRealSdkVoid('modifyGroup', [
      {
        'groupId': groupId,
        'ext': ext,
      },
    ]);
  }

  Future<void> leaveGroup(String groupId) async {
    await _callRealSdkVoid('leaveGroup', [
      {'groupId': groupId},
    ]);
  }

  Future<void> joinPublicGroup(String groupId) async {
    await _callRealSdkVoid('joinGroup', [
      {'groupId': groupId},
    ]);
  }

  Future<void> inviteUsersToGroup({
    required String groupId,
    required List<String> users,
    String? welcome,
  }) async {
    if (users.isEmpty) {
      return;
    }
    await _callRealSdkVoid('inviteUsersToGroup', [
      {
        'groupId': groupId,
        'users': users,
        if (welcome != null && welcome.isNotEmpty) 'message': welcome,
      },
    ]);
  }

  Future<void> acceptGroupInvite({
    required String groupId,
    required String invitee,
  }) async {
    await _callRealSdkVoid('acceptGroupInvite', [
      {
        'groupId': groupId,
        'invitee': invitee,
      },
    ]);
  }

  Future<void> declineGroupInvite({
    required String groupId,
    required String invitee,
    String? reason,
  }) async {
    await _callRealSdkVoid('rejectGroupInvite', [
      {
        'groupId': groupId,
        'invitee': invitee,
        if (reason != null && reason.isNotEmpty) 'message': reason,
      },
    ]);
  }

  Future<void> requestToJoinGroup({
    required String groupId,
    String? reason,
  }) async {
    await _callRealSdkVoid('joinGroup', [
      {
        'groupId': groupId,
        if (reason != null && reason.isNotEmpty) 'message': reason,
      },
    ]);
  }

  Future<void> acceptGroupJoinRequest({
    required String groupId,
    required String applicant,
  }) async {
    await _callRealSdkVoid('acceptGroupJoinRequest', [
      {
        'groupId': groupId,
        'applicant': applicant,
      },
    ]);
  }

  Future<void> declineGroupJoinRequest({
    required String groupId,
    required String applicant,
    String? reason,
  }) async {
    await _callRealSdkVoid('rejectGroupJoinRequest', [
      {
        'groupId': groupId,
        'applicant': applicant,
        if (reason != null && reason.isNotEmpty) 'message': reason,
      },
    ]);
  }

  Future<void> setGroupMemberAttributes({
    required String groupId,
    required String userId,
    required Map<String, String> attributes,
  }) async {
    await _callRealSdkVoid('setGroupMemberAttributes', [
      {
        'groupId': groupId,
        'userId': userId,
        'memberAttributes': attributes,
      },
    ]);
  }

  Future<Map<String, String>> getGroupMemberAttributes({
    required String groupId,
    required String userId,
    List<String> keys = const [],
  }) async {
    final result = await _callRealSdk('getGroupMemberAttributes', [
      {
        'groupId': groupId,
        'userId': userId,
        if (keys.isNotEmpty) 'keys': keys,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final attrs = _asMap(
      rawMap['data'] ?? rawMap['attributes'] ?? rawMap['result'],
    );
    final normalized = <String, String>{};
    attrs.forEach((key, value) {
      if (value != null) {
        normalized[key] = value.toString();
      }
    });
    return normalized;
  }

  Future<Map<String, Map<String, String>>> getGroupMembersAttributes({
    required String groupId,
    required List<String> userIds,
    List<String> keys = const [],
  }) async {
    final result = await _callRealSdk('getGroupMembersAttributes', [
      {
        'groupId': groupId,
        'userIds': userIds,
        if (keys.isNotEmpty) 'keys': keys,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final source = _asMap(
      rawMap['data'] ?? rawMap['attributes'] ?? rawMap['result'],
    );
    final normalized = <String, Map<String, String>>{};
    source.forEach((userId, value) {
      final attrs = <String, String>{};
      _asMap(value).forEach((key, attrValue) {
        if (attrValue != null) {
          attrs[key] = attrValue.toString();
        }
      });
      normalized[userId] = attrs;
    });
    return normalized;
  }

  Future<void> removeGroupMembers({
    required String groupId,
    required List<String> users,
  }) async {
    if (users.isEmpty) {
      return;
    }
    if (users.length == 1) {
      await _callRealSdkVoid('removeGroupMember', [
        {
          'groupId': groupId,
          'username': users.first,
        },
      ]);
      return;
    }
    await _callRealSdkVoid('removeGroupMembers', [
      {
        'groupId': groupId,
        'users': users,
      },
    ]);
  }

  Future<void> disableSendGroupMsg(String groupId) async {
    await muteAllGroupMembers(groupId);
  }

  Future<void> enableSendGroupMsg(String groupId) async {
    await unmuteAllGroupMembers(groupId);
  }

  Future<void> changeGroupOwner({
    required String groupId,
    required String newOwner,
  }) async {
    await _callRealSdkVoid('changeGroupOwner', [
      {
        'groupId': groupId,
        'newOwner': newOwner,
      },
    ]);
  }

  Future<void> blockGroupMembers({
    required String groupId,
    required List<String> members,
  }) async {
    if (members.isEmpty) {
      return;
    }
    await _callRealSdkVoid('blockGroupMembers', [
      {
        'groupId': groupId,
        'usernames': members,
      },
    ]);
  }

  Future<void> unblockGroupMembers({
    required String groupId,
    required List<String> members,
  }) async {
    if (members.isEmpty) {
      return;
    }
    if (members.length == 1) {
      await _callRealSdkVoid('unblockGroupMember', [
        {
          'groupId': groupId,
          'username': members.first,
        },
      ]);
      return;
    }
    await _callRealSdkVoid('unblockGroupMembers', [
      {
        'groupId': groupId,
        'usernames': members,
      },
    ]);
  }

  Future<void> setGroupAdmin({
    required String groupId,
    required String admin,
  }) async {
    await _callRealSdkVoid('setGroupAdmin', [
      {
        'groupId': groupId,
        'username': admin,
      },
    ]);
  }

  Future<void> removeGroupAdmin({
    required String groupId,
    required String admin,
  }) async {
    await _callRealSdkVoid('removeGroupAdmin', [
      {
        'groupId': groupId,
        'username': admin,
      },
    ]);
  }

  Future<void> muteGroupMembers({
    required String groupId,
    required List<String> members,
    required int duration,
  }) async {
    final muteDuration = duration < 0 ? -1 : duration * 1000;
    for (final member in members) {
      await _callRealSdkVoid('muteGroupMember', [
        {
          'groupId': groupId,
          'username': member,
          'muteDuration': muteDuration,
        },
      ]);
    }
  }

  Future<void> unmuteGroupMembers({
    required String groupId,
    required List<String> members,
  }) async {
    for (final member in members) {
      await _callRealSdkVoid('unmuteGroupMember', [
        {
          'groupId': groupId,
          'username': member,
        },
      ]);
    }
  }

  Future<void> muteAllGroupMembers(String groupId) async {
    if (_highLevelClient != null) {
      await _callRealGroupHandleVoid(groupId, 'muteAllMembers');
      return;
    }
    await _callRealSdkVoid('muteAllGroupMembers', [
      {
        'groupId': groupId,
      },
    ]);
  }

  Future<void> unmuteAllGroupMembers(String groupId) async {
    if (_highLevelClient != null) {
      await _callRealGroupHandleVoid(groupId, 'unmuteAllMembers');
      return;
    }
    await _callRealSdkVoid('unmuteAllGroupMembers', [
      {
        'groupId': groupId,
      },
    ]);
  }

  Future<Map<String, dynamic>> getGroupMuteList({
    required String groupId,
    int pageSize = 200,
    int pageNum = 1,
  }) async {
    final result = await _callRealSdk('getGroupMutelist', [
      {
        'groupId': groupId,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['data'] is List
        ? data['data']
        : data['list'] is List
            ? data['list']
            : rawMap['data'] is List
                ? rawMap['data']
                : rawMap['entities'] is List
                    ? rawMap['entities']
                    : const [];
    return {
      'pageNum': _asInt(data['pageNum']) ?? pageNum,
      'pageSize': _asInt(data['pageSize']) ?? pageSize,
      'list': _normalizeUserIdList(source),
    };
  }

  Future<List<String>> getGroupAdmins(String groupId) async {
    final result = await _callRealSdk('getGroupAdmin', [
      {'groupId': groupId},
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['data'] is List
        ? data['data']
        : data['list'] is List
            ? data['list']
            : rawMap['data'] is List
                ? rawMap['data']
                : rawMap['entities'] is List
                    ? rawMap['entities']
                    : const [];
    return _normalizeUserIdList(source);
  }

  Future<Map<String, dynamic>> getGroupBlockList({
    required String groupId,
    int pageSize = 200,
    int pageNum = 1,
  }) async {
    final result = await _callRealSdk('getGroupBlocklist', [
      {
        'groupId': groupId,
        'pageSize': pageSize,
        'pageNum': pageNum,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['data'] is List
        ? data['data']
        : data['list'] is List
            ? data['list']
            : rawMap['data'] is List
                ? rawMap['data']
                : rawMap['entities'] is List
                    ? rawMap['entities']
                    : const [];
    return {
      'pageNum': _asInt(data['pageNum']) ?? pageNum,
      'pageSize': _asInt(data['pageSize']) ?? pageSize,
      'list': _normalizeUserIdList(source),
    };
  }

  Future<void> addGroupWhiteList({
    required String groupId,
    required List<String> members,
  }) async {
    if (members.isEmpty) {
      return;
    }
    await _callRealSdkVoid('addUsersToGroupWhitelist', [
      {
        'groupId': groupId,
        'users': members,
      },
    ]);
  }

  Future<void> removeGroupWhiteList({
    required String groupId,
    required List<String> members,
  }) async {
    for (final member in members) {
      await _callRealSdkVoid('removeGroupWhitelistMember', [
        {
          'groupId': groupId,
          'userName': member,
        },
      ]);
    }
  }

  Future<List<String>> getGroupWhiteList(String groupId) async {
    final result = await _callRealSdk('getGroupWhitelist', [
      {'groupId': groupId},
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['data'] is List
        ? data['data']
        : data['list'] is List
            ? data['list']
            : rawMap['data'] is List
                ? rawMap['data']
                : rawMap['entities'] is List
                    ? rawMap['entities']
                    : const [];
    return _normalizeUserIdList(source);
  }

  Future<bool> isInGroupWhiteList({
    required String groupId,
    required String userId,
  }) async {
    bool? directResult;
    for (final method in const [
      'isInGroupWhiteList',
      'isInGroupAllowlist',
      'isGroupWhiteUser',
    ]) {
      try {
        final result = await _callRealSdk(method, [
          {
            'groupId': groupId,
            'userName': userId,
          },
        ]);
        final raw = js_util.dartify(result);
        final rawMap = _asMap(raw);
        final data = rawMap['data'];
        if (data is bool) {
          directResult = data;
          break;
        }
        if (data is String) {
          directResult = data.toLowerCase() == 'true';
          break;
        }
        final dataMap = _asMap(data);
        if (dataMap['result'] == true ||
            dataMap['isInWhiteList'] == true ||
            dataMap['isInAllowlist'] == true ||
            rawMap['result'] == true) {
          return true;
        }
      } catch (_) {}
    }
    final users = await getGroupWhiteList(groupId);
    if (users.contains(userId)) {
      return true;
    }
    return directResult ?? false;
  }

  Future<bool> isInGroupMuteList({
    required String groupId,
    required String userId,
  }) async {
    final result = await _callRealSdk('isInGroupMutelist', [
      {
        'groupId': groupId,
        'userName': userId,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = rawMap['data'];
    if (data is bool) {
      return data;
    }
    if (data is String) {
      return data.toLowerCase() == 'true';
    }
    final dataMap = _asMap(data);
    return dataMap['result'] == true ||
        dataMap['muted'] == true ||
        dataMap['isInMuteList'] == true ||
        rawMap['result'] == true;
  }

  Future<List<Map<String, dynamic>>> getGroupSharedFileList(
      String groupId) async {
    dynamic source = const [];
    if (_highLevelClient != null) {
      final groupHandle = _requireHighLevelGroupHandle(groupId);
      final promise = js_util.callMethod<Object?>(
        groupHandle,
        'getSharedFileList',
        [
          js_util.jsify({'pageSize': 50})
        ],
      );
      final raw = js_util
          .dartify(await js_util.promiseToFuture<Object?>(promise as Object));
      final rawMap = _asMap(raw);
      _recordDebug('getGroupSharedFileList_raw', {
        'runtime': 'imsdk',
        'groupId': groupId,
        'raw': rawMap,
      });
      source = rawMap['items'] is List
          ? rawMap['items']
          : rawMap['list'] is List
              ? rawMap['list']
              : rawMap['data'] is List
                  ? rawMap['data']
                  : _asMap(rawMap['data'])['items'] is List
                      ? _asMap(rawMap['data'])['items']
                      : const [];
    } else {
      final result = await _callRealSdk('getGroupSharedFilelist', [
        {'groupId': groupId},
      ]);
      final raw = js_util.dartify(result);
      final rawMap = _asMap(raw);
      _recordDebug('getGroupSharedFileList_raw', {
        'runtime': 'legacy',
        'groupId': groupId,
        'raw': rawMap,
      });
      final data = _asMap(rawMap['data']);
      source = data['data'] is List
          ? data['data']
          : data['list'] is List
              ? data['list']
              : rawMap['data'] is List
                  ? rawMap['data']
                  : rawMap['entities'] is List
                      ? rawMap['entities']
                      : const [];
    }
    final files = <Map<String, dynamic>>[];
    for (final item in source) {
      final map = _asMap(item);
      if (map.isEmpty) {
        continue;
      }
      final fileOwner = _asMap(map['fileOwner']);
      files.add({
        ...Map<String, dynamic>.from(map),
        'fileId': map['fileId']?.toString() ??
            map['file_id']?.toString() ??
            map['id']?.toString() ??
            '',
        'name': map['name']?.toString() ??
            map['fileName']?.toString() ??
            map['file_name']?.toString() ??
            '',
        'owner': map['owner']?.toString() ??
            fileOwner['userId']?.toString() ??
            map['file_owner']?.toString() ??
            '',
        'createTime': _asInt(map['createTime']) ??
            _asInt(map['created']) ??
            _asInt(map['created_at']) ??
            0,
        'fileSize': _asInt(map['fileSize']) ??
            _asInt(map['file_size']) ??
            _asInt(map['size']) ??
            0,
      });
    }
    final uploadedFiles = _uploadedGroupSharedFiles[groupId] ?? const [];
    for (final uploaded in uploadedFiles) {
      final uploadedFileId = uploaded['fileId']?.toString();
      if (uploadedFileId == null || uploadedFileId.isEmpty) {
        continue;
      }
      final alreadyPresent = files.any(
        (item) => item['fileId']?.toString() == uploadedFileId,
      );
      if (!alreadyPresent) {
        files.add(Map<String, dynamic>.from(uploaded));
      }
    }
    return files;
  }

  Object _requireHighLevelGroupHandle(String groupId) {
    final highLevelClient = _highLevelClient;
    if (highLevelClient == null) {
      throw StateError('Real Web SDK high-level client is not available.');
    }
    final groupManager =
        js_util.getProperty<Object?>(highLevelClient, 'groupManager');
    if (groupManager == null) {
      throw StateError('Real Web SDK groupManager is not available.');
    }
    final groupHandle = js_util.callMethod<Object?>(
      groupManager,
      'getGroup',
      [groupId],
    );
    if (groupHandle == null) {
      throw StateError('Real Web SDK group handle is not available.');
    }
    return groupHandle;
  }

  Map<String, dynamic>? _normalizeUploadedGroupSharedFile({
    required String groupId,
    required String fileName,
    required Object? responseText,
  }) {
    final responseString = responseText?.toString();
    if (responseString == null || responseString.isEmpty) {
      return null;
    }
    Object? decoded;
    try {
      decoded = jsonDecode(responseString);
    } catch (_) {
      return null;
    }
    final data = _asMap(_asMap(decoded)['data']);
    final fileId = data['file_id']?.toString() ??
        data['fileId']?.toString() ??
        data['id']?.toString();
    if (fileId == null || fileId.isEmpty) {
      return null;
    }
    return {
      'groupId': data['group_id']?.toString() ?? groupId,
      'fileId': fileId,
      'id': fileId,
      'name': data['file_name']?.toString() ?? fileName,
      'fileName': data['file_name']?.toString() ?? fileName,
      'file_url': data['file_url']?.toString() ?? '',
      'owner': _currentUser ?? '',
      'createTime': _asInt(data['created']) ?? 0,
      'fileSize': _asInt(data['file_size']) ?? 0,
    };
  }

  void _rememberUploadedGroupSharedFile({
    required String groupId,
    required String fileName,
    required Object? responseText,
  }) {
    final file = _normalizeUploadedGroupSharedFile(
      groupId: groupId,
      fileName: fileName,
      responseText: responseText,
    );
    if (file == null) {
      return;
    }
    final files = _uploadedGroupSharedFiles.putIfAbsent(groupId, () => []);
    final fileId = file['fileId']?.toString();
    files.removeWhere((item) => item['fileId']?.toString() == fileId);
    files.add(file);
  }

  Future<Map<String, dynamic>> uploadGroupSharedFile({
    required String groupId,
    required String filePath,
  }) async {
    final uri = Uri.tryParse(filePath);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw StateError(
        'Real Web SDK group shared-file upload requires an http/https filePath.',
      );
    }
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw StateError(
        'Real Web SDK group shared-file upload only supports http/https filePath.',
      );
    }

    final response = await web.window.fetch(filePath.toJS).toDart;
    if (!response.ok) {
      throw StateError(
        'Real Web SDK group shared-file upload fetch failed: '
        '${response.status} ${response.statusText}',
      );
    }
    final fileName = _realSdkFileNameFromPath(filePath);
    final blob = await response.blob().toDart;
    final file = web.File(
      [blob].toJS,
      fileName,
      web.FilePropertyBag(
        type:
            response.headers.get('content-type') ?? 'application/octet-stream',
      ),
    );
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final groupHandle = _requireHighLevelGroupHandle(groupId);
      final promise = js_util.callMethod<Object?>(
        groupHandle,
        'uploadSharedFile',
        [
          js_util.jsify({
            'file': file,
            'fileName': fileName,
            'onFileUploadComplete': ((JSAny? responseText) {
              final rawResponseText = js_util.dartify(responseText);
              _rememberUploadedGroupSharedFile(
                groupId: groupId,
                fileName: fileName,
                responseText: rawResponseText,
              );
              _recordDebug('uploadGroupSharedFile_complete', {
                'runtime': 'imsdk',
                'groupId': groupId,
                'fileName': fileName,
                'responseText': rawResponseText?.toString(),
              });
            }).toJS,
            'onFileUploadError': ((JSAny? responseText) {
              _recordDebug('uploadGroupSharedFile_error_callback', {
                'runtime': 'imsdk',
                'groupId': groupId,
                'fileName': fileName,
                'responseText': js_util.dartify(responseText)?.toString(),
              });
            }).toJS,
          }),
        ],
      );
      if (promise == null) {
        return <String, dynamic>{};
      }
      final rawResult = await js_util.promiseToFuture<Object?>(promise);
      _recordDebug('uploadGroupSharedFile_success', {
        'runtime': 'imsdk',
        'groupId': groupId,
        'fileName': fileName,
        'result': js_util.dartify(rawResult),
      });
      return <String, dynamic>{};
    }

    final conn = _requireConnection();
    final options = js_util.newObject();
    js_util.setProperty(options, 'groupId', groupId);
    js_util.setProperty(options, 'file', file);
    final promise = js_util.callMethod<Object?>(
      conn,
      'uploadGroupSharedFile',
      [options],
    );
    if (promise == null) {
      return <String, dynamic>{};
    }
    final result = await js_util.promiseToFuture<Object?>(promise);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    if (data.isNotEmpty) {
      return Map<String, dynamic>.from(data);
    }
    if (rawMap.isNotEmpty) {
      return Map<String, dynamic>.from(rawMap);
    }
    return <String, dynamic>{};
  }

  Future<void> removeGroupSharedFile({
    required String groupId,
    required String fileId,
  }) async {
    if (_highLevelClient != null) {
      final groupHandle = _requireHighLevelGroupHandle(groupId);
      final promise = js_util.callMethod<Object?>(
        groupHandle,
        'deleteSharedFile',
        [
          js_util.jsify({'fileId': fileId})
        ],
      );
      if (promise != null) {
        await js_util.promiseToFuture<Object?>(promise);
      }
      _uploadedGroupSharedFiles[groupId]
          ?.removeWhere((item) => item['fileId']?.toString() == fileId);
      return;
    }
    await _callRealSdkVoid('deleteGroupSharedFile', [
      {
        'groupId': groupId,
        'fileId': fileId,
      },
    ]);
    _uploadedGroupSharedFiles[groupId]
        ?.removeWhere((item) => item['fileId']?.toString() == fileId);
  }

  Future<void> downloadGroupSharedFile({
    required String groupId,
    required String fileId,
    String? secret,
    String? fileName,
  }) async {
    if (_highLevelClient != null) {
      final groupHandle = _requireHighLevelGroupHandle(groupId);
      final completer = Completer<void>();
      final promise = js_util.callMethod<Object?>(
        groupHandle,
        'downloadSharedFile',
        [
          js_util.jsify({
            'fileId': fileId,
            if (secret != null && secret.isNotEmpty) 'secret': secret,
            'onFileDownloadComplete': ((JSAny? blob) {
              _recordDebug('downloadGroupSharedFile_complete', {
                'runtime': 'imsdk',
                'groupId': groupId,
                'fileId': fileId,
                'fileName': fileName,
                'blobType': blob == null ? null : blob.runtimeType.toString(),
              });
              if (!completer.isCompleted) {
                completer.complete();
              }
            }).toJS,
            'onFileDownloadError': ((JSAny? error) {
              _recordDebug('downloadGroupSharedFile_error_callback', {
                'runtime': 'imsdk',
                'groupId': groupId,
                'fileId': fileId,
                'error': js_util.dartify(error)?.toString(),
              });
              if (!completer.isCompleted) {
                completer.completeError(
                  StateError(
                    'Real Web SDK downloadGroupSharedFile callback failed: '
                    '${js_util.dartify(error)}',
                  ),
                );
              }
            }).toJS,
          }),
        ],
      );
      if (promise == null) {
        await completer.future.timeout(const Duration(seconds: 30));
        return;
      }
      await js_util.promiseToFuture<Object?>(promise);
      if (!completer.isCompleted) {
        completer.complete();
      }
      await completer.future;
      return;
    }
    final conn = _requireConnection();
    final completer = Completer<web.Blob>();
    final options = js_util.newObject();
    js_util.setProperty(options, 'groupId', groupId);
    js_util.setProperty(options, 'fileId', fileId);
    if (secret != null && secret.isNotEmpty) {
      js_util.setProperty(options, 'secret', secret);
    }
    js_util.setProperty(
      options,
      'onFileDownloadComplete',
      ((JSAny? blob) {
        if (completer.isCompleted) {
          return;
        }
        final value = blob?.dartify();
        if (value is web.Blob) {
          completer.complete(value);
          return;
        }
        if (blob != null) {
          completer.complete(blob as web.Blob);
          return;
        }
        completer.completeError(
          StateError(
              'Real Web SDK group shared-file download returned null blob.'),
        );
      }).toJS,
    );
    js_util.setProperty(
      options,
      'onFileDownloadError',
      ((JSAny? error) {
        if (completer.isCompleted) {
          return;
        }
        completer.completeError(
          StateError(
            'Real Web SDK downloadGroupSharedFile callback failed: '
            '${_jsErrorDescription(error)}',
          ),
        );
      }).toJS,
    );
    js_util.callMethod<Object?>(conn, 'downloadGroupSharedFile', [options]);
    final blob = await completer.future.timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        throw StateError(
          'Real Web SDK group shared-file download timed out waiting for blob callback.',
        );
      },
    );
    final objectUrl = web.URL.createObjectURL(blob);
    try {
      final anchor = web.HTMLAnchorElement()
        ..href = objectUrl
        ..download =
            (fileName != null && fileName.isNotEmpty) ? fileName : 'shared-file'
        ..style.display = 'none';
      web.document.body?.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      web.URL.revokeObjectURL(objectUrl);
    }
  }

  Future<void> updateGroupAnnouncement({
    required String groupId,
    required String announcement,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final groupManager =
          js_util.getProperty<Object?>(highLevelClient, 'groupManager');
      if (groupManager == null) {
        throw StateError('Real Web SDK groupManager is not available.');
      }
      final groupHandle =
          js_util.callMethod<Object?>(groupManager, 'getGroup', [groupId]);
      if (groupHandle == null) {
        throw StateError('Real Web SDK group handle is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        groupHandle,
        'updateAnnouncement',
        [
          js_util.jsify({
            'announcement': announcement,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('updateGroupAnnouncement', [
      {
        'groupId': groupId,
        'announcement': announcement,
      },
    ]);
  }

  Future<String?> fetchGroupAnnouncement(String groupId) async {
    final result = await _callRealSdk('fetchGroupAnnouncement', [
      {'groupId': groupId},
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = rawMap['data'];
    if (data is String) {
      return data;
    }
    final dataMap = _asMap(data);
    return dataMap['announcement']?.toString() ??
        dataMap['data']?.toString() ??
        rawMap['announcement']?.toString();
  }

  Future<Map<String, dynamic>> fetchGroupAcks({
    required String msgId,
    required String groupId,
    int pageSize = 20,
  }) async {
    final result = await _callRealSdk('getGroupMsgReadUser', [
      {
        'groupId': groupId,
        'msgId': msgId,
      },
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    final source = data is Map && data['list'] is List
        ? data['list']
        : data is Map && data['entities'] is List
            ? data['entities']
            : data is Map && data['userlist'] is List
                ? data['userlist']
                : data is List
                    ? data
                    : raw is Map && raw['entities'] is List
                        ? raw['entities']
                        : const [];
    final list = _asMapList(source)
        .take(pageSize <= 0 ? 500 : pageSize)
        .map((item) => _normalizeGroupAck(item, msgId: msgId))
        .toList();
    return {
      'cursor': '',
      'list': list,
    };
  }

  Future<Map<String, dynamic>> createChatThread(
      Map<String, dynamic> map) async {
    if (_highLevelClient != null) {
      final threadManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'chatThreadManager',
      );
      if (threadManager == null) {
        throw StateError('Real Web SDK chatThreadManager is not available.');
      }
      try {
        final createMethod = js_util.getProperty<Object?>(
          threadManager,
          'createChatThread',
        );
        if (createMethod == null) {
          throw StateError(
            'Real Web SDK chatThreadManager.createChatThread is not available.',
          );
        }
        final promise = js_util.callMethod<Object?>(
          threadManager,
          'createChatThread',
          [
            js_util.jsify({
              'name': map['name']?.toString() ??
                  map['threadName']?.toString() ??
                  'web-real-thread-${DateTime.now().millisecondsSinceEpoch}',
              'messageId': map['msgId']?.toString() ??
                  map['messageId']?.toString() ??
                  '',
              'parentId': map['parentId']?.toString() ?? '',
            }),
          ],
        );
        final raw = js_util.dartify(
          await js_util.promiseToFuture<Object?>(promise as Object),
        );
        final rawMap = _asMap(raw);
        final threadId = rawMap['chatThreadId']?.toString() ??
            rawMap['threadId']?.toString() ??
            rawMap['thread_id']?.toString() ??
            rawMap['id']?.toString() ??
            '';
        final detail =
            threadId.isEmpty ? null : await getChatThreadDetail(threadId);
        final normalized = detail ??
            _normalizeChatThread(
              rawMap,
              fallback: {
                ...map,
                'threadId': threadId,
              },
            );
        _recordDebug('createChatThread_success', {
          'runtime': 'imsdk',
          'result': raw,
          'normalized': normalized,
        });
        return normalized;
      } catch (e) {
        _recordDebug('createChatThread_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
            'Real Web SDK createChatThread failed: ${_jsErrorDescription(e)}');
      }
    }
    final result = await _callRealSdk('createChatThread', [
      {
        'name': map['name']?.toString() ??
            map['threadName']?.toString() ??
            'web-real-thread-${DateTime.now().millisecondsSinceEpoch}',
        'messageId':
            map['msgId']?.toString() ?? map['messageId']?.toString() ?? '',
        'parentId': map['parentId']?.toString() ?? '',
      },
    ]);
    final data = _asMap(_asMap(js_util.dartify(result))['data']);
    final threadId = data['chatThreadId']?.toString() ??
        data['threadId']?.toString() ??
        data['thread_id']?.toString() ??
        '';
    final detail =
        threadId.isEmpty ? null : await getChatThreadDetail(threadId);
    return detail ??
        _normalizeChatThread(
          data,
          fallback: {
            ...map,
            'threadId': threadId,
          },
        );
  }

  Future<Map<String, dynamic>?> getChatThreadDetail(String threadId) async {
    if (threadId.isEmpty) {
      return null;
    }
    if (_highLevelClient != null) {
      final threadManager = _requireChatThreadManager();
      final promise = js_util.callMethod<Object?>(
        threadManager,
        'getChatThreadInfo',
        [
          js_util.jsify({'chatThreadId': threadId}),
        ],
      );
      final raw = js_util
          .dartify(await js_util.promiseToFuture<Object?>(promise as Object));
      return _normalizeChatThread(_asMap(raw),
          fallback: {'threadId': threadId});
    }
    final result = await _callRealSdk('getChatThreadDetail', [
      {'chatThreadId': threadId},
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    return _normalizeChatThread(_asMap(data), fallback: {'threadId': threadId});
  }

  Future<Map<String, dynamic>?> getChatThreadByMessageId({
    required String msgId,
    required String parentId,
  }) async {
    final indexed = _messageIndex[msgId];
    final resolvedParentId = parentId.isNotEmpty
        ? parentId
        : indexed?['convId']?.toString() ?? indexed?['to']?.toString() ?? '';
    if (msgId.isEmpty || resolvedParentId.isEmpty) {
      return null;
    }
    final page = await getChatThreads(parentId: resolvedParentId, pageSize: 50);
    for (final thread in _asMapList(page['list'])) {
      if (thread['msgId']?.toString() == msgId) {
        return thread;
      }
    }
    return null;
  }

  Future<Map<String, dynamic>> getChatThreads({
    required String parentId,
    int pageSize = 20,
    String cursor = '',
  }) async {
    if (_highLevelClient != null) {
      final threadManager = _requireChatThreadManager();
      final promise = js_util.callMethod<Object?>(
        threadManager,
        'getChatThreadList',
        [
          js_util.jsify({
            'parentId': parentId,
            'pageSize': pageSize,
            if (cursor.isNotEmpty) 'cursor': cursor,
          }),
        ],
      );
      final raw = js_util
          .dartify(await js_util.promiseToFuture<Object?>(promise as Object));
      final rawMap = _asMap(raw);
      final source = rawMap['items'] is List
          ? rawMap['items']
          : rawMap['list'] is List
              ? rawMap['list']
              : const [];
      return {
        'cursor': rawMap['cursor']?.toString() ?? '',
        'list': _asMapList(source)
            .map((item) =>
                _normalizeChatThread(item, fallback: {'parentId': parentId}))
            .toList(),
      };
    }
    final result = await _callRealSdk('getChatThreads', [
      {
        'parentId': parentId,
        'pageSize': pageSize,
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final source = rawMap['entities'] is List
        ? rawMap['entities']
        : rawMap['data'] is Map && _asMap(rawMap['data'])['list'] is List
            ? _asMap(rawMap['data'])['list']
            : const [];
    return {
      'cursor': rawMap['cursor']?.toString() ??
          _asMap(rawMap['data'])['cursor']?.toString() ??
          '',
      'list': _asMapList(source)
          .map((item) =>
              _normalizeChatThread(item, fallback: {'parentId': parentId}))
          .toList(),
    };
  }

  Future<Map<String, dynamic>> getJoinedChatThreads({
    int pageSize = 20,
    String cursor = '',
  }) async {
    if (_highLevelClient != null) {
      final threadManager = _requireChatThreadManager();
      final promise = js_util.callMethod<Object?>(
        threadManager,
        'getJoinedChatThreadList',
        [
          js_util.jsify({
            'pageSize': pageSize,
            if (cursor.isNotEmpty) 'cursor': cursor,
          }),
        ],
      );
      final raw = js_util
          .dartify(await js_util.promiseToFuture<Object?>(promise as Object));
      final rawMap = _asMap(raw);
      final source = rawMap['items'] is List
          ? rawMap['items']
          : rawMap['list'] is List
              ? rawMap['list']
              : const [];
      return {
        'cursor': rawMap['cursor']?.toString() ?? '',
        'list': _asMapList(source).map(_normalizeChatThread).toList(),
      };
    }
    final result = await _callRealSdk('getJoinedChatThreads', [
      {
        'pageSize': pageSize,
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = rawMap['entities'] is List
        ? rawMap['entities']
        : data['list'] is List
            ? data['list']
            : data['entities'] is List
                ? data['entities']
                : const [];
    return {
      'cursor':
          rawMap['cursor']?.toString() ?? data['cursor']?.toString() ?? '',
      'list': _asMapList(source).map(_normalizeChatThread).toList(),
    };
  }

  Future<Map<String, dynamic>> getChatThreadMembers({
    required String threadId,
    int pageSize = 20,
    String cursor = '',
  }) async {
    if (_highLevelClient != null) {
      final promise = js_util.callMethod<Object?>(
        _requireChatThreadManager(),
        'getChatThreadMemberList',
        [
          js_util.jsify({
            'chatThreadId': threadId,
            'pageSize': pageSize,
            if (cursor.isNotEmpty) 'cursor': cursor,
          }),
        ],
      );
      final raw = js_util
          .dartify(await js_util.promiseToFuture<Object?>(promise as Object));
      final rawMap = _asMap(raw);
      final source = rawMap['members'] is List
          ? rawMap['members']
          : rawMap['items'] is List
              ? rawMap['items']
              : rawMap['list'] is List
                  ? rawMap['list']
                  : const [];
      return {
        'cursor': rawMap['cursor']?.toString() ?? '',
        'list': _normalizeUserIdList(source),
      };
    }
    final result = await _callRealSdk('getChatThreadMembers', [
      {
        'chatThreadId': threadId,
        'pageSize': pageSize,
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['entities'] is List
        ? data['entities']
        : rawMap['entities'] is List
            ? rawMap['entities']
            : data['data'] is List
                ? data['data']
                : data['members'] is List
                    ? data['members']
                    : data['affiliations'] is List
                        ? data['affiliations']
                        : const [];
    final members = _normalizeUserIdList(source);
    return {
      'cursor': data['cursor']?.toString() ??
          _asMap(rawMap['properties'])['cursor']?.toString() ??
          rawMap['cursor']?.toString() ??
          '',
      'list': members,
    };
  }

  Future<Map<String, dynamic>> getLastMessagesWithChatThreads(
    List<String> threadIds,
  ) async {
    final normalizedIds = threadIds.where((id) => id.isNotEmpty).toList();
    if (normalizedIds.isEmpty) {
      return <String, dynamic>{};
    }
    if (_highLevelClient != null) {
      final threadManager = _requireChatThreadManager();
      try {
        final promise = js_util.callMethod<Object?>(
          threadManager,
          'getChatThreadLastMessageList',
          [
            js_util.jsify({
              'chatThreadIds': normalizedIds,
            }),
          ],
        );
        final raw = js_util.dartify(
          await js_util.promiseToFuture<Object?>(promise as Object),
        );
        _recordDebug('getChatThreadLastMessageList_raw', {
          'runtime': 'imsdk',
          'threadIds': normalizedIds,
          'raw': raw,
        });
        return _normalizeThreadLastMessageResult(raw);
      } catch (e) {
        _recordDebug('getChatThreadLastMessageList_error', {
          'runtime': 'imsdk',
          'threadIds': normalizedIds,
          'error': _jsErrorDescription(e),
        });
      }
    }
    final raw = js_util.dartify(
      await _callRealSdk('getChatThreadLastMessage', [
        {'chatThreadIds': normalizedIds},
      ]),
    );
    return _normalizeThreadLastMessageResult(raw);
  }

  Future<Map<String, dynamic>?> joinChatThread(String threadId) async {
    if (threadId.isEmpty) {
      return null;
    }
    if (_highLevelClient != null) {
      final promise = js_util.callMethod<Object?>(
        _requireChatThreadManager(),
        'joinChatThread',
        [
          js_util.jsify({'chatThreadId': threadId}),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return getChatThreadDetail(threadId);
    }
    final result = await _callRealSdk('joinChatThread', [
      {'chatThreadId': threadId},
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    return _normalizeChatThread(_asMap(data), fallback: {'threadId': threadId});
  }

  Future<void> leaveChatThread(String threadId) async {
    if (_highLevelClient != null) {
      final promise = js_util.callMethod<Object?>(
        _requireChatThreadManager(),
        'leaveChatThread',
        [
          js_util.jsify({'chatThreadId': threadId}),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('leaveChatThread', [
      {'chatThreadId': threadId},
    ]);
  }

  Future<void> removeChatThreadMember({
    required String threadId,
    required String memberId,
  }) async {
    if (_highLevelClient != null) {
      final promise = js_util.callMethod<Object?>(
        _requireChatThreadManager(),
        'removeChatThreadMember',
        [
          js_util.jsify({
            'chatThreadId': threadId,
            'memberId': memberId,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('removeChatThreadMember', [
      {
        'chatThreadId': threadId,
        'username': memberId,
      },
    ]);
  }

  Future<void> changeChatThreadName({
    required String threadId,
    required String name,
  }) async {
    if (_highLevelClient != null) {
      final promise = js_util.callMethod<Object?>(
        _requireChatThreadManager(),
        'updateChatThreadName',
        [
          js_util.jsify({
            'chatThreadId': threadId,
            'name': name,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('changeChatThreadName', [
      {
        'chatThreadId': threadId,
        'name': name,
      },
    ]);
  }

  Future<void> destroyChatThread(String threadId) async {
    if (_highLevelClient != null) {
      final promise = js_util.callMethod<Object?>(
        _requireChatThreadManager(),
        'destroyChatThread',
        [
          js_util.jsify({'chatThreadId': threadId}),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('destroyChatThread', [
      {'chatThreadId': threadId},
    ]);
  }

  Future<Map<String, dynamic>> joinChatRoom({
    required String roomId,
    bool leaveOtherRooms = false,
    String? ext,
  }) async {
    if (_highLevelClient != null) {
      final chatRoomManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatRoomManager');
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final joinMethod =
          js_util.getProperty<Object?>(chatRoomManager, 'joinChatRoom');
      if (joinMethod == null) {
        throw StateError(
          'Real Web SDK chatRoomManager.joinChatRoom is not available.',
        );
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'joinChatRoom',
        [
          js_util.jsify({
            'chatRoomId': roomId,
            'leaveOtherRooms': leaveOtherRooms,
            if (ext != null && ext.isNotEmpty) 'ext': ext,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      final detail = await getChatRoom(roomId);
      return detail ?? _normalizeChatRoom({'id': roomId});
    }
    await _callRealSdk('joinChatRoom', [
      {
        'roomId': roomId,
        'leaveOtherRooms': leaveOtherRooms,
        if (ext != null && ext.isNotEmpty) 'ext': ext,
      },
    ]);
    final detail = await getChatRoom(roomId);
    return detail ?? _normalizeChatRoom({'id': roomId});
  }

  Future<Map<String, dynamic>> createChatRoom(Map<String, dynamic> map) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final context = js_util.callMethod<Object?>(
        highLevelClient,
        'getRestContext',
        const [],
      );
      final contextMap = _asMap(js_util.dartify(context));
      final restBaseUrl = contextMap['restBaseUrl']?.toString() ?? '';
      final appKey = contextMap['appKey']?.toString() ?? '';
      final token = contextMap['token']?.toString() ?? '';
      final clientResource = contextMap['clientResource']?.toString() ?? '';
      final userId = contextMap['userId']?.toString() ?? '';
      if (restBaseUrl.isEmpty ||
          appKey.isEmpty ||
          token.isEmpty ||
          clientResource.isEmpty ||
          userId.isEmpty) {
        throw StateError(
          'Real Web SDK createChatRoom requires restBaseUrl/appKey/token/clientResource/userId.',
        );
      }
      final appKeyParts = appKey.split('#');
      if (appKeyParts.length != 2) {
        throw StateError('Invalid appKey for createChatRoom: $appKey');
      }
      final roomName = map['subject']?.toString() ??
          map['name']?.toString() ??
          'web-real-room-${DateTime.now().millisecondsSinceEpoch}';
      final description =
          map['description']?.toString() ?? map['desc']?.toString() ?? '';
      final maxUsers = _asInt(map['maxUserCount']) ??
          _asInt(map['maxUsers']) ??
          _asInt(map['maxusers']) ??
          200;
      final orgName = Uri.encodeComponent(appKeyParts[0]);
      final appName = Uri.encodeComponent(appKeyParts[1]);
      final uri = Uri.parse('$restBaseUrl/$orgName/$appName/chatrooms');
      final body = <String, dynamic>{
        'name': roomName,
        'description': description,
        'maxusers': maxUsers,
        'owner': userId,
        'members': _asStringList(map['members']),
        'public': true,
        'owner_can_leave': true,
        'allowinvites': false,
        'membersonly': false,
      };
      final response = await web.window
          .fetch(
            uri.toString().toJS,
            web.RequestInit(
              method: 'POST',
              headers: js_util.jsify({
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              }),
              body: jsonEncode(body).toJS,
            ),
          )
          .toDart;
      final statusCode = response.status;
      final responseText = (await response.text().toDart).toString();
      Map<String, dynamic> data = const {};
      if (responseText.isNotEmpty) {
        try {
          data = _asMap(jsonDecode(responseText));
        } catch (_) {
          data = {'rawText': responseText};
        }
      }
      if (statusCode < 200 || statusCode >= 300) {
        _recordDebug('createChatRoom_error', {
          'runtime': 'imsdk',
          'statusCode': statusCode,
          'body': data.isEmpty ? responseText : data,
        });
        throw StateError(
          'Real Web SDK createChatRoom failed: HTTP $statusCode $responseText',
        );
      }
      final roomId = _asMap(data['data'])['id']?.toString() ??
          data['chatRoomId']?.toString() ??
          data['roomId']?.toString() ??
          data['id']?.toString() ??
          '';
      _recordDebug('createChatRoom_success', {
        'runtime': 'imsdk',
        'roomId': roomId,
        'raw': data,
      });
      final detail = roomId.isEmpty ? null : await getChatRoom(roomId);
      return detail ??
          _normalizeChatRoom(
            <String, dynamic>{
              ..._asMap(data['data']),
              if (roomId.isNotEmpty) 'id': roomId,
              'title': roomName,
              'description': description,
              'max_users': maxUsers,
            },
            fallback: map,
          );
    }
    final result = await _callRealSdk('createChatRoom', [
      {
        'name': map['subject']?.toString() ??
            map['name']?.toString() ??
            'web-real-room-${DateTime.now().millisecondsSinceEpoch}',
        'description':
            map['description']?.toString() ?? map['desc']?.toString() ?? '',
        'maxusers': _asInt(map['maxUserCount']) ??
            _asInt(map['maxUsers']) ??
            _asInt(map['maxusers']) ??
            200,
        'members': _asStringList(map['members']),
      },
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    final roomId = _asMap(data)['id']?.toString() ??
        _asMap(data)['roomId']?.toString() ??
        _asMap(data)['chatRoomId']?.toString() ??
        '';
    final detail = roomId.isEmpty ? null : await getChatRoom(roomId);
    return detail ?? _normalizeChatRoom(_asMap(data), fallback: map);
  }

  Future<void> destroyChatRoom(String roomId) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final context = js_util.callMethod<Object?>(
        highLevelClient,
        'getRestContext',
        const [],
      );
      final contextMap = _asMap(js_util.dartify(context));
      final restBaseUrl = contextMap['restBaseUrl']?.toString() ?? '';
      final appKey = contextMap['appKey']?.toString() ?? '';
      final token = contextMap['token']?.toString() ?? '';
      final clientResource = contextMap['clientResource']?.toString() ?? '';
      if (restBaseUrl.isEmpty ||
          appKey.isEmpty ||
          token.isEmpty ||
          clientResource.isEmpty) {
        throw StateError(
          'Real Web SDK destroyChatRoom requires restBaseUrl/appKey/token/clientResource.',
        );
      }
      final appKeyParts = appKey.split('#');
      if (appKeyParts.length != 2) {
        throw StateError('Invalid appKey for destroyChatRoom: $appKey');
      }
      final orgName = Uri.encodeComponent(appKeyParts[0]);
      final appName = Uri.encodeComponent(appKeyParts[1]);
      final uri = Uri.parse(
        '$restBaseUrl/$orgName/$appName/chatrooms/${Uri.encodeComponent(roomId)}',
      ).replace(
        queryParameters: <String, String>{
          'resource': clientResource,
          'version': 'v3',
        },
      );
      final response = await web.window
          .fetch(
            uri.toString().toJS,
            web.RequestInit(
              method: 'DELETE',
              headers: js_util.jsify({
                'Accept': 'application/json',
                'Authorization': 'Bearer $token',
              }),
            ),
          )
          .toDart;
      final statusCode = response.status;
      final body = (await response.text().toDart).toString();
      if (statusCode < 200 || statusCode >= 300) {
        _recordDebug('destroyChatRoom_error', {
          'runtime': 'imsdk',
          'statusCode': statusCode,
          'body': body,
        });
        throw StateError(
          'Real Web SDK destroyChatRoom failed: HTTP $statusCode $body',
        );
      }
      _recordDebug('destroyChatRoom_success', {
        'runtime': 'imsdk',
        'roomId': roomId,
      });
      return;
    }
    await _callRealSdkVoid('destroyChatRoom', [
      {'chatRoomId': roomId},
    ]);
  }

  Future<Map<String, dynamic>?> modifyChatRoom({
    required String roomId,
    String? name,
    String? description,
    int? maxUsers,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatRoomManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatRoomManager');
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'updateChatRoomInfo',
        [
          js_util.jsify({
            'chatRoomId': roomId,
            if (name != null) 'name': name,
            if (description != null) 'description': description,
            if (maxUsers != null) 'maxMembers': maxUsers,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return getChatRoom(roomId);
    }
    await _callRealSdk('modifyChatRoom', [
      {
        'chatRoomId': roomId,
        if (name != null) 'chatRoomName': name,
        if (description != null) 'description': description,
        if (maxUsers != null) 'maxusers': maxUsers,
      },
    ]);
    return getChatRoom(roomId);
  }

  Future<Map<String, dynamic>> getChatRoomMembers({
    required String roomId,
    String cursor = '',
    int pageSize = 50,
  }) async {
    final result = await _callRealSdk('getChatRoomMembers', [
      {
        'chatRoomId': roomId,
        if (cursor.isNotEmpty) 'cursor': cursor,
        'limit': pageSize,
      },
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? _asMap(raw['data']) : const <String, dynamic>{};
    final members = _asMapList(data['members'])
        .map((item) => item['userId']?.toString() ?? '')
        .where((userId) => userId.isNotEmpty)
        .toList()
      ..sort();
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': members,
    };
  }

  Future<void> muteChatRoomMembers({
    required String roomId,
    required List<String> members,
    required int duration,
  }) async {
    for (final member in members) {
      await _callRealSdk('muteChatRoomMember', [
        {
          'chatRoomId': roomId,
          'username': member,
          'muteDuration': duration,
        },
      ]);
    }
  }

  Future<void> unmuteChatRoomMembers({
    required String roomId,
    required List<String> members,
  }) async {
    for (final member in members) {
      await _callRealSdk('unmuteChatRoomMember', [
        {
          'chatRoomId': roomId,
          'username': member,
        },
      ]);
    }
  }

  Future<void> changeChatRoomOwner({
    required String roomId,
    required String newOwner,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final context = js_util.callMethod<Object?>(
        highLevelClient,
        'getRestContext',
        const [],
      );
      final contextMap = _asMap(js_util.dartify(context));
      final restBaseUrl = contextMap['restBaseUrl']?.toString() ?? '';
      final appKey = contextMap['appKey']?.toString() ?? '';
      final token = contextMap['token']?.toString() ?? '';
      final clientResource = contextMap['clientResource']?.toString() ?? '';
      if (restBaseUrl.isEmpty ||
          appKey.isEmpty ||
          token.isEmpty ||
          clientResource.isEmpty) {
        throw StateError(
          'Real Web SDK changeChatRoomOwner requires restBaseUrl/appKey/token/clientResource.',
        );
      }
      final appKeyParts = appKey.split('#');
      if (appKeyParts.length != 2) {
        throw StateError('Invalid appKey for changeChatRoomOwner: $appKey');
      }
      final orgName = Uri.encodeComponent(appKeyParts[0]);
      final appName = Uri.encodeComponent(appKeyParts[1]);
      final uri = Uri.parse(
        '$restBaseUrl/$orgName/$appName/chatrooms/${Uri.encodeComponent(roomId)}',
      ).replace(
        queryParameters: <String, String>{
          'resource': clientResource,
        },
      );
      final response = await web.window
          .fetch(
            uri.toString().toJS,
            web.RequestInit(
              method: 'PUT',
              headers: js_util.jsify({
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              }),
              body: jsonEncode(<String, dynamic>{
                'newowner': newOwner,
              }).toJS,
            ),
          )
          .toDart;
      final statusCode = response.status;
      final body = (await response.text().toDart).toString();
      if (statusCode < 200 || statusCode >= 300) {
        _recordDebug('changeChatRoomOwner_error', {
          'runtime': 'imsdk',
          'statusCode': statusCode,
          'body': body,
        });
        throw StateError(
          'Real Web SDK changeChatRoomOwner failed: HTTP $statusCode $body',
        );
      }
      _recordDebug('changeChatRoomOwner_success', {
        'runtime': 'imsdk',
        'roomId': roomId,
        'newOwner': newOwner,
      });
      return;
    }
    await _callRealSdkVoid('changeChatRoomOwner', [
      {
        'chatRoomId': roomId,
        'newOwner': newOwner,
      },
    ]);
  }

  Future<void> addChatRoomAdmin({
    required String roomId,
    required String admin,
  }) async {
    await _callRealSdkVoid('setChatRoomAdmin', [
      {
        'chatRoomId': roomId,
        'username': admin,
      },
    ]);
  }

  Future<void> removeChatRoomAdmin({
    required String roomId,
    required String admin,
  }) async {
    await _callRealSdkVoid('removeChatRoomAdmin', [
      {
        'chatRoomId': roomId,
        'username': admin,
      },
    ]);
  }

  Future<List<String>> getChatRoomAdmins(String roomId) async {
    final result = await _callRealSdk('getChatRoomAdmin', [
      {'chatRoomId': roomId},
    ]);
    final raw = js_util.dartify(result);
    final source = raw is Map ? raw['data'] : raw;
    return _normalizeUserIdList(source);
  }

  Future<Map<String, dynamic>> getChatRoomMuteList({
    required String roomId,
  }) async {
    final result = await _callRealSdk('getChatRoomMutelist', [
      {'chatRoomId': roomId},
    ]);
    final raw = js_util.dartify(result);
    final source = raw is Map ? raw['data'] : raw;
    final members = _normalizeUserIdList(source);
    return {
      'pageNum': 1,
      'pageSize': members.length,
      'list': members,
    };
  }

  Future<void> removeChatRoomMembers({
    required String roomId,
    required List<String> members,
  }) async {
    if (members.isEmpty) {
      return;
    }
    await _callRealSdk('removeChatRoomMembers', [
      {
        'chatRoomId': roomId,
        'users': members,
      },
    ]);
  }

  Future<void> blockChatRoomMembers({
    required String roomId,
    required List<String> members,
  }) async {
    for (final member in members) {
      await _callRealSdk('blockChatRoomMember', [
        {
          'chatRoomId': roomId,
          'username': member,
        },
      ]);
    }
  }

  Future<void> unblockChatRoomMembers({
    required String roomId,
    required List<String> members,
  }) async {
    for (final member in members) {
      await _callRealSdk('unblockChatRoomMember', [
        {
          'chatRoomId': roomId,
          'username': member,
        },
      ]);
    }
  }

  Future<Map<String, dynamic>> getChatRoomBlockList({
    required String roomId,
  }) async {
    final result = await _callRealSdk('getChatRoomBlocklist', [
      {'chatRoomId': roomId},
    ]);
    final raw = js_util.dartify(result);
    final source = raw is Map ? raw['data'] : raw;
    final members = _normalizeUserIdList(source);
    return {
      'pageNum': 1,
      'pageSize': members.length,
      'list': members,
    };
  }

  Future<void> updateChatRoomAnnouncement({
    required String roomId,
    required String announcement,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatRoomManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatRoomManager');
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'updateAnnouncement',
        [
          js_util.jsify({
            'chatRoomId': roomId,
            'announcement': announcement,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('updateChatRoomAnnouncement', [
      {
        'roomId': roomId,
        'announcement': announcement,
      },
    ]);
  }

  Future<String?> fetchChatRoomAnnouncement(String roomId) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatRoomManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatRoomManager');
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'getAnnouncement',
        [
          js_util.jsify({
            'chatRoomId': roomId,
          }),
        ],
      );
      final raw = js_util.dartify(
        await js_util.promiseToFuture<Object?>(promise as Object),
      );
      if (raw is String) {
        return raw;
      }
      final map = _asMap(raw);
      return map['announcement']?.toString() ??
          map['data']?.toString() ??
          map['content']?.toString();
    }
    final result = await _callRealSdk('fetchChatRoomAnnouncement', [
      {'roomId': roomId},
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    if (data is String) {
      return data;
    }
    final map = _asMap(data);
    return map['announcement']?.toString() ??
        map['data']?.toString() ??
        (raw is Map ? raw['announcement']?.toString() : null);
  }

  Future<void> addChatRoomWhiteList({
    required String roomId,
    required List<String> members,
  }) async {
    if (members.isEmpty) {
      return;
    }
    await _callRealSdk('addUsersToChatRoomWhitelist', [
      {
        'chatRoomId': roomId,
        'users': members,
      },
    ]);
  }

  Future<void> removeChatRoomWhiteList({
    required String roomId,
    required List<String> members,
  }) async {
    for (final member in members) {
      await _callRealSdk('removeChatRoomAllowlistMember', [
        {
          'chatRoomId': roomId,
          'userName': member,
        },
      ]);
    }
  }

  Future<List<String>> getChatRoomWhiteList(String roomId) async {
    final result = await _callRealSdk('getChatRoomWhitelist', [
      {'chatRoomId': roomId},
    ]);
    final raw = js_util.dartify(result);
    final source = raw is Map ? raw['data'] : raw;
    return _normalizeUserIdList(source);
  }

  Future<bool> isInChatRoomWhiteList({
    required String roomId,
    required String userId,
  }) async {
    final result = await _callRealSdk('isInChatRoomAllowlist', [
      {
        'chatRoomId': roomId,
        'userName': userId,
      },
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    if (data is bool) {
      return data;
    }
    if (data is String) {
      return data.toLowerCase() == 'true';
    }
    final map = _asMap(data);
    return map['result'] == true ||
        map['isInWhiteList'] == true ||
        map['isInAllowlist'] == true ||
        map['white'] == true ||
        map['data'] == true;
  }

  Future<void> muteAllChatRoomMembers(String roomId) async {
    await _callRealSdkVoid('disableSendChatRoomMsg', [
      {'chatRoomId': roomId},
    ]);
  }

  Future<void> unmuteAllChatRoomMembers(String roomId) async {
    await _callRealSdkVoid('enableSendChatRoomMsg', [
      {'chatRoomId': roomId},
    ]);
  }

  Future<bool> isInChatRoomMuteList({
    required String roomId,
    required String userId,
  }) async {
    final result = await _callRealSdk('isInChatRoomMutelist', [
      {
        'chatRoomId': roomId,
        'userName': userId,
      },
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    if (data is bool) {
      return data;
    }
    if (data is String) {
      return data.toLowerCase() == 'true';
    }
    final map = _asMap(data);
    return map['result'] == true ||
        map['data'] == true ||
        map['isInMuteList'] == true ||
        map['muted'] == true;
  }

  Future<Map<String, String>> fetchChatRoomAttributes({
    required String roomId,
    List<String> keys = const [],
  }) async {
    final result = await _callRealSdk('getChatRoomAttributes', [
      {
        'chatRoomId': roomId,
        if (keys.isNotEmpty) 'attributeKeys': keys,
      },
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    final source =
        data is Map && data['attributes'] is Map ? data['attributes'] : data;
    final attributes = <String, String>{};
    _asMap(source).forEach((key, value) {
      if (value != null) {
        attributes[key] = value.toString();
      }
    });
    return attributes;
  }

  Future<Map<String, int>> setChatRoomAttributes({
    required String roomId,
    required Map<String, dynamic> attributes,
    required bool force,
    required bool autoDelete,
  }) async {
    if (attributes.isEmpty) {
      return <String, int>{};
    }
    final result = await _callRealSdk('setChatRoomAttributes', [
      {
        'chatRoomId': roomId,
        'attributes': attributes,
        'isForced': force,
        'autoDelete': autoDelete,
      },
    ]);
    return _normalizeChatRoomAttributeFailures(js_util.dartify(result));
  }

  Future<Map<String, int>> removeChatRoomAttributes({
    required String roomId,
    required List<String> keys,
    required bool force,
  }) async {
    if (keys.isEmpty) {
      return <String, int>{};
    }
    final result = await _callRealSdk('removeChatRoomAttributes', [
      {
        'chatRoomId': roomId,
        'attributeKeys': keys,
        'isForced': force,
      },
    ]);
    return _normalizeChatRoomAttributeFailures(js_util.dartify(result));
  }

  Future<void> leaveChatRoom(String roomId) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatRoomManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatRoomManager');
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'leaveChatRoom',
        [
          js_util.jsify({'chatRoomId': roomId}),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('leaveChatRoom', [
      {'roomId': roomId},
    ]);
  }

  Future<Map<String, dynamic>?> getChatRoom(String roomId) async {
    if (roomId.isEmpty) {
      return null;
    }
    if (_highLevelClient != null) {
      final chatRoomManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'chatRoomManager',
      );
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'getChatRoomInfo',
        [
          js_util.jsify({'chatRoomId': roomId}),
        ],
      );
      final raw = js_util
          .dartify(await js_util.promiseToFuture<Object?>(promise as Object));
      return _normalizeChatRoom(_asMap(raw), fallback: {'roomId': roomId});
    }
    final result = await _callRealSdk('getChatRoomDetails', [
      {'chatRoomId': roomId},
    ]);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    final item = data is List && data.isNotEmpty ? data.first : data;
    final normalized =
        _normalizeChatRoom(_asMap(item), fallback: {'roomId': roomId});
    try {
      normalized['adminList'] = await getChatRoomAdmins(roomId);
    } catch (_) {}
    return normalized;
  }

  Future<List<Map<String, dynamic>>> getJoinedChatRooms({
    int pageNum = 1,
    int pageSize = 50,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final raw = await _requestJoinedChatRoomsRaw(
        highLevelClient,
        pageNum: pageNum,
        pageSize: pageSize,
      );
      _recordDebug('getJoinedChatRoomList_raw', {
        'runtime': 'imsdk',
        'pageNum': pageNum,
        'pageSize': pageSize,
        'raw': raw,
      });
      final source = raw is Map ? raw['data'] : raw;
      return _asMapList(source).map(_normalizeChatRoom).toList()
        ..sort((a, b) => (a['roomId'] ?? '')
            .toString()
            .compareTo((b['roomId'] ?? '').toString()));
    }
    final result = await _callRealSdk('getJoinedChatRooms', [
      {
        'pageNum': pageNum,
        'pageSize': pageSize,
      },
    ]);
    final raw = js_util.dartify(result);
    final source = raw is Map ? raw['data'] : raw;
    return _asMapList(source).map(_normalizeChatRoom).toList()
      ..sort((a, b) => (a['roomId'] ?? '')
          .toString()
          .compareTo((b['roomId'] ?? '').toString()));
  }

  Future<Object?> _requestJoinedChatRoomsRaw(
    Object highLevelClient, {
    required int pageNum,
    required int pageSize,
  }) async {
    final getRestContext =
        js_util.getProperty<Object?>(highLevelClient, 'getRestContext');
    if (getRestContext == null) {
      throw StateError('Real Web SDK client.getRestContext is not available.');
    }
    final context = js_util.callMethod<Object?>(
      highLevelClient,
      'getRestContext',
      const [],
    );
    final contextMap = _asMap(js_util.dartify(context));
    final restBaseUrl = contextMap['restBaseUrl']?.toString() ?? '';
    final appKey = contextMap['appKey']?.toString() ?? '';
    final userId = contextMap['userId']?.toString() ?? '';
    final token = contextMap['token']?.toString() ?? '';
    if (restBaseUrl.isEmpty ||
        appKey.isEmpty ||
        userId.isEmpty ||
        token.isEmpty) {
      throw StateError(
        'Real Web SDK joined chat room list requires restBaseUrl/appKey/userId/token.',
      );
    }
    final appKeyParts = appKey.split('#');
    if (appKeyParts.length != 2) {
      throw StateError('Invalid appKey for joined chat room list: $appKey');
    }
    final orgName = Uri.encodeComponent(appKeyParts[0]);
    final appName = Uri.encodeComponent(appKeyParts[1]);
    final encodedUserId = Uri.encodeComponent(userId);
    final uri = Uri.parse(
      '$restBaseUrl/$orgName/$appName/users/$encodedUserId/joined_chatrooms',
    ).replace(
      queryParameters: <String, String>{
        'pagenum': '$pageNum',
        'pagesize': '$pageSize',
        'detail': 'true',
      },
    );
    final response = await web.window
        .fetch(
          uri.toString().toJS,
          web.RequestInit(
            headers: js_util.jsify({
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            }),
          ),
        )
        .toDart;
    final statusCode = response.status;
    final body = (await response.text().toDart).toString();
    if (statusCode < 200 || statusCode >= 300) {
      _recordDebug('getJoinedChatRoomList_error', {
        'runtime': 'imsdk',
        'statusCode': statusCode,
        'body': body,
      });
      throw StateError(
        'Real Web SDK getJoinedChatRoomList failed: '
        'HTTP $statusCode $body',
      );
    }
    return jsonDecode(body);
  }

  Future<Map<String, dynamic>> getChatRooms({
    int pageNum = 1,
    int pageSize = 20,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatRoomManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatRoomManager');
      if (chatRoomManager == null) {
        throw StateError('Real Web SDK chatRoomManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatRoomManager,
        'getChatRoomList',
        [
          js_util.jsify({
            'pageNum': pageNum,
            'pageSize': pageSize,
          }),
        ],
      );
      final result = await js_util.promiseToFuture<Object?>(promise as Object);
      final raw = js_util.dartify(result);
      _recordDebug('getChatRoomList_raw', {
        'runtime': 'imsdk',
        'pageNum': pageNum,
        'pageSize': pageSize,
        'raw': raw,
      });
      final rawMap = raw is Map ? _asMap(raw) : const <String, dynamic>{};
      final data = rawMap['data'];
      final dataMap = _asMap(data);
      final source = data is List
          ? data
          : dataMap['data'] is List
              ? dataMap['data']
              : dataMap['items'] is List
                  ? dataMap['items']
                  : dataMap['list'] is List
                      ? dataMap['list']
                      : rawMap['items'] is List
                          ? rawMap['items']
                          : rawMap['entities'] is List
                              ? rawMap['entities']
                              : const [];
      final rooms = _asMapList(source).map(_normalizeChatRoom).toList();
      return {
        'pageNum': pageNum,
        'pageSize': pageSize,
        'totalSize': _asInt(rawMap['count']) ??
            _asInt(rawMap['total']) ??
            _asInt(dataMap['count']) ??
            _asInt(dataMap['total']) ??
            rooms.length,
        'list': rooms,
      };
    }
    final result = await _callRealSdk('getChatRooms', [
      {
        'pagenum': pageNum,
        'pagesize': pageSize,
      },
    ]);
    final raw = js_util.dartify(result);
    final rawMap = raw is Map ? _asMap(raw) : const <String, dynamic>{};
    final data = rawMap['data'];
    final dataMap = _asMap(data);
    final source = data is List
        ? data
        : dataMap['data'] is List
            ? dataMap['data']
            : dataMap['list'] is List
                ? dataMap['list']
                : rawMap['entities'] is List
                    ? rawMap['entities']
                    : const [];
    final rooms = _asMapList(source).map(_normalizeChatRoom).toList();
    return {
      'pageNum': pageNum,
      'pageSize': pageSize,
      'totalSize': _asInt(rawMap['count']) ??
          _asInt(dataMap['count']) ??
          _asInt(dataMap['total']) ??
          rooms.length,
      'list': rooms,
    };
  }

  Future<Map<String, dynamic>> modifyMessage({
    required String msgId,
    required Map<String, dynamic> body,
  }) async {
    final existing = _messageIndex[msgId];
    if (existing == null) {
      throw StateError(
          'Real Web SDK modifyMessage requires a known sent message: $msgId.');
    }
    final to =
        existing['to']?.toString() ?? existing['convId']?.toString() ?? '';
    final chatType = _asInt(existing['chatType']) ??
        _asInt(existing['type']) ??
        _asInt(existing['conversationType']) ??
        0;
    final content = body['content']?.toString() ?? '';
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      try {
        final value = await js_util.promiseToFuture<Object?>(
          js_util.callMethod<Object?>(
            chatManager,
            'modifyMessage',
            [
              js_util.jsify({
                'conversationId': to,
                'conversationType': _webChatType(chatType),
                'messageId': msgId,
                'message': {
                  'type': 'text',
                  'body': {'content': content},
                  'ext': _asMap(existing['attributes']).isNotEmpty
                      ? _asMap(existing['attributes'])
                      : _asMap(existing['ext']),
                },
              }),
            ],
          ) as Object,
        );
        final modified = _normalizeRealTextMessage(value, fallback: existing);
        modified['msgId'] = msgId;
        modified['body'] = {'type': 0, 'content': content};
        modified['isContentReplaced'] = true;
        _rememberMessage(modified);
        _recordDebug('modifyMessage_success', {
          'runtime': 'imsdk',
          'result': modified,
        });
        return modified;
      } catch (e) {
        _recordDebug('modifyMessage_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
            'Real Web SDK modifyMessage failed: ${_jsErrorDescription(e)}');
      }
    }
    final conn = _requireConnection();
    final webIm = _webImObject();
    final messageApi =
        webIm == null ? null : js_util.getProperty<Object?>(webIm, 'message');
    if (messageApi == null) {
      throw StateError('Real Web SDK global WebIM.message is missing.');
    }
    final modifiedMessage = js_util.callMethod<Object?>(
      messageApi,
      'create',
      [
        js_util.jsify({
          'chatType': _webChatType(chatType),
          'type': 'txt',
          'to': to,
          'msg': content,
        }),
      ],
    );
    final result = js_util.callMethod<Object?>(conn, 'modifyMessage', [
      js_util.jsify({
        'messageId': msgId,
        'modifiedMessage': modifiedMessage,
      }),
    ]);
    try {
      if (result != null) {
        final value = await js_util.promiseToFuture<Object?>(result);
        _recordDebug(
            'modifyMessage_success', {'result': js_util.dartify(value)});
      }
    } catch (e) {
      _recordDebug('modifyMessage_error', {'error': _jsErrorDescription(e)});
      throw StateError(
          'Real Web SDK modifyMessage failed: ${_jsErrorDescription(e)}');
    }
    final modified = Map<String, dynamic>.from(existing);
    modified['body'] = body;
    modified['isContentReplaced'] = true;
    _rememberMessage(modified);
    return modified;
  }

  Future<void> recallMessage({
    required String msgId,
    String ext = '',
  }) async {
    final existing = _messageIndex[msgId];
    if (existing == null) {
      throw StateError(
          'Real Web SDK recallMessage requires a known sent message: $msgId.');
    }
    final to =
        existing['to']?.toString() ?? existing['convId']?.toString() ?? '';
    final chatType = _asInt(existing['chatType']) ?? 0;
    await _callRealSdkVoid('recallMessage', [
      {
        'mid': msgId,
        'to': to,
        'chatType': _webChatType(chatType),
        if (ext.isNotEmpty) 'ext': ext,
      },
    ]);
    _messageIndex.remove(msgId);
  }

  Future<void> addContact(String userId, String? reason) async {
    if (_highLevelClient != null) {
      final manager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (manager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(manager, 'addContact', [
        js_util.jsify({'userId': userId, 'message': reason ?? ''}),
      ]);
      await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug(
          'addContact_success', {'userId': userId, 'runtime': 'imsdk'});
      return;
    }
    await _callRealSdkVoid('addContact', [
      userId,
      if (reason != null && reason.isNotEmpty) reason,
    ]);
  }

  Future<void> deleteContact(String userId) async {
    if (_highLevelClient != null) {
      final manager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (manager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(manager, 'deleteContact', [
        js_util.jsify({'userId': userId}),
      ]);
      await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug(
          'deleteContact_success', {'userId': userId, 'runtime': 'imsdk'});
      return;
    }
    await _callRealSdkVoid('deleteContact', [userId]);
  }

  Future<void> acceptInvitation(String userId) async {
    if (_highLevelClient != null) {
      final manager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (manager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final promise =
          js_util.callMethod<Object?>(manager, 'acceptContactInvite', [
        js_util.jsify({'userId': userId}),
      ]);
      await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug(
          'acceptInvitation_success', {'userId': userId, 'runtime': 'imsdk'});
      return;
    }
    await _callRealSdkVoid('acceptInvitation', [userId]);
  }

  Future<void> declineInvitation(String userId) async {
    if (_highLevelClient != null) {
      final manager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (manager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final promise =
          js_util.callMethod<Object?>(manager, 'declineContactInvite', [
        js_util.jsify({'userId': userId}),
      ]);
      await js_util.promiseToFuture<Object?>(promise as Object);
      _recordDebug(
          'declineInvitation_success', {'userId': userId, 'runtime': 'imsdk'});
      return;
    }
    await _callRealSdkVoid('declineInvitation', [userId]);
  }

  Future<List<String>> getContactIds() async {
    if (_highLevelClient != null) {
      final contacts = await _getImSdkContactSnapshotItems();
      final ids = contacts
          .map((item) => item['userId']?.toString() ?? '')
          .where((item) => item.isNotEmpty)
          .toList()
        ..sort();
      _recordDebug('getContactIds_success', {
        'runtime': 'imsdk',
        'result': ids,
      });
      return ids;
    }
    final result = await _callRealSdk('getContacts', const []);
    final value = js_util.dartify(result);
    return _contactIdsFromRealValue(value);
  }

  Future<List<Map<String, dynamic>>> getContacts() async {
    if (_highLevelClient != null) {
      final contacts = await _getImSdkContactSnapshotItems();
      _recordDebug('getContacts_success', {
        'runtime': 'imsdk',
        'result': contacts,
      });
      return contacts;
    }
    final result = await _callRealSdk('getAllContacts', const []);
    final value = js_util.dartify(result);
    final contacts = _contactsFromRealValue(value);
    if (contacts.isNotEmpty) {
      return contacts;
    }
    final ids = await getContactIds();
    return ids.map((userId) => {'userId': userId}).toList();
  }

  Future<Map<String, dynamic>> getContactsWithCursor({
    required int pageSize,
    required String cursor,
  }) async {
    if (_highLevelClient != null) {
      final contacts = await _getImSdkContactSnapshotItems();
      final start = int.tryParse(cursor) ?? 0;
      final page = contacts.skip(start).take(pageSize).toList();
      final next = start + page.length;
      final nextCursor = next >= contacts.length ? '' : next.toString();
      _recordDebug('getContactsWithCursor_success', {
        'runtime': 'imsdk',
        'cursor': cursor,
        'pageSize': pageSize,
        'result': {
          'cursor': nextCursor,
          'list': page,
        },
      });
      return {
        'cursor': nextCursor,
        'list': page,
      };
    }
    final result = await _callRealSdk('getContactsWithCursor', [
      {'pageSize': pageSize, 'cursor': cursor},
    ]);
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    final contacts = _asMapList(data['contacts'])
        .map(_contactFromRealSdkItem)
        .whereType<Map<String, dynamic>>()
        .toList()
      ..sort(
        (a, b) => (a['userId'] ?? '')
            .toString()
            .compareTo((b['userId'] ?? '').toString()),
      );
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': contacts,
    };
  }

  Future<void> setContactRemark({
    required String userId,
    required String remark,
  }) async {
    await _callRealSdkVoid('setContactRemark', [
      {'userId': userId, 'remark': remark},
    ]);
  }

  Future<List<Map<String, dynamic>>> _getImSdkContactSnapshotItems() async {
    final client = _highLevelClient;
    if (client == null) {
      return const <Map<String, dynamic>>[];
    }
    if (js_util.hasProperty(client, 'refreshContactSnapshot')) {
      try {
        final result = js_util.callMethod<Object?>(
          client,
          'refreshContactSnapshot',
          const [],
        );
        await _awaitMaybePromise(result);
        _recordDebug('refreshContactSnapshot_success', {'runtime': 'imsdk'});
      } catch (e) {
        _recordDebug('refreshContactSnapshot_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
      }
    }
    final snapshot =
        js_util.callMethod<Object?>(client, 'getContactSnapshot', const []);
    final value = js_util.dartify(snapshot);
    final items = value is Map ? value['items'] : null;
    final contacts = _contactsFromRealValue(items);
    _recordDebug('contactSnapshot_success', {
      'runtime': 'imsdk',
      'result': value,
    });
    return contacts;
  }

  List<String> _contactIdsFromRealValue(Object? value) {
    if (value is List) {
      return value.map(_contactIdFromRealSdkItem).whereType<String>().toList()
        ..sort();
    }
    if (value is Map) {
      final data = value['data'];
      if (data is List) {
        return data.map(_contactIdFromRealSdkItem).whereType<String>().toList()
          ..sort();
      }
      final contacts = value['contacts'];
      if (contacts is List) {
        return contacts
            .map(_contactIdFromRealSdkItem)
            .whereType<String>()
            .toList()
          ..sort();
      }
    }
    return const [];
  }

  List<Map<String, dynamic>> _contactsFromRealValue(Object? value) {
    final rawList = value is Map ? (value['data'] ?? value['contacts']) : value;
    if (rawList is List) {
      return rawList
          .map(_contactFromRealSdkItem)
          .whereType<Map<String, dynamic>>()
          .toList()
        ..sort((a, b) => (a['userId'] ?? '')
            .toString()
            .compareTo((b['userId'] ?? '').toString()));
    }
    return const [];
  }

  Future<List<String>> getBlockList() async {
    Object? result;
    if (_highLevelClient != null) {
      final contactManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (contactManager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final raw = js_util.callMethod<Object?>(
        contactManager,
        'getBlocklist',
        const [],
      );
      result = await _awaitMaybePromise(raw);
    } else {
      result = await _callRealSdk('getBlocklist', const []);
    }
    final value = js_util.dartify(result);
    final rawList = value is Map ? value['data'] : value;
    if (rawList is List) {
      return rawList.map(_contactIdFromRealSdkItem).whereType<String>().toList()
        ..sort();
    }
    return const [];
  }

  Future<Map<String, dynamic>> updateOwnUserInfo(
    Map<String, dynamic> info,
  ) async {
    final result = await _callRealSdk('updateOwnInfo', [
      _realUserInfoUpdatePayload(info),
    ]);
    final userId = _currentUser ?? '';
    final data = _realUserInfoFromResponse(result, fallbackUserId: userId);
    final normalized = {
      'userId': userId,
      ...data,
      ..._normalizeUserInfoFields(info, fallbackUserId: userId),
    };
    if (userId.isNotEmpty) {
      _userInfoCache[userId] = {
        ...?_userInfoCache[userId],
        ...normalized,
      };
    }
    _recordDebug('updateOwnUserInfo_success', {'result': normalized});
    return normalized;
  }

  Future<Map<String, dynamic>> updateOwnUserInfoWithType(
    Map<String, dynamic> info,
  ) async {
    final key = _userInfoFieldForType(info['userInfoType']);
    if (key == null) {
      return updateOwnUserInfo(const {});
    }
    final attribute = _realUserInfoPropertyForField(key);
    if (attribute == null) {
      return updateOwnUserInfo(const {});
    }
    final value = info['userInfoValue'];
    final result = await _callRealSdk('updateOwnInfoByAttribute', [
      attribute,
      value,
    ]);
    final userId = _currentUser ?? '';
    final updated = {
      'userId': userId,
      ..._realUserInfoFromResponse(result, fallbackUserId: userId),
      ..._normalizeUserInfoFields({key: value}, fallbackUserId: userId),
    };
    if (userId.isEmpty) {
      return updated;
    }
    final normalized = {
      ...?_userInfoCache[userId],
      ...updated,
    };
    _userInfoCache[userId] = Map<String, dynamic>.from(normalized);
    _recordDebug('updateOwnUserInfoWithType_success', {'result': normalized});
    return normalized;
  }

  Future<Map<String, dynamic>> fetchUserInfoById(
    List<String> userIds, {
    List<int> userInfoTypes = const [],
  }) async {
    final properties = userInfoTypes
        .map(_realUserInfoPropertyForType)
        .whereType<String>()
        .toList();
    final result = await _callRealSdk('getUserInfoByUserId', [
      {
        'userIds': userIds,
        if (properties.isNotEmpty) 'attributes': properties,
      },
    ]);
    final mapped = _realUserInfoMapFromResponse(result, userIds);
    if (properties.isEmpty) {
      await _subscribeUsersInfoBestEffort(userIds);
    }
    for (final entry in mapped.entries) {
      _userInfoCache[entry.key] = {
        ...?_userInfoCache[entry.key],
        ...entry.value,
      };
    }
    _recordDebug('fetchUserInfoById_success', {'result': mapped});
    return mapped;
  }

  Future<void> subscribeUsersInfo(List<String> userIds) async {
    if (userIds.isEmpty) {
      return;
    }
    await _callRealSdkVoid('subscribeUsersInfo', [
      {'userIds': userIds},
    ]);
  }

  Future<void> unsubscribeUsersInfo(List<String> userIds) async {
    if (userIds.isEmpty) {
      return;
    }
    await _callRealSdkVoid('unsubscribeUsersInfo', [
      {'userIds': userIds},
    ]);
  }

  Future<Map<String, dynamic>> fetchSubscribedUsers() async {
    final result = await _callRealSdk('getSubscribedUsers', const []);
    final raw = js_util.dartify(result);
    final data = raw is Map ? raw['data'] : raw;
    final users = <String, dynamic>{};
    if (data is List) {
      for (final item in data) {
        final info = _normalizeUserInfoFields(_asMap(item));
        final userId = info['userId']?.toString();
        if (userId != null && userId.isNotEmpty) {
          users[userId] = info;
        }
      }
    } else if (data is Map) {
      for (final entry in data.entries) {
        final userId = entry.key.toString();
        users[userId] = _normalizeUserInfoFields(
          _asMap(entry.value),
          fallbackUserId: userId,
        );
      }
    }
    _recordDebug('fetchSubscribedUsers_success', {'result': users});
    return users;
  }

  Future<void> _subscribeUsersInfoBestEffort(List<String> userIds) async {
    if (userIds.isEmpty) {
      return;
    }
    try {
      await subscribeUsersInfo(userIds);
      _recordDebug('subscribeUsersInfo_success', {'userIds': userIds});
    } catch (e) {
      _recordDebug('subscribeUsersInfo_error', {
        'userIds': userIds,
        'error': _jsErrorDescription(e),
      });
    }
  }

  Future<void> publishPresence(String description) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final presenceManager =
          js_util.getProperty<Object?>(highLevelClient, 'presenceManager');
      if (presenceManager == null) {
        throw StateError('Real Web SDK presenceManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        presenceManager,
        'publishPresence',
        [
          js_util.jsify({
            'customStatus': description,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('publishPresence', [
      {'description': description},
    ]);
  }

  Future<List<Map<String, dynamic>>> subscribePresence({
    required List<String> members,
    required int expiry,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final presenceManager =
          js_util.getProperty<Object?>(highLevelClient, 'presenceManager');
      if (presenceManager == null) {
        throw StateError('Real Web SDK presenceManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        presenceManager,
        'subscribePresence',
        [
          js_util.jsify({
            'userIds': members,
            'expiry': expiry,
          }),
        ],
      );
      final result = await js_util.promiseToFuture<Object?>(promise as Object);
      return _presenceListFromResponse(result, fallbackMembers: members);
    }
    final result = await _callRealSdk('subscribePresence', [
      {'usernames': members, 'expiry': expiry},
    ]);
    return _presenceListFromResponse(result, fallbackMembers: members);
  }

  Future<void> unsubscribePresence(List<String> members) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final presenceManager =
          js_util.getProperty<Object?>(highLevelClient, 'presenceManager');
      if (presenceManager == null) {
        throw StateError('Real Web SDK presenceManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        presenceManager,
        'unsubscribePresence',
        [
          js_util.jsify({
            'userIds': members,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('unsubscribePresence', [
      {'usernames': members},
    ]);
  }

  Future<List<String>> getSubscribedPresenceList({
    required int pageNum,
    required int pageSize,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final presenceManager =
          js_util.getProperty<Object?>(highLevelClient, 'presenceManager');
      if (presenceManager == null) {
        throw StateError('Real Web SDK presenceManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        presenceManager,
        'getSubscribedPresenceList',
        [
          js_util.jsify({
            'pageNum': pageNum,
            'pageSize': pageSize,
          }),
        ],
      );
      final result = await js_util.promiseToFuture<Object?>(promise as Object);
      return _presenceMembersFromResponse(result);
    }
    final result = await _callRealSdk('getSubscribedPresenceList', [
      {'pageNum': pageNum, 'pageSize': pageSize},
    ]);
    return _presenceMembersFromResponse(result);
  }

  Future<List<Map<String, dynamic>>> getPresenceStatus(
    List<String> members,
  ) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final presenceManager =
          js_util.getProperty<Object?>(highLevelClient, 'presenceManager');
      if (presenceManager == null) {
        throw StateError('Real Web SDK presenceManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        presenceManager,
        'getPresenceStatus',
        [
          js_util.jsify({
            'userIds': members,
          }),
        ],
      );
      final result = await js_util.promiseToFuture<Object?>(promise as Object);
      return _presenceListFromResponse(result, fallbackMembers: members);
    }
    final result = await _callRealSdk('getPresenceStatus', [
      {'usernames': members},
    ]);
    return _presenceListFromResponse(result, fallbackMembers: members);
  }

  Future<void> setPushPerformLanguage(String language) async {
    await _callRealSdkVoid('setPushLanguage', [
      {'language': language},
    ]);
    _recordDebug('setPushPerformLanguage_success', {'result': null});
  }

  Future<String?> getPushPerformLanguage() async {
    final result = await _callRealSdk('getPushLanguage', const []);
    final language = _pushLanguageFromResponse(result);
    _recordDebug('getPushPerformLanguage_success', {'result': language});
    return language;
  }

  Future<List<String>> getSupportedLanguages() async {
    final result = await _callRealSdk('getSupportedLanguages', const []);
    final raw = js_util.dartify(result);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['list'] ??
        data['languages'] ??
        rawMap['result'] ??
        rawMap['data'] ??
        raw;
    return _asStringList(source);
  }

  Future<Map<String, dynamic>> translateTextMessage({
    required Map<String, dynamic> message,
    required List<String> targetLanguages,
  }) async {
    final existing = Map<String, dynamic>.from(message);
    final body = _asMap(existing['body']);
    final content = body['content']?.toString() ?? '';
    if (content.isEmpty) {
      return existing;
    }
    final result = await _callRealSdk('translateMessage', [
      {
        'message': _webSdkMessageFromFlutter(existing),
        'targetLanguages': targetLanguages,
      },
    ]);
    final nextBody = Map<String, dynamic>.from(body)
      ..['translations'] = _normalizeTranslations(result, targetLanguages);
    return Map<String, dynamic>.from(existing)..['body'] = nextBody;
  }

  Future<void> setSilentModeForAll(Map<String, dynamic> param) async {
    await _callRealSdkVoid('setGlobalSilentMode', [
      {'rule': _silentModeRule(param)},
    ]);
    _recordDebug('setSilentModeForAll_success', {'result': null});
  }

  Future<Map<String, dynamic>> getSilentModeForAll() async {
    final result = await _callRealSdk('getGlobalSilentMode', const []);
    final mode = _silentModeFromResponse(result);
    _recordDebug('getSilentModeForAll_success', {'result': mode});
    return mode;
  }

  Future<void> setSilentModeForConversation({
    required String conversationId,
    required int type,
    required Map<String, dynamic> param,
  }) async {
    await _callRealSdkVoid('setConversationSilentMode', [
      {
        'conversationId': conversationId,
        'conversationType': _webPushConversationType(type),
        'rule': _silentModeRule(param),
      },
    ]);
    _recordDebug('setSilentModeForConversation_success', {'result': null});
  }

  Future<void> clearRemindTypeForConversation({
    required String conversationId,
    required int type,
  }) async {
    await _callRealSdkVoid('clearConversationRemindType', [
      {
        'conversationId': conversationId,
        'conversationType': _webPushConversationType(type),
      },
    ]);
    _recordDebug('clearRemindTypeForConversation_success', {'result': null});
  }

  Future<Map<String, dynamic>> getSilentModeForConversation({
    required String conversationId,
    required int type,
  }) async {
    final result = await _callRealSdk('getConversationSilentMode', [
      {
        'conversationId': conversationId,
        'conversationType': _webPushConversationType(type),
      },
    ]);
    final mode = _silentModeFromResponse(result);
    _recordDebug('getSilentModeForConversation_success', {'result': mode});
    return mode;
  }

  Future<Map<String, Map<String, dynamic>>> getSilentModeForConversations(
    Map<String, int> conversations,
  ) async {
    final conversationList = conversations.entries
        .map(
          (entry) => {
            'id': entry.key,
            'conversationId': entry.key,
            'conversationType': _webPushConversationType(entry.value),
          },
        )
        .toList();
    final result = await _callRealSdk('getConversationSilentModes', [
      {'conversationList': conversationList},
    ]);
    final modes = _silentModesFromResponse(result, conversations);
    _recordDebug('getSilentModeForConversations_success', {'result': modes});
    return modes;
  }

  Future<int> getConversationRemindType({
    required String conversationId,
    required int type,
  }) async {
    final result = await _callRealSdk('getConversationListByRemindType', [
      {
        'pageSize': 200,
        'cursor': '',
      },
    ]);
    final value = js_util.dartify(result);
    final rawMap = _asMap(value);
    final data = _asMap(rawMap['data']);
    final items = data['conversations'] is List
        ? data['conversations'] as List
        : data['data'] is List
            ? data['data'] as List
            : const [];
    final targetType = _webConversationType(type);
    for (final item in items) {
      final map = _asMap(item);
      final convId = map['conversationId']?.toString() ??
          map['user']?.toString() ??
          map['group']?.toString() ??
          '';
      final convType = map['type']?.toString() ?? '';
      if (convId == conversationId && convType == targetType) {
        final remindValue = map['remindType'] ?? map['value'];
        final parsed = _asInt(remindValue);
        if (parsed != null) {
          return parsed;
        }
        final normalized = remindValue?.toString().toUpperCase() ?? '';
        return switch (normalized) {
          'ALL' => 1,
          'MENTION_ONLY' => 2,
          'NONE' => 3,
          _ => 0,
        };
      }
    }
    return 0;
  }

  Future<void> uploadPushToken({
    required String notifierName,
    required String deviceToken,
  }) async {
    final deviceId = deviceIdFromConnection();
    if (deviceId == null || deviceId.isEmpty) {
      throw StateError('Real Web SDK uploadPushToken requires deviceId.');
    }
    await _callRealSdkVoid('uploadPushToken', [
      {
        'deviceId': deviceId,
        'deviceToken': deviceToken,
        'notifierName': notifierName,
      },
    ]);
  }

  Future<void> addUserToBlockList(String userId) async {
    if (_highLevelClient != null) {
      final contactManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (contactManager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final result = js_util.callMethod<Object?>(
        contactManager,
        'addUsersToBlocklist',
        [
          js_util.jsify({
            'userIds': [userId]
          })
        ],
      );
      await js_util.promiseToFuture<Object?>(result as Object);
      return;
    }
    await _callRealSdkVoid('addUsersToBlocklist', [
      {
        'userIds': [userId]
      },
    ]);
  }

  Future<void> removeUserFromBlockList(String userId) async {
    if (_highLevelClient != null) {
      final contactManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'contactManager');
      if (contactManager == null) {
        throw StateError('Real Web SDK contactManager is not available.');
      }
      final result = js_util.callMethod<Object?>(
        contactManager,
        'removeUserFromBlocklist',
        [
          js_util.jsify({
            'userIds': [userId]
          })
        ],
      );
      await js_util.promiseToFuture<Object?>(result as Object);
      return;
    }
    await _callRealSdkVoid('removeUserFromBlocklist', [
      {
        'userIds': [userId]
      },
    ]);
  }

  Future<List<Map<String, dynamic>>> getServerConversations({
    int pageSize = 20,
    String cursor = '',
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final result = js_util.callMethod<Object?>(
        chatManager,
        'refreshSessionList',
        [
          js_util.jsify({'includeEmpty': true})
        ],
      );
      try {
        final value = await js_util.promiseToFuture<Object?>(result as Object);
        _recordDebug('refreshSessionList_success', {
          'runtime': 'imsdk',
          'result': js_util.dartify(value),
        });
        return _conversationListFromImSdkResult(value);
      } catch (e) {
        _recordDebug('refreshSessionList_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK refreshSessionList failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    final result = await _callRealSdk('getServerConversations', [
      {'pageSize': pageSize, 'cursor': cursor},
    ]);
    return _conversationListFromRealSdk(result);
  }

  Future<List<Map<String, dynamic>>> getConversationList({
    int? mark,
    bool? isPinned,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient == null) {
      return getServerConversations();
    }
    final chatManager =
        js_util.getProperty<Object?>(highLevelClient, 'chatManager');
    if (chatManager == null) {
      throw StateError('Real Web SDK chatManager is not available.');
    }
    final filter = <String, dynamic>{};
    if (mark != null) {
      filter['mark'] = mark;
    }
    if (isPinned != null) {
      filter['isPinned'] = isPinned;
    }
    final result = js_util.callMethod<Object?>(
      chatManager,
      'getConversationList',
      filter.isEmpty ? const [] : [js_util.jsify(filter)],
    );
    return _conversationListFromImSdkResult(result);
  }

  Future<Map<String, dynamic>?> getServerConversation({
    required String convId,
    required int type,
  }) async {
    final conversations = await getServerConversations(pageSize: 50);
    for (final conversation in conversations) {
      if (conversation['convId']?.toString() == convId &&
          (_asInt(conversation['type']) ?? 0) == type) {
        return conversation;
      }
    }
    return null;
  }

  Future<Map<String, dynamic>> getServerConversationsWithCursor({
    int pageSize = 20,
    String cursor = '',
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final list =
          await getServerConversations(pageSize: pageSize, cursor: cursor);
      return {
        'cursor': '',
        'list': list.take(pageSize).toList(),
      };
    }
    final result = await _callRealSdk('getServerConversations', [
      {'pageSize': pageSize, 'cursor': cursor},
    ]);
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': _conversationListFromRealSdk(result),
    };
  }

  Future<Map<String, dynamic>> getServerConversationsPage({
    int pageNum = 1,
    int pageSize = 20,
  }) async {
    final page = await getServerConversationsWithCursor(
      pageSize: pageNum <= 1 ? pageSize : pageNum * pageSize,
      cursor: '',
    );
    final all = _asMapList(page['list']);
    final start = ((pageNum <= 0 ? 1 : pageNum) - 1) * pageSize;
    final end = (start + pageSize).clamp(start, all.length);
    return {
      'cursor': page['cursor']?.toString() ?? '',
      'list': start >= all.length
          ? <Map<String, dynamic>>[]
          : all.sublist(start, end),
    };
  }

  Future<Map<String, dynamic>> getPinnedServerConversationsWithCursor({
    int pageSize = 20,
    String cursor = '',
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final result = js_util.callMethod<Object?>(
        chatManager,
        'getConversationList',
        [
          js_util.jsify({'isPinned': true})
        ],
      );
      final list = _conversationListFromImSdkResult(result);
      return {
        'cursor': '',
        'list': list.take(pageSize).toList(),
      };
    }
    final result = await _callRealSdk('getServerPinnedConversations', [
      {'pageSize': pageSize, 'cursor': cursor},
    ]);
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': _conversationListFromRealSdk(result),
    };
  }

  Future<Map<String, dynamic>> pinConversation({
    required String convId,
    required int type,
    required bool isPinned,
  }) async {
    if (_highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'setConversationPinned',
        [
          js_util.jsify({
            'conversationId': convId,
            'conversationType': type == 1 ? 'groupChat' : 'singleChat',
            'pinned': isPinned,
          }),
        ],
      );
      final result = await js_util.promiseToFuture<Object?>(promise as Object);
      final data = _asMap(js_util.dartify(result));
      return {
        'isPinned': data['isPinned'] == true || isPinned,
        'pinnedTime': _asInt(data['pinnedTime']) ?? 0,
      };
    }
    final result = await _callRealSdk('pinConversation', [
      {
        'conversationId': convId,
        'conversationType': type == 1 ? 'groupChat' : 'singleChat',
        'isPinned': isPinned,
      },
    ]);
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    return {
      'isPinned': data['isPinned'] == true,
      'pinnedTime': _asInt(data['pinnedTime']) ?? 0,
    };
  }

  Future<void> deleteConversation({
    required String convId,
    required int type,
    required bool deleteRoam,
  }) async {
    await _callRealSdkVoid('deleteConversation', [
      {
        'conversationId': convId,
        'conversationType': type == 1 ? 'groupChat' : 'singleChat',
        'deleteRoamingMessages': deleteRoam,
      },
    ]);
  }

  Future<void> removeHistoryMessagesByIds({
    required String convId,
    required int type,
    required List<String> msgIds,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'removeHistoryMessages',
        [
          js_util.jsify({
            'conversationId': convId,
            'conversationType': _webHistoryChatType(type),
            'messageIds': msgIds,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('removeHistoryMessages', [
      {
        'targetId': convId,
        'chatType': _webHistoryChatType(type),
        'messageIds': msgIds,
      },
    ]);
  }

  Future<void> removeHistoryMessagesBefore({
    required String convId,
    required int type,
    required int timestamp,
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'removeHistoryMessages',
        [
          js_util.jsify({
            'conversationId': convId,
            'conversationType': _webHistoryChatType(type),
            'beforeTimestamp': timestamp,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('removeHistoryMessages', [
      {
        'targetId': convId,
        'chatType': _webHistoryChatType(type),
        'beforeTimeStamp': timestamp,
      },
    ]);
  }

  Future<Map<String, dynamic>> fetchHistoryMessages({
    required String convId,
    required int type,
    int pageSize = 20,
    String cursor = '',
  }) async {
    final highLevelClient = _highLevelClient;
    if (highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(highLevelClient, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final result = js_util.callMethod<Object?>(
        chatManager,
        'getHistoryMessages',
        [
          js_util.jsify({
            'conversationId': convId,
            'conversationType': _webHistoryChatType(type),
            'pageSize': pageSize,
            if (cursor.isNotEmpty) 'cursor': cursor,
          }),
        ],
      );
      try {
        final value = await js_util.promiseToFuture<Object?>(result as Object);
        _recordDebug('getHistoryMessages_success', {
          'runtime': 'imsdk',
          'result': js_util.dartify(value),
        });
        final raw = js_util.dartify(value);
        final data = raw is Map ? _asMap(raw) : const <String, dynamic>{};
        final rawMessages = _asMapList(
          data['items'] ?? data['messages'] ?? data['list'],
        );
        final messages = rawMessages
            .map((item) => _normalizeRealIncomingMessage(
                  item,
                  fallback: {
                    'convId': convId,
                    'chatType': type,
                  },
                ))
            .toList();
        for (final message in messages) {
          _rememberMessage(message);
        }
        return {
          'cursor': data['cursor']?.toString() ?? '',
          'list': messages,
        };
      } catch (e) {
        _recordDebug('getHistoryMessages_error', {
          'runtime': 'imsdk',
          'error': _jsErrorDescription(e),
        });
        throw StateError(
          'Real Web SDK getHistoryMessages failed: ${_jsErrorDescription(e)}',
        );
      }
    }
    final result = await _callRealSdk('getHistoryMessages', [
      {
        'targetId': convId,
        'chatType': _webHistoryChatType(type),
        'pageSize': pageSize,
        'cursor': cursor.isEmpty ? -1 : cursor,
        'searchDirection': 'up',
      },
    ]);
    final value = js_util.dartify(result);
    final data = value is Map ? _asMap(value) : const <String, dynamic>{};
    final messages = _asMapList(data['messages'])
        .map((item) => _normalizeRealTextMessage(item, fallback: {
              'to': convId,
              'chatType': type,
            }))
        .toList();
    for (final message in messages) {
      _rememberMessage(message);
    }
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': messages,
    };
  }

  Future<void> addReaction({
    required String msgId,
    required String reaction,
  }) async {
    if (_highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'addReaction',
        [
          js_util.jsify({
            'messageId': msgId,
            'reaction': reaction,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('addReaction', [
      {
        'messageId': msgId,
        'reaction': reaction,
      },
    ]);
  }

  Future<void> removeReaction({
    required String msgId,
    required String reaction,
  }) async {
    if (_highLevelClient != null) {
      final chatManager =
          js_util.getProperty<Object?>(_highLevelClient!, 'chatManager');
      if (chatManager == null) {
        throw StateError('Real Web SDK chatManager is not available.');
      }
      final promise = js_util.callMethod<Object?>(
        chatManager,
        'removeReaction',
        [
          js_util.jsify({
            'messageId': msgId,
            'reaction': reaction,
          }),
        ],
      );
      await js_util.promiseToFuture<Object?>(promise as Object);
      return;
    }
    await _callRealSdkVoid('deleteReaction', [
      {
        'messageId': msgId,
        'reaction': reaction,
      },
    ]);
  }

  Future<void> reportMessage({
    required String msgId,
    required String tag,
    required String reason,
  }) async {
    await _callRealSdkVoid('reportMessage', [
      {
        'messageId': msgId,
        'reportType': tag,
        'reportReason': reason,
      },
    ]);
  }

  Future<void> pinMessage({
    required String convId,
    required int type,
    required String msgId,
  }) async {
    await _callRealSdkVoid('pinMessage', [
      {
        'conversationId': convId,
        'conversationType': _webHistoryChatType(type),
        'messageId': msgId,
      },
    ]);
  }

  Future<void> unpinMessage({
    required String convId,
    required int type,
    required String msgId,
  }) async {
    await _callRealSdkVoid('unpinMessage', [
      {
        'conversationId': convId,
        'conversationType': _webHistoryChatType(type),
        'messageId': msgId,
      },
    ]);
  }

  Future<Map<String, dynamic>?> getPinInfo({
    required String convId,
    required int type,
    required String msgId,
  }) async {
    final result = await fetchPinnedMessages(
      convId: convId,
      type: type,
      pageSize: 50,
      cursor: '',
    );
    for (final item in _asMapList(result['list'])) {
      if (item['msgId']?.toString() == msgId) {
        return item['pinInfo'] is Map
            ? Map<String, dynamic>.from(item['pinInfo'] as Map)
            : {
                'msgId': item['msgId'],
                'convId': item['convId'],
                'operatorId': item['operatorId'],
                'pinTime': item['pinTime'],
              };
      }
    }
    return null;
  }

  Future<List<Map<String, dynamic>>> pinnedMessages({
    required String convId,
    required int type,
  }) async {
    final result = await fetchPinnedMessages(
      convId: convId,
      type: type,
      pageSize: 50,
      cursor: '',
    );
    return _asMapList(result['list']);
  }

  Future<Map<String, dynamic>> fetchPinnedMessages({
    required String convId,
    required int type,
    int pageSize = 20,
    String cursor = '',
  }) async {
    final result = await _callRealSdk('getServerPinnedMessages', [
      {
        'conversationId': convId,
        'conversationType': _webHistoryChatType(type),
        'pageSize': pageSize,
        'cursor': cursor,
      },
    ]);
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    final items = _asMapList(data['list']).map((item) {
      final message =
          _normalizeRealPinnedMessage(item, convId: convId, type: type);
      final pinInfo = _normalizeRealPinInfo(item, message);
      return {
        ...message,
        'operatorId': pinInfo['operatorId'],
        'pinTime': pinInfo['pinTime'],
        'pinInfo': pinInfo,
      };
    }).toList();
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': items,
    };
  }

  Future<Map<String, dynamic>> fetchReactionList({
    required List<String> msgIds,
    required int chatType,
    String? groupId,
  }) async {
    final result = await _callRealSdk('getReactionList', [
      {
        'messageId': msgIds,
        'chatType': _webHistoryChatType(chatType),
        if (groupId != null && groupId.isNotEmpty) 'groupId': groupId,
      },
    ]);
    final value = js_util.dartify(result);
    final data = value is Map ? value['data'] : value;
    if (data is List) {
      return {
        for (final item in data.whereType<Map>())
          if (item['msgId'] != null)
            item['msgId'].toString():
                _normalizeReactionList(item['reactionList'])
      };
    }
    final rawItems = data is Map
        ? data.entries
        : const Iterable<MapEntry<dynamic, dynamic>>.empty();
    return {
      for (final entry in rawItems)
        entry.key.toString(): _normalizeReactionList(entry.value),
    };
  }

  Future<Map<String, dynamic>> fetchReactionDetail({
    required String msgId,
    required String reaction,
    String cursor = '',
    int pageSize = 20,
  }) async {
    final result = await _callRealSdk('getReactionDetail', [
      {
        'messageId': msgId,
        'reaction': reaction,
        'cursor': cursor,
        'pageSize': pageSize,
      },
    ]);
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    final reactions = data['reactionUserList'] ??
        data['reactionList'] ??
        data['list'] ??
        data['reactions'];
    return {
      'cursor': data['cursor']?.toString() ?? '',
      'list': _normalizeReactionDetailList(
        reactions,
        fallbackReaction: data['reaction']?.toString() ?? reaction,
        fallbackCount: _asInt(data['count']) ?? 0,
        fallbackIsAddedBySelf: data['isAddedBySelf'] == true,
      ),
    };
  }

  Future<Object?> _callRealSdk(String method, List<Object?> args) async {
    final conn = _callTargetForRealSdkMethod(method);
    final result = js_util.callMethod<Object?>(conn, method, [
      for (final arg in args) js_util.jsify(arg),
    ]);
    try {
      if (result == null) return null;
      final value = await js_util.promiseToFuture<Object?>(result);
      _recordDebug('${method}_success', {'result': js_util.dartify(value)});
      return value;
    } catch (e) {
      _recordDebug('${method}_error', {'error': _jsErrorDescription(e)});
      throw StateError(
          'Real Web SDK $method failed: ${_jsErrorDescription(e)}');
    }
  }

  Future<void> _callRealSdkVoid(String method, List<Object?> args) async {
    await _callRealSdk(method, args);
  }

  Object _callTargetForRealSdkMethod(String method) {
    final highLevelClient = _highLevelClient;
    if (highLevelClient == null) {
      return _requireConnection();
    }
    final managerProperty = _imsdkManagerPropertyForMethod(method);
    if (managerProperty == null) {
      if (js_util.hasProperty(highLevelClient, method)) {
        final clientMethod =
            js_util.getProperty<Object?>(highLevelClient, method);
        if (clientMethod != null) {
          return highLevelClient;
        }
      }
      throw StateError('Real Web SDK method $method is not available.');
    }
    final manager =
        js_util.getProperty<Object?>(highLevelClient, managerProperty);
    if (manager == null) {
      throw StateError(
        'Real Web SDK $managerProperty is not available for $method.',
      );
    }
    final managerMethod = js_util.getProperty<Object?>(manager, method);
    if (managerMethod == null) {
      throw StateError(
        'Real Web SDK $managerProperty.$method is not available.',
      );
    }
    return manager;
  }

  String? _imsdkManagerPropertyForMethod(String method) {
    if (const <String>{
      'downloadAndParseCombineMessage',
      'getServerConversations',
      'getServerPinnedConversations',
      'pinConversation',
      'deleteConversation',
      'removeHistoryMessages',
      'getHistoryMessages',
      'addReaction',
      'deleteReaction',
      'reportMessage',
      'pinMessage',
      'unpinMessage',
      'getServerPinnedMessages',
      'getReactionList',
      'getReactionDetail',
      'recallMessage',
      'translateMessage',
    }.contains(method)) {
      return 'chatManager';
    }
    if (const <String>{
      'createGroupVNext',
      'destroyGroup',
      'getGroup',
      'getGroupInfo',
      'getJoinedGroups',
      'getPublicGroups',
      'getGroupMembers',
      'modifyGroup',
      'leaveGroup',
      'joinGroup',
      'inviteUsersToGroup',
      'acceptGroupInvite',
      'rejectGroupInvite',
      'acceptGroupJoinRequest',
      'rejectGroupJoinRequest',
      'setGroupMemberAttributes',
      'getGroupMemberAttributes',
      'getGroupMembersAttributes',
      'removeGroupMember',
      'removeGroupMembers',
      'changeGroupOwner',
      'blockGroupMembers',
      'unblockGroupMember',
      'unblockGroupMembers',
      'setGroupAdmin',
      'removeGroupAdmin',
      'muteGroupMember',
      'unmuteGroupMember',
      'muteAllGroupMembers',
      'unmuteAllGroupMembers',
      'getGroupMutelist',
      'getGroupAdmin',
      'getGroupBlocklist',
      'addUsersToGroupWhitelist',
      'removeGroupWhitelistMember',
      'getGroupWhitelist',
      'isInGroupMutelist',
      'getGroupSharedFilelist',
      'deleteGroupSharedFile',
      'updateGroupAnnouncement',
      'fetchGroupAnnouncement',
      'getGroupMsgReadUser',
    }.contains(method)) {
      return 'groupManager';
    }
    if (const <String>{
      'createChatThread',
      'getChatThreadDetail',
      'getChatThreads',
      'getJoinedChatThreads',
      'getChatThreadMembers',
      'getChatThreadLastMessage',
      'joinChatThread',
      'leaveChatThread',
      'removeChatThreadMember',
      'changeChatThreadName',
      'destroyChatThread',
    }.contains(method)) {
      return 'chatThreadManager';
    }
    if (const <String>{
      'joinChatRoom',
      'createChatRoom',
      'destroyChatRoom',
      'modifyChatRoom',
      'getChatRoomMembers',
      'muteChatRoomMember',
      'unmuteChatRoomMember',
      'changeChatRoomOwner',
      'setChatRoomAdmin',
      'removeChatRoomAdmin',
      'getChatRoomAdmin',
      'getChatRoomMutelist',
      'removeChatRoomMembers',
      'blockChatRoomMember',
      'unblockChatRoomMember',
      'getChatRoomBlocklist',
      'updateChatRoomAnnouncement',
      'fetchChatRoomAnnouncement',
      'addUsersToChatRoomWhitelist',
      'removeChatRoomAllowlistMember',
      'getChatRoomWhitelist',
      'isInChatRoomAllowlist',
      'disableSendChatRoomMsg',
      'enableSendChatRoomMsg',
      'isInChatRoomMutelist',
      'getChatRoomAttributes',
      'setChatRoomAttributes',
      'removeChatRoomAttributes',
      'leaveChatRoom',
      'getChatRoomDetails',
      'getJoinedChatRooms',
      'getChatRooms',
    }.contains(method)) {
      return 'chatRoomManager';
    }
    if (const <String>{
      'addContact',
      'deleteContact',
      'acceptInvitation',
      'declineInvitation',
      'getContacts',
      'getAllContacts',
      'getContactsWithCursor',
      'setContactRemark',
      'getBlocklist',
      'addUsersToBlocklist',
      'removeUserFromBlocklist',
    }.contains(method)) {
      return 'contactManager';
    }
    if (const <String>{
      'updateOwnInfo',
      'updateOwnInfoByAttribute',
      'getUserInfoByUserId',
      'getUserInfoByAttribute',
      'subscribeUsersInfo',
      'unsubscribeUsersInfo',
      'getSubscribedUsers',
    }.contains(method)) {
      return 'userInfoManager';
    }
    if (const <String>{
      'publishPresence',
      'subscribePresence',
      'unsubscribePresence',
      'getSubscribedPresenceList',
      'getPresenceStatus',
    }.contains(method)) {
      return 'presenceManager';
    }
    if (const <String>{
      'setPushLanguage',
      'getPushLanguage',
      'getSupportedLanguages',
      'setGlobalSilentMode',
      'getGlobalSilentMode',
      'setConversationSilentMode',
      'clearConversationRemindType',
      'getConversationSilentMode',
      'getConversationSilentModes',
      'getConversationListByRemindType',
      'uploadPushToken',
    }.contains(method)) {
      return 'pushManager';
    }
    return null;
  }

  Future<Object?> _awaitMaybePromise(Object? result) async {
    if (result == null) {
      return null;
    }
    try {
      final then = js_util.getProperty<Object?>(result, 'then');
      if (then != null) {
        return await js_util.promiseToFuture<Object?>(result);
      }
    } catch (_) {
      // Fall through to direct synchronous value.
    }
    return result;
  }

  Object _requireChatThreadManager() {
    final highLevelClient = _highLevelClient;
    if (highLevelClient == null) {
      throw StateError('Real Web SDK IMSDK client is not initialized.');
    }
    final threadManager = js_util.getProperty<Object?>(
      highLevelClient,
      'chatThreadManager',
    );
    if (threadManager == null) {
      throw StateError('Real Web SDK chatThreadManager is not available.');
    }
    return threadManager;
  }

  Future<void> _callRealGroupHandleVoid(String groupId, String method) async {
    final client = _highLevelClient;
    if (client == null) {
      throw StateError('Real Web SDK IMSDK client is not initialized.');
    }
    final groupManager = js_util.getProperty<Object?>(client, 'groupManager');
    if (groupManager == null) {
      throw StateError('Real Web SDK groupManager is not available.');
    }
    final group =
        js_util.callMethod<Object?>(groupManager, 'getGroup', [groupId]);
    if (group == null) {
      throw StateError('Real Web SDK group handle is null.');
    }
    final result = js_util.callMethod<Object?>(group, method, const []);
    try {
      final value = await js_util.promiseToFuture<Object?>(result as Object);
      _recordDebug('${method}_success', {
        'runtime': 'imsdk',
        'groupId': groupId,
        'result': js_util.dartify(value),
      });
    } catch (e) {
      _recordDebug('${method}_error', {
        'runtime': 'imsdk',
        'groupId': groupId,
        'error': _jsErrorDescription(e),
      });
      throw StateError(
        'Real Web SDK $method failed: ${_jsErrorDescription(e)}',
      );
    }
  }

  Object _requireConnection() {
    final conn = _connection;
    if (conn == null) {
      throw StateError('Real Web SDK connection is not initialized.');
    }
    return conn;
  }

  void _installEventHandler() {
    final conn = _requireConnection();
    if (_highLevelClient != null) {
      final messageHandler = js_util.jsify({
        'onMessage': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onMessage', {'payload': value, 'runtime': 'imsdk'});
          if (value is List) {
            for (final item in value) {
              final message = _normalizeRealIncomingMessage(item);
              _recordDebug('bridge_emit_real_text_message_begin', {
                'runtime': 'imsdk',
                'source': 'onMessage',
                'msgId': message['msgId'],
                'from': message['from'],
                'to': message['to'],
                'bodyType': _asMap(message['body'])['type'],
              });
              onTextMessage(message);
              _recordDebug('bridge_emit_real_text_message_end', {
                'runtime': 'imsdk',
                'source': 'onMessage',
                'msgId': message['msgId'],
              });
            }
          } else {
            final message = _normalizeRealIncomingMessage(value);
            _recordDebug('bridge_emit_real_text_message_begin', {
              'runtime': 'imsdk',
              'source': 'onMessage',
              'msgId': message['msgId'],
              'from': message['from'],
              'to': message['to'],
              'bodyType': _asMap(message['body'])['type'],
            });
            onTextMessage(message);
            _recordDebug('bridge_emit_real_text_message_end', {
              'runtime': 'imsdk',
              'source': 'onMessage',
              'msgId': message['msgId'],
            });
          }
        }).toJS,
        'onMessageRead': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onMessageRead', {'payload': value, 'runtime': 'imsdk'});
          if (value is List) {
            for (final item in value) {
              final message = _normalizeRealReadAck(item);
              onReadAckMessage(message);
            }
          } else {
            final message = _normalizeRealReadAck(value);
            onReadAckMessage(message);
          }
        }).toJS,
        'onMessageDelivered': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onMessageDelivered', {'payload': value, 'runtime': 'imsdk'});
          final message = _normalizeRealDeliveryAck(value);
          onDeliveredAckMessage(message);
        }).toJS,
        'onMessageUpdated': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onMessageUpdated', {'payload': value, 'runtime': 'imsdk'});
          final message = _normalizeRealTextMessage(value);
          _rememberMessage(message);
          onModifiedMessage(message);
        }).toJS,
        'onMessageRecalled': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onMessageRecalled', {'payload': value, 'runtime': 'imsdk'});
          final message = _normalizeRealRecall(value);
          onRecallMessage(message);
        }).toJS,
        'onConversationRead': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onConversationRead', {'payload': value, 'runtime': 'imsdk'});
          final payload = _normalizeRealConversationRead(value);
          onConversationRead(payload);
        }).toJS,
        'onReactionChanged': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onReactionChanged', {'payload': value, 'runtime': 'imsdk'});
          final payload = _normalizeRealReactionChanged(value);
          onReactionChanged(payload);
        }).toJS,
        'onConversationListUpdate': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onConversationListUpdate',
              {'payload': value, 'runtime': 'imsdk'});
          final updates = _normalizeRealConversationUpdates(value);
          for (final item in updates) {
            onConversationUpdated(item);
          }
        }).toJS,
        'onMultiDeviceContact': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onMultiDeviceContact', {'payload': value, 'runtime': 'imsdk'});
          onClientEvent('onMultiDeviceContactEvent',
              _normalizeMultiDeviceClientEvent(value, 'contact'));
        }).toJS,
        'onMultiDeviceGroup': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onMultiDeviceGroup', {'payload': value, 'runtime': 'imsdk'});
          onClientEvent('onMultiDeviceGroupEvent',
              _normalizeMultiDeviceClientEvent(value, 'group'));
        }).toJS,
        'onMultiDeviceThread': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onMultiDeviceThread', {'payload': value, 'runtime': 'imsdk'});
          onClientEvent('onMultiDeviceThreadEvent',
              _normalizeMultiDeviceClientEvent(value, 'thread'));
        }).toJS,
        'onMultiDeviceConversation': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onMultiDeviceConversation',
              {'payload': value, 'runtime': 'imsdk'});
          onClientEvent('onMultiDevicesConversationEvent',
              _normalizeMultiDeviceClientEvent(value, 'conversation'));
        }).toJS,
        'onMultiDeviceMessageRemoved': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onMultiDeviceMessageRemoved',
              {'payload': value, 'runtime': 'imsdk'});
          onClientEvent('onMultiDeviceRemoveMessagesEvent',
              _normalizeMultiDeviceClientEvent(value, 'messageRemoved'));
        }).toJS,
        'onPresenceStatusChange': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onPresenceStatusChange', {'payload': value, 'runtime': 'imsdk'});
          onPresenceStatusChanged({
            'presences': _presenceListFromResponse(value),
            'operation': 'presence_status_changed',
          });
        }).toJS,
        'onSyncDataStart': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onSyncDataStart', {'payload': value, 'runtime': 'imsdk'});
        }).toJS,
        'onSyncDataFinished': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onSyncDataFinished', {'payload': value, 'runtime': 'imsdk'});
        }).toJS,
        'onContactAdded': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onContactAdded', {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onContactEvent('onContactChanged', {
            'type': 'onContactAdded',
            'userId': payload['from']?.toString() ??
                payload['userId']?.toString() ??
                '',
            'reason': payload['reason']?.toString(),
            'operation': 'contact_added',
          });
        }).toJS,
        'onContactDeleted': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onContactDeleted', {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onContactEvent('onContactChanged', {
            'type': 'onContactDeleted',
            'userId': payload['from']?.toString() ??
                payload['userId']?.toString() ??
                '',
            'reason': payload['reason']?.toString(),
            'operation': 'contact_deleted',
          });
        }).toJS,
        'onContactInvited': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onContactInvited', {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onContactEvent('onContactChanged', {
            'type': 'onContactInvited',
            'userId': payload['from']?.toString() ??
                payload['userId']?.toString() ??
                '',
            'reason': payload['reason']?.toString(),
            'operation': 'contact_invited',
          });
        }).toJS,
        'onContactAgreed': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onContactAgreed', {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onContactEvent('onContactChanged', {
            'type': 'onFriendRequestAccepted',
            'userId': payload['from']?.toString() ??
                payload['userId']?.toString() ??
                '',
            'reason': payload['reason']?.toString(),
            'operation': 'contact_agreed',
          });
        }).toJS,
        'onContactRefuse': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onContactRefuse', {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onContactEvent('onContactChanged', {
            'type': 'onFriendRequestDeclined',
            'userId': payload['from']?.toString() ??
                payload['userId']?.toString() ??
                '',
            'reason': payload['reason']?.toString(),
            'operation': 'contact_refused',
          });
        }).toJS,
        'onOwnInfoUpdated': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onOwnInfoUpdated', {'payload': value, 'runtime': 'imsdk'});
          onUserInfoEvent(
              'onOwnInfoUpdated', _normalizeUserInfoFields(_asMap(value)));
        }).toJS,
        'onUserInfoUpdated': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onUserInfoUpdated', {'payload': value, 'runtime': 'imsdk'});
          final raw = value is List ? value : <dynamic>[value];
          final users = raw
              .map((item) => _normalizeUserInfoFields(_asMap(item)))
              .where((item) => item.isNotEmpty)
              .toList();
          onUserInfoEvent('onUserInfoUpdated', users);
        }).toJS,
        'onAnnouncementChanged': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onGroupAnnouncementChanged',
              {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onGroupEvent('onGroupChanged', {
            'type': 'onGroupAnnouncementChanged',
            'groupId': payload['groupId']?.toString() ?? '',
            'announcement': payload['announcement']?.toString() ?? '',
            'operation': 'announcement',
          });
        }).toJS,
        'onMembersJoined': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onGroupMembersJoined', {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onGroupEvent('onGroupChanged', {
            'type': 'onGroupMemberJoined',
            'groupId': payload['groupId']?.toString() ?? '',
            'userIds': _normalizeUserInfoIdList(payload['members']),
            'operation': 'member_joined',
          });
        }).toJS,
        '__chatroom:onAnnouncementChanged': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onChatRoomAnnouncementChanged',
              {'payload': value, 'runtime': 'imsdk'});
          final payload = _asMap(value);
          onChatRoomEvent('onChatRoomChanged', {
            'type': 'onRoomAnnouncementChanged',
            'roomId': payload['roomId']?.toString() ?? '',
            'announcement': payload['announcement']?.toString() ?? '',
            'operation': 'announcement',
          });
        }).toJS,
        'onConnected': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug('onConnected', {'payload': value, 'runtime': 'imsdk'});
          onConnected(_asMap(value));
        }).toJS,
        'onDisconnected': ((JSAny? event) {
          final value = js_util.dartify(event);
          _recordDebug(
              'onDisconnected', {'payload': value, 'runtime': 'imsdk'});
          onDisconnected(_asMap(value));
        }).toJS,
      });
      js_util.callMethod<Object?>(_highLevelClient!, 'addEventHandler', [
        'im_flutter_sdk_web',
        messageHandler,
      ]);

      final presenceManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'presenceManager',
      );
      if (presenceManager != null) {
        final presenceHandler = js_util.jsify({
          'onPresenceStatusChange': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onPresenceStatusChange', {
              'payload': value,
              'runtime': 'imsdk',
            });
            onPresenceStatusChanged({
              'presences': _presenceListFromResponse(value),
              'operation': 'presence_status_changed',
            });
          }).toJS,
        });
        js_util.callMethod<Object?>(presenceManager, 'addEventHandler', [
          'im_flutter_sdk_web_presence',
          presenceHandler,
        ]);
      }

      final contactManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'contactManager',
      );
      if (contactManager != null) {
        final contactHandler = js_util.jsify({
          'onContactAdded': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug(
                'onContactAdded', {'payload': value, 'runtime': 'imsdk'});
            final payload = _asMap(value);
            onContactEvent('onContactChanged', {
              'type': 'onContactAdded',
              'userId': payload['from']?.toString() ??
                  payload['userId']?.toString() ??
                  '',
              'reason': payload['reason']?.toString(),
              'operation': 'contact_added',
            });
          }).toJS,
          'onContactDeleted': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onContactDeleted', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onContactEvent('onContactChanged', {
              'type': 'onContactDeleted',
              'userId': payload['from']?.toString() ??
                  payload['userId']?.toString() ??
                  '',
              'reason': payload['reason']?.toString(),
              'operation': 'contact_deleted',
            });
          }).toJS,
          'onContactInvited': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onContactInvited', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onContactEvent('onContactChanged', {
              'type': 'onContactInvited',
              'userId': payload['from']?.toString() ??
                  payload['userId']?.toString() ??
                  '',
              'reason': payload['reason']?.toString(),
              'operation': 'contact_invited',
            });
          }).toJS,
          'onContactAgreed': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onContactAgreed', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onContactEvent('onContactChanged', {
              'type': 'onFriendRequestAccepted',
              'userId': payload['from']?.toString() ??
                  payload['userId']?.toString() ??
                  '',
              'reason': payload['reason']?.toString(),
              'operation': 'contact_agreed',
            });
          }).toJS,
          'onContactRefuse': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onContactRefuse', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onContactEvent('onContactChanged', {
              'type': 'onFriendRequestDeclined',
              'userId': payload['from']?.toString() ??
                  payload['userId']?.toString() ??
                  '',
              'reason': payload['reason']?.toString(),
              'operation': 'contact_refused',
            });
          }).toJS,
        });
        js_util.callMethod<Object?>(contactManager, 'addEventHandler', [
          'im_flutter_sdk_web_contact',
          contactHandler,
        ]);
      }

      final groupManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'groupManager',
      );
      if (groupManager != null) {
        final groupHandler = js_util.jsify({
          'onAnnouncementChanged': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onGroupAnnouncementChanged', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onGroupEvent('onGroupChanged', {
              'type': 'onGroupAnnouncementChanged',
              'groupId': payload['groupId']?.toString() ?? '',
              'announcement': payload['announcement']?.toString() ?? '',
              'operation': 'announcement',
            });
          }).toJS,
          'onMembersJoined': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onGroupMembersJoined', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onGroupEvent('onGroupChanged', {
              'type': 'onGroupMemberJoined',
              'groupId': payload['groupId']?.toString() ?? '',
              'userIds': _normalizeUserInfoIdList(
                payload['members'] ?? payload['memberIds'],
              ),
              'operation': 'member_joined',
            });
          }).toJS,
        });
        js_util.callMethod<Object?>(groupManager, 'addEventHandler', [
          'im_flutter_sdk_web_group',
          groupHandler,
        ]);
      }

      final chatRoomManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'chatRoomManager',
      );
      if (chatRoomManager != null) {
        final chatRoomHandler = js_util.jsify({
          'onAnnouncementChanged': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onChatRoomAnnouncementChanged', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onChatRoomEvent('onChatRoomChanged', {
              'type': 'onRoomAnnouncementChanged',
              'roomId': payload['chatRoomId']?.toString() ??
                  payload['roomId']?.toString() ??
                  '',
              'announcement': payload['announcement']?.toString() ?? '',
              'operation': 'announcement',
            });
          }).toJS,
          'onMembersJoined': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onChatRoomMembersJoined', {
              'payload': value,
              'runtime': 'imsdk',
            });
            final payload = _asMap(value);
            onChatRoomEvent('onChatRoomChanged', {
              'type': 'onRoomMemberJoined',
              'roomId': payload['chatRoomId']?.toString() ??
                  payload['roomId']?.toString() ??
                  '',
              'participants': _normalizeUserInfoIdList(
                payload['members'] ?? payload['memberIds'],
              ),
              'operation': 'member_joined',
            });
          }).toJS,
        });
        js_util.callMethod<Object?>(chatRoomManager, 'addEventHandler', [
          'im_flutter_sdk_web_chatroom',
          chatRoomHandler,
        ]);
      }
      final chatThreadManager = js_util.getProperty<Object?>(
        _highLevelClient!,
        'chatThreadManager',
      );
      if (chatThreadManager != null) {
        final chatThreadHandler = js_util.jsify({
          'onChatThreadCreated': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onChatThreadCreated', {
              'payload': value,
              'runtime': 'imsdk',
            });
            onChatRoomEvent(
              'onChatThreadCreate',
              _normalizeChatThreadEvent(value, 'create'),
            );
          }).toJS,
          'onChatThreadUpdated': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onChatThreadUpdated', {
              'payload': value,
              'runtime': 'imsdk',
            });
            onChatRoomEvent(
              'onChatThreadUpdate',
              _normalizeChatThreadEvent(value, 'update'),
            );
          }).toJS,
          'onChatThreadDestroyed': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onChatThreadDestroyed', {
              'payload': value,
              'runtime': 'imsdk',
            });
            onChatRoomEvent(
              'onChatThreadDestroy',
              _normalizeChatThreadEvent(value, 'destroy'),
            );
          }).toJS,
          'onChatThreadUserRemoved': ((JSAny? event) {
            final value = js_util.dartify(event);
            _recordDebug('onChatThreadUserRemoved', {
              'payload': value,
              'runtime': 'imsdk',
            });
            onChatRoomEvent(
              'onUserKickOutOfChatThread',
              _normalizeChatThreadEvent(value, 'user_kicked'),
            );
          }).toJS,
        });
        js_util.callMethod<Object?>(chatThreadManager, 'addEventHandler', [
          'im_flutter_sdk_web_chat_thread',
          chatThreadHandler,
        ]);
      }
      return;
    }
    final handler = {
      'onMessage': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onMessage', {'payload': value});
        if (value is List) {
          for (final item in value) {
            final message = _normalizeRealIncomingMessage(item);
            _recordDebug('bridge_emit_real_text_message_begin', {
              'source': 'onMessage',
              'msgId': message['msgId'],
              'from': message['from'],
              'to': message['to'],
              'bodyType': _asMap(message['body'])['type'],
            });
            onTextMessage(message);
            _recordDebug('bridge_emit_real_text_message_end', {
              'source': 'onMessage',
              'msgId': message['msgId'],
            });
          }
        } else {
          final message = _normalizeRealIncomingMessage(value);
          _recordDebug('bridge_emit_real_text_message_begin', {
            'source': 'onMessage',
            'msgId': message['msgId'],
            'from': message['from'],
            'to': message['to'],
            'bodyType': _asMap(message['body'])['type'],
          });
          onTextMessage(message);
          _recordDebug('bridge_emit_real_text_message_end', {
            'source': 'onMessage',
            'msgId': message['msgId'],
          });
        }
      }).toJS,
      'onTextMessage': ((JSAny? event) {
        _recordDebug('onTextMessage', {'payload': js_util.dartify(event)});
        final message = _normalizeRealIncomingMessage(js_util.dartify(event));
        _recordDebug('bridge_emit_real_text_message_begin', {
          'source': 'onTextMessage',
          'msgId': message['msgId'],
          'from': message['from'],
          'to': message['to'],
          'bodyType': _asMap(message['body'])['type'],
        });
        onTextMessage(message);
        _recordDebug('bridge_emit_real_text_message_end', {
          'source': 'onTextMessage',
          'msgId': message['msgId'],
        });
      }).toJS,
      'onReadMessage': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onReadMessage', {'payload': value});
        final message = _normalizeRealReadAck(value);
        onReadAckMessage(message);
      }).toJS,
      'onDeliveredMessage': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onDeliveredMessage', {'payload': value});
        final message = _normalizeRealDeliveryAck(value);
        onDeliveredAckMessage(message);
      }).toJS,
      'onModifiedMessage': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onModifiedMessage', {'payload': value});
        final message = _normalizeRealTextMessage(value);
        _rememberMessage(message);
        onModifiedMessage(message);
      }).toJS,
      'onRecallMessage': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onRecallMessage', {'payload': value});
        final message = _normalizeRealRecall(value);
        onRecallMessage(message);
      }).toJS,
      'onMessagePinEvent': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onMessagePinEvent', {'payload': value});
        final pinEvent = _normalizeRealMessagePinEvent(value);
        onMessagePinChanged(pinEvent);
      }).toJS,
      'onOpened': (() {
        _recordDebug('onOpened');
      }).toJS,
      'onConversationRead': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onConversationRead', {'payload': value});
        final payload = _normalizeRealConversationRead(value);
        onConversationRead(payload);
      }).toJS,
      'onConnected': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onConnected', {'payload': value});
        onConnected(_asMap(value));
      }).toJS,
      'onDisconnected': ((JSAny? event) {
        final value = js_util.dartify(event);
        _recordDebug('onDisconnected', {'payload': value});
        onDisconnected(_asMap(value));
      }).toJS,
      'onOnline': (() {
        _recordDebug('onOnline');
      }).toJS,
      'onError': ((JSAny? event) {
        _recordDebug('onError', {'payload': js_util.dartify(event)});
      }).toJS,
    };
    final jsHandler = js_util.newObject<Object>();
    for (final entry in handler.entries) {
      js_util.setProperty(jsHandler, entry.key, entry.value);
    }
    js_util.callMethod<Object?>(conn, 'addEventHandler', [
      'im_flutter_sdk_web',
      jsHandler,
    ]);
  }

  Map<String, dynamic> _normalizeRealTextMessage(
    Object? value, {
    Map<String, dynamic>? fallback,
    String? content,
  }) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final body = _asMap(fallback?['body']);
    final fallbackBodyType = _asInt(body['type']) ?? 0;
    final rawMessageType =
        raw['type']?.toString() ?? raw['msgType']?.toString() ?? '';
    final normalizedBodyType =
        rawMessageType == 'cmd' || fallbackBodyType == 6 ? 6 : 0;
    final action = raw['action']?.toString() ??
        _asMap(raw['body'])['action']?.toString() ??
        body['action']?.toString() ??
        '';
    final text = raw['msg']?.toString() ??
        raw['data']?.toString() ??
        content ??
        body['content']?.toString() ??
        '';
    final to = raw['to']?.toString() ?? fallback?['to']?.toString();
    final from = raw['from']?.toString() ??
        fallback?['from']?.toString() ??
        _currentUser;
    final msgServerId = raw['msgServerId']?.toString() ??
        raw['serverMsgId']?.toString() ??
        raw['msgId']?.toString() ??
        raw['id']?.toString();
    final msgLocalId = raw['msgLocalId']?.toString() ??
        raw['id']?.toString() ??
        fallback?['msgLocalId']?.toString();
    final msgId = msgServerId ??
        msgLocalId ??
        fallback?['msgId']?.toString() ??
        DateTime.now().millisecondsSinceEpoch.toString();
    final now = DateTime.now().millisecondsSinceEpoch;
    final timestamp = _asInt(raw['time']) ??
        _asInt(raw['timestamp']) ??
        _asInt(raw['serverTime']) ??
        _asInt(fallback?['serverTime']) ??
        _asInt(fallback?['localTime']) ??
        now;
    return {
      'msgId': msgId,
      if (msgServerId != null && msgServerId.isNotEmpty)
        'msgServerId': msgServerId,
      if (msgLocalId != null && msgLocalId.isNotEmpty) 'msgLocalId': msgLocalId,
      'from': from,
      'to': to,
      'convId': fallback?['convId']?.toString() ?? to ?? from,
      'chatType': fallback?['chatType'] ?? 0,
      'direction': fallback?['direction'] ?? (from == _currentUser ? 0 : 1),
      'status': 2,
      'localTime': timestamp,
      'serverTime': timestamp,
      'body': normalizedBodyType == 6
          ? {
              'type': 6,
              'action': action,
            }
          : {
              'type': 0,
              'content': text,
            },
    };
  }

  Map<String, dynamic> _webSdkMessageFromFlutter(Map<String, dynamic> message) {
    final body = _asMap(message['body']);
    final bodyType = _asInt(body['type']) ?? 0;
    final conversationType = _webChatType(message['chatType']);
    if (bodyType == 0) {
      return {
        ...message,
        'id': message['msgId']?.toString() ??
            message['msgServerId']?.toString() ??
            message['msgLocalId']?.toString(),
        'type': 'text',
        'conversationId':
            message['convId']?.toString() ?? message['to']?.toString() ?? '',
        'conversationType': conversationType,
        'body': {
          'content': body['content']?.toString() ?? '',
        },
      };
    }
    return {
      ...message,
      'conversationId':
          message['convId']?.toString() ?? message['to']?.toString() ?? '',
      'conversationType': conversationType,
    };
  }

  Map<String, dynamic> _normalizeRealIncomingMessage(
    Object? value, {
    Map<String, dynamic>? fallback,
  }) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final messageType =
        raw['type']?.toString() ?? raw['msgType']?.toString() ?? '';
    if (messageType == 'combine') {
      return _normalizeRealCombineMessage(raw, fallback: fallback);
    }
    if (messageType == 'cmd' ||
        _asInt(_asMap(fallback?['body'])['type']) == 6) {
      return _normalizeRealTextMessage(value, fallback: fallback);
    }
    final body = _asMap(raw['body']);
    if (body.isNotEmpty &&
        (body['type'] != null ||
            messageType == 'text' ||
            body['content'] != null)) {
      final normalizedBody = Map<String, dynamic>.from(body);
      if (!normalizedBody.containsKey('type')) {
        normalizedBody['type'] = messageType == 'combine' ? 8 : 0;
      }
      final msgServerId = raw['msgServerId']?.toString() ??
          raw['serverMsgId']?.toString() ??
          raw['msgId']?.toString() ??
          raw['id']?.toString();
      final msgLocalId = raw['msgLocalId']?.toString() ??
          raw['id']?.toString() ??
          fallback?['msgLocalId']?.toString();
      final msgId = msgServerId ??
          msgLocalId ??
          fallback?['msgId']?.toString() ??
          DateTime.now().millisecondsSinceEpoch.toString();
      final from = raw['from']?.toString() ??
          fallback?['from']?.toString() ??
          _currentUser;
      final to = raw['to']?.toString() ?? fallback?['to']?.toString();
      final timestamp = _asInt(raw['serverTime']) ??
          _asInt(raw['time']) ??
          _asInt(raw['timestamp']) ??
          _asInt(fallback?['serverTime']) ??
          _asInt(fallback?['localTime']) ??
          DateTime.now().millisecondsSinceEpoch;
      final normalized = {
        'msgId': msgId,
        if (msgServerId != null && msgServerId.isNotEmpty)
          'msgServerId': msgServerId,
        if (msgLocalId != null && msgLocalId.isNotEmpty)
          'msgLocalId': msgLocalId,
        'from': from,
        'to': to,
        'convId': fallback?['convId']?.toString() ??
            raw['convId']?.toString() ??
            raw['conversationId']?.toString() ??
            to ??
            from,
        'chatType': _normalizeIncomingChatType(
            raw['chatType'] ?? fallback?['chatType']),
        'direction': raw['direction'] ??
            fallback?['direction'] ??
            (from == _currentUser ? 0 : 1),
        'status': raw['status'] ?? fallback?['status'] ?? 2,
        'localTime': _asInt(raw['localTime']) ?? timestamp,
        'serverTime': timestamp,
        'body': normalizedBody,
      };
      _rememberMessage(normalized);
      return normalized;
    }
    return _normalizeRealTextMessage(value, fallback: fallback);
  }

  int _normalizeIncomingChatType(Object? value) {
    if (value is int) {
      return value;
    }
    final text = value?.toString() ?? '';
    switch (text) {
      case 'singleChat':
        return 0;
      case 'groupChat':
        return 1;
      case 'chatRoom':
        return 2;
      default:
        return _asInt(value) ?? 0;
    }
  }

  Map<String, dynamic> _normalizeRealCombineMessage(
    Object? value, {
    Map<String, dynamic>? fallback,
  }) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final rawBody = _asMap(raw['body']);
    final body = _asMap(fallback?['body']);
    final combineUrl = raw['url']?.toString() ??
        raw['remotePath']?.toString() ??
        raw['combineUrl']?.toString() ??
        rawBody['url']?.toString() ??
        rawBody['remotePath']?.toString() ??
        rawBody['combineUrl']?.toString() ??
        body['url']?.toString() ??
        body['remotePath']?.toString() ??
        body['combineUrl']?.toString();
    final combineSecret = raw['secret']?.toString() ??
        raw['secretKey']?.toString() ??
        rawBody['secret']?.toString() ??
        rawBody['secretKey']?.toString() ??
        body['secret']?.toString() ??
        body['secretKey']?.toString();
    final to = raw['to']?.toString() ?? fallback?['to']?.toString();
    final from = raw['from']?.toString() ??
        fallback?['from']?.toString() ??
        _currentUser;
    final msgId = raw['id']?.toString() ??
        raw['msgId']?.toString() ??
        raw['msgServerId']?.toString() ??
        raw['serverMsgId']?.toString() ??
        fallback?['msgId']?.toString() ??
        DateTime.now().millisecondsSinceEpoch.toString();
    final now = DateTime.now().millisecondsSinceEpoch;
    final timestamp = _asInt(raw['time']) ??
        _asInt(raw['timestamp']) ??
        _asInt(raw['serverTime']) ??
        _asInt(fallback?['serverTime']) ??
        _asInt(fallback?['localTime']) ??
        now;
    final messageList = _asStringList(
      raw['messageList'] ??
          raw['msgIds'] ??
          rawBody['messageList'] ??
          rawBody['msgIds'] ??
          body['messageList'],
    );
    return {
      'msgId': msgId,
      'from': from,
      'to': to,
      'convId': fallback?['convId']?.toString() ?? to ?? from,
      'chatType': fallback?['chatType'] ?? 0,
      'direction': fallback?['direction'] ?? (from == _currentUser ? 0 : 1),
      'status': 2,
      'localTime': timestamp,
      'serverTime': timestamp,
      'body': {
        'type': 8,
        'title': raw['title']?.toString() ??
            rawBody['title']?.toString() ??
            body['title']?.toString() ??
            '',
        'summary': raw['summary']?.toString() ??
            rawBody['summary']?.toString() ??
            body['summary']?.toString() ??
            '',
        'compatibleText': raw['compatibleText']?.toString() ??
            rawBody['compatibleText']?.toString() ??
            body['compatibleText']?.toString() ??
            '',
        'messageList': messageList,
        if (combineUrl != null && combineUrl.isNotEmpty)
          'remotePath': combineUrl,
        if (combineUrl != null && combineUrl.isNotEmpty) 'url': combineUrl,
        if (combineSecret != null && combineSecret.isNotEmpty)
          'secret': combineSecret,
      },
    };
  }

  Map<String, dynamic> _normalizeRealReadAck(Object? value) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final msgId = raw['mid']?.toString() ??
        raw['ackId']?.toString() ??
        raw['messageId']?.toString() ??
        raw['msgId']?.toString() ??
        raw['id']?.toString() ??
        '';
    final indexed = _messageIndex[msgId] ?? const <String, dynamic>{};
    final from =
        indexed['from']?.toString() ?? raw['to']?.toString() ?? _currentUser;
    final to = indexed['to']?.toString() ?? raw['from']?.toString();
    final rawConversationType = raw['conversationType']?.toString();
    final rawConversationId = raw['conversationId']?.toString();
    return {
      'msgId': msgId,
      'from': from,
      'to': to,
      'convId':
          rawConversationId ?? indexed['convId']?.toString() ?? to ?? from,
      'chatType':
          _chatTypeFromWeb(rawConversationType) ?? indexed['chatType'] ?? 0,
      'direction': indexed['direction'] ?? 0,
      'status': indexed['status'] ?? 2,
      'hasReadAck': true,
      if (raw['ackContent'] != null) 'content': raw['ackContent']?.toString(),
      'body': _asMap(indexed['body']),
    };
  }

  Map<String, dynamic> _normalizeRealDeliveryAck(Object? value) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final msgId = raw['mid']?.toString() ??
        raw['ackId']?.toString() ??
        raw['msgId']?.toString() ??
        raw['id']?.toString() ??
        '';
    final indexed = _messageIndex[msgId] ?? const <String, dynamic>{};
    final from =
        indexed['from']?.toString() ?? raw['to']?.toString() ?? _currentUser;
    final to = indexed['to']?.toString() ?? raw['from']?.toString();
    return {
      'msgId': msgId,
      'from': from,
      'to': to,
      'convId': indexed['convId']?.toString() ?? to ?? from,
      'chatType': indexed['chatType'] ?? 0,
      'direction': indexed['direction'] ?? 0,
      'status': indexed['status'] ?? 2,
      'hasDeliverAck': true,
      'body': _asMap(indexed['body']),
    };
  }

  Map<String, dynamic> _normalizeRealRecall(Object? value) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final msgId = raw['mid']?.toString() ??
        raw['msgId']?.toString() ??
        raw['ackId']?.toString() ??
        raw['id']?.toString() ??
        '';
    final indexed = _messageIndex[msgId] ?? const <String, dynamic>{};
    return {
      'msgId': msgId,
      'from': indexed['from']?.toString() ?? raw['from']?.toString(),
      'to': indexed['to']?.toString() ?? raw['to']?.toString(),
      'convId': indexed['convId']?.toString() ??
          raw['from']?.toString() ??
          raw['to']?.toString(),
      'chatType': indexed['chatType'] ?? 0,
      'direction': indexed['direction'] ?? 0,
      'status': indexed['status'] ?? 2,
      'body': _asMap(indexed['body']),
      'recallBy': raw['from']?.toString(),
      if (raw['ext'] != null) 'ext': raw['ext'].toString(),
    };
  }

  Map<String, dynamic> _normalizeRealConversationRead(Object? value) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : const {};
    final conversationId =
        raw['conversationId']?.toString() ?? raw['to']?.toString() ?? '';
    final selfUser = _currentUser ?? '';
    final from = raw['from']?.toString() ??
        raw['by']?.toString() ??
        raw['peerId']?.toString() ??
        conversationId;
    final to = raw['to']?.toString() ?? raw['userId']?.toString() ?? selfUser;
    return {
      'from': from,
      'to': to,
      'convId': conversationId.isNotEmpty ? conversationId : to,
      'timestamp': _asInt(raw['timestamp']) ??
          _asInt(raw['time']) ??
          DateTime.now().millisecondsSinceEpoch,
      if (raw['type'] != null) 'type': raw['type'],
    };
  }

  Map<String, dynamic> _normalizeRealMessagePinEvent(Object? value) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final operation = raw['operation']?.toString() == 'unpin'
        ? 'message_unpinned'
        : 'message_pinned';
    final msgId = raw['messageId']?.toString() ??
        raw['msgId']?.toString() ??
        raw['id']?.toString() ??
        '';
    final indexed = _messageIndex[msgId] ?? const <String, dynamic>{};
    final rawType = raw['conversationType'];
    return {
      'msgId': msgId,
      'convId': raw['conversationId']?.toString() ??
          indexed['convId']?.toString() ??
          indexed['to']?.toString() ??
          '',
      'operatorId':
          raw['operatorId']?.toString() ?? raw['from']?.toString() ?? '',
      'operation': operation,
      'chatType': _chatTypeFromWeb(rawType) ?? indexed['chatType'] ?? 0,
      'pinTime': _asInt(raw['time']) ?? DateTime.now().millisecondsSinceEpoch,
    };
  }

  Map<String, dynamic> _normalizeRealReactionChanged(Object? value) {
    final raw = _asMap(value);
    final reaction = raw['reaction']?.toString() ??
        raw['emoji']?.toString() ??
        raw['key']?.toString() ??
        '';
    final msgId = raw['msgId']?.toString() ??
        raw['messageId']?.toString() ??
        raw['id']?.toString() ??
        '';
    final userId = raw['userId']?.toString() ??
        raw['from']?.toString() ??
        raw['operatorId']?.toString() ??
        _currentUser ??
        '';
    final operation = raw['operation']?.toString() ??
        raw['type']?.toString() ??
        raw['event']?.toString() ??
        '';
    final lowered = operation.toLowerCase();
    final added = lowered.contains('add') ||
        lowered.contains('added') ||
        lowered == 'add' ||
        lowered == 'create';
    return {
      'msgId': msgId,
      'reaction': reaction,
      'userId': userId,
      'operation': added ? 'reaction_added' : 'reaction_removed',
    };
  }

  List<Map<String, dynamic>> _normalizeRealConversationUpdates(Object? value) {
    if (value is Map) {
      final raw = _asMap(value);
      final items = raw['items'];
      if (items is List) {
        return items
            .map((item) => _normalizeRealConversationUpdate(item))
            .where((item) => item['convId']?.toString().isNotEmpty == true)
            .toList();
      }
    }
    final rawList = value is List ? value : [value];
    return rawList
        .map((item) => _normalizeRealConversationUpdate(item))
        .where((item) => item['convId']?.toString().isNotEmpty == true)
        .toList();
  }

  Map<String, dynamic> _normalizeRealConversationUpdate(Object? value) {
    final raw = _asMap(value);
    final convId = raw['conversationId']?.toString() ??
        raw['convId']?.toString() ??
        raw['id']?.toString() ??
        '';
    final isPinned = raw['isPinned'] == true;
    final deleted = raw['deleted'] == true ||
        raw['isDeleted'] == true ||
        raw['operation']?.toString() == 'conversation_deleted';
    final source =
        raw['source']?.toString() ?? raw['operation']?.toString() ?? '';
    final op = deleted
        ? 'conversation_deleted'
        : (isPinned
            ? 'conversation_pinned'
            : (source.contains('unpin')
                ? 'conversation_unpinned'
                : 'conversation_updated'));
    return {
      'convId': convId,
      'isPinned': isPinned,
      if (deleted) 'deleteMessages': true,
      'operation': op,
    };
  }

  Map<String, dynamic> _normalizeRealPinnedMessage(
    Map<String, dynamic> item, {
    required String convId,
    required int type,
  }) {
    final rawMessage = _asMap(item['message']);
    final message = _normalizeRealTextMessage(
      rawMessage,
      fallback: {
        'to': convId,
        'convId': convId,
        'chatType': type,
      },
    );
    _rememberMessage(message);
    return message;
  }

  Map<String, dynamic> _normalizeRealPinInfo(
    Map<String, dynamic> item,
    Map<String, dynamic> message,
  ) {
    return {
      'msgId': message['msgId'],
      'convId': message['convId'],
      'operatorId': item['operatorId']?.toString() ??
          item['operator']?.toString() ??
          item['pinOperator']?.toString() ??
          '',
      'pinTime': _asInt(item['pinTime']) ??
          _asInt(item['pinnedTime']) ??
          DateTime.now().millisecondsSinceEpoch,
    };
  }

  String? _contactIdFromRealSdkItem(Object? item) {
    if (item is String && item.isNotEmpty) {
      return item;
    }
    if (item is Map) {
      return item['userId']?.toString() ??
          item['username']?.toString() ??
          item['name']?.toString();
    }
    return null;
  }

  Map<String, dynamic>? _contactFromRealSdkItem(Object? item) {
    final userId = _contactIdFromRealSdkItem(item);
    if (userId == null || userId.isEmpty) {
      return null;
    }
    final contact = <String, dynamic>{'userId': userId};
    if (item is Map && item['remark'] != null) {
      contact['remark'] = item['remark'].toString();
    }
    return contact;
  }

  Map<String, dynamic> _realUserInfoUpdatePayload(Map<String, dynamic> info) {
    final payload = <String, dynamic>{};
    for (final entry in info.entries) {
      final key = _realUserInfoPropertyForField(entry.key);
      if (key != null && entry.value != null) {
        payload[key] = entry.value;
      }
    }
    return payload;
  }

  Map<String, dynamic> _realUserInfoMapFromResponse(
    Object? value,
    List<String> fallbackUserIds,
  ) {
    final raw = js_util.dartify(value);
    final data = raw is Map ? raw['data'] : raw;
    final result = <String, dynamic>{};
    if (data is Map) {
      for (final entry in data.entries) {
        final userId = entry.key.toString();
        result[userId] = _normalizeUserInfoFields(
          _asMap(entry.value),
          fallbackUserId: userId,
        );
      }
    } else if (data is List) {
      for (final item in data) {
        final info = _normalizeUserInfoFields(_asMap(item));
        final userId = info['userId']?.toString();
        if (userId != null && userId.isNotEmpty) {
          result[userId] = info;
        }
      }
    }
    for (final userId in fallbackUserIds) {
      result.putIfAbsent(userId, () => {'userId': userId});
    }
    return result;
  }

  Map<String, dynamic> _realUserInfoFromResponse(
    Object? value, {
    required String fallbackUserId,
  }) {
    final raw = js_util.dartify(value);
    final data = raw is Map ? raw['data'] : raw;
    if (data is Map) {
      if (data[fallbackUserId] != null) {
        return _normalizeUserInfoFields(
          _asMap(data[fallbackUserId]),
          fallbackUserId: fallbackUserId,
        );
      }
      return _normalizeUserInfoFields(
        _asMap(data),
        fallbackUserId: fallbackUserId,
      );
    }
    return {'userId': fallbackUserId};
  }

  Map<String, dynamic> _normalizeUserInfoFields(
    Map<String, dynamic> raw, {
    String? fallbackUserId,
  }) {
    final userId = raw['userId']?.toString() ??
        raw['username']?.toString() ??
        raw['user']?.toString() ??
        fallbackUserId;
    return {
      if (userId != null && userId.isNotEmpty) 'userId': userId,
      if (raw['nickName'] != null) 'nickName': raw['nickName'],
      if (raw['nickname'] != null) 'nickName': raw['nickname'],
      if (raw['avatarUrl'] != null) 'avatarUrl': raw['avatarUrl'],
      if (raw['avatarurl'] != null) 'avatarUrl': raw['avatarurl'],
      if (raw['mail'] != null) 'mail': raw['mail'],
      if (raw['phone'] != null) 'phone': raw['phone'],
      if (raw['gender'] != null) 'gender': raw['gender'],
      if (raw['sign'] != null) 'sign': raw['sign'],
      if (raw['birth'] != null) 'birth': raw['birth'],
      if (raw['ext'] != null) 'ext': raw['ext'],
    };
  }

  String? _realUserInfoPropertyForField(String field) {
    switch (field) {
      case 'nickName':
        return 'nickname';
      case 'avatarUrl':
        return 'avatarurl';
      case 'mail':
      case 'phone':
      case 'gender':
      case 'sign':
      case 'birth':
      case 'ext':
        return field;
      default:
        return null;
    }
  }

  String? _realUserInfoPropertyForType(int type) {
    final field = _userInfoFieldForType(type);
    return field == null ? null : _realUserInfoPropertyForField(field);
  }

  List<Map<String, dynamic>> _presenceListFromResponse(
    Object? value, {
    List<String> fallbackMembers = const [],
  }) {
    final raw = js_util.dartify(value);
    final result = raw is Map ? _presencePayloadResult(raw) : raw;
    final items = result is List
        ? result
        : result is Map
            ? result.values.toList()
            : const [];
    final normalized = items
        .map(_normalizePresence)
        .where((item) => (item['publisher']?.toString() ?? '').isNotEmpty)
        .toList();
    if (normalized.isNotEmpty || fallbackMembers.isEmpty) {
      return normalized;
    }
    return fallbackMembers
        .map((member) => {
              'publisher': member,
              'statusDescription': '',
              'lastTime': 0,
              'expiryTime': 0,
              'statusDetails': <String, dynamic>{},
            })
        .toList();
  }

  List<String> _presenceMembersFromResponse(Object? value) {
    final raw = js_util.dartify(value);
    final result = raw is Map ? _presencePayloadResult(raw) : raw;
    final items = result is List
        ? result
        : result is Map
            ? result['sublist'] is List
                ? result['sublist'] as List
                : result.values.toList()
            : const [];
    return items
        .map((item) {
          if (item is String) return item;
          if (item is Map) {
            return item['publisher']?.toString() ??
                item['uid']?.toString() ??
                item['username']?.toString() ??
                item['userId']?.toString() ??
                item['user']?.toString();
          }
          return null;
        })
        .whereType<String>()
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
  }

  Object? _presencePayloadResult(Map<dynamic, dynamic> raw) {
    final data = raw['data'];
    if (raw.containsKey('result')) {
      return raw['result'];
    }
    if (data is Map && data.containsKey('result')) {
      return data['result'];
    }
    return data ?? raw;
  }

  Map<String, dynamic> _normalizePresence(Object? item) {
    final raw = _asMap(item);
    final publisher = raw['publisher']?.toString() ??
        raw['uid']?.toString() ??
        raw['username']?.toString() ??
        raw['userId']?.toString() ??
        raw['user']?.toString() ??
        '';
    final statusDetails =
        _asMap(raw['statusDetails'] ?? raw['status_details'] ?? raw['status']);
    return {
      'publisher': publisher,
      'statusDescription': raw['statusDescription']?.toString() ??
          raw['description']?.toString() ??
          raw['ext']?.toString() ??
          '',
      'lastTime': _asInt(raw['lastTime']) ?? _asInt(raw['last_time']) ?? 0,
      'expiryTime': _asInt(raw['expiryTime']) ??
          _asInt(raw['expiry_time']) ??
          _asInt(raw['expiry']) ??
          0,
      'statusDetails': statusDetails,
    };
  }

  List<String> _normalizeUserInfoIdList(Object? source) {
    final items = source is List ? source : const [];
    return items
        .map((item) {
          if (item is Map) {
            final map = Map<String, dynamic>.from(item);
            return map['userId']?.toString() ??
                map['uid']?.toString() ??
                map['username']?.toString() ??
                '';
          }
          return item?.toString() ?? '';
        })
        .where((item) => item.isNotEmpty)
        .toList();
  }

  bool _groupStyleIsPublic(Object? style) {
    final value = _asInt(style) ?? 1;
    return value == 2 || value == 3;
  }

  bool _groupStyleNeedsApproval(Object? style) {
    final value = _asInt(style) ?? 1;
    return value == 2;
  }

  Map<String, dynamic> _normalizeRealGroup(
    Object? value,
    Map<String, dynamic> fallback,
  ) {
    final raw = value is Map ? Map<String, dynamic>.from(value) : {};
    final data = raw['data'] is Map
        ? Map<String, dynamic>.from(raw['data'] as Map)
        : raw;
    final groupId = data['groupId']?.toString() ??
        data['groupid']?.toString() ??
        data['id']?.toString() ??
        fallback['groupId']?.toString() ??
        '';
    final members = _asStringList(
      fallback['inviteMembers'] ?? fallback['members'],
    );
    final owner = fallback['owner']?.toString() ?? _currentUser ?? '';
    final memberList =
        <String>{owner, ...members}.where((e) => e.isNotEmpty).toList()..sort();
    return {
      'groupId': groupId,
      'name': fallback['groupName']?.toString() ??
          fallback['name']?.toString() ??
          data['groupName']?.toString() ??
          data['groupname']?.toString() ??
          groupId,
      'desc': fallback['desc']?.toString() ??
          fallback['description']?.toString() ??
          data['description']?.toString() ??
          data['desc']?.toString(),
      'owner': data['owner']?.toString() ?? owner,
      'memberList': memberList,
      'memberCount': _asInt(data['memberCount']) ??
          _asInt(data['affiliations_count']) ??
          memberList.length,
      'adminList': <String>[],
      'blockList': <String>[],
      'muteList': <String>[],
      'whiteList': <String>[],
      'sharedFiles': <Map<String, dynamic>>[],
      'messageBlocked': false,
      'isAllMemberMuted': data['isAllMemberMuted'] == true ||
          data['muteAllMembers'] == true ||
          data['mute'] == true ||
          data['allMemberMuted'] == true ||
          data['isMuted'] == true,
      'isDisabled': data['disabled'] == true,
    };
  }

  Map<String, dynamic>? _normalizeRealGroupDetail(
    Object? value, {
    Map<String, dynamic> fallback = const {},
  }) {
    final raw = _asMap(value);
    final dataList = raw['data'] is List
        ? _asMapList(raw['data'])
        : const <Map<String, dynamic>>[];
    final data = _asMap(raw['data']);
    final source = dataList.isNotEmpty
        ? dataList.firstWhere(
            (item) =>
                (item['groupid']?.toString() ??
                    item['groupId']?.toString() ??
                    item['id']?.toString() ??
                    '') ==
                (fallback['groupId']?.toString() ?? ''),
            orElse: () => dataList.first,
          )
        : data.isNotEmpty
            ? data
            : raw;
    if (raw.isEmpty && source.isEmpty && fallback.isEmpty) {
      return null;
    }
    final affiliations = _asMapList(source['affiliations']);
    final owner = source['owner']?.toString() ??
        _groupAffiliationFirst(affiliations, 'owner') ??
        fallback['owner']?.toString() ??
        _currentUser ??
        '';
    final memberList = <String>{
      ..._asStringList(source['members']),
      ..._groupAffiliationIds(affiliations, 'member'),
      if (owner.isNotEmpty) owner,
    }.toList()
      ..sort();
    final group = _normalizeRealGroup(source, fallback);
    group['owner'] = owner;
    group['memberList'] = memberList;
    group['memberCount'] = _asInt(source['memberCount']) ??
        _asInt(source['affiliations_count']) ??
        _asInt(source['affiliationsCount']) ??
        memberList.length;
    group['adminList'] = <String>{
      ..._asStringList(source['adminList'] ?? source['admins']),
      ..._groupAffiliationIds(affiliations, 'admin'),
    }.toList()
      ..sort();
    group['ext'] = source['ext']?.toString() ??
        source['custom']?.toString() ??
        raw['ext']?.toString() ??
        raw['custom']?.toString() ??
        fallback['ext']?.toString() ??
        '';
    group['isDisabled'] =
        source['disabled'] == true || source['disabled']?.toString() == 'true';
    group['isAllMemberMuted'] = source['isAllMemberMuted'] == true ||
        source['muteAllMembers'] == true ||
        source['mute'] == true ||
        source['allMemberMuted'] == true ||
        source['isMuted'] == true;
    if (source['announcement'] != null) {
      group['announcement'] = source['announcement']?.toString();
    }
    if (source['avatarUrl'] != null) {
      group['avatarUrl'] = source['avatarUrl'];
    } else if (source['avatarurl'] != null) {
      group['avatarUrl'] = source['avatarurl'];
    } else if (source['avatar'] != null) {
      group['avatarUrl'] = source['avatar'];
    }
    return group;
  }

  List<Map<String, dynamic>> _groupListSource(Object? raw) {
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final source = data['list'] is List
        ? data['list']
        : data['data'] is List
            ? data['data']
            : rawMap['data'] is List
                ? rawMap['data']
                : rawMap['entities'] is List
                    ? rawMap['entities']
                    : const [];
    return _asMapList(source);
  }

  Map<String, dynamic> _normalizeRealGroupInfo(Map<String, dynamic> item) {
    return {
      'groupId': item['groupId']?.toString() ??
          item['groupid']?.toString() ??
          item['id']?.toString() ??
          '',
      'name': item['groupName']?.toString() ??
          item['groupname']?.toString() ??
          item['name']?.toString() ??
          '',
      'desc': item['description']?.toString() ?? item['desc']?.toString(),
      'owner': item['owner']?.toString() ?? '',
      'memberCount': _asInt(item['memberCount']) ??
          _asInt(item['affiliations_count']) ??
          _asInt(item['affiliationsCount']) ??
          0,
    };
  }

  List<String> _groupAffiliationIds(
    List<Map<String, dynamic>> affiliations,
    String key,
  ) {
    return affiliations
        .map((item) => item[key]?.toString() ?? '')
        .where((value) => value.isNotEmpty)
        .toList();
  }

  String? _groupAffiliationFirst(
    List<Map<String, dynamic>> affiliations,
    String key,
  ) {
    for (final item in affiliations) {
      final value = item[key]?.toString() ?? '';
      if (value.isNotEmpty) {
        return value;
      }
    }
    return null;
  }

  Map<String, dynamic> _normalizeGroupAck(
    Map<String, dynamic> item, {
    required String msgId,
  }) {
    final userId = item['userId']?.toString() ??
        item['user']?.toString() ??
        item['from']?.toString() ??
        item['username']?.toString() ??
        item['name']?.toString() ??
        '';
    return {
      'ack_id': item['ack_id']?.toString() ??
          item['ackId']?.toString() ??
          item['id']?.toString() ??
          userId,
      'msgId': item['msgId']?.toString() ?? msgId,
      'from': userId,
      'content': item['content']?.toString() ??
          item['ackContent']?.toString() ??
          item['ack_content']?.toString(),
      'count': _asInt(item['count']) ?? 1,
      'timestamp': _asInt(item['timestamp']) ??
          _asInt(item['time']) ??
          _asInt(item['created']) ??
          0,
    };
  }

  Map<String, dynamic> _normalizeChatThread(
    Map<String, dynamic> item, {
    Map<String, dynamic> fallback = const {},
  }) {
    final threadId = item['threadId']?.toString() ??
        item['chatThreadId']?.toString() ??
        item['thread_id']?.toString() ??
        item['id']?.toString() ??
        fallback['threadId']?.toString() ??
        '';
    return {
      'threadId': threadId,
      'threadName': item['threadName']?.toString() ??
          item['name']?.toString() ??
          fallback['name']?.toString() ??
          fallback['threadName']?.toString() ??
          threadId,
      'owner': item['owner']?.toString() ??
          fallback['owner']?.toString() ??
          _currentUser ??
          '',
      'msgId': item['msgId']?.toString() ??
          item['messageId']?.toString() ??
          item['message_id']?.toString() ??
          fallback['msgId']?.toString() ??
          fallback['messageId']?.toString() ??
          '',
      'parentId': item['parentId']?.toString() ??
          item['groupId']?.toString() ??
          item['group_id']?.toString() ??
          fallback['parentId']?.toString() ??
          '',
      'memberCount': _asInt(item['memberCount']) ??
          _asInt(item['membersCount']) ??
          _asInt(item['affiliationsCount']) ??
          _asInt(item['affiliations_count']) ??
          1,
      'messageCount':
          _asInt(item['messageCount']) ?? _asInt(item['message_count']) ?? 0,
      'createAt': _asInt(item['createAt']) ??
          _asInt(item['created']) ??
          _asInt(item['createdAt']) ??
          _asInt(item['timestamp']) ??
          DateTime.now().millisecondsSinceEpoch,
      if (item['lastMessage'] != null)
        'lastMessage': _normalizeRealTextMessage(item['lastMessage']),
    };
  }

  Map<String, dynamic> _normalizeChatThreadEvent(
    Object? raw,
    String operation,
  ) {
    final payload = _asMap(raw);
    final thread = _asMap(payload['thread']);
    final normalizedThread = _normalizeChatThread({
      ...thread,
      ...payload,
      if (payload['chatThreadName'] != null)
        'threadName': payload['chatThreadName'],
      if (payload['messageId'] != null) 'msgId': payload['messageId'],
    });
    final userId =
        payload['userId']?.toString() ?? payload['memberId']?.toString();
    return {
      'threadId': normalizedThread['threadId'],
      'threadName': normalizedThread['threadName'],
      'parentId': normalizedThread['parentId'],
      'owner': normalizedThread['owner'],
      if (userId != null && userId.isNotEmpty) 'userId': userId,
      'operation': operation,
    };
  }

  Map<String, dynamic> _normalizeThreadLastMessageResult(Object? rawValue) {
    final rawMap = _asMap(rawValue);
    final result = <String, dynamic>{};
    final entities = _asMapList(
      rawMap['entities'] is List
          ? rawMap['entities']
          : _asMap(rawMap['data'])['entities'],
    );
    if (entities.isNotEmpty) {
      for (final item in entities) {
        final threadId = item['chatThreadId']?.toString() ??
            item['threadId']?.toString() ??
            item['thread_id']?.toString() ??
            '';
        if (threadId.isEmpty) {
          continue;
        }
        final lastMessage = _asMap(item['lastMessage'] ?? item['message']);
        if (lastMessage.isEmpty) {
          continue;
        }
        result[threadId] = _normalizeRealIncomingMessage(
          lastMessage,
          fallback: {'to': threadId},
        );
      }
      return result;
    }
    final data = _asMap(rawMap['data']);
    data.forEach((threadId, value) {
      final valueMap = _asMap(value);
      if (valueMap.isEmpty) {
        return;
      }
      result[threadId] = _normalizeRealIncomingMessage(
        valueMap,
        fallback: {'to': threadId.toString()},
      );
    });
    return result;
  }

  Map<String, dynamic> _normalizeChatRoom(
    Map<String, dynamic> item, {
    Map<String, dynamic> fallback = const {},
  }) {
    final roomId = item['roomId']?.toString() ??
        item['chatRoomId']?.toString() ??
        item['chatroomId']?.toString() ??
        item['id']?.toString() ??
        fallback['roomId']?.toString() ??
        '';
    final affiliations = _asMapList(item['affiliations']);
    final ownerIds = _chatRoomAffiliationIds(affiliations, 'owner');
    final owner = _chatRoomUserId(item['owner']) ??
        _chatRoomUserId(fallback['owner']) ??
        (ownerIds.isNotEmpty ? ownerIds.first : '');
    final memberList = <String>{
      ..._chatRoomUserIds(item['memberList'] ?? item['members']),
      ..._chatRoomAffiliationIds(affiliations, 'member'),
      if (owner.isNotEmpty) owner,
    }.toList()
      ..sort();
    return {
      'roomId': roomId,
      'name': item['name']?.toString() ??
          item['title']?.toString() ??
          fallback['name']?.toString() ??
          roomId,
      'desc': item['desc']?.toString() ??
          item['description']?.toString() ??
          fallback['desc']?.toString() ??
          fallback['description']?.toString(),
      'owner': owner,
      'memberCount': _asInt(item['memberCount']) ??
          _asInt(item['affiliations_count']) ??
          _asInt(item['affiliationsCount']) ??
          _asInt(item['occupants_count']) ??
          memberList.length,
      'maxUsers': _asInt(item['maxUsers']) ??
          _asInt(item['maxusers']) ??
          _asInt(item['max_users']) ??
          _asInt(fallback['maxUsers']) ??
          0,
      'adminList': <String>{
        ..._asStringList(item['adminList'] ?? item['admins']),
        ..._chatRoomAffiliationIds(affiliations, 'admin'),
      }.toList()
        ..sort(),
      'memberList': memberList,
      'blockList': _asStringList(item['blockList'] ?? item['blocklist']),
      'muteList': _asStringList(item['muteList'] ?? item['mutelist']),
      'whiteList': _asStringList(item['whiteList'] ?? item['whitelist']),
      'announcement': item['announcement']?.toString(),
      'isAllMemberMuted': item['isAllMemberMuted'] == true ||
          item['mute'] == true ||
          item['allMemberMuted'] == true,
      'permissionType': _asInt(item['permissionType']) ?? 0,
      'isInWhitelist': item['isInWhitelist'] == true,
      'createTimestamp': _asInt(item['createTimestamp']) ??
          _asInt(item['created']) ??
          _asInt(item['created_at']) ??
          0,
      'muteExpireTimestamp': _asInt(item['muteExpireTimestamp']) ?? 0,
    };
  }

  String? _chatRoomUserId(Object? value) {
    if (value == null) {
      return null;
    }
    if (value is Map) {
      final map = _asMap(value);
      final userId = map['userId']?.toString() ??
          map['memberId']?.toString() ??
          map['username']?.toString() ??
          map['user']?.toString();
      if (userId != null && userId.isNotEmpty) {
        return userId;
      }
    }
    final text = value.toString();
    return text.isEmpty ? null : text;
  }

  List<String> _chatRoomUserIds(Object? raw) {
    final result = <String>{};
    if (raw is List) {
      for (final item in raw) {
        final userId = _chatRoomUserId(item);
        if (userId != null && userId.isNotEmpty) {
          result.add(userId);
        }
      }
      final sorted = result.toList()..sort();
      return sorted;
    }
    return _asStringList(raw);
  }

  List<String> _chatRoomAffiliationIds(
    List<Map<String, dynamic>> affiliations,
    String key,
  ) {
    return affiliations
        .map((item) => item[key]?.toString() ?? '')
        .where((value) => value.isNotEmpty)
        .toList();
  }

  List<String> _normalizeUserIdList(Object? source) {
    if (source is List) {
      final values = <String>[];
      for (final item in source) {
        if (item is String && item.isNotEmpty) {
          values.add(item);
        } else if (item is Map) {
          final map = Map<String, dynamic>.from(item);
          final userId = map['user']?.toString() ??
              map['member']?.toString() ??
              map['username']?.toString() ??
              map['userId']?.toString() ??
              map['name']?.toString() ??
              '';
          if (userId.isNotEmpty) {
            values.add(userId);
          }
        }
      }
      return _sortedStrings(values);
    }
    return <String>[];
  }

  List<Map<String, dynamic>> _normalizeGroupMemberInfoList(Object? source) {
    final result = <Map<String, dynamic>>[];
    if (source is! List) {
      return result;
    }
    for (final item in source.whereType<Map>()) {
      final map = Map<String, dynamic>.from(item);
      final userId = map['user']?.toString() ??
          map['member']?.toString() ??
          map['username']?.toString() ??
          map['userId']?.toString() ??
          map['owner']?.toString() ??
          '';
      if (userId.isEmpty) {
        continue;
      }
      final roleName = map['role']?.toString() ??
          map['affiliation']?.toString() ??
          map['type']?.toString() ??
          '';
      final joinedTs = _asInt(map['joinedTime']) ??
          _asInt(map['joinTime']) ??
          _asInt(map['joinedTs']) ??
          _asInt(map['timestamp']) ??
          0;
      result.add({
        'userId': userId,
        'memberId': userId,
        'role': switch (roleName) {
          'owner' => 0,
          'admin' => 1,
          _ => 2,
        },
        'joinTime': joinedTs,
        'joinedTs': joinedTs,
        'namecard': map['namecard']?.toString() ?? '',
      });
    }
    result.sort((a, b) => (a['userId'] ?? '')
        .toString()
        .compareTo((b['userId'] ?? '').toString()));
    return result;
  }

  Map<String, int> _normalizeChatRoomAttributeFailures(Object? raw) {
    final source = raw is Map && raw['data'] is Map ? raw['data'] : raw;
    final failures = <String, int>{};
    _asMap(source).forEach((key, value) {
      final parsed =
          value is int ? value : int.tryParse(value?.toString() ?? '');
      if (parsed != null) {
        failures[key] = parsed;
      }
    });
    return failures;
  }

  String? _pushLanguageFromResponse(Object? value) {
    final raw = js_util.dartify(value);
    final data = raw is Map ? raw['data'] : raw;
    final result = data is Map && data.containsKey('result')
        ? data['result']
        : raw is Map && raw.containsKey('result')
            ? raw['result']
            : data;
    if (result is String && result.isNotEmpty) {
      return result;
    }
    if (result is Map) {
      return result['translationLanguage']?.toString() ??
          result['language']?.toString() ??
          result['code']?.toString();
    }
    if (data is Map) {
      return data['translationLanguage']?.toString() ??
          data['language']?.toString() ??
          data['code']?.toString();
    }
    if (raw is Map) {
      return raw['translationLanguage']?.toString() ??
          raw['language']?.toString() ??
          raw['code']?.toString();
    }
    return null;
  }

  Map<String, dynamic> _normalizeTranslations(
    Object? value,
    List<String> targetLanguages,
  ) {
    final raw = js_util.dartify(value);
    final rawMap = _asMap(raw);
    final data = _asMap(rawMap['data']);
    final result = _asMap(data['result']);
    final merged = <String, dynamic>{
      ..._asMap(rawMap['translations']),
      ..._asMap(data['translations']),
      ..._asMap(result['translations']),
    };
    if (merged.isNotEmpty) {
      return merged.map(
        (key, item) => MapEntry(key, item?.toString() ?? ''),
      );
    }
    final source = data['list'] ??
        data['items'] ??
        rawMap['result'] ??
        rawMap['data'] ??
        raw;
    if (source is List) {
      final translations = <String, dynamic>{};
      for (final item in source) {
        final map = _asMap(item);
        final language = map['translationLanguage']?.toString() ??
            map['language']?.toString() ??
            map['code']?.toString() ??
            '';
        if (language.isEmpty) {
          continue;
        }
        final text = map['translation']?.toString() ??
            map['text']?.toString() ??
            map['result']?.toString() ??
            '';
        translations[language] = text;
      }
      if (translations.isNotEmpty) {
        return translations;
      }
    }
    return {
      for (final language in targetLanguages) language: '',
    };
  }

  Map<String, dynamic> _silentModeRule(Map<String, dynamic> param) {
    final paramType = _asInt(param['paramType']) ?? 0;
    switch (paramType) {
      case 1:
        return {
          'mode': 'DURATION',
          'duration': _asInt(param['duration']) ?? 0,
        };
      case 2:
        final start = _asMap(param['startTime']);
        final end = _asMap(param['endTime']);
        return {
          'mode': 'INTERVAL',
          'startTime': {
            'hours': _asInt(start['hour'] ?? start['hours']) ?? 0,
            'minutes': _asInt(start['minute'] ?? start['minutes']) ?? 0,
          },
          'endTime': {
            'hours': _asInt(end['hour'] ?? end['hours']) ?? 0,
            'minutes': _asInt(end['minute'] ?? end['minutes']) ?? 0,
          },
        };
      case 0:
      default:
        return {
          'mode': 'REMIND_TYPE',
          'remindType': _silentRemindType(_asInt(param['remindType']) ?? 0),
        };
    }
  }

  Map<String, dynamic> _normalizeMultiDeviceClientEvent(
    Object? value,
    String category,
  ) {
    final payload = _asMap(value);
    final operation = payload['operation']?.toString() ?? '';
    final conversationType =
        payload['conversationType']?.toString() ?? payload['type']?.toString();
    return {
      'event': _multiDeviceEventCode(category, operation),
      'target': payload['target']?.toString() ??
          payload['targetUserId']?.toString() ??
          payload['groupId']?.toString() ??
          payload['threadId']?.toString() ??
          payload['conversationId']?.toString() ??
          '',
      'userIds': _normalizeUserInfoIdList(payload['userIds']),
      'ext': payload['ext']?.toString(),
      'convId': payload['convId']?.toString() ??
          payload['conversationId']?.toString() ??
          '',
      'convType': _multiDeviceConversationType(conversationType),
      'deviceId': payload['deviceId']?.toString() ??
          payload['operatorId']?.toString() ??
          '',
      'msgIds': _asStringList(payload['messageIds'] ?? payload['msgIds']),
      'beforeTimestamp': _asInt(payload['beforeTimestamp']),
      'operation': operation,
      'category': category,
    };
  }

  int _multiDeviceConversationType(String? type) {
    switch (type) {
      case 'group':
      case 'groupChat':
        return 1;
      case 'room':
      case 'chatRoom':
        return 2;
      case 'single':
      case 'singleChat':
      default:
        return 0;
    }
  }

  int _multiDeviceEventCode(String category, String operation) {
    switch (category) {
      case 'contact':
        switch (operation) {
          case 'contactAccept':
          case 'contact_accept':
          case 'accept':
            return 3;
          case 'contactDecline':
          case 'contact_decline':
          case 'decline':
            return 4;
          case 'contactBan':
          case 'contact_ban':
          case 'block':
            return 5;
          case 'contactAllow':
          case 'contact_allow':
          case 'unblock':
            return 6;
          case 'contactRemove':
          case 'contact_remove':
          case 'delete':
          default:
            return 2;
        }
      case 'group':
        switch (operation) {
          case 'groupCreate':
          case 'create':
            return 10;
          case 'groupDestroy':
          case 'destroy':
            return 11;
          case 'groupJoin':
          case 'join':
            return 12;
          case 'groupLeave':
          case 'leave':
            return 13;
          case 'groupApply':
          case 'apply':
            return 14;
          case 'groupApplyAccept':
          case 'apply_accept':
            return 15;
          case 'groupApplyDecline':
          case 'apply_decline':
            return 16;
          case 'groupInvite':
          case 'invite':
            return 17;
          case 'groupInviteAccept':
          case 'invite_accept':
            return 18;
          case 'groupInviteDecline':
          case 'invite_decline':
            return 19;
          case 'groupKick':
          case 'kick':
            return 20;
          case 'groupBan':
          case 'ban':
            return 21;
          case 'groupAllow':
          case 'allow':
            return 22;
          case 'groupBlock':
          case 'block':
            return 23;
          case 'groupUnblock':
          case 'unblock':
            return 24;
          case 'groupAssignOwner':
          case 'assign_owner':
            return 25;
          case 'groupAddAdmin':
          case 'add_admin':
            return 26;
          case 'groupRemoveAdmin':
          case 'remove_admin':
            return 27;
          case 'groupAddMute':
          case 'add_mute':
            return 28;
          case 'groupRemoveMute':
          case 'remove_mute':
            return 29;
          case 'memberAttributesChanged':
          case 'member_attributes_changed':
            return 52;
          default:
            return -1;
        }
      case 'thread':
        switch (operation) {
          case 'threadCreate':
          case 'create':
            return 40;
          case 'threadDestroy':
          case 'destroy':
            return 41;
          case 'threadJoin':
          case 'join':
            return 42;
          case 'threadLeave':
          case 'leave':
            return 43;
          case 'threadKick':
          case 'kick':
            return 44;
          case 'threadUpdate':
          case 'update':
            return 45;
          default:
            return -1;
        }
      case 'conversation':
        switch (operation) {
          case 'pinConversation':
          case 'conversationPinned':
          case 'pinned':
          case 'pin':
            return 60;
          case 'unpinConversation':
          case 'conversationUnpinned':
          case 'unpinned':
          case 'unpin':
            return 61;
          case 'deleteConversation':
          case 'conversationDelete':
          case 'delete':
            return 62;
          case 'updateConversationMark':
          case 'conversationUpdateMark':
          case 'update_mark':
            return 63;
          case 'setSilentModeForConversation':
          case 'removeSilentModeForConversation':
          case 'conversationMuteInfoChanged':
          case 'mute_info_changed':
            return 64;
          default:
            return -1;
        }
      case 'messageRemoved':
        return 62;
      default:
        return -1;
    }
  }

  Map<String, dynamic> _silentModeFromResponse(Object? value) {
    final raw = js_util.dartify(value);
    final data = raw is Map ? raw['data'] : raw;
    final result = data is Map && data.containsKey('result')
        ? data['result']
        : raw is Map && raw.containsKey('result')
            ? raw['result']
            : data;
    final resultMap = _asMap(result);
    final map =
        resultMap['rule'] is Map ? _asMap(resultMap['rule']) : resultMap;
    final ignoreInterval =
        map['ignoreInterval']?.toString() ?? map['ignore_interval']?.toString();
    return {
      'expireTs': _asInt(map['expireTs']) ??
          _asInt(map['expire_ts']) ??
          _asInt(map['expireTimestamp']) ??
          _asInt(map['expire']) ??
          0,
      'remindType': _remindTypeFromReal(map['type'] ?? map['remindType']),
      'startTime': _silentTimeFromIgnoreInterval(ignoreInterval, start: true),
      'endTime': _silentTimeFromIgnoreInterval(ignoreInterval, start: false),
    };
  }

  String _silentRemindType(int remindType) {
    switch (remindType) {
      case 1:
        return 'ALL';
      case 2:
        return 'AT';
      case 0:
      default:
        return 'NONE';
    }
  }

  int _remindTypeFromReal(Object? value) {
    final text = value?.toString();
    switch (text) {
      case 'ALL':
        return 1;
      case 'AT':
      case 'MENTION_ONLY':
        return 2;
      case 'NONE':
        return 0;
      case 'DEFAULT':
      default:
        return _asInt(value) ?? 0;
    }
  }

  Map<String, dynamic> _silentTimeFromIgnoreInterval(
    String? value, {
    required bool start,
  }) {
    final fallback = {'hour': 0, 'minute': 0};
    if (value == null || !value.contains('-')) {
      return fallback;
    }
    final part = value.split('-')[start ? 0 : 1];
    final pieces = part.split(':');
    if (pieces.length != 2) {
      return fallback;
    }
    return {
      'hour': _asInt(pieces[0]) ?? 0,
      'minute': _asInt(pieces[1]) ?? 0,
    };
  }

  Map<String, Map<String, dynamic>> _silentModesFromResponse(
    Object? value,
    Map<String, int> requestedConversations,
  ) {
    final raw = js_util.dartify(value);
    final data = raw is Map ? raw['data'] : raw;
    final result = <String, Map<String, dynamic>>{};
    for (final entry in requestedConversations.entries) {
      result[entry.key] = _defaultSilentMode();
    }

    void putMode(String? convId, Object? mode) {
      if (convId == null || convId.isEmpty) {
        return;
      }
      result[convId] = _silentModeFromResponse({'data': mode});
    }

    void putModeFromItem(Object? item) {
      final map = _asMap(item);
      putMode(
        map['id']?.toString() ??
            map['user']?.toString() ??
            map['group']?.toString() ??
            map['conversationId']?.toString(),
        map,
      );
    }

    if (data is Map) {
      for (final key in const ['user', 'users', 'group', 'groups']) {
        final value = data[key];
        if (value is List) {
          for (final item in value) {
            putModeFromItem(item);
          }
        } else if (value is Map) {
          for (final entry in value.entries) {
            putMode(entry.key.toString(), entry.value);
          }
        }
      }
      final nested = data['result'];
      if (nested is List) {
        for (final item in nested) {
          putModeFromItem(item);
        }
      } else if (nested is Map) {
        for (final entry in nested.entries) {
          putMode(entry.key.toString(), entry.value);
        }
      }
    } else if (data is List) {
      for (final item in data) {
        putModeFromItem(item);
      }
    }
    return result;
  }

  Map<String, dynamic> _defaultSilentMode() {
    return {
      'expireTs': 0,
      'remindType': 0,
      'startTime': {'hour': 0, 'minute': 0},
      'endTime': {'hour': 0, 'minute': 0},
    };
  }

  List<Map<String, dynamic>> _conversationListFromRealSdk(Object? result) {
    final value = js_util.dartify(result);
    final data =
        value is Map ? _asMap(value['data']) : const <String, dynamic>{};
    final rawList = _asMapList(data['conversations']);
    return rawList.map(_normalizeConversationItem).toList();
  }

  List<Map<String, dynamic>> _conversationListFromImSdkResult(Object? result) {
    final value = js_util.dartify(result);
    final rawList = value is List
        ? value
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
        : _asMapList(value);
    return rawList.map(_normalizeConversationItem).toList();
  }

  Map<String, dynamic> _normalizeConversationItem(Map<String, dynamic> item) {
    final rawType = item['conversationType']?.toString();
    final latest = _asMap(item['lastMessage']);
    final marksValue = item['marks'] ?? item['markList'] ?? item['mark_list'];
    return {
      'convId': item['conversationId']?.toString() ?? '',
      'type': rawType == 'groupChat' ? 1 : 0,
      'unreadCount':
          _asInt(item['unReadCount']) ?? _asInt(item['unreadCount']) ?? 0,
      'isPinned': item['isPinned'] == true,
      'pinnedTime': _asInt(item['pinnedTime']) ?? 0,
      'marks': _asIntList(marksValue),
      if (latest.isNotEmpty)
        'latestMessage': _normalizeConversationLatestMessage(
          latest,
          fallback: {
            'to': item['conversationId']?.toString(),
            'chatType': rawType == 'groupChat' ? 1 : 0,
          },
        ),
    };
  }

  Map<String, dynamic> _normalizeConversationLatestMessage(
    Map<String, dynamic> raw, {
    Map<String, dynamic>? fallback,
  }) {
    final body = _asMap(raw['body']);
    final text = raw['msg']?.toString() ??
        raw['content']?.toString() ??
        raw['text']?.toString() ??
        body['content']?.toString() ??
        '';
    final normalizedBody = body.isNotEmpty
        ? Map<String, dynamic>.from(body)
        : <String, dynamic>{'content': text};
    normalizedBody['content'] = text;
    return _normalizeRealIncomingMessage(
      {
        ...raw,
        'body': normalizedBody,
      },
      fallback: fallback,
    );
  }

  List<Map<String, dynamic>> _normalizeReactionList(Object? value) {
    final rawList = value is List
        ? value
        : value is Map
            ? (value['reactionList'] is List
                ? value['reactionList'] as List
                : value['list'] is List
                    ? value['list'] as List
                    : const [])
            : const [];
    return rawList.whereType<Map>().map((item) {
      final userList =
          _asStringList(item['userList'] ?? item['userListDetail']);
      final userId = item['userId']?.toString() ??
          item['user']?.toString() ??
          item['username']?.toString() ??
          (userList.isNotEmpty ? userList.first : null);
      return {
        'reaction': item['reaction']?.toString() ??
            item['message']?.toString() ??
            item['reactionId']?.toString() ??
            '',
        'count': _asInt(item['count']) ??
            _asInt(item['userCount']) ??
            userList.length,
        'isAddedBySelf': item['isAddedBySelf'] == true,
        if (userId != null && userId.isNotEmpty) 'userId': userId,
        if (userList.isNotEmpty) 'userList': userList,
      };
    }).toList();
  }

  List<Map<String, dynamic>> _normalizeReactionDetailList(
    Object? value, {
    required String fallbackReaction,
    required int fallbackCount,
    required bool fallbackIsAddedBySelf,
  }) {
    final rawList = value is List ? value : const [];
    return rawList.whereType<Map>().map((item) {
      final userId = item['userId']?.toString() ??
          item['user']?.toString() ??
          item['username']?.toString();
      return {
        'reaction': item['reaction']?.toString() ?? fallbackReaction,
        'count': _asInt(item['count']) ?? fallbackCount,
        'isAddedBySelf': item['isAddedBySelf'] == true || fallbackIsAddedBySelf,
        if (userId != null && userId.isNotEmpty) 'userId': userId,
        if (item['createdAt'] != null)
          'createdAt': item['createdAt'].toString(),
      };
    }).toList();
  }

  List<Map<String, dynamic>> debugEvents() {
    return List.unmodifiable(_debugEvents);
  }

  Object? get rawClient => _highLevelClient;

  List<String> dumpContactManagerMethods() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String>[];
    }
    final manager = js_util.getProperty<Object?>(client, 'contactManager');
    if (manager == null) {
      return const <String>[];
    }
    final result = <String>{};
    try {
      for (final key
          in js_util.dartify(_jsObjectKeys(manager as JSAny?)) as List) {
        final text = key?.toString();
        if (text != null && text.isNotEmpty) {
          result.add(text);
        }
      }
    } catch (_) {}
    try {
      JSAny? current = manager as JSAny?;
      for (var depth = 0; depth < 5 && current != null; depth++) {
        for (final key
            in js_util.dartify(_jsGetOwnPropertyNames(current)) as List) {
          final text = key?.toString();
          if (text != null && text.isNotEmpty) {
            result.add(text);
          }
        }
        current = _jsGetPrototypeOf(current);
      }
    } catch (_) {}
    final sorted = result.toList()..sort();
    _recordDebug('contactManager_methods', {
      'runtime': 'imsdk',
      'methods': sorted,
    });
    return sorted;
  }

  List<String> dumpChatRoomManagerMethods() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String>[];
    }
    final manager = js_util.getProperty<Object?>(client, 'chatRoomManager');
    if (manager == null) {
      return const <String>[];
    }
    final result = <String>{};
    try {
      for (final key
          in js_util.dartify(_jsObjectKeys(manager as JSAny?)) as List) {
        final text = key?.toString();
        if (text != null && text.isNotEmpty) {
          result.add(text);
        }
      }
    } catch (_) {}
    try {
      JSAny? current = manager as JSAny?;
      for (var depth = 0; depth < 5 && current != null; depth++) {
        for (final key
            in js_util.dartify(_jsGetOwnPropertyNames(current)) as List) {
          final text = key?.toString();
          if (text != null && text.isNotEmpty) {
            result.add(text);
          }
        }
        current = _jsGetPrototypeOf(current);
      }
    } catch (_) {}
    final sorted = result.toList()..sort();
    _recordDebug('chatRoomManager_methods', {
      'runtime': 'imsdk',
      'methods': sorted,
    });
    return sorted;
  }

  List<String> dumpGroupManagerMethods() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String>[];
    }
    final manager = js_util.getProperty<Object?>(client, 'groupManager');
    if (manager == null) {
      return const <String>[];
    }
    final result = <String>{};
    try {
      for (final key
          in js_util.dartify(_jsObjectKeys(manager as JSAny?)) as List) {
        final text = key?.toString();
        if (text != null && text.isNotEmpty) {
          result.add(text);
        }
      }
    } catch (_) {}
    try {
      JSAny? current = manager as JSAny?;
      for (var depth = 0; depth < 5 && current != null; depth++) {
        for (final key
            in js_util.dartify(_jsGetOwnPropertyNames(current)) as List) {
          final text = key?.toString();
          if (text != null && text.isNotEmpty) {
            result.add(text);
          }
        }
        current = _jsGetPrototypeOf(current);
      }
    } catch (_) {}
    final sorted = result.toList()..sort();
    _recordDebug('groupManager_methods', {
      'runtime': 'imsdk',
      'methods': sorted,
    });
    return sorted;
  }

  List<String> dumpChatThreadManagerMethods() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String>[];
    }
    final manager = js_util.getProperty<Object?>(client, 'chatThreadManager');
    if (manager == null) {
      return const <String>[];
    }
    final result = <String>{};
    try {
      for (final key
          in js_util.dartify(_jsObjectKeys(manager as JSAny?)) as List) {
        final text = key?.toString();
        if (text != null && text.isNotEmpty) {
          result.add(text);
        }
      }
    } catch (_) {}
    try {
      JSAny? current = manager as JSAny?;
      for (var depth = 0; depth < 5 && current != null; depth++) {
        for (final key
            in js_util.dartify(_jsGetOwnPropertyNames(current)) as List) {
          final text = key?.toString();
          if (text != null && text.isNotEmpty) {
            result.add(text);
          }
        }
        current = _jsGetPrototypeOf(current);
      }
    } catch (_) {}
    final sorted = result.toList()..sort();
    _recordDebug('chatThreadManager_methods', {
      'runtime': 'imsdk',
      'methods': sorted,
    });
    return sorted;
  }

  Map<String, dynamic> dumpRestContextState() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String, dynamic>{
        'hasHighLevelClient': false,
        'hasGetRestContext': false,
      };
    }
    final getRestContext =
        js_util.getProperty<Object?>(client, 'getRestContext');
    final result = <String, dynamic>{
      'hasHighLevelClient': true,
      'hasGetRestContext': getRestContext != null,
    };
    if (getRestContext == null) {
      _recordDebug('restContext_state', {
        'runtime': 'imsdk',
        ...result,
      });
      return result;
    }
    try {
      final context = js_util.callMethod<Object?>(
        client,
        'getRestContext',
        const [],
      );
      final contextMap = _asMap(js_util.dartify(context));
      result.addAll({
        'getRestContextThrows': false,
        'hasRestBaseUrl':
            contextMap['restBaseUrl']?.toString().isNotEmpty == true,
        'hasAppKey': contextMap['appKey']?.toString().isNotEmpty == true,
        'hasUserId': contextMap['userId']?.toString().isNotEmpty == true,
        'hasToken': contextMap['token']?.toString().isNotEmpty == true,
        'hasClientResource':
            contextMap['clientResource']?.toString().isNotEmpty == true,
      });
    } catch (e) {
      result.addAll({
        'getRestContextThrows': true,
        'error': _jsErrorDescription(e),
      });
    }
    _recordDebug('restContext_state', {
      'runtime': 'imsdk',
      ...result,
    });
    return result;
  }

  Map<String, dynamic> dumpContactSnapshot() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String, dynamic>{'available': false};
    }
    try {
      final snapshot =
          js_util.callMethod<Object?>(client, 'getContactSnapshot', const []);
      final value = js_util.dartify(snapshot);
      if (value is Map) {
        return <String, dynamic>{
          'available': true,
          'snapshot': Map<String, dynamic>.from(value),
        };
      }
      return <String, dynamic>{'available': true, 'snapshot': value};
    } catch (e) {
      return <String, dynamic>{
        'available': true,
        'error': _jsErrorDescription(e),
      };
    }
  }

  Map<String, dynamic> dumpContactCacheState() {
    final client = _highLevelClient;
    if (client == null) {
      return const <String, dynamic>{'available': false};
    }
    try {
      final cacheManager = js_util.callMethod<Object?>(
        client,
        'getCacheManager',
        const [],
      );
      if (cacheManager == null) {
        return const <String, dynamic>{
          'available': true,
          'cacheManager': false
        };
      }
      final meta = js_util.callMethod<Object?>(
        cacheManager,
        'loadContactCacheMeta',
        const [],
      );
      final versionState = js_util.callMethod<Object?>(
        cacheManager,
        'loadContactVersionState',
        const [],
      );
      final relations = js_util.callMethod<Object?>(
        cacheManager,
        'loadContactRelationRecords',
        const [],
      );
      return <String, dynamic>{
        'available': true,
        'cacheManager': true,
        'meta': js_util.dartify(meta),
        'versionState': js_util.dartify(versionState),
        'relations': js_util.dartify(relations),
      };
    } catch (e) {
      return <String, dynamic>{
        'available': true,
        'error': _jsErrorDescription(e),
      };
    }
  }

  Map<String, dynamic>? messageById(String msgId) {
    final value = _messageIndex[msgId];
    return value == null ? null : Map<String, dynamic>.from(value);
  }

  void recordDebugEvent(String type, [Map<String, Object?> data = const {}]) {
    _recordDebug(type, data);
  }

  void _rememberMessage(Map<String, dynamic> message) {
    final msgId = message['msgId']?.toString() ?? '';
    if (msgId.isNotEmpty) {
      _messageIndex[msgId] = Map<String, dynamic>.from(message);
    }
  }

  void _recordDebug(String type, [Map<String, Object?> data = const {}]) {
    _debugEvents.add({
      'type': type,
      'time': DateTime.now().millisecondsSinceEpoch,
      ...data.map((key, value) => MapEntry(key, _debugSafeValue(value))),
    });
    if (_debugEvents.length > 50) {
      _debugEvents.removeAt(0);
    }
  }

  Object? _debugSafeValue(Object? value) {
    if (value == null || value is String || value is num || value is bool) {
      return value;
    }
    if (value is Map) {
      return value.map(
        (key, item) => MapEntry(key.toString(), _debugSafeValue(item)),
      );
    }
    if (value is Iterable) {
      return value.map(_debugSafeValue).toList();
    }
    try {
      return _debugSafeValue(js_util.dartify(value));
    } catch (_) {
      return value.toString();
    }
  }
}

String _realSdkFileNameFromPath(String path) {
  final parts = path.split(RegExp(r'[/\\]'));
  return parts.isEmpty ? path : parts.last;
}

String _jsErrorDescription(Object? error) {
  final jsError = error as Object;
  final message = js_util.getProperty<Object?>(jsError, 'message');
  final stack = js_util.getProperty<Object?>(jsError, 'stack');
  if (message != null || stack != null) {
    return [
      if (message != null) message.toString(),
      if (stack != null) stack.toString(),
    ].join('\n');
  }
  final dartValue = js_util.dartify(error);
  if (dartValue is Map) {
    final normalized = Map<Object?, Object?>.from(dartValue);
    return normalized.entries
        .map((entry) => '${entry.key}: ${entry.value}')
        .join(', ');
  }
  if (dartValue != null) {
    return dartValue.toString();
  }
  return error.toString();
}

Object? _webImObject() =>
    js_util.getProperty<Object?>(js_util.globalThis, 'WebIM');
Object? _imSdkObject() =>
    js_util.getProperty<Object?>(js_util.globalThis, 'IMSDK');

void _putIfPresent(Map<String, Object?> map, String key, Object? value) {
  final text = value?.toString();
  if (text != null && text.isNotEmpty) {
    map[key] = text;
  }
}

String _webChatType(dynamic chatType) {
  final value =
      chatType is int ? chatType : int.tryParse(chatType?.toString() ?? '');
  switch (value) {
    case 1:
      return 'groupChat';
    case 2:
      return 'chatRoom';
    case 0:
    default:
      return 'singleChat';
  }
}

String _webHistoryChatType(dynamic chatType) {
  final value =
      chatType is int ? chatType : int.tryParse(chatType?.toString() ?? '');
  return value == 1 ? 'groupChat' : 'singleChat';
}

String _webConversationType(dynamic chatType) {
  final value =
      chatType is int ? chatType : int.tryParse(chatType?.toString() ?? '');
  return value == 1 ? 'groupChat' : 'singleChat';
}

String _webPushConversationType(dynamic chatType) {
  final value =
      chatType is int ? chatType : int.tryParse(chatType?.toString() ?? '');
  if (value == 2) {
    throw StateError(
        'Real Web SDK push silent mode does not support chatRoom.');
  }
  return value == 1 ? 'groupChat' : 'singleChat';
}

int? _chatTypeFromWeb(dynamic chatType) {
  final value = chatType?.toString();
  if (value == 'groupChat' || value == 'groupchat') return 1;
  if (value == 'chatRoom' || value == 'chatroom') return 2;
  if (value == 'singleChat' || value == 'chat') return 0;
  return int.tryParse(value ?? '');
}
