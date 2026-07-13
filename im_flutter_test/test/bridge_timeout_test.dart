import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:im_flutter_test/bridge/bridge_timeout.dart';

void main() {
  test('withBridgeTimeout returns completed native call result', () async {
    final result = await withBridgeTimeout(
      Future.value({'sendMessage': true}),
      managerName: 'ChatManager',
      method: 'sendMessage',
      timeout: const Duration(milliseconds: 20),
    );

    expect(result, {'sendMessage': true});
  });

  test('withBridgeTimeout fails hung native call with command context', () async {
    final future = withBridgeTimeout(
      Completer<Map<String, dynamic>>().future,
      managerName: 'GroupManager',
      method: 'destroyGroup',
      timeout: const Duration(milliseconds: 1),
    );

    await expectLater(
      future,
      throwsA(
        isA<TimeoutException>().having(
          (error) => error.message,
          'message',
          contains('GroupManager.destroyGroup'),
        ),
      ),
    );
  });
}
