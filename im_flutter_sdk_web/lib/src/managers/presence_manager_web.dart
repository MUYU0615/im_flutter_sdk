part of '../client_web.dart';

class PresenceManagerWeb extends PresenceManager {
  Future<dynamic> Function(MethodCall call)? _handler;
  String? currentUser;
  final Map<String, Map<String, dynamic>> _presences = {};
  final Set<String> _subscribedMembers = {};

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
      case _MethodKeys.presenceWithDescription:
        if (realSdk != null) {
          await realSdk.publishPresence(map['desc']?.toString() ?? '');
          return {method: null};
        }
        _publishPresence(map);
        return {method: null};
      case _MethodKeys.presenceSubscribe:
        final members = _asStringList(map['members']);
        if (realSdk != null) {
          return {
            method: await realSdk.subscribePresence(
              members: members,
              expiry: _asInt(map['expiry']) ?? 3600,
            ),
          };
        }
        _subscribedMembers.addAll(members);
        return {method: members.map(_presenceForUser).toList()};
      case _MethodKeys.presenceUnsubscribe:
        if (realSdk != null) {
          await realSdk.unsubscribePresence(_asStringList(map['members']));
          return {method: null};
        }
        _subscribedMembers.removeAll(_asStringList(map['members']));
        return {method: null};
      case _MethodKeys.fetchSubscribedMembersWithPageNum:
        if (realSdk != null) {
          final pageNum = _asInt(map['pageNum']) ?? 1;
          return {
            method: await realSdk.getSubscribedPresenceList(
              pageNum: pageNum <= 0 ? 0 : pageNum - 1,
              pageSize: _asInt(map['pageSize']) ?? 20,
            ),
          };
        }
        return {method: _subscribedPage(map)};
      case _MethodKeys.fetchPresenceStatus:
        if (realSdk != null) {
          return {
            method: await realSdk.getPresenceStatus(
              _asStringList(map['members']),
            ),
          };
        }
        return {
          method: _asStringList(map['members']).map(_presenceForUser).toList(),
        };
      default:
        return _unsupported('PresenceManager', method);
    }
  }

  Future<void> emitPresenceEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }

  Future<void> emitRealPresenceStatusChanged(Map<String, dynamic> event) async {
    await _handler?.call(MethodCall('onPresenceStatusChanged', event));
  }

  void reset() {
    _presences.clear();
    _subscribedMembers.clear();
  }

  void _publishPresence(Map<String, dynamic> map) {
    final userId = currentUser;
    if (userId == null || userId.isEmpty) {
      return;
    }
    _presences[userId] = _presencePayload(
      userId,
      statusDescription: map['desc']?.toString() ?? '',
      expiryTime: 0,
    );
  }

  Map<String, dynamic> _presenceForUser(String userId) {
    return Map<String, dynamic>.from(
      _presences[userId] ?? _presencePayload(userId),
    );
  }

  Map<String, dynamic> _presencePayload(
    String userId, {
    String statusDescription = '',
    int expiryTime = 0,
  }) {
    return {
      'publisher': userId,
      'statusDescription': statusDescription,
      'lastTime': DateTime.now().millisecondsSinceEpoch ~/ 1000,
      'expiryTime': expiryTime,
      'statusDetails': {'web': 1},
    };
  }

  List<String> _subscribedPage(Map<String, dynamic> map) {
    final members = _subscribedMembers.toList()..sort();
    final pageSize = _asInt(map['pageSize']) ?? members.length;
    final pageNum = _asInt(map['pageNum']) ?? 1;
    final start =
        (((pageNum - 1).clamp(0, pageNum)) * pageSize).clamp(0, members.length);
    final end = (start + pageSize).clamp(start, members.length);
    return members.sublist(start, end);
  }
}
