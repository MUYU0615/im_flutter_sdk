# im_flutter_sdk_ios 代理规则

## 目录职责
`im_flutter_sdk_ios/` 是 Flutter SDK 的 iOS 平台插件实现。这里负责把 Dart/interface 的 method call 映射到 iOS 原生 IM SDK，并把 iOS 回调序列化回 Dart。

iOS 需要跟 Android 命名、method key、event key、字段结构保持一致；如有差异，以 Android 为准。

## 可修改范围
- `ios/Classes/` 下的 wrapper、helper、listener、method key。
- iOS 原生依赖版本、本地 `.xcframework` 或远程 Pod 依赖配置。
- 与真实 iOS SDK 能力对应的参数解析、返回值序列化、事件派发。

## 不应放在这里
- Python 测试用例和测试断言。
- Flutter 测试 App 的 WebSocket 桥接逻辑。
- 只服务测试、不能映射到真实 iOS SDK 的能力。

## 依赖规则
- 本地依赖使用 `ios/HyphenateChat.xcframework` 和 `ios/ShengwangInfra_iOS/aosl.xcframework`。
- 远程依赖使用 podspec 中的 `HyphenateChat` 与 `ShengwangChat_iOS`。
- 不使用环境变量开关；通过编辑 `ios/im_flutter_sdk_ios.podspec` 手动切换本地/远程依赖。
- vendored frameworks 和远程 Pod 依赖只能启用一种。

## 相关目录
- Dart API 和 event key 对齐：`../im_flutter_sdk/lib/src/`
- Android 命名基准：`../im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/`
- 依赖规范：`../docs/specs/dependency-spec.md`
- API 适配规范：`../docs/specs/api-adaptation-spec.md`

## 常用校验
- 规范检查：`im_flutter_sdk/scripts/speckit.sh check`
- Pod 安装：`im_flutter_sdk/scripts/speckit.sh ios`
- iOS 模拟器构建：`im_flutter_sdk/scripts/speckit.sh ios-build`
