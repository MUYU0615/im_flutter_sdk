import 'package:flutter/material.dart';

import 'web_client_bootstrap.dart';
import 'websocket_config_page.dart';

const bool _bridgeAutoconnect = bool.fromEnvironment(
  'IM_BRIDGE_AUTOCONNECT',
);
const String _bridgeUrl = String.fromEnvironment('IM_BRIDGE_URL');
const String _bridgeDevice = String.fromEnvironment('IM_BRIDGE_DEVICE');
const String _bridgeTopic = String.fromEnvironment('IM_BRIDGE_TOPIC');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  installWebClientForTestApp();

  runApp(const IMTestApp());
}

class IMTestApp extends StatelessWidget {
  const IMTestApp({super.key});

  @override
  Widget build(BuildContext context) {
    final initialUri = _bridgeAutoconnect
        ? Uri(
            scheme: 'http',
            host: 'localhost',
            queryParameters: {
              'bridgeUrl': _bridgeUrl,
              'device': _bridgeDevice.isEmpty ? 'deviceA' : _bridgeDevice,
              if (_bridgeTopic.isNotEmpty) 'topic': _bridgeTopic,
              'autoconnect': '1',
            },
          )
        : null;
    return MaterialApp(
      title: 'IM Flutter Test',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: WebSocketConfigPage(initialUri: initialUri),
    );
  }
}
