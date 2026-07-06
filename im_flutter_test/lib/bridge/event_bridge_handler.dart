import 'package:im_flutter_sdk/im_flutter_sdk.dart';

/// Event forwarding entry point for the JSON bridge test app.
///
/// The Web MVP forwards deterministic events triggered by JSON bridge commands
/// so automation can verify the app -> WebSocket event path before broader SDK
/// callback parity is added.
typedef BridgeEventSender = void Function(
  String eventType,
  Map<String, dynamic> data,
);

class EventBridgeHandler {
  EventBridgeHandler._();

  static final EventBridgeHandler instance = EventBridgeHandler._();
  static const String _handlerId = 'im_flutter_test_bridge';

  bool _registered = false;
  BridgeEventSender? _sendEvent;

  List<Map<String, dynamic>> _messagesToJson(List<EMMessage> messages) {
    return messages.map((message) => message.toJson()).toList();
  }

  void registerAllHandlers({
    String? deviceName,
    required BridgeEventSender sendEvent,
    bool emitConnectedOnRegister = true,
  }) {
    _registered = true;
    _sendEvent = sendEvent;
    EMClient.getInstance.chatManager.addEventHandler(
      _handlerId,
      EMChatEventHandler(
        onMessagesReceived: (messages) {
          emitMessagesReceived(messages: _messagesToJson(messages));
        },
        onCmdMessagesReceived: (messages) {
          emitCmdMessagesReceived(messages: _messagesToJson(messages));
        },
        onMessagesRead: (messages) {
          emitMessagesRead(messages: _messagesToJson(messages));
        },
        onMessagesDelivered: (messages) {
          emitMessagesDelivered(messages: _messagesToJson(messages));
        },
        onMessagesRecalled: (messages) {
          emitMessagesRecalled(messages: _messagesToJson(messages));
        },
        onMessagesRecalledInfo: (infos) {
          emitMessagesRecalledInfo(
            infos: infos
                .map((info) => Map<String, dynamic>.from(info.toJson()))
                .toList(),
          );
        },
        onMessagePinChanged: (
          messageId,
          conversationId,
          pinOperation,
          pinInfo,
        ) {
          emitMessagePinChanged(
            messageId: messageId,
            conversationId: conversationId,
            pinOperation: pinOperation,
            pinInfo: Map<String, dynamic>.from(pinInfo.toJson()),
          );
        },
        onStreamMessagesReceived: (messages) {
          emitStreamMessagesReceived(messages: _messagesToJson(messages));
        },
      ),
    );
    EMClient.getInstance.contactManager.addEventHandler(
      _handlerId,
      EMContactEventHandler(
        onContactAdded: (userId) {
          emitContactAdded(userId: userId);
        },
        onContactDeleted: (userId) {
          emitContactDeleted(userId: userId);
        },
        onContactInvited: (userId, reason) {
          emitContactChanged(
            type: 'onContactInvited',
            userId: userId,
            reason: reason,
          );
        },
        onFriendRequestAccepted: (userId) {
          emitContactChanged(
            type: 'onFriendRequestAccepted',
            userId: userId,
          );
        },
        onFriendRequestDeclined: (userId) {
          emitContactChanged(
            type: 'onFriendRequestDeclined',
            userId: userId,
          );
        },
      ),
    );
    if (emitConnectedOnRegister) {
      emitConnected(deviceName: deviceName);
    }
  }

  void emitConnected({String? deviceName}) {
    if (!_registered) return;
    _sendEvent?.call('onConnected', {
      'device': deviceName,
      'connected': true,
    });
  }

  void emitTestEvent({
    required String eventType,
    required Map<String, dynamic> data,
    String? deviceName,
  }) {
    if (!_registered) return;
    _sendEvent?.call(eventType, {
      ...data,
      if (deviceName != null) 'device': deviceName,
    });
  }

  void emitDisconnected({String? deviceName}) {
    if (!_registered) return;
    _sendEvent?.call('onDisconnected', {
      'device': deviceName,
      'connected': false,
    });
  }

