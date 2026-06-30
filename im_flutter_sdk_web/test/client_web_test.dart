import 'package:flutter_test/flutter_test.dart';
import 'package:im_flutter_sdk_interface/im_flutter_sdk_interface.dart';
import 'package:im_flutter_sdk_web/im_flutter_sdk_web.dart';

const _init = 'init';
const _login = 'login';
const _getCurrentUser = 'getCurrentUser';
const _isConnected = 'isConnected';
const _getToken = 'getToken';
const _uploadLog = 'uploadLog';
const _compressLogs = 'compressLogs';
const _getLoggedInDevicesFromServer = 'getLoggedInDevicesFromServer';
const _kickDevice = 'kickDevice';
const _kickAllDevices = 'kickAllDevices';
const _sendMessage = 'sendMessage';
const _getMessage = 'getMessage';
const _updateChatMessage = 'updateChatMessage';
const _importMessages = 'importMessages';
const _getConversation = 'getConversation';
const _loadAllConversations = 'loadAllConversations';
const _deleteConversation = 'deleteConversation';
const _markAllChatMsgAsRead = 'markAllChatMsgAsRead';
const _getUnreadMessageCount = 'getUnreadMessageCount';
const _deleteMessagesBeforeTimestamp = 'deleteMessagesBeforeTimestamp';
const _fetchHistoryMessagesByOptions = 'fetchHistoryMessagesByOptions';
const _fetchSupportLanguages = 'fetchSupportLanguages';
const _loadMessagesWithIds = 'loadMessagesWithIds';
const _getMessageCount = 'getMessageCount';
const _updateOwnUserInfo = 'updateOwnUserInfo';
const _updateOwnUserInfoWithType = 'updateOwnUserInfoWithType';
const _fetchOwnInfo = 'fetchOwnInfo';
const _fetchUserInfoById = 'fetchUserInfoById';
const _fetchUserInfoByIdWithType = 'fetchUserInfoByIdWithType';
const _addContact = 'addContact';
const _deleteContact = 'deleteContact';
const _getAllContactsFromServer = 'getAllContactsFromServer';
const _getAllContactsFromDB = 'getAllContactsFromDB';
const _getAllContacts = 'getAllContacts';
const _fetchAllContacts = 'fetchAllContacts';
const _fetchContacts = 'fetchContacts';
const _fetchAllContactIds = 'fetchAllContactIds';
const _getAllContactIds = 'getAllContactIds';
const _setContactRemark = 'setContactRemark';
const _getContact = 'getContact';
const _addUserToBlockList = 'addUserToBlockList';
const _removeUserFromBlockList = 'removeUserFromBlockList';
const _getBlockListFromServer = 'getBlockListFromServer';
const _getBlockListFromDB = 'getBlockListFromDB';
const _getSelfIdsOnOtherPlatform = 'getSelfIdsOnOtherPlatform';

