import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:im_flutter_sdk/im_flutter_sdk.dart';
import 'package:im_flutter_sdk_interface/im_flutter_sdk_interface.dart';

import 'sdk_config_loader.dart';
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

  if (kIsWeb) {
    final options = await SdkConfigLoader.loadOptionsJson();
    final webSdkMode = Uri.base.queryParameters['webSdkMode'];
    if (webSdkMode != null && webSdkMode.isNotEmpty) {
      options['webSdkMode'] = webSdkMode;
    }
    await Client.instance.callNativeMethod('init', options);
  } else {
    final options = await SdkConfigLoader.loadOptions();
    await EMClient.getInstance.init(options);
  }

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
