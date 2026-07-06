# 项目总规范

本仓库同时是 Flutter SDK 工程和 SDK 自动化测试工程。当前日常主目标是用 `native-auto-test/` 驱动 `im_flutter_test/`，持续覆盖 Android、iOS、HMOS、Windows、Web 以及后续新增平台的真实 SDK 能力。

## 目录职责

| 目录 | 职责 | 是否发布 |
|---|---|---|
| `im_flutter_sdk/` | Flutter SDK 入口和发布包本体。 | 是 |
| `im_flutter_sdk_interface/` | Dart 调用契约、manager/method channel 契约。 | 是 |
| `im_flutter_sdk_android/`、`im_flutter_sdk_ios/`、`im_flutter_sdk_web/` | 各平台原生 SDK 封装层。 | 是 |
| `im_flutter_test/` | 被控测试 App，接收 WebSocket 控制、调用 SDK、转发事件和结果。 | 否 |
| `native-auto-test/` | Python 自动化测试主工程，负责用例、断言、覆盖统计和报告。 | 否 |

不要把测试专用桥接、账号配置、REST 凭据、pytest 断言或报告逻辑混入发布 SDK 包。

## 工作角色

### 测试人员

测试人员默认以 `native-auto-test/` 为主工作目录。目标是对原生 SDK 更新、Flutter SDK 适配和平台能力变更做功能测试、跨端 E2E、全量回归、版本覆盖和报告输出。

核心链路：

```text
native-auto-test
  -> WebSocket manager/cmd/info
  -> im_flutter_test(client1)
  -> im_flutter_sdk_interface
  -> im_flutter_sdk_xxx 平台封装层
  -> 真实原生 SDK
  -> SDK server
  -> 真实原生 SDK
  -> im_flutter_test(client2)
  -> WebSocket event/response
  -> native-auto-test 严格断言
```

测试覆盖必须证明真实 SDK 行为，不能用封装映射测试、夹具测试、本地适配器、mock 或单元测试结果冒充真实 E2E。发送端同步结果、接收端事件、服务端状态和本地状态都属于同一次 E2E 的可用证据。参数错误、权限错误、状态错误等反向 case 也必须经同一条控制和返回通道完成断言。

### 开发人员

开发人员可以修改全部目录。新增或修复 SDK 能力时，需要同步考虑 Dart API、interface、平台 MethodKeys/等价 key、平台实现、事件序列化和自动化用例。

跨端命名和语义默认以 Android 为基准；确有平台差异时，写入覆盖统计、版本能力策略或项目文档。

## 测试和报告要求

- 多端互测必须显式写真实平台和设备，例如 Android-A/Android-B、Android/iOS、Android/Web、android-tablet；不要用 `mobile` 掩盖平台统计。
- 新增 API 或新增平台时，先确认真实原生 SDK API，再确认 Flutter 封装层是否暴露，最后补自动化映射和真实 E2E 用例。
- 用例不能只覆盖成功路径；需要覆盖关键参数、边界、错误、事件、服务端状态或本地状态。
- 如果 DNS、SDK 初始化或登录整体失败，后续 API 用例没有意义，应直接报告环境失败。
- 测试报告至少包含两张表：
  1. SDK API 级覆盖表：以原生 SDK API 为主线，记录平台、SDK 版本、支持状态、封装状态、真实 E2E 覆盖状态、关联用例和中文原因。该表用于发版前对齐各端 API。
  2. 测试用例结果表：以执行为主线，按日期时间、运行 ID、平台、设备组合、用例、结果、失败摘要、关联 API、日志路径和 HTML 报告路径记录。该表用于查看本次发版测试执行结果。
- 生成产物统一放在 `native-auto-test/out/`，平台日志放在 `native-auto-test/out/log/<platform>/`，按日期时间和目标平台区分文件名。

## 配置和版本策略

- `native-auto-test/config.yaml` 是本地敏感配置，可包含 app key、REST 凭据和 SDK options，不应提交。
- SDK 版本、平台能力差异、版本差异暂不覆盖、平台专属能力、SDK 下载地址或源码地址等写入 `native-auto-test/config/sdk_version_capability_policy.yaml`。
- Android 4.23 只是当前追平阶段的本次基线，不是永久基线。SDK 回归或切换版本时，通过当前测试版本动态生成有效覆盖策略，不在用例里散落硬编码跳过逻辑。

## Skill 和文档

- 项目使用默认 skills 目录。
- 当前保留两个项目 skill：`native-auto-test-framework`、`android-api-coverage`。
- WebSocket、REST 用户、Contact flow 等可执行工具放在 `native-auto-test/scripts/`，不要为它们创建独立 skill。
- SDK E2E、跨平台互测、新 API/新平台适配、覆盖统计、报告和回归的 agent 执行规则统一写入 `native-auto-test-framework` skill；不要再维护平行的 workflow spec。
- 只有存在独立触发条件和可复用方法时才新增 skill。
- 子目录可以有自己的 `AGENTS.md`。规则优先级为：用户最新指令 > 更深层目录 `AGENTS.md` > 本文件。

## 常用校验

- 测试端：`cd im_flutter_test && flutter analyze && flutter build apk --debug`
- iOS 测试端：`cd im_flutter_test && flutter build ios --simulator`
- 发布 SDK 自检：`cd im_flutter_sdk && flutter analyze`
- 自动化测试：`cd native-auto-test && make help`
