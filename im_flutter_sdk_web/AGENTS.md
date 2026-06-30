# im_flutter_sdk_web 代理规则

## 目录职责
`im_flutter_sdk_web/` 是 Flutter SDK Web 平台适配区，用于让 `im_flutter_test/` 的 Web 被测端通过同一套 interface 和 WebSocket JSON 协议参与自动化回归。

Web 当前按 capability 逐步补齐，不应假装与 Android/iOS 已完全等价。

## 可修改范围
- Web 平台 plugin 注册、manager adapter、Web SDK2 调用映射。
- Web 专属 capability、unsupported/pending/different 行为的稳定表达。
- Web real E2E 所需的最小真实 API 适配。

## 不应放在这里
- Python pytest 用例和断言。
- `im_flutter_test/` 的桥接 UI 或 WebSocket 通用协议。
- Android/iOS 原生平台实现。
- 为通过测试而伪造真实 Web SDK 不支持的成功结果。

## 相关目录
- Web 被测 App 入口：`../im_flutter_test/`
- 自动化测试与 Web capability：`../native-auto-test/`
- 共享接口：`../im_flutter_sdk_interface/`
- Web 适配计划和规范：`websdk2/`

## 常用校验
- Web 插件自检：`cd im_flutter_sdk_web && flutter analyze`
- Web 自动化基线通常从 `../native-auto-test/` 执行，例如 `make web-e2e` 或 `make web-real-full-baseline`。
