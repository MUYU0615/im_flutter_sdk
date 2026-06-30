part of '../client_web.dart';

class UserInfoManagerWeb extends UserInfoManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  String? currentUser;
  final Map<String, Map<String, dynamic>> _userInfos = {};

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
      case _MethodKeys.updateOwnUserInfo:
        if (realSdk != null) {
          return {method: await realSdk.updateOwnUserInfo(map)};
        }
        return {method: _updateOwnUserInfo(map)};
      case _MethodKeys.updateOwnUserInfoWithType:
        if (realSdk != null) {
          return {method: await realSdk.updateOwnUserInfoWithType(map)};
        }
        return {method: _updateOwnUserInfoWithType(map)};
      case _MethodKeys.fetchOwnInfo:
        if (realSdk != null) {
          return {
            method: (await realSdk.fetchUserInfoById(
              [_requireCurrentUser()],
            ))[_requireCurrentUser()]
          };
        }
        return {
          method:
              Map<String, dynamic>.from(_ensureUserInfo(_requireCurrentUser()))
        };
      case _MethodKeys.fetchUserInfoById:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchUserInfoById(
              _asStringList(map['userIds']),
            ),
          };
        }
        return {method: _fetchUserInfo(map['userIds'])};
      case _MethodKeys.fetchUserInfoByIdWithType:
        if (realSdk != null) {
          return {
            method: await realSdk.fetchUserInfoById(
              _asStringList(map['userIds']),
              userInfoTypes: _asIntList(map['userInfoTypes']),
            ),
          };
        }
        return {
          method: _filterUserInfo(
            _fetchUserInfo(map['userIds']),
            _asIntList(map['userInfoTypes']),
          ),
        };
      default:
        return _unsupported('UserInfoManager', method);
    }
  }

  Future<void> emitUserInfoEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  void reset({String? keepUserId}) {
    _userInfos.clear();
    if (keepUserId != null && keepUserId.isNotEmpty) {
      _ensureUserInfo(keepUserId);
    }
  }

  Map<String, dynamic> _updateOwnUserInfo(Map<String, dynamic> info) {
    final userId = _requireCurrentUser();
    final existing = _ensureUserInfo(userId);
    for (final entry in info.entries) {
      if (entry.value != null) {
        existing[entry.key] = entry.value;
      }
    }
    existing['userId'] = userId;
    return Map<String, dynamic>.from(existing);
  }

  Map<String, dynamic> _updateOwnUserInfoWithType(Map<String, dynamic> info) {
    final key = _userInfoFieldForType(info['userInfoType']);
    if (key == null) {
      return _updateOwnUserInfo({});
    }
    return _updateOwnUserInfo({key: info['userInfoValue']});
  }

  Map<String, dynamic> _fetchUserInfo(dynamic rawUserIds) {
    final result = <String, dynamic>{};
    final userIds = _asStringList(rawUserIds);
    for (final userId in userIds) {
      result[userId] = Map<String, dynamic>.from(_ensureUserInfo(userId));
    }
    return result;
  }

  Map<String, dynamic> _filterUserInfo(
    Map<String, dynamic> source,
    List<int> types,
  ) {
    if (types.isEmpty) {
      return source;
    }
    final fields = types.map(_userInfoFieldForType).whereType<String>().toSet();
    return source.map((userId, value) {
      final info = _asMap(value);
      final filtered = <String, dynamic>{'userId': userId};
      for (final field in fields) {
        if (info.containsKey(field)) {
          filtered[field] = info[field];
        }
      }
      return MapEntry(userId, filtered);
    });
  }

  Map<String, dynamic> _ensureUserInfo(String userId) {
    return _userInfos.putIfAbsent(userId, () => {'userId': userId});
  }

  String _requireCurrentUser() {
    final userId = currentUser;
    if (userId == null || userId.isEmpty) {
      throw StateError('No current user on Web');
    }
    return userId;
  }
}
