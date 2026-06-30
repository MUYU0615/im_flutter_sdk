# native-auto-test 代理规则

## 项目角色

`native-auto-test/` 是当前自动化测试主工程，目标是逐步覆盖完整 Flutter SDK API。它通过 WebSocket JSON 消息驱动 `../im_flutter_test/`，并把 `../im_flutter_sdk/`、`../im_flutter_sdk_android/`、`../im_flutter_sdk_ios/`、`../im_flutter_sdk_interface/` 视为被测 SDK。

日常工作默认在本目录展开：用例设计、pytest 实现、REST 准备辅助、WebSocket 工具、覆盖矩阵、能力门禁和报告。

在“测试人员”角色下，本目录是主要工作目录，也是测试报告和覆盖统计的唯一归口。测试人员通常不直接从 `../im_flutter_sdk/` 开始工作；除发布 SDK 入口外，其余目录都服务于自动化测试资产和原生 SDK 回归验证。

本目录驱动的完整链路是：
`native-auto-test` 通过 WebSocket 发送 `manager/cmd/info` JSON → `../im_flutter_test` 接收控制消息 → `../im_flutter_sdk_interface` 分发到对应 manager/platform → `../im_flutter_sdk_xxx` 平台层解析参数并调用真实原生 SDK API → 同步结果或 SDK 回调经 `im_flutter_test` 返回 WebSocket → 本目录 pytest 对结果、事件、服务端状态和本地状态做断言。

常规 E2E 不是单客户端自测，而是多客户端互测：例如 Android-A 与 Android-B 互发消息、互相处理好友/群/聊天室/presence 事件，并分别断言发送端、接收端和服务端状态。新增平台后，也应扩展为跨平台互测，而不是只跑平台内单端 case。

- 优先通过 Python 发送新的 `manager/cmd/info` 请求来增加 SDK 覆盖。
- 不要为了让测试更容易而修改发布 SDK。
- 只有桥接端缺少通用事件、配置、媒体支持，或真实 SDK/interface/platform wrapper 未暴露 App 开发者应有能力时，才升级到本目录之外处理。
- 核心目标是跨平台 E2E：Android、iOS、Web 以及后续新增平台应尽量通过同一套 case 互相验证同一 SDK 能力，而不是分别维护孤立用例。

## 仓库约定

- 技能
  - 所有 Codex 技能放在 `skills/` 下。
  - 每个技能包含 `SKILL.md`，可选包含 `openai.yaml`、`scripts/`、`references/`、`assets/`。
  - `skills/native-auto-test-framework` 是 SDK 覆盖、跨平台一致性、用例设计、辅助工具使用、release note 映射的主技能。`skills/im-*` 和 `skills/release-note-case-mapping` 等旧技能目录作为兼容或辅助入口。
- 文档
  - 文档放在 `docs/` 下。
  - `docs/agents/AGENTS.zh.md` 是唯一权威 Agent 文档（中文）。
  - `docs/spec/` 存放可执行测试规范与速查；新增规范统一写入 `docs/agents/AGENTS.zh.md`。
- 测试
  - 可执行测试只放在 `tests/` 下，不要把文档放进 `tests/`。
- 工具
  - Makefile 暴露常用任务（`make help`）。WS 调用、REST 用户操作、联系人流程优先使用这些 target。
- 编辑器与本地产物
  - `.cursor/`、`.DS_Store`、`allure-results/` 不是事实来源，需通过 `.gitignore` 忽略。
- 不要在本仓库创建 `.agents/`；仓库内技能使用 `skills/`。需要用户全局技能时使用 `$CODEX_HOME/skills`。

- Assertions: 禁止自证式 result 断言；优先断言信封字段 + 关键业务字段，或使用类型/条件与 ignore_keys。

参见：`docs/agents/AGENTS.zh.md`（中文总规范）。

## 目录边界

- `tests/`：只放可执行 pytest 用例。不要放文档或生成报告。
- `src/`：可复用 client、REST 辅助、断言辅助、topic/session 工具、覆盖率工具。
- `config/`：可复用能力与配置数据。不要提交真实密钥。
- `docs/`：代理规则、用例规范、覆盖报告、调查记录。
- `skills/`：本自动化测试工程的仓库内 Codex 技能。
- `out/` 和 `allure-results/`：仅放生成产物。

