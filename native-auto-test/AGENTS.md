# native-auto-test 代理规则

## 项目角色

`native-auto-test/` 是当前自动化测试主工程，目标是逐步覆盖完整 Flutter SDK API。它通过 WebSocket JSON 消息驱动 `../im_flutter_test/`，并把 `../im_flutter_sdk/`、`../im_flutter_sdk_android/`、`../im_flutter_sdk_ios/`、`../im_flutter_sdk_web/`、后续 HMOS/Windows 等平台包和 `../im_flutter_sdk_interface/` 视为被测 SDK。

日常工作默认在本目录展开：用例设计、pytest 实现、REST 准备辅助、WebSocket 工具、覆盖矩阵、能力门禁和报告。

在“测试人员”角色下，本目录是主要工作目录，也是测试报告和覆盖统计的唯一归口。测试人员通常不直接从 `../im_flutter_sdk/` 开始工作；除发布 SDK 入口外，其余目录都服务于自动化测试资产和原生 SDK 回归验证。

本目录驱动的完整链路是：
`native-auto-test` 通过 WebSocket 发送 `manager/cmd/info` JSON → `../im_flutter_test` 的 client1 接收控制消息 → `../im_flutter_sdk_interface` 分发到对应 manager/platform → `../im_flutter_sdk_xxx` 平台层解析参数并调用真实原生 SDK API → 真实 SDK server → client2 的真实原生 SDK → `im_flutter_test` 把 SDK callback/event 通过 WebSocket 返回 → 本目录 pytest 对 client1 同步结果、client2 接收事件、服务端状态和本地状态做断言。

反向 case 也走同一条通道：例如缺参、非法类型、权限错误、状态冲突等错误应由真实 SDK 或封装层返回到 WebSocket，再由 pytest 断言稳定错误码、错误描述和不产生副作用。

常规 E2E 不是单客户端自测，而是多客户端互测：例如 Android-A 与 Android-B 互发消息、互相处理好友/群/聊天室/presence 事件，并分别断言发送端、接收端和服务端状态。新增平台后，也应扩展为跨平台互测，而不是只跑平台内单端 case。

- 优先通过 Python 发送新的 `manager/cmd/info` 请求来增加 SDK 覆盖。
- 不要为了让测试更容易而修改发布 SDK。
- 只有桥接端缺少通用事件、配置、媒体支持，或真实 SDK/interface/platform wrapper 未暴露 App 开发者应有能力时，才升级到本目录之外处理。
- 核心目标是跨平台 E2E：Android、iOS、HMOS、Windows、Web 以及后续新增平台应尽量通过同一套用例互相验证同一 SDK 能力，而不是分别维护孤立用例。

## 仓库约定

- 技能
  - 项目使用默认 skills 目录。
  - `native-auto-test-framework` 是真实 SDK E2E、跨端互测、SDK 覆盖、新 API/新平台适配、用例设计、报告和回归的主技能。
  - `android-api-coverage` 只保留 Android 原生 SDK API 覆盖统计专项流程。
  - 新增 skill 前先判断是否已有独立触发条件和可复用流程；SDK E2E 通用流程统一收敛到 `native-auto-test-framework`。
  - WebSocket、REST 用户、Contact flow 等可执行工具放在 `scripts/`，不要为它们单独保留旧 skill。
  - 不要在子目录下散落创建额外 skill 目录。需要个人全局技能时使用用户自己的全局技能目录。
- 文档
  - 文档放在 `docs/` 下。
  - `docs/` 只放长期人类说明和少量设计说明；agent 执行流程优先写入项目 skill。
- 测试
  - 可执行测试只放在 `tests/` 下，不要把文档放进 `tests/`。
- 工具
  - Makefile 暴露常用任务（`make help`）。WS 调用、REST 用户操作、联系人流程优先使用这些 target。
  - Android 代表性真实基线优先使用 `make android-real-sanity`；不要每次手拼同一组 sanity case。
- 编辑器与本地产物
  - `.cursor/`、`.DS_Store`、`allure-results/` 不是事实来源，需通过 `.gitignore` 忽略。
- 断言：禁止自证式 result 断言；优先断言信封字段 + 关键业务字段，或使用类型/条件与 ignore_keys。

## 目录边界