void main() {
  test('registerWith installs web client through interface', () {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    addTearDown(() {
      Client.instance = previous;
    });

    expect(Client.instance, isA<ClientWeb>());
  });

  test('web client handles client session methods', () async {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    final client = Client.instance;
    addTearDown(() {
      Client.instance = previous;
    });

    expect(await client.callNativeMethod(_init, {}), {_init: true});
    expect(
      await client.callNativeMethod(_login, {
        'userId': 'web-user-a',
        'pwdOrToken': 'token-a',
      }),
      {_login: 'web-user-a'},
    );
    expect(await client.callNativeMethod(_getCurrentUser), {
      _getCurrentUser: 'web-user-a',
    });
    expect(await client.callNativeMethod(_isConnected), {_isConnected: true});
    expect(await client.callNativeMethod(_getToken), {_getToken: 'token-a'});
    expect(await client.callNativeMethod(_uploadLog), {_uploadLog: true});
    expect(await client.callNativeMethod(_compressLogs), {
      _compressLogs: isA<String>(),
    });
    expect(
      await client.callNativeMethod(_getLoggedInDevicesFromServer, {
        'userId': 'web-user-a',
        'pwdOrToken': 'token-a',
      }),
      {_getLoggedInDevicesFromServer: <Object>[]},
    );
    expect(
      await client.callNativeMethod(_kickDevice, {
        'userId': 'web-user-a',
        'pwdOrToken': 'token-a',
        'resource': 'web',
      }),
      {_kickDevice: true},
    );
    expect(
      await client.callNativeMethod(_kickAllDevices, {
        'userId': 'web-user-a',
        'pwdOrToken': 'token-a',
      }),
      {_kickAllDevices: true},
    );
  });

  test('web client sends text message through chat manager', () async {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    final client = Client.instance;
    addTearDown(() {
      Client.instance = previous;
    });

    final result = await client.chatManager.callNativeMethod(_sendMessage, {
      'from': 'web-user-a',
      'to': 'web-user-b',
      'body': {'type': 0, 'content': 'hello'},
      'direction': 0,
      'chatType': 0,
    }) as Map<String, dynamic>;

    final message = result[_sendMessage] as Map<String, dynamic>;
    expect(message['from'], 'web-user-a');
    expect(message['to'], 'web-user-b');
    expect(message['convId'], 'web-user-b');
    expect(message['body'], {'type': 0, 'content': 'hello'});
    expect(message['status'], 2);
    expect(message['msgId'], isNotEmpty);
  });

  test('web client stores local chat messages and conversations', () async {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    final client = Client.instance;
    addTearDown(() {
      Client.instance = previous;
    });

    final sent = await client.chatManager.callNativeMethod(_sendMessage, {
      'from': 'web-user-a',
      'to': 'web-user-b',
      'body': {'type': 0, 'content': 'local-one'},
      'direction': 0,
      'chatType': 0,
    }) as Map<String, dynamic>;
    final message = sent[_sendMessage] as Map<String, dynamic>;
    final msgId = message['msgId'] as String;

    expect(
        await client.chatManager
            .callNativeMethod(_getMessage, {'msgId': msgId}),
        {
          _getMessage: message,
        });

    final updated = Map<String, dynamic>.from(message)
      ..['body'] = {'type': 0, 'content': 'local-two'};
    expect(
      await client.chatManager.callNativeMethod(_updateChatMessage, {
        'message': updated,
      }),
      {_updateChatMessage: updated},
    );

    expect(
      await client.chatManager.callNativeMethod(_getConversation, {
        'convId': 'web-user-b',
        'type': 0,
        'createIfNeed': false,
      }),
      {
        _getConversation: {
          'convId': 'web-user-b',
          'type': 0,
          'unreadCount': 0,
          'latestMessage': updated,
        },
      },
    );

    final conversations = await client.chatManager
        .callNativeMethod(_loadAllConversations) as Map<String, dynamic>;
    expect(conversations[_loadAllConversations], isA<List>());
    expect((conversations[_loadAllConversations] as List).length, 1);

    expect(await client.chatManager.callNativeMethod(_getUnreadMessageCount), {
      _getUnreadMessageCount: 0,
    });
    expect(await client.chatManager.callNativeMethod(_markAllChatMsgAsRead), {
      _markAllChatMsgAsRead: 1,
    });

    expect(
      await client.chatManager
          .callNativeMethod(_fetchHistoryMessagesByOptions, {
        'convId': 'web-user-b',
        'type': 0,
        'pageSize': 20,
        'cursor': '',
      }),
      {
        _fetchHistoryMessagesByOptions: {
          'cursor': '',
          'list': [updated],
        },
      },
    );
    expect(
      await client.chatManager.callNativeMethod(_loadMessagesWithIds, {
        'msgIds': [msgId],
      }),
      {
        _loadMessagesWithIds: [updated],
      },
    );
    expect(await client.chatManager.callNativeMethod(_getMessageCount), {
      _getMessageCount: 1,
    });
    expect(await client.chatManager.callNativeMethod(_fetchSupportLanguages), {
      _fetchSupportLanguages: isA<List>(),
    });

    expect(
      await client.chatManager
          .callNativeMethod(_deleteMessagesBeforeTimestamp, {
        'timestamp': DateTime.now().millisecondsSinceEpoch + 1000,
      }),
      {_deleteMessagesBeforeTimestamp: null},
    );
    expect(
        await client.chatManager
            .callNativeMethod(_getMessage, {'msgId': msgId}),
        {
          _getMessage: null,
        });

    final imported = {
      'from': 'web-user-a',
      'to': 'web-user-b',
      'msgId': 'imported-1',
      'body': {'type': 0, 'content': 'imported'},
      'direction': 0,
      'chatType': 0,
    };
    expect(
      await client.chatManager.callNativeMethod(_importMessages, {
        'messages': [imported],
      }),
      {_importMessages: true},
    );
    expect(
        await client.chatManager
            .callNativeMethod(_getMessage, {'msgId': 'imported-1'}),
        {
          _getMessage: containsPair('msgId', 'imported-1'),
        });

    expect(
      await client.chatManager.callNativeMethod(_deleteConversation, {
        'convId': 'web-user-b',
        'deleteMessages': true,
      }),
      {_deleteConversation: true},
    );
    expect(await client.chatManager.callNativeMethod(_loadAllConversations), {
      _loadAllConversations: <Object>[],
    });
  });

  test('web client stores and fetches user info through user info manager',
      () async {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    final client = Client.instance;
    addTearDown(() {
      Client.instance = previous;
    });

    await client.callNativeMethod(_login, {
      'userId': 'web-user-a',
      'pwdOrToken': 'token-a',
    });

    final update = await client.userInfoManager.callNativeMethod(
      _updateOwnUserInfo,
      {
        'nickName': 'nick-a',
        'sign': 'sign-a',
        'mail': 'a@example.com',
      },
    ) as Map<String, dynamic>;
    expect(update[_updateOwnUserInfo], {
      'userId': 'web-user-a',
      'nickName': 'nick-a',
      'sign': 'sign-a',
      'mail': 'a@example.com',
    });

    await client.userInfoManager.callNativeMethod(_updateOwnUserInfoWithType, {
      'userInfoType': 5,
      'userInfoValue': 'sign-b',
    });

    final own = await client.userInfoManager.callNativeMethod(_fetchOwnInfo)
        as Map<String, dynamic>;
    expect(own[_fetchOwnInfo], {
      'userId': 'web-user-a',
      'nickName': 'nick-a',
      'sign': 'sign-b',
      'mail': 'a@example.com',
    });

    final full = await client.userInfoManager.callNativeMethod(
      _fetchUserInfoById,
      {
        'userIds': ['web-user-a', 'web-user-b'],
      },
    ) as Map<String, dynamic>;
    expect(full[_fetchUserInfoById], {
      'web-user-a': {
        'userId': 'web-user-a',
        'nickName': 'nick-a',
        'sign': 'sign-b',
        'mail': 'a@example.com',
      },
      'web-user-b': {'userId': 'web-user-b'},
    });

    final partial = await client.userInfoManager.callNativeMethod(
      _fetchUserInfoByIdWithType,
      {
        'userIds': ['web-user-a'],
        'userInfoTypes': [0, 5],
      },
    ) as Map<String, dynamic>;
    expect(partial[_fetchUserInfoByIdWithType], {
      'web-user-a': {
        'userId': 'web-user-a',
        'nickName': 'nick-a',
        'sign': 'sign-b',
      },
    });
  });

  test('web client manages contacts through contact manager', () async {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    final client = Client.instance;
    addTearDown(() {
      Client.instance = previous;
    });

    await client.callNativeMethod(_login, {
      'userId': 'web-user-a',
      'pwdOrToken': 'token-a',
    });

    expect(
      await client.contactManager.callNativeMethod(_addContact, {
        'userId': 'web-user-b',
        'reason': 'hello',
      }),
      {_addContact: 'web-user-b'},
    );
    expect(
        await client.contactManager.callNativeMethod(_getAllContactsFromServer),
        {
          _getAllContactsFromServer: ['web-user-b'],
        });
    expect(
        await client.contactManager.callNativeMethod(_getAllContactsFromDB), {
      _getAllContactsFromDB: ['web-user-b'],
    });

    expect(
      await client.contactManager.callNativeMethod(_setContactRemark, {
        'userId': 'web-user-b',
        'remark': 'remark-b',
      }),
      {_setContactRemark: true},
    );
    expect(
        await client.contactManager
            .callNativeMethod(_getContact, {'userId': 'web-user-b'}),
        {
          _getContact: {'userId': 'web-user-b', 'remark': 'remark-b'},
        });

    expect(await client.contactManager.callNativeMethod(_getAllContacts), {
      _getAllContacts: [
        {'userId': 'web-user-b', 'remark': 'remark-b'},
      ],
    });
    expect(await client.contactManager.callNativeMethod(_fetchAllContacts), {
      _fetchAllContacts: [
        {'userId': 'web-user-b', 'remark': 'remark-b'},
      ],
    });
    expect(
      await client.contactManager.callNativeMethod(_fetchContacts, {
        'cursor': '',
        'pageSize': 1,
      }),
      {
        _fetchContacts: {
          'cursor': '',
          'list': [
            {'userId': 'web-user-b', 'remark': 'remark-b'},
          ],
        },
      },
    );
    expect(await client.contactManager.callNativeMethod(_fetchAllContactIds), {
      _fetchAllContactIds: ['web-user-b'],
    });
    expect(await client.contactManager.callNativeMethod(_getAllContactIds), {
      _getAllContactIds: ['web-user-b'],
    });

    expect(
      await client.contactManager.callNativeMethod(_addUserToBlockList, {
        'userId': 'web-user-c',
      }),
      {_addUserToBlockList: 'web-user-c'},
    );
    expect(
        await client.contactManager.callNativeMethod(_getBlockListFromServer), {
      _getBlockListFromServer: ['web-user-c'],
    });
    expect(await client.contactManager.callNativeMethod(_getBlockListFromDB), {
      _getBlockListFromDB: ['web-user-c'],
    });
    expect(
      await client.contactManager.callNativeMethod(_removeUserFromBlockList, {
        'userId': 'web-user-c',
      }),
      {_removeUserFromBlockList: 'web-user-c'},
    );
    expect(await client.contactManager.callNativeMethod(_getBlockListFromDB), {
      _getBlockListFromDB: <String>[],
    });

    expect(
        await client.contactManager
            .callNativeMethod(_getSelfIdsOnOtherPlatform),
        {
          _getSelfIdsOnOtherPlatform: <String>[],
        });
    expect(
      await client.contactManager.callNativeMethod(_deleteContact, {
        'userId': 'web-user-b',
        'keepConversation': true,
      }),
      {_deleteContact: 'web-user-b'},
    );
    expect(
        await client.contactManager.callNativeMethod(_getAllContactsFromDB), {
      _getAllContactsFromDB: <String>[],
    });
  });
}