当测试需要 Flutter 侧支持时，应修改 `../im_flutter_test/`，不要在本目录添加临时绕行逻辑。当测试发现 SDK 能力缺失时，先记录缺口，再通过根目录 API 适配流程修改 SDK 或平台包。

## 配置边界

- `config.yaml` 是 Python 控制端本地配置，可包含 REST 用户管理凭据，已被 `.gitignore` 忽略。
- `flutter_config.yaml` 是 Flutter 测试 App 可见配置，会通过 `../im_flutter_test/assets/config.yaml` 打包进测试 App。
- `flutter_config.yaml` 只能包含客户端运行必需配置，例如 `websocket`、`web.sdk_mode`、`sdk_options`。不得包含 `rest_api`、`client_secret`、`auth_token` 等控制端凭据。
- Web E2E 默认 `web.sdk_mode=real_sdk`。只有明确做 wrapper JSON 映射验证时，才可手动指定 Web 兼容模式 `local_adapter`。
- 修改客户端连接目标或 SDK 初始化参数时，应同步 `config.yaml` 与 `flutter_config.yaml` 中对应的非敏感字段。

## 跨平台 E2E 覆盖规则

- 平台维度必须显式：Android、iOS、Web 以及后续新增平台都要能表达独立支持状态。`mobile` 只能作为兼容别名或设备组，不应替代 Android/iOS 统计。
- 每个平台都有自己的 MethodKeys 或等价方法表。新增平台或新 API 覆盖时，先从 MethodKeys/等价方法表建立 API 清单，再映射到 `manager/cmd/info`。
- 用户提供“需要增加的方法”后，先补充对应 MethodKeys 或等价 key 清单，再补可执行 E2E case，然后扩展到其他所有平台的支持状态统计。
- 覆盖一个方法时，不能只写“默认参数成功”用例。必须补充参数矩阵，验证不同参数组合会产生可观察差异：响应字段、服务端状态、接收端事件、本地状态、错误码或 unsupported 统计。
- 对可选参数、对象参数、枚举参数、边界值、非法值分别设计 case。稳定字段必须严格断言；不稳定字段才允许最小化 ignore。
- 如果确认某个平台不存在该方法、未暴露 key、wrapper 未实现、真实 SDK 不支持或环境不适用，不要伪造成成功；需要记录成明确统计分类。
- 平台支持统计、覆盖报告、审计报告统一输出到 `/Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/native-auto-test/out`。生成物只放 `out/`，不放进 `tests/`。
- 完整测试报告必须能回答：哪些 API 已测、哪些 case 已跑、哪些平台通过、哪些失败、失败原因是什么、哪些未实现/不适用/待确认。HTML 报告、CSV/HTML 覆盖统计和平台日志都应能按平台定位。
- 测试视角必须维护两类表，并在报告中可查看：
  1. SDK 功能覆盖表：以 SDK 能力为主线，字段至少包含 manager、cmd/API、平台、平台 MethodKey/等价 key、SDK 版本、支持状态、实现状态、真实 E2E 覆盖状态、关联 case、未实现/不适用/失败原因。
  2. 测试 case 结果信息表：以测试执行为主线，字段至少包含 case 路径、case 名称、关联 API、执行平台、设备组合、run_id、结果、失败摘要、日志路径、HTML 报告路径、重跑建议。
- 两张表职责不同：SDK 功能覆盖表回答“SDK 哪些能力覆盖到了”；测试 case 结果信息表回答“这次执行哪些 case 过了或失败了”。不能只保留 pytest HTML 而缺少 SDK 功能覆盖表，也不能只保留 API 覆盖表而缺少 case 级执行结果。
- 每次通过统一 runner 跑 Web case 后，都必须刷新 `out/platform-api-support.html` 和 `out/platform-api-support.csv`；这两个文件是当前快照产物，不作为手工维护的基础源。
- 现有统计入口优先复用 `src/tools/platform_api_support_report.py`、Web coverage/report 相关工具和 `config/*coverage*.yaml`。新增统计字段时要保持“支持、未找到、找到但未实现、已实现但未通过、不适用、待确认”等状态可区分。

