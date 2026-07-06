# im_flutter_test 代理规则

## 目录职责
`im_flutter_test/` 是自动化测试的被测设备 App。它通过 WebSocket JSON 协议接收 `native-auto-test/` 的请求，并转发到 `Client.instance` 和各 manager 的 `callNativeMethod(cmd, info)`。

这个目录是测试专用工程，不随 SDK 发布。

## 可修改范围
- WebSocket 桥接、topic/连接配置、设备启动参数。
- SDK 事件回调转发，例如 `lib/bridge/event_bridge_handler.dart`。
- 测试 App 需要的配置加载、默认媒体素材准备、平台启动 bootstrap。
- 为自动化测试提供的序列化辅助，但应保持通用和可解释。

## 不应放在这里
- pytest 用例、业务断言、覆盖率矩阵。
- 发布 SDK 的公开 API 实现。
- 原生 Android/iOS SDK wrapper 逻辑。
- 只为单个 case 硬编码的响应或断言。

## 桥接边界
- 新增 SDK API 用例时，优先只在 `../native-auto-test/` 发送新的 `manager/cmd/info`。
- 只有缺少事件转发、默认素材、配置能力或通用序列化辅助时，才修改本目录。
- 如发现 SDK/interface 未暴露真实能力，应回到发布 SDK 与平台包做全栈适配，而不是在测试 App 中伪造能力。

## 跨平台 E2E 支撑规则
- 本目录要保持 Android、iOS、Web 以及后续新增平台使用同一套 WebSocket JSON 协议接入测试。
- 桥接请求的核心语义是 `manager/cmd/info`，其中 `cmd` 应与对应平台 MethodKeys 或等价方法表保持一致。
- 新增平台时，先保证该平台能通过 `Client.instance`、manager、`callNativeMethod(cmd, info)` 或等价入口接入通用桥接，再由 `../native-auto-test/` 补覆盖和统计。
- 本目录只负责让不同平台被驱动、发送事件、返回真实结果；不同参数组合的严格断言、平台差异统计和覆盖报告属于 `../native-auto-test/`。
- 不允许为某个平台硬编码“测试成功”响应。平台不支持、未实现、未暴露或不适用时，应返回可被 Python 端稳定识别和统计的真实错误或 unsupported 结果。
- Android、iOS、Web 的桥接行为应尽量一致；若某个平台只能提供 wrapper mapping、local adapter 或 synthetic event，必须在 `../native-auto-test/` 的 suite/coverage 中单独标记，不能计入真实 E2E 覆盖。

## 配置边界
- 测试 App 不再打包 SDK 初始化配置；`assets/` 只允许放测试媒体等非敏感素材。
- SDK 初始化参数由 `../native-auto-test/config.yaml` 的 `sdk_options` 统一解析，并由 runner 在 WebSocket bridge ready 后通过 `Client.init` 下发。
- 不要把 `../native-auto-test/config.yaml`、REST 凭据、app secret、auth token 或 SDK 环境配置打包进 App。
- Flutter 端只关注 WebSocket 连接、设备标识、topic、事件转发和真实 SDK 调用。
- Web/Android/iOS E2E 默认都是真实 SDK 全流程；wrapper mapping/local adapter 类能力只能作为独立执行层统计，不能算真实 E2E。

## 相关目录
- Python 自动化测试主工程：`../native-auto-test/`
- SDK 公开 API：`../im_flutter_sdk/`
- 共享接口：`../im_flutter_sdk_interface/`
- Web 插件适配：`../im_flutter_sdk_web/`

## 常用校验
- 静态检查：`cd im_flutter_test && flutter analyze`
- Android 测试端构建：`cd im_flutter_test && flutter build apk --debug`
- iOS 测试端构建：`cd im_flutter_test && flutter build ios --simulator`
- Web 测试端运行：`cd im_flutter_test && flutter run -d chrome`