- `tests/`：只放可执行 pytest 用例。不要放文档或生成报告。
- `src/`：可复用 client、REST 辅助、断言辅助、topic/session 工具、覆盖率工具。
- `config/`：可复用能力与配置数据。不要提交真实密钥。
- `docs/`：长期人类说明和少量调查记录；生成报告不放在这里。
- `out/` 和 `allure-results/`：仅放生成产物。
- `scripts/`：可执行辅助工具，例如 WebSocket 调用、REST 用户准备、Contact flow。工具不是 skill。

当测试需要 Flutter 侧支持时，应修改 `../im_flutter_test/`，不要在本目录添加临时绕行逻辑。当测试发现 SDK 能力缺失时，先记录缺口，再通过根目录 API 适配流程修改 SDK 或平台包。

## 配置边界

- `config.yaml` 是 Python 控制端本地配置，可包含 REST 用户管理凭据，已被 `.gitignore` 忽略。
- SDK 初始化参数、指定服务器地址、DNS 开关等统一放在 `config.yaml` 的 `sdk_options`，由 `src/tools/sdk_options_resolver.py` 校验并转换成 bridge `Client.init` JSON。
- Flutter 测试 App 不再打包 `sdk_options` 或客户端环境配置；`../im_flutter_test/assets/` 只允许放测试媒体等非敏感素材。
- 不要恢复 `flutter_config.yaml`、`../im_flutter_test/assets/config.yaml` 或 `../im_flutter_test/lib/sdk_config_loader.dart`。这些属于旧的 App 内置配置路径，会和 WebSocket 下发 `Client.init` 冲突。
- runner 必须在 bridge ready 后、登录和用例执行前下发 `Client.init`。若 init 失败，应直接中止本次真实 E2E。
- Web/Android/iOS E2E 默认都是真实 SDK 全流程。封装映射/本地适配器类测试只能作为独立执行层统计，不能算真实 E2E 覆盖。

## 跨平台 E2E 覆盖规则

- 平台维度必须显式：Android、iOS、HMOS、Windows、Web 以及后续新增平台都要能表达独立支持状态。`mobile` 只能作为兼容别名或设备组，不应替代 Android/iOS 统计。
- 每个平台都有自己的 MethodKeys 或等价方法表。新增平台或新 API 覆盖时，先从 MethodKeys/等价方法表建立 API 清单，再映射到 `manager/cmd/info`。
- 用户提供“需要增加的方法”后，先补充对应 MethodKeys 或等价 key 清单，再补可执行 E2E case，然后扩展到其他所有平台的支持状态统计。
- 覆盖一个方法时，不能只写“默认参数成功”用例。必须补充参数矩阵，验证不同参数组合会产生可观察差异：响应字段、服务端状态、接收端事件、本地状态、错误码或 unsupported 统计。
- 对可选参数、对象参数、枚举参数、边界值、非法值分别设计 case。稳定字段必须严格断言；不稳定字段才允许最小化 ignore。
- 如果确认某个平台不存在该方法、未暴露 key、wrapper 未实现、真实 SDK 不支持或环境不适用，不要伪造成成功；需要记录成明确统计分类。
- 平台支持统计、覆盖报告、审计报告统一输出到 `/Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/native-auto-test/out`。生成物只放 `out/`，不放进 `tests/`。
- 完整测试报告必须能回答：哪些 API 已测、哪些用例已跑、哪些平台通过、哪些失败、失败原因是什么、哪些未实现/不适用/待确认。HTML 报告、CSV/HTML 覆盖统计和平台日志都应能按平台、SDK 版本、run_id 和时间定位。
- 测试视角必须维护两类表，并在报告中可查看：
  1. SDK API 级覆盖表：以原生 SDK API 为主线，字段至少包含 native class/method、manager、cmd/API、平台、平台 MethodKey/等价 key、SDK 版本、SDK 来源/下载地址、支持状态、封装状态、真实 E2E 覆盖状态、关联 case、未实现/不适用/失败原因。
  2. 测试用例结果信息表：以测试执行为主线，字段至少包含执行日期时间、用例路径、用例名称、关联 API、执行平台、设备组合、run_id、结果、失败摘要、日志路径、HTML 报告路径、重跑建议。
