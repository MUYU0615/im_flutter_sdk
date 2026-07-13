import 'dart:async';

const Duration kBridgeNativeCallTimeout = Duration(seconds: 25);

Future<T> withBridgeTimeout<T>(
  Future<T> future, {
  required String managerName,
  required String method,
  Duration timeout = kBridgeNativeCallTimeout,
}) {
  return future.timeout(
    timeout,
    onTimeout: () {
      throw TimeoutException(
        'Bridge native call timeout: $managerName.$method',
        timeout,
      );
    },
  );
}
