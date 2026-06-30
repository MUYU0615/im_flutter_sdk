# Superpowers 主规范（总 Agent）

本仓库采用“总 Agent + 执行 Agent”结构：
- 总 Agent（本文件）：统一流程、命名、质量门槛和调用技能（skills）。
- 执行 Agent（三类）：
  1) 远程依赖更新与构建（Remote Deps Agent）
  2) 本地依赖更新与构建（Local Deps Agent）
  3) API/回调适配与一致性检查（API Adapt Agent）

通用规则
- 统一命名：若 Android/iOS/Dart 命名不一致，以 Android 为准；Dart 与 iOS 对齐。
- 依赖切换：不使用 IM_USE_LOCAL_DEPS 等开关；通过编辑构建文件进行“手动切换”，脚本仅在获得确认后代改。
- 工作视角：本仓库既是 Flutter SDK 工程，也是自动化测试工程。当前日常主目标是用 `native-auto-test/` + `im_flutter_test/` 逐步覆盖完整 SDK；`im_flutter_sdk/` 及平台包是被测对象和发布包，默认不承载测试脚手架。
- 文档先行：任何操作前先阅读/更新规范：
  - 依赖切换规范：docs/specs/dependency-spec.md
  - API 适配规范：docs/specs/api-adaptation-spec.md
  - 升级流程规范：docs/specs/upgrade-flow.md
  - speckit 使用：docs/skills/speckit.md
- 构建校验：自检通过 → Android assembleDebug → iOS pod install → iOS 模拟器 build。
- 交付标准：变更点列表、构建日志摘要（成功/失败）、必要的代码与文档补丁。

必用技能（在开始任何动作前先调用/遵循）
- using-superpowers：建立计划、清单与检查点（用户可在私有技能库中查看）。
- speckit：统一执行检查与构建（im_flutter_sdk/scripts/speckit.sh）。

执行 Agent 入口与职责
- Remote Deps Agent：docs/agents/remote-deps-agent.md，脚本 im_flutter_sdk/scripts/agents/remote_deps_agent.sh
- Local Deps Agent：docs/agents/local-deps-agent.md，脚本 im_flutter_sdk/scripts/agents/local_deps_agent.sh
- API Adapt Agent：docs/agents/api-adapt-agent.md，脚本 im_flutter_sdk/scripts/agents/api_adapt_agent.sh


---

## SDK 与测试端分离约定（重要）

为保证发布包干净，自动化测试的桥接逻辑与发布 SDK 已拆分。三个目录职责如下：

| 目录 | 职责 | 是否随发布 |
|---|---|---|
| `im_flutter_sdk/`（含 `_android`/`_ios`/`_interface`） | 发布层 SDK（联合插件本体）。**测试时不改动，仅版本升级**。 | 是 |
| `im_flutter_test/` | 被测设备 App：承载 WebSocket 桥接、事件转发、配置加载、媒体素材、连接 UI。`path` 依赖 `im_flutter_sdk`。 | 否（测试专用） |
| `native-auto-test/` | Python 用例端，通过同一 WebSocket + topic 驱动 `im_flutter_test`。 | 否 |

## 两种工作角色（重要）

本仓库同时支持“测试人员”和“开发人员”两种角色。开始任务前先判断当前角色，因为两种角色的资产边界不同。

### 角色一：测试人员

测试人员的核心目标是：在原生 SDK 更新、Flutter SDK 适配、平台能力变更或代码提测时，完成对应能力的自动化测试、全量回归和版本覆盖测试，并输出可追踪报告。

测试人员视角下：
- `im_flutter_sdk/` 是发布 SDK 入口和被测对象，默认不作为测试资产随意修改。
- 除 `im_flutter_sdk/` 之外，其余目录都可以视为测试资产或测试支撑资产，包括：
  - `native-auto-test/`：自动化测试主工程，负责用例、断言、REST 准备、覆盖统计、报告生成。
  - `im_flutter_test/`：被控测试 App，负责接收长链接控制、转发请求、转发事件、返回真实 SDK 结果。
  - `im_flutter_sdk_interface/`：桥接调用契约和 manager/method channel 契约。
  - `im_flutter_sdk_android/`、`im_flutter_sdk_ios/`、`im_flutter_sdk_web/` 等 `im_flutter_sdk_xxx/`：各平台原生 SDK wrapper，是原生 SDK 能力适配与回归验证的重点。
