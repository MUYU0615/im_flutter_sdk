import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

class BridgeSocket {
  BridgeSocket._(this._channel);

  final WebSocketChannel _channel;

  Stream<String> get messages => _channel.stream.map(
        (raw) => raw is String
            ? raw
            : (raw is List<int> ? utf8.decode(raw) : raw?.toString() ?? ''),
      );

  bool get isClosed => _channel.closeCode != null;

  void add(String data) {
    _channel.sink.add(data);
  }

  Future<void> close() => _channel.sink.close();
}

Future<BridgeSocket> connectBridgeSocket(Uri uri) async {
  final channel = WebSocketChannel.connect(uri);
  await channel.ready;
  return BridgeSocket._(channel);
}