## Suite 分层规则

- 默认全量应是“目标平台真实 E2E”，即通过真实 SDK/真实服务/真实桥接验证业务闭环。
- wrapper JSON 映射、local store、synthetic event、fixture-only、unit 类用例必须单独标记，不能混入默认真实 E2E 全量。
- Suite 维度应按“平台 × 执行层”组织：
  - 平台：`android`、`ios`、`web`、后续新增平台；`mobile` 仅作兼容别名。
  - 执行层：`real_e2e`、`wrapper_mapping`、`fixture`、`capability`、`unit`。
- 同一个 API 的 case 可以有多层测试，但覆盖统计必须以真实 E2E 为准；`wrapper_mapping`/unit 只能证明 wrapper JSON 映射或本地逻辑，不能证明 SDK 真实能力。
- Web 的 `local_adapter` 只是当前实现 wrapper mapping 层的一种兼容执行模式；Android/iOS 也可能有桥接层映射测试，必须用 `wrapper_mapping` 统一隔离。

## 用例编写代理（全局）

本节定义跨模块编写和维护测试用例的端到端流程，是 `docs/spec/CASES_SPEC.md` 的补充。

- 事实来源
  - 规范：`docs/spec/CASES_SPEC.md`（全局规则 + 各领域速查）。
  - SDK key：`src/sdk_api/cmd_keys.py`、`src/sdk_api/event_keys.py`。
  - 平台 MethodKeys：Android `../im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java`，iOS `../im_flutter_sdk_ios/ios/Classes/MethodKeys.h`，Web/新增平台使用其等价方法表或 capability 配置。
  - 断言辅助：`src/tools/assertions.py`、`src/tools/response_match.py`。

- 工作流（严格优先 + 发现循环）
  - 技能门禁：修改前先调用 `using-superpowers`，检查适用技能并确认流程。
  - 范围确认：把 Manager/Cmd 和 Event 名称映射到 Dart；让 `info` 结构与 model 对齐。
  - 草拟用例：根据 `docs/spec/CASES_SPEC.md` 的领域速查，为每个 API 至少设计一条正常用例和一条错误/边界用例。
  - 实现：可执行测试只放在 `tests/`；不要在 `tests/` 下写文档。
  - 断言：成功使用 `assert_api.assert_response_matches`，失败使用 `assert_api.assert_error`；忽略集保持最小。
  - 发现运行：`CASES_DISCOVER=1 WS_DEBUG=1 pytest -q <path>::<case> -s`，捕获实际值与预期差异。
  - 收紧：把稳定字段写入 `expected`，减少 `ignore_keys`，再无环境变量严格复跑。

- 事件与语义
  - 始终断言 `type="event"`、`eventType` 和关键 `data` 字段。Chat 场景需遵守发送/接收中的 convId 语义。
  - 同步响应：默认只忽略 `sequence`。事件：可忽略时间类字段（`timestamp/serverTime/localTime`）和 `sequence`。

- 错误归一
  - 对 `docs/spec/CASES_SPEC.md` 中已稳定的 code/文案进行冻结；未知错误先发现再冻结。

- 调试策略
  - 不要在测试中添加 debug 开关；调试开关仅限 WS 层（`WS_DEBUG`、`WS_RELAX`）。

- 常用命令
  - 单例发现：`CASES_DISCOVER=1 WS_DEBUG=1 pytest -q tests/<domain>/test_<topic>.py::test_<name> -s`
  - 模块严格：`pytest -q tests/<domain>/test_<topic>.py -s`
  - 全量：`pytest -q tests -s`

## 子代理（按领域）

子代理文档放在 `docs/agents/` 下，结合领域代理规则与 `docs/spec/CASES_SPEC.md` 使用。它们定义本地检查清单和不变量。入口如下：

- Chat 用例代理：`docs/agents/chat/AGENTS.md`
- Contact 用例代理：`docs/agents/contact/AGENTS.md`

在某个领域内工作时，除本全局规则外，还要阅读对应子代理文档并遵守其检查清单。
