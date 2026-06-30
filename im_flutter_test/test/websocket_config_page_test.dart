import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:im_flutter_test/websocket_config_page.dart';

void main() {
  testWidgets('autoconnect query starts bridge with web device', (
    tester,
  ) async {
    final starts = <BridgeStartRequest>[];

    await tester.pumpWidget(
      MaterialApp(
        home: WebSocketConfigPage(
          initialUri: Uri.parse(
            'http://localhost/?bridgeUrl=ws://localhost:2000/ws&topic=web-a&device=webA&autoconnect=1',
          ),
          bridgeStarter: (request) async {
            starts.add(request);
          },
          eventRegistrar: () {},
        ),
      ),
    );

    await tester.pump();

    expect(starts, hasLength(1));
    expect(starts.single.url, 'ws://localhost:2000/ws?topic=web-a');
    expect(starts.single.deviceName, 'webA');
  });
}
