part of '../client_web.dart';

class PushManagerWeb extends PushManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  String? currentUser;
  int _pushStyle = 0;
  String? _displayName;
  String? _preferredLanguage;
  String? _pushTemplateName;
  Map<String, dynamic> _allSilentMode = _defaultSilentMode();
  final Map<String, Map<String, dynamic>> _conversationSilentModes = {};
  final Map<String, String> _pushTokens = {};
  final List<Map<String, dynamic>> _reportedPushActions = [];

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
      case _MethodKeys.getImPushConfig:
      case _MethodKeys.getImPushConfigFromServer:
        return {method: _pushConfig()};
      case _MethodKeys.updateImPushStyle:
        _pushStyle = _asInt(map['pushStyle']) ?? _pushStyle;
        return {method: null};
      case _MethodKeys.updatePushNickname:
        _displayName = map['nickname']?.toString();
        return {method: null};
      case _MethodKeys.updateHMSPushToken:
        _recordToken('hms', map['token']);
        return {method: null};
      case _MethodKeys.updateFCMPushToken:
        _recordToken('fcm', map['token']);
        return {method: null};
      case _MethodKeys.updateAPNsPushToken:
        _recordToken('apns', map['token']);
        return {method: null};
      case _MethodKeys.bindDeviceToken:
        final notifierName = map['notifierName']?.toString();
        final deviceToken = map['deviceToken']?.toString();
        if (realSdk != null) {
          await realSdk.uploadPushToken(
            notifierName: notifierName ?? '',
            deviceToken: deviceToken ?? '',
          );
          return {method: null};
        }
        if (notifierName != null && deviceToken != null) {
          _pushTokens[notifierName] = deviceToken;
        }
        return {method: null};
      case _MethodKeys.reportPushAction:
        _reportedPushActions.add(Map<String, dynamic>.from(map));
        return {method: null};
      case _MethodKeys.setPreferredNotificationLanguage:
        if (realSdk != null) {
          await realSdk.setPushPerformLanguage(map['code']?.toString() ?? '');
          return {method: null};
        }
        _preferredLanguage = map['code']?.toString();
        return {method: null};
      case _MethodKeys.fetchPreferredNotificationLanguage:
        if (realSdk != null) {
          return {method: await realSdk.getPushPerformLanguage()};
        }
        return {method: _preferredLanguage};
      case _MethodKeys.setPushTemplate:
        _pushTemplateName = map['pushTemplateName']?.toString();
        return {method: null};
      case _MethodKeys.getPushTemplate:
        return {method: _pushTemplateName};
      case _MethodKeys.setSilentModeForAll:
        if (realSdk != null) {
          final param = _asMap(map['param']);
          await realSdk.setSilentModeForAll(param);
          _allSilentMode = _silentModeFromParam(param);
          return {method: null};
        }
        _allSilentMode = _silentModeFromParam(map['param']);
        return {method: null};
      case _MethodKeys.fetchSilentModeForAll:
        if (realSdk != null) {
          final remote = await realSdk.getSilentModeForAll();
          return {
            method: _silentModeResult(
              '',
              0,
              _preferNonDefaultSilentMode(remote, _allSilentMode),
            )
          };
        }
        return {method: _silentModeResult('', 0, _allSilentMode)};
      case _MethodKeys.setConversationSilentMode:
        if (realSdk != null) {
          final param = _asMap(map['param']);
          await realSdk.setSilentModeForConversation(
            conversationId: map['convId']?.toString() ?? '',
            type: _asInt(map['conversationType']) ?? 0,
            param: param,
          );
          _conversationSilentModes[_conversationKey(map)] =
              _silentModeFromParam(param);
          return {method: null};
        }
        _conversationSilentModes[_conversationKey(map)] =
            _silentModeFromParam(map['param']);
        return {method: null};
      case _MethodKeys.removeConversationSilentMode:
        if (realSdk != null) {
          await realSdk.clearRemindTypeForConversation(
            conversationId: map['convId']?.toString() ?? '',
            type: _asInt(map['conversationType']) ?? 0,
          );
          _conversationSilentModes.remove(_conversationKey(map));
          return {method: null};
        }
        _conversationSilentModes.remove(_conversationKey(map));
        return {method: null};
      case _MethodKeys.fetchConversationSilentMode:
        if (realSdk != null) {
          final convId = map['convId']?.toString() ?? '';
          final conversationType = _asInt(map['conversationType']) ?? 0;
          final mode = await realSdk.getSilentModeForConversation(
            conversationId: convId,
            type: conversationType,
          );
          return {
            method: _silentModeResult(
              convId,
              conversationType,
              _preferNonDefaultSilentMode(
                mode,
                _conversationSilentModes[_conversationKey(map)] ??
                    _defaultSilentMode(),
              ),
            )
          };
        }
        return {
          method: _silentModeResult(
            map['convId']?.toString() ?? '',
            _asInt(map['conversationType']) ?? 0,
            _conversationSilentModes[_conversationKey(map)] ?? _allSilentMode,
          ),
        };
      case _MethodKeys.fetchSilentModeForConversations:
        if (realSdk != null) {
          final conversations = map.map(
            (key, value) => MapEntry(key.toString(), _asInt(value) ?? 0),
          );
          return {
            method: _silentModesForRealConversations(
              conversations,
              await realSdk.getSilentModeForConversations(conversations),
            ),
          };
        }
        return {method: _silentModesForConversations(map)};
      case _MethodKeys.syncSilentModels:
        if (realSdk != null) {
          await realSdk.getSilentModeForAll();
        }
        return {method: true};
      default:
        return _unsupported('PushManager', method);
    }
  }

  Future<void> emitPushEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  void reset() {
    _pushStyle = 0;
    _displayName = null;
    _preferredLanguage = null;
    _pushTemplateName = null;
    _allSilentMode = _defaultSilentMode();
    _conversationSilentModes.clear();
    _pushTokens.clear();
    _reportedPushActions.clear();
  }

  Map<String, dynamic> _pushConfig() {
    return {
      'pushStyle': _pushStyle,
      'displayName': _displayName,
    };
  }

  void _recordToken(String name, dynamic token) {
    final value = token?.toString();
    if (value != null) {
      _pushTokens[name] = value;
    }
  }

  String _conversationKey(Map<String, dynamic> map) {
    return '${map['convId']?.toString() ?? ''}:'
        '${_asInt(map['conversationType']) ?? 0}';
  }

  Map<String, dynamic> _silentModeFromParam(dynamic rawParam) {
    final param = _asMap(rawParam);
    final remindType = _asInt(param['remindType']);
    final duration = _asInt(param['duration']);
    final start = _asMap(param['startTime']);
    final end = _asMap(param['endTime']);
    return {
      'expireTs': duration == null || duration <= 0
          ? 0
          : DateTime.now().millisecondsSinceEpoch + duration * 60 * 1000,
      'remindType': remindType ?? _asInt(_allSilentMode['remindType']) ?? 0,
      'startTime': start.isEmpty ? _defaultSilentTime() : _silentTime(start),
      'endTime': end.isEmpty ? _defaultSilentTime() : _silentTime(end),
    };
  }

  Map<String, dynamic> _silentModeResult(
    String convId,
    int conversationType,
    Map<String, dynamic> mode,
  ) {
    final rule = _asMap(mode['rule']);
    final source = rule.isEmpty ? mode : rule;
    return {
      'expireTs':
          _asInt(source['expireTs']) ?? _asInt(source['expireTimestamp']) ?? 0,
      'convId': convId,
      'conversationType': conversationType,
      'remindType': _remindType(source['remindType'] ?? source['type']),
      'startTime': _silentTime(
          _asMap(source['startTime'] ?? source['silentModeStartTime'])),
      'endTime':
          _silentTime(_asMap(source['endTime'] ?? source['silentModeEndTime'])),
    };
  }

  int _remindType(dynamic value) {
    final parsed = _asInt(value);
    if (parsed != null) {
      return parsed;
    }
    switch (value?.toString()) {
      case 'ALL':
        return 1;
      case 'AT':
      case 'MENTION_ONLY':
        return 2;
      case 'NONE':
      case 'DEFAULT':
      default:
        return 0;
    }
  }

  Map<String, dynamic> _silentModesForConversations(Map<String, dynamic> map) {
    final result = <String, dynamic>{};
    for (final entry in map.entries) {
      final convId = entry.key;
      final conversationType = _asInt(entry.value) ?? 0;
      final key = '$convId:$conversationType';
      result[convId] = _silentModeResult(
        convId,
        conversationType,
        _conversationSilentModes[key] ?? _allSilentMode,
      );
    }
    return result;
  }

  Map<String, dynamic> _silentModesForRealConversations(
    Map<String, int> conversations,
    Map<String, Map<String, dynamic>> modes,
  ) {
    final result = <String, dynamic>{};
    for (final entry in conversations.entries) {
      result[entry.key] = _silentModeResult(
        entry.key,
        entry.value,
        _preferNonDefaultSilentMode(
          modes[entry.key] ?? _defaultSilentMode(),
          _conversationSilentModes['${entry.key}:${entry.value}'] ??
              _defaultSilentMode(),
        ),
      );
    }
    return result;
  }

  int remindTypeForConversation(String conversationId, int conversationType) {
    final mode = _conversationSilentModes['$conversationId:$conversationType'];
    return mode == null ? 0 : _remindType(mode['remindType']);
  }

  Map<String, dynamic> _preferNonDefaultSilentMode(
    Map<String, dynamic> remote,
    Map<String, dynamic> fallback,
  ) {
    if ((_asInt(remote['remindType']) ?? _remindType(remote['remindType'])) !=
        0) {
      return remote;
    }
    if ((_asInt(fallback['remindType']) ??
            _remindType(fallback['remindType'])) !=
        0) {
      return fallback;
    }
    return remote;
  }

  Map<String, dynamic> _silentTime(Map<String, dynamic> map) {
    return {
      'hour': _asInt(map['hour']) ?? 0,
      'minute': _asInt(map['minute']) ?? 0,
    };
  }

  static Map<String, dynamic> _defaultSilentMode() {
    return {
      'expireTs': 0,
      'remindType': 0,
      'startTime': _defaultSilentTime(),
      'endTime': _defaultSilentTime(),
    };
  }

  static Map<String, dynamic> _defaultSilentTime() {
    return {
      'hour': 0,
      'minute': 0,
    };
  }
}