- “原生 SDK”在本仓库语境中指各平台包 `im_flutter_sdk_xxx/` 背后的平台 SDK 能力，其中 `xxx` 是 Android、iOS、Web、OHOS 或后续新增平台。

测试人员执行提测覆盖时，应按完整链路工作：
1. 在各平台补齐或确认 MethodKeys / 等价方法表。
2. 在平台 wrapper 中把 `manager/cmd/info` 映射到真实原生 SDK API。
3. 通过 `im_flutter_sdk_interface/` 保持 Flutter 侧调用契约一致。
4. 在 `im_flutter_test/` 通过长链接接收 `native-auto-test` 发来的 JSON，并调用 interface/manager。
5. 平台层处理 JSON 参数、调用真实 SDK、序列化同步结果或事件。
6. `im_flutter_test` 把结果/事件通过长链接返回。
7. `native-auto-test` 对响应、事件、服务端状态、本地状态进行严格断言。

典型测试方式是启动多个客户端互测，例如 Android-A 与 Android-B、Android 与 iOS、Android 与 Web，互相发送消息、加好友、进群、进聊天室、订阅 presence，并在双方分别断言发送结果、接收事件、服务端查询结果和本地缓存状态。

测试人员新增或维护 API 覆盖时必须做到：
- 功能测试：至少覆盖成功链路、关键事件、服务端状态和本地状态。
- 参数校验：覆盖必填缺失、空值、非法类型、边界值、枚举差异、组合参数，并确保不同参数产生不同可观察 E2E 结果。
- 全量回归：在目标平台执行对应模块或全量 E2E，不能只跑单个 happy path。
- 版本覆盖：原生 SDK 升级或平台新增能力时，标记该能力对应的 SDK 版本、平台支持状态和不适用原因。
- 报告输出：最终生成测试报告，明确哪些 API、哪些 case 已测，哪些没过，失败原因是什么，哪些平台未实现/不适用/待确认。
- 统计产物统一输出到 `native-auto-test/out/`；运行日志按平台放到 `native-auto-test/out/log/<platform>/`。
- 测试报告必须至少包含两张表：
  1. SDK 功能覆盖表：按 SDK/API/Manager/Cmd/平台/版本记录能力是否存在、是否实现、是否可测、是否已覆盖、覆盖用例入口、不适用或未实现原因。
  2. 测试 case 结果信息表：按 case 记录执行平台、设备组合、运行 ID、结果（通过/失败/跳过/不适用）、失败原因、关联 API、日志路径、HTML 报告路径。

测试人员不得为了让 case 通过而伪造 SDK 能力。若平台未暴露、未实现、不支持或环境不适用，应记录为覆盖统计中的明确状态，而不是写成通过。

### 角色二：开发人员

开发人员拥有本仓库全部资产，目标是维护发布 SDK、平台 wrapper、接口契约、测试 App 和自动化测试工程的一致性。

开发人员视角下：
- 可以修改 `im_flutter_sdk/`、`im_flutter_sdk_interface/`、`im_flutter_sdk_xxx/`、`im_flutter_test/`、`native-auto-test/` 等全部目录。
- 修改发布 SDK 或平台 wrapper 时，必须同步考虑自动化测试链路是否仍能打通。
- 新增真实 SDK 能力时，应同步补齐 Dart API、interface、各平台 MethodKeys、平台实现、事件序列化和测试用例。
- 修复平台差异时，以 Android 命名和语义为基准，Dart、iOS、Web 与其对齐；确有平台差异时要写入覆盖统计和文档。
- 不能把测试专用桥接、账号配置、REST 凭据、pytest 断言等混入发布 SDK 包。

开发人员交付时除构建通过外，还应提供对应测试证据：至少包括受影响模块的 E2E 结果、失败/跳过说明、报告路径，以及是否需要刷新平台 API 支持统计。