  void emitChatRoomSpecificationChanged({
    required Map<String, dynamic> room,
    String operation = 'update',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomSpecificationChanged', {
      'roomId': room['roomId'],
      'name': room['name'],
      'owner': room['owner'],
      'operation': operation,
    });
  }

  void emitChatRoomDestroyed({
    required Map<String, dynamic> room,
    String operation = 'destroy',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomDestroyed', {
      'roomId': room['roomId'],
      'name': room['name'],
      'owner': room['owner'],
      'operation': operation,
    });
  }

  void emitChatRoomAnnouncementChanged({
    required String roomId,
    required String announcement,
    String operation = 'announcement',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomAnnouncementChanged', {
      'roomId': roomId,
      'announcement': announcement,
      'operation': operation,
    });
  }

  void emitChatRoomAdminChanged({
    required String roomId,
    required String admin,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent?.call(added ? 'onRoomAdminAdded' : 'onRoomAdminRemoved', {
      'roomId': roomId,
      'admin': admin,
      'operation': added ? 'admin_added' : 'admin_removed',
    });
  }

  void emitChatRoomMuteChanged({
    required String roomId,
    required List<String> members,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent?.call(added ? 'onRoomMuteListAdded' : 'onRoomMuteListRemoved', {
      'roomId': roomId,
      'members': members,
      'operation': added ? 'mute_added' : 'mute_removed',
    });
  }

  void emitChatRoomWhiteListChanged({
    required String roomId,
    required List<String> members,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent?.call(
      added ? 'onRoomWhiteListAdded' : 'onRoomWhiteListRemoved',
      {
        'roomId': roomId,
        'members': members,
        'operation': added ? 'white_list_added' : 'white_list_removed',
      },
    );
  }

  void emitChatRoomOwnerChanged({
    required String roomId,
    required String newOwner,
    required String oldOwner,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomOwnerChanged', {
      'roomId': roomId,
      'newOwner': newOwner,
      'oldOwner': oldOwner,
      'operation': 'owner_changed',
    });
  }

  void emitChatRoomAllMemberMuteChanged({
    required String roomId,
    required bool isAllMuted,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomAllMemberMuteStateChanged', {
      'roomId': roomId,
      'isAllMuted': isAllMuted,
      'operation': 'all_member_mute_changed',
    });
  }

  void emitChatRoomAttributesUpdated({
    required String roomId,
    required Map<String, dynamic> attributes,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomAttributesDidUpdated', {
      'roomId': roomId,
      'attributes': attributes,
      'operation': 'attributes_updated',
    });
  }

  void emitChatRoomAttributesRemoved({
    required String roomId,
    required List<String> keys,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomAttributesDidRemoved', {
      'roomId': roomId,
      'keys': keys,
      'operation': 'attributes_removed',
    });
  }

  void emitChatRoomMemberChanged({
    required String roomId,
    required String participant,
    required bool joined,
  }) {
    if (!_registered) return;
    _sendEvent?.call(joined ? 'onRoomMemberJoined' : 'onRoomMemberExited', {
      'roomId': roomId,
      'participant': participant,
      'operation': joined ? 'member_joined' : 'member_exited',
    });
  }

  void emitChatRoomRemoved({
    required String roomId,
    required List<String> participants,
    required String operator,
    required String reason,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onRoomRemoved', {
      'roomId': roomId,
      'participants': participants,
      'operator': operator,
      'reason': reason,
      'operation': 'member_removed',
    });
  }

  void emitGroupSpecificationChanged({
    required Map<String, dynamic> group,
    String operation = 'update',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupSpecificationDidUpdate', {
      'groupId': group['groupId'],
      'name': group['name'],
      'owner': group['owner'],
      'operation': operation,
    });
  }

  void emitGroupAnnouncementChanged({
    required String groupId,
    required String announcement,
    String operation = 'announcement',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupAnnouncementChanged', {
      'groupId': groupId,
      'announcement': announcement,
      'operation': operation,
    });
  }

  void emitGroupAdminChanged({
    required String groupId,
    required String admin,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent?.call(added ? 'onGroupAdminAdded' : 'onGroupAdminRemoved', {
      'groupId': groupId,
      'admin': admin,
      'operation': added ? 'admin_added' : 'admin_removed',
    });
  }

  void emitGroupMuteChanged({
    required String groupId,
    required List<String> members,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent
        ?.call(added ? 'onGroupMuteListAdded' : 'onGroupMuteListRemoved', {
      'groupId': groupId,
      'members': members,
      'operation': added ? 'mute_added' : 'mute_removed',
    });
  }

  void emitGroupWhiteListChanged({
    required String groupId,
    required List<String> members,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent?.call(
      added ? 'onGroupWhiteListAdded' : 'onGroupWhiteListRemoved',
      {
        'groupId': groupId,
        'members': members,
        'operation': added ? 'white_list_added' : 'white_list_removed',
      },
    );
  }

  void emitGroupMemberChanged({
    required String groupId,
    required List<String> members,
    required bool joined,
  }) {
    if (!_registered) return;
    _sendEvent?.call(joined ? 'onGroupMemberJoined' : 'onGroupMemberExited', {
      'groupId': groupId,
      'members': members,
      'operation': joined ? 'member_joined' : 'member_exited',
    });
  }

  void emitGroupUserRemoved({
    required String groupId,
    required List<String> members,
    required String operator,
    required String reason,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupUserRemoved', {
      'groupId': groupId,
      'members': members,
      'operator': operator,
      'reason': reason,
      'operation': 'user_removed',
    });
  }

  void emitGroupOwnerChanged({
    required String groupId,
    required String newOwner,
    required String oldOwner,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupOwnerChanged', {
      'groupId': groupId,
      'newOwner': newOwner,
      'oldOwner': oldOwner,
      'operation': 'owner_changed',
    });
  }

  void emitGroupStateChanged({
    required String groupId,
    required bool messageBlocked,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupStateChanged', {
      'groupId': groupId,
      'messageBlocked': messageBlocked,
      'operation': 'state_changed',
    });
  }

  void emitGroupAllMemberMuteChanged({
    required String groupId,
    required bool isAllMuted,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupAllMemberMuteStateChanged', {
      'groupId': groupId,
      'isAllMuted': isAllMuted,
      'operation': 'all_member_mute_changed',
    });
  }

  void emitGroupMemberAttributesChanged({
    required String groupId,
    required String userId,
    Map<String, dynamic>? attributes,
    List<String>? keys,
    required bool removed,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupAttributesChangedOfMember', {
      'groupId': groupId,
      'userId': userId,
      if (attributes != null) 'attributes': attributes,
      if (keys != null) 'keys': keys,
      'operation':
          removed ? 'member_attributes_removed' : 'member_attributes_updated',
    });
  }

  void emitGroupDestroyed({
    required Map<String, dynamic> group,
    String operation = 'destroy',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupDestroyed', {
      'groupId': group['groupId'],
      'name': group['name'],
      'owner': group['owner'],
      'operation': operation,
    });
  }

  void emitContactAdded({
    required String userId,
    String operation = 'add',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onContactAdded', {
      'userId': userId,
      'operation': operation,
    });
  }

  void emitContactDeleted({
    required String userId,
    String operation = 'delete',
  }) {
    if (!_registered) return;
    _sendEvent?.call('onContactDeleted', {
      'userId': userId,
      'operation': operation,
    });
  }

  void emitContactChanged({
    required String type,
    required String userId,
    String? reason,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onContactChanged', {
      'type': type,
      'userId': userId,
      if (reason != null) 'reason': reason,
    });
  }

  void emitMessagesReceived({
    required List<Map<String, dynamic>> messages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessagesReceived', {
      'messages': messages,
      'operation': 'messages_received',
    });
  }

  void emitStreamMessagesReceived({
    required List<Map<String, dynamic>> messages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onStreamMessagesReceived', {
      'messages': messages,
      'operation': 'stream_messages_received',
    });
  }

  void emitCmdMessagesReceived({
    required List<Map<String, dynamic>> messages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onCmdMessagesReceived', {
      'messages': messages,
      'operation': 'cmd_messages_received',
    });
  }

  void emitMessagesRecalled({
    required List<Map<String, dynamic>> messages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessagesRecalled', {
      'messages': messages,
      'operation': 'messages_recalled',
    });
  }

  void emitMessagesRecalledInfo({
    required List<Map<String, dynamic>> infos,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessagesRecalledInfo', {
      'infos': infos,
      'operation': 'messages_recalled_info',
    });
  }

  void emitMessagesDelivered({
    required List<Map<String, dynamic>> messages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessagesDelivered', {
      'messages': messages,
      'operation': 'messages_delivered',
    });
  }

  void emitMessageSuccess({
    required Map<String, dynamic> message,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessageSuccess', {
      'msg': message,
      'operation': 'message_success',
    });
  }

  void emitMessageProgress({
    required String localId,
    required int progress,
  }) {
    if (!_registered) return;
    final payload = {
      'localId': localId,
      'progress': progress,
    };
    _sendEvent?.call('onMessageProgress', {
      ...payload,
      'operation': 'message_progress',
    });
    _sendEvent?.call('onMessageProgressUpdate', {
      ...payload,
      'operation': 'message_progress_update',
    });
  }

  void emitMessageError({
    required String localId,
    required Map<String, dynamic> message,
    required String description,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessageError', {
      'localId': localId,
      'msg': message,
      'error': {
        'code': -1,
        'description': description,
      },
      'operation': 'message_error',
    });
  }

  void emitMessageDeliveryAck({
    required Map<String, dynamic> message,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessageDeliveryAck', {
      'msg': message,
      'operation': 'message_delivery_ack',
    });
  }

  void emitMessagesRead({
    required List<Map<String, dynamic>> messages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessagesRead', {
      'messages': messages,
      'operation': 'messages_read',
    });
  }

  void emitMessageReadAck({
    required Map<String, dynamic> message,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessageReadAck', {
      'msg': message,
      'operation': 'message_read_ack',
    });
  }

  void emitReadAckForGroupMessageUpdated({
    required String msgId,
    required String groupId,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onReadAckForGroupMessageUpdated', {
      'msgId': msgId,
      'groupId': groupId,
      'operation': 'group_message_read_ack_updated',
    });
  }

  void emitGroupMessageRead({
    required List<Map<String, dynamic>> acks,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onGroupMessageRead', {
      'acks': acks,
      'operation': 'group_message_read',
    });
  }

  void emitPresenceStatusChanged({
    required List<Map<String, dynamic>> presences,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onPresenceStatusChanged', {
      'presences': presences,
      'operation': 'presence_status_changed',
    });
  }

  void emitConversationUpdate({
    required String convId,
    required String operation,
    bool? isPinned,
    bool? deleteMessages,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onConversationUpdate', {
      'convId': convId,
      if (isPinned != null) 'isPinned': isPinned,
      if (deleteMessages != null) 'deleteMessages': deleteMessages,
      'operation': operation,
    });
  }

  void emitConversationHasRead({
    required String convId,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onConversationHasRead', {
      'convId': convId,
      'operation': 'conversation_has_read',
    });
  }

  void emitMessageContentChanged({
    required Map<String, dynamic> message,
    required String operatorId,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessageContentChanged', {
      'message': message,
      'operatorId': operatorId,
      'operation': 'message_content_changed',
    });
  }

  void emitMessageChanged({
    required Map<String, dynamic> message,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessageChanged', {
      'msg': message,
      'operation': 'message_changed',
    });
  }

  void emitMessageReactionChanged({
    required String msgId,
    required String reaction,
    required String userId,
    required bool added,
  }) {
    if (!_registered) return;
    _sendEvent?.call('messageReactionDidChange', {
      'msgId': msgId,
      'reaction': reaction,
      'userId': userId,
      'operation': added ? 'reaction_added' : 'reaction_removed',
    });
  }

  void emitMessagePinChanged({
    required String messageId,
    required String conversationId,
    required MessagePinOperation pinOperation,
    required Map<String, dynamic> pinInfo,
  }) {
    if (!_registered) return;
    _sendEvent?.call('onMessagePinChanged', {
      'messageId': messageId,
      'conversationId': conversationId,
      'pinOperation': pinOperation.toString(),
      'pinInfo': pinInfo,
    });
  }

  void emitChatThreadCreated({
    required Map<String, dynamic> thread,
    String operation = 'create',
    String? userId,
  }) {
    if (!_registered) return;
    final eventType = switch (operation) {
      'update' => 'onChatThreadUpdate',
      'destroy' => 'onChatThreadDestroy',
      'user_kicked' => 'onUserKickOutOfChatThread',
      _ => 'onChatThreadCreate',
    };
    _sendEvent?.call(
      eventType,
      {
        'threadId': thread['threadId'],
        'threadName': thread['threadName'],
        'parentId': thread['parentId'],
        'owner': thread['owner'],
        if (userId != null) 'userId': userId,
        'operation': operation,
      },
    );
  }

  void unregisterAllHandlers() {
    EMClient.getInstance.chatManager.removeEventHandler(_handlerId);
    EMClient.getInstance.contactManager.removeEventHandler(_handlerId);
    _registered = false;
    _sendEvent = null;
  }
}
