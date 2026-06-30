# im_flutter_sdk_android 代理规则

## 目录职责
`im_flutter_sdk_android/` 是 Flutter SDK 的 Android 平台插件实现。这里负责把 Dart/interface 的 method call 映射到 Android 原生 IM SDK，并把 Android 回调序列化回 Dart。

Android 命名是三端对齐基准；当 Android、iOS、Dart 命名不一致时，以 Android 为准。

## 可修改范围
- `android/src/main/java/com/easemob/im_flutter_sdk/` 下的 wrapper、helper、listener、method key。
- Android 原生依赖版本或本地 jar/so 接入配置。
- 与真实 Android SDK 能力对应的参数解析、返回值序列化、事件派发。

## 不应放在这里
- Python 测试用例和测试断言。
- Flutter 测试 App 的 WebSocket 桥接逻辑。
- 只为绕过测试而添加、不能映射到真实 Android SDK 的能力。

## 依赖规则
- 本地依赖目录固定为 `android/libs/easemob-sdk/`，目录名不带版本号。
- jar 文件名可带版本号，例如 `hyphenatechat_4.23.0.jar`。
- 不使用 `IM_USE_LOCAL_DEPS` 等环境变量开关；通过编辑 `android/build.gradle` 手动切换本地/远程依赖。
- 本地和远程依赖只能启用一种。

## 相关目录
- Dart API 和 method key 对齐：`../im_flutter_sdk/lib/src/`
- iOS 同步实现：`../im_flutter_sdk_ios/ios/Classes/`
- 依赖规范：`../docs/specs/dependency-spec.md`
- API 适配规范：`../docs/specs/api-adaptation-spec.md`

## 常用校验
- 规范检查：`im_flutter_sdk/scripts/speckit.sh check`
- Android 示例构建：`im_flutter_sdk/scripts/speckit.sh android`
