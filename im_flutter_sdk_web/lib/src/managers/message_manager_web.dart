part of '../client_web.dart';

class MessageManagerWeb extends MessageManager {
  MessageManagerWeb(this._chatManager, this._chatThreadManager);

  final ChatManagerWeb _chatManager;
  final ChatThreadManagerWeb _chatThreadManager;
  Future<dynamic> Function(MethodCall call)? _handler;

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
      case _MethodKeys.getReactionList:
        if (realSdk != null) {
          final msgId = map['msgId']?.toString() ?? '';
          final reactions = await realSdk.fetchReactionList(
            msgIds: [msgId],
            chatType: _asInt(map['chatType']) ?? _asInt(map['type']) ?? 0,
            groupId: map['groupId']?.toString(),
          );
          return {method: _asMapList(reactions[msgId])};
        }
        return {method: _chatManager._messageReactionList(map['msgId'])};
      case _MethodKeys.groupAckCount:
        if (realSdk != null) {
          final result = await realSdk.fetchGroupAcks(
            msgId: map['msgId']?.toString() ?? '',
            groupId: map['group_id']?.toString() ??
                map['groupId']?.toString() ??
                '',
            pageSize: 500,
          );
          return {method: _asMapList(result['list']).length};
        }
        return {method: _chatManager._groupAckCount(map['msgId'])};
      case _MethodKeys.getChatThread:
        if (realSdk != null) {
          return {
            method: await realSdk.getChatThreadByMessageId(
              msgId: map['msgId']?.toString() ?? '',
              parentId: map['parentId']?.toString() ??
                  map['groupId']?.toString() ??
                  '',
            ),
          };
        }
        return {method: _chatThreadManager._threadByMessageId(map['msgId'])};
      default:
        return _unsupported('MessageManager', method);
    }
  }

  Future<void> emitMessageEvent(String method, [dynamic arguments]) async {
    await _handler?.call(MethodCall(method, arguments));
  }
}
