# im_flutter_sdk_interface 代理规则

## 目录职责
`im_flutter_sdk_interface/` 是平台插件共享接口层。它定义 Flutter 侧调用平台实现的稳定契约，包括 `Client.instance`、manager 入口和 `ManagerMixin.callNativeMethod`。

自动化测试桥接和平台插件都依赖这里的调用契约，因此这里的改动影响 Android、iOS、Web 和测试 App。

## 可修改范围
- 平台实现共享的抽象接口、manager mixin、method channel 契约。
- 为真实 SDK 能力补齐所需的接口入口。
- 多平台一致性所需的最小兼容适配。

## 不应放在这里
- 具体 Android/iOS/Web 原生实现。
- WebSocket 桥接协议、pytest 用例、测试断言。
- 只服务单个测试用例、没有 SDK 契约意义的 helper。

## 相关目录
- 发布 SDK 聚合入口：`../im_flutter_sdk/`
- Android 实现：`../im_flutter_sdk_android/`
- iOS 实现：`../im_flutter_sdk_ios/`
- 测试 App 使用该接口执行 JSON bridge：`../im_flutter_test/`

## 常用校验
- 接口包自检：`cd im_flutter_sdk_interface && flutter analyze`
- 受影响平台需继续执行对应平台构建或测试。