### 目录级代理规则
各关键目录可以有自己的 `AGENTS.md`。根目录规则负责全局边界；子目录规则只补充本目录职责、可改范围和校验命令。若规则冲突，优先级为：用户最新指令 > 更深层目录 `AGENTS.md` 的具体规则 > 根目录总规则。

### 日常测试工作流
- 构建 `im_flutter_test` 装到设备/模拟器 → `native-auto-test` 跑 pytest 用例驱动。
- 桥接采用通用 `callNativeMethod(manager, cmd, info)` 转发：**新增用例通常无需改动 `im_flutter_sdk` 与 `im_flutter_test`**，只在 Python 侧发新的 manager/cmd 即可。
- 多端互测必须显式说明参与平台与设备，例如 Android-A/Android-B、Android/iOS、Android/Web。不要用“mobile”掩盖真实平台统计。

### 何时改 `im_flutter_test`
- 需要转发新的 SDK 事件回调 → `im_flutter_test/lib/bridge/event_bridge_handler.dart`。
- 需要新的发送便利 / 序列化辅助。

### 何时改 `im_flutter_sdk`
仅两种情况，均非"测试脚手架改动"：
1. SDK 版本升级。
2. 用例要测的能力，SDK/原生尚未暴露（全栈真功能，需 Dart + Android + iOS 同步实现，放不进 `im_flutter_test`）。判定标准：能映射到原生 SDK 真实能力、对 App 开发者有用、不设置时不改变行为 → 属 SDK 功能；仅服务测试桥接、脱离测试无意义 → 放 `im_flutter_test`。

### ⚠️ 升级 SDK 时必须保留的"测试支撑增量"
这些是本仓库相对官方 stable 的增量，`im_flutter_test` 的桥接依赖它们；**版本升级时务必一并迁移/保留，否则桥接编译不过或对应用例跑不了**：
- 公开 API：`EMChatManager.sendMessageWithType` + `buildOutgoingMessage` + `EMSendMessageType`（`em_chat_enums.dart`）；各 `sendXxxMessage` 经其分发。
- 内部符号（桥接通过 `package:im_flutter_sdk/src/...` 实现引用）：`EMLog`（`src/tools/em_log.dart`）。
- 公开导出：`ChatMethodKeys`（经 `src/internal/inner_headers.dart`）。
- 全栈功能（Dart + Android + iOS 三端）：`EMOptions.enableUserInfo` / `enableAutoSyncContacts` / `syncDataWebSocketServer/Port`；好友同步事件 `onFriendStartSync` / `onFriendSyncFinished` / `onFriendUserInfoDidUpdated`；`EMMessage.webhookEnv`；`downloadBigImage`；`EMContact.updatedAt/userInfo`；`EMCombineMessageBody` 接收侧 `messageList/compatibleText`；`group_member_info` 扩展字段。
- 11 个 model 的 `toJson/toString`（供事件序列化）：`em_cursor_result` / `em_page_result` / `em_presence` / `em_group_message_ack` / `em_message_reaction` / `reaction_operation` / `message_pin_info` / `login_extension_info` / `recall_message_info` / `em_chat_thread` / `em_push_configs`。

### 桥接对 SDK 的依赖边界
- 公开 API：`package:im_flutter_sdk/im_flutter_sdk.dart`。
- 接口包：`package:im_flutter_sdk_interface/...`（`Client.instance`、`ManagerMixin.callNativeMethod`）。
- 实现引用（lint 容忍）：`package:im_flutter_sdk/src/tools/em_log.dart`。
- 媒体素材：放在 `im_flutter_test/assets/media/`，由桥接 `_prepareDefaultMediaPath` 在用例未传 `filePath` 时从测试 App 自带 assets 加载（**不再打进 SDK 包**）。

### 构建校验
- 测试端：`cd im_flutter_test && flutter analyze && flutter build ios --simulator`（Android 用 `flutter build apk --debug`）。
- 发布 SDK 自检：`cd im_flutter_sdk && flutter analyze`。
