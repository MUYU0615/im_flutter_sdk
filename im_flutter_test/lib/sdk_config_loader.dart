import 'package:flutter/services.dart' show rootBundle;
import 'package:im_flutter_sdk/im_flutter_sdk.dart';
import 'package:yaml/yaml.dart';

/// 从 assets/config.yaml（软链到 native-auto-test/flutter_config.yaml）的 sdk_options 节
/// 读取配置并构建与 EMOptions.toJson() 对齐的初始化 Map。
///
/// 运行时直接从 asset 读取，无需代码生成步骤。
/// 修改 native-auto-test/flutter_config.yaml 后重新编译即可生效。
class SdkConfigLoader {
  SdkConfigLoader._();

  static Future<EMOptions> loadOptions() async {
    final sdkOpts = await _loadSdkOptions();
    final appKey = sdkOpts['app_key']?.toString() ?? '';
    if (appKey.isEmpty) {
      throw StateError('config.yaml sdk_options.app_key 为空');
    }
    return EMOptions.withAppKey(
      appKey,
      autoLogin: _bool(sdkOpts, 'auto_login', true),
      debugMode: _bool(sdkOpts, 'debug_mode', false),
      enableDNSConfig: _bool(sdkOpts, 'enable_dns_config', true),
      enableAutoSyncContacts: _bool(
        sdkOpts,
        'enable_auto_sync_contacts',
        false,
      ),
      requireAck: _bool(sdkOpts, 'require_ack', true),
      usingHttpsOnly: false,
      restServer: _str(sdkOpts, 'rest_server'),
      imServer: _str(sdkOpts, 'im_server'),
      imPort: _int(sdkOpts, 'im_port'),
      webSocketServer: _str(sdkOpts, 'web_socket_server'),
      webSocketPort: _int(sdkOpts, 'web_socket_port'),
      syncDataWebSocketServer: _str(sdkOpts, 'sync_data_web_socket_server'),
      syncDataWebSocketPort: _int(sdkOpts, 'sync_data_web_socket_port'),
      enableUserInfo: _boolNullable(sdkOpts, 'enable_user_info'),
    );
  }

  /// 异步加载 config.yaml asset 并构建 Client.init JSON。
  static Future<Map<String, dynamic>> loadOptionsJson() async {
    final yaml = await _loadConfigYaml();
    final sdkOpts = _sdkOptionsFromYaml(yaml);
    final webOpts = yaml['web'] as YamlMap?;

    final appKey = sdkOpts['app_key']?.toString() ?? '';
    if (appKey.isEmpty) {
      throw StateError('config.yaml sdk_options.app_key 为空');
    }

    final options = <String, dynamic>{
      'appKey': appKey,
      'autoLogin': _bool(sdkOpts, 'auto_login', true),
      'debugModel': _bool(sdkOpts, 'debug_mode', false),
      'enableDNSConfig': _bool(sdkOpts, 'enable_dns_config', true),
      'enableAutoSyncContacts': _bool(
        sdkOpts,
        'enable_auto_sync_contacts',
        false,
      ),
      'requireAck': _bool(sdkOpts, 'require_ack', true),
      'usingHttpsOnly': false,
      'pushConfig': <String, dynamic>{},
      'areaCode': -1,
      'webSdkMode': webOpts?['sdk_mode']?.toString() ?? 'real_sdk',
    };
    _putIfNotNull(options, 'restServer', _str(sdkOpts, 'rest_server'));
    _putIfNotNull(options, 'imServer', _str(sdkOpts, 'im_server'));
    _putIfNotNull(options, 'imPort', _int(sdkOpts, 'im_port'));
    _putIfNotNull(
      options,
      'webSocketServer',
      _str(sdkOpts, 'web_socket_server'),
    );
    _putIfNotNull(options, 'webSocketPort', _int(sdkOpts, 'web_socket_port'));
    _putIfNotNull(
      options,
      'syncDataWebSocketServer',
      _str(sdkOpts, 'sync_data_web_socket_server'),
    );
    _putIfNotNull(
      options,
      'syncDataWebSocketPort',
      _int(sdkOpts, 'sync_data_web_socket_port'),
    );
    _putIfNotNull(
      options,
      'enableUserInfo',
      _boolNullable(sdkOpts, 'enable_user_info'),
    );
    return options;
  }

  static Future<YamlMap> _loadConfigYaml() async {
    final content = await rootBundle.loadString('assets/config.yaml');
    return loadYaml(content) as YamlMap;
  }

  static Future<YamlMap> _loadSdkOptions() async {
    return _sdkOptionsFromYaml(await _loadConfigYaml());
  }

  static YamlMap _sdkOptionsFromYaml(YamlMap yaml) {
    final sdkOpts = yaml['sdk_options'] as YamlMap?;
    if (sdkOpts == null) {
      throw StateError('config.yaml 中未找到 sdk_options 节');
    }
    return sdkOpts;
  }

  static void _putIfNotNull(
    Map<String, dynamic> map,
    String key,
    Object? value,
  ) {
    if (value != null) {
      map[key] = value;
    }
  }

  static String? _str(YamlMap m, String key) {
    final v = m[key];
    if (v == null) return null;
    return v.toString();
  }

  static int? _int(YamlMap m, String key) {
    final v = m[key];
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse(v.toString());
  }

  static bool _bool(YamlMap m, String key, bool defaultValue) {
    final v = m[key];
    if (v == null) return defaultValue;
    if (v is bool) return v;
    return v.toString().toLowerCase() == 'true';
  }

  static bool? _boolNullable(YamlMap m, String key) {
    final v = m[key];
    if (v == null) return null;
    if (v is bool) return v;
    return v.toString().toLowerCase() == 'true';
  }
}