- 两张表职责不同：SDK 功能覆盖表回答“SDK 哪些能力覆盖到了”；测试用例结果信息表回答“这次执行哪些用例过了或失败了”。不能只保留 pytest HTML 而缺少 SDK 功能覆盖表，也不能只保留 API 覆盖表而缺少用例级执行结果。
- 每次通过统一 runner 跑用例后，都必须刷新对应平台的 API 覆盖表和本次测试结果表。Web 当前仍会刷新 `out/platform-api-support.html` 和 `out/platform-api-support.csv`；Android 当前以 `out/android-<version>-native-api-coverage.*` 为 API 级覆盖表。
- 现有统计入口优先复用 `src/tools/platform_api_support_report.py`、`src/tools/android_423_api_coverage_report.py`、Web coverage/report 相关工具和 `config/*coverage*.yaml`。新增统计字段时要保持“支持、未找到、找到但未实现、已实现但未通过、不适用、待确认”等状态可区分。

## Suite 分层规则

- 默认全量应是“目标平台真实 E2E”，即通过真实 SDK/真实服务/真实桥接验证业务闭环。
- wrapper JSON 映射、本地存储、合成事件、夹具、单元测试类用例必须单独标记，不能混入默认真实 E2E 全量。
- Suite 维度应按“平台 × 执行层”组织：
  - 平台：`android`、`ios`、`web`、后续新增平台；`mobile` 仅作兼容别名。
  - 执行层：`real_e2e`、`wrapper_mapping`、`fixture`、`capability`、`unit`。
- 同一个 API 的用例可以有多层测试，但覆盖统计必须以真实 E2E 为准；`wrapper_mapping`/unit 只能证明 wrapper JSON 映射或本地逻辑，不能证明 SDK 真实能力。
- Web 的 `local_adapter` 只是当前实现封装映射层的一种兼容执行模式；Android/iOS 也可能有桥接层映射测试，必须用 `wrapper_mapping` 统一隔离。

## 用例编写代理（全局）

本节定义跨模块编写和维护测试用例的端到端流程。完整 SDK E2E agent 流程见 `native-auto-test-framework` skill。

- 事实来源
  - 规范：`.agents/skills/native-auto-test-framework/SKILL.md`。
  - SDK key：`src/sdk_api/cmd_keys.py`、`src/sdk_api/event_keys.py`。
  - 平台 MethodKeys：Android `../im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`，iOS `../im_flutter_sdk_ios/ios/Classes/MethodKeys.h`，Web/新增平台使用其等价方法表或 capability 配置。
  - 断言辅助：`src/tools/assertions.py`、`src/tools/response_match.py`。

- 工作流（严格优先 + 发现循环）
  - 技能门禁：修改前先调用 `using-superpowers`，检查适用技能并确认流程。
  - 范围确认：把 Manager/Cmd 和 Event 名称映射到 Dart；让 `info` 结构与 model 对齐。
  - 草拟用例：根据工作流规范和 API 统计缺口，为每个 API 至少设计一条正常用例和一条错误/边界用例。
  - 实现：可执行测试只放在 `tests/`；不要在 `tests/` 下写文档。
  - 断言：成功使用 `assert_api.assert_response_matches`，失败使用 `assert_api.assert_error`；忽略集保持最小。
  - 发现运行：`CASES_DISCOVER=1 WS_DEBUG=1 pytest -q <path>::<case> -s`，捕获实际值与预期差异。
  - 收紧：把稳定字段写入 `expected`，减少 `ignore_keys`，再无环境变量严格复跑。

- 事件与语义
  - 始终断言 `type="event"`、`eventType` 和关键 `data` 字段。Chat 场景需遵守发送/接收中的 convId 语义。
  - 同步响应：默认只忽略 `sequence`。事件：可忽略时间类字段（`timestamp/serverTime/localTime`）和 `sequence`。

- 错误归一
  - 对已稳定的 code/文案进行冻结；未知错误先发现再冻结。

- 调试策略
  - 不要在测试中添加 debug 开关；调试开关仅限 WS 层（`WS_DEBUG`、`WS_RELAX`）。

- 常用命令
  - 单例发现：`CASES_DISCOVER=1 WS_DEBUG=1 pytest -q tests/<domain>/test_<topic>.py::test_<name> -s`
  - 模块严格：`pytest -q tests/<domain>/test_<topic>.py -s`
  - 全量：`pytest -q tests -s`
  - Android sanity：`make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5558 --run-id <run_id>"`
  - Android 正式发版：`make e2e-full-run ARGS="--client android:a@<version> --client android:b@<version> --run-id <run_id> --platform-matrix android-android --install-mode clean --matrix-mode pair --account-mode fresh"`
  - Android 单点调试：`make android-real-e2e ARGS="--device-ids emulator-5554 emulator-5558 --run-id <run_id> -- tests/<path>::<case> --target-platform android -m real_e2e -q"`
