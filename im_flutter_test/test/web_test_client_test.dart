import 'package:flutter_test/flutter_test.dart';
import 'package:im_flutter_sdk_web/im_flutter_sdk_web.dart';
import 'package:im_flutter_sdk_interface/im_flutter_sdk_interface.dart';

const _init = 'init';
const _login = 'login';
const _logout = 'logout';
const _getCurrentUser = 'getCurrentUser';
const _getCurrentDeviceId = 'getCurrentDeviceId';
const _isConnected = 'isConnected';
const _isLoggedInBefore = 'isLoggedInBefore';
const _getToken = 'getToken';
const _startCallback = 'startCallback';
const _sendMessage = 'sendMessage';
const _getSdkMode = 'getSdkMode';

void main() {
  test('web test client handles client session methods', () async {
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
    expect(await client.callNativeMethod(_isLoggedInBefore), {
      _isLoggedInBefore: true,
    });
    expect(await client.callNativeMethod(_getToken), {_getToken: 'token-a'});
    expect(await client.callNativeMethod(_getCurrentDeviceId), {
      _getCurrentDeviceId: {'deviceUUID': 'web-device'},
    });
    expect(await client.callNativeMethod(_startCallback), {
      _startCallback: true,
    });
    expect(await client.callNativeMethod(_logout), {_logout: true});
  });

  test('web test client stores SDK mode from init options', () async {
    final previous = Client.instance;
    ImFlutterSdkWeb.registerWith();
    final client = Client.instance;
    addTearDown(() {
      Client.instance = previous;
    });

    expect(await client.callNativeMethod(_init, {'webSdkMode': 'real_sdk'}), {
      _init: true,
    });
    expect(await client.callNativeMethod(_getSdkMode), {
      _getSdkMode: 'real_sdk',
    });
  });

  test('web test client sends text message through chat manager', () async {
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

  test(
    'web test client returns unsupported payload for non-text chat message',
    () async {
      final previous = Client.instance;
      ImFlutterSdkWeb.registerWith();
      final client = Client.instance;
      addTearDown(() {
        Client.instance = previous;
      });

      final result = await client.chatManager.callNativeMethod(_sendMessage, {
        'to': 'web-user-b',
        'body': {'type': 1},
      }) as Map<String, dynamic>;

      expect(result[_sendMessage], {
        'code': 900001,
        'description': 'Unsupported on Web: ChatManager.sendMessage',
      });
    },
  );
}
