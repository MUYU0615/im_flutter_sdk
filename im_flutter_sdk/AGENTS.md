# im_flutter_sdk 代理规则

## 目录职责
`im_flutter_sdk/` 是发布层 Flutter 联合插件入口，对外暴露 `package:im_flutter_sdk/im_flutter_sdk.dart`，并把 Android、iOS、OHOS 等平台实现挂到同一个 SDK 包下。

这个目录代表发布 SDK 的 Dart API 表面，不是自动化测试脚手架目录。

## 可修改范围
- SDK 版本升级、CHANGELOG 驱动的 Dart API 适配。
- 公开 manager、model、enum、method key、event key 的真实 SDK 能力补齐。
- 与 Android/iOS 原生 wrapper 一致的参数、返回值、事件模型调整。
- 示例工程仅用于验证 SDK 使用方式，不放自动化测试主逻辑。

## 不应放在这里
- WebSocket 桥接逻辑、测试连接 UI、测试账号配置、测试媒体准备逻辑。
- pytest 用例、测试断言、覆盖矩阵、REST 测试辅助。
- 只服务自动化测试且对 App 开发者无意义的 API。

## 相关目录
- `../im_flutter_sdk_interface/` 定义平台插件共享接口。
- `../im_flutter_sdk_android/` 和 `../im_flutter_sdk_ios/` 是平台实现。
- `../im_flutter_test/` 是测试专用 App，通过公开 API/interface 调用 SDK。
- `../native-auto-test/` 是自动化测试主工程。

## 常用校验
- 发布 SDK 自检：`cd im_flutter_sdk && flutter analyze`
- 依赖/构建总校验：`im_flutter_sdk/scripts/speckit.sh check`
