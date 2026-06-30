---
description: '030 微信小程序 Demo 实现任务清单'
---

# Tasks: 微信小程序 Demo

**Input**: 设计文档来自 `/specs/030-wechat-miniapp-demo/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试，以及按 spec 要求记录的微信开发者工具手工验证清单；本期不新增自动化 E2E，但必须在任务中显式记录依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立小程序 demo、测试与文档骨架

- [x] T001 创建小程序 demo 基础骨架 `miniprogram-demo/app.json`、`miniprogram-demo/app.ts`、`miniprogram-demo/app.wxss`、`miniprogram-demo/project.config.json`、`miniprogram-demo/pages/index/index.json`
- [x] T002 [P] 创建小程序工具与类型骨架 `miniprogram-demo/utils/sdk-loader.ts`、`miniprogram-demo/utils/platform-adapters.ts`、`miniprogram-demo/utils/message-drafts.ts`、`miniprogram-demo/utils/env.ts`、`miniprogram-demo/typings/index.d.ts`
- [x] T003 [P] 创建 030 测试骨架 `tests/unit/miniapp-demo/sdk-loader.test.ts`、`tests/unit/miniapp-demo/session-controller.test.ts`、`tests/unit/miniapp-demo/message-drafts.test.ts`、`tests/unit/miniapp-demo/platform-adapters.test.ts`、`tests/unit/miniapp-demo/init-config.test.ts`、`tests/integration/miniapp-demo/init-login.integration.test.ts`、`tests/integration/miniapp-demo/message-send.integration.test.ts`
- [x] T004 [P] 创建小程序 demo 文档骨架 `miniprogram-demo/README.md` 和 `docs/demos/wechat-miniapp-demo.md`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的 SDK 连接抽象收口

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T005 在 `src/platform/types.ts` 和 `src/platform/index.ts` 明确连接层可复用的 socket 抽象导出，作为小程序连接与发送链路的统一依赖
- [x] T006 [P] 将 `src/core/connection/heartbeat.ts` 和 `src/core/message/message-sender.ts` 从浏览器原生 `WebSocket` 收口到平台 socket 抽象
- [x] T007 将 `src/core/connection/connection-manager.ts` 改造成通过平台 `SocketAdapter` 建连、发包和监听事件，而不是直接 `new WebSocket()`
- [x] T008 将平台 socket 抽象接入 `src/core/index.ts` 和 `src/chat-client.ts`，确保登录与发消息主路径继续维持现有公开 API
- [x] T009 [P] 补充连接抽象回归测试 `tests/unit/core/connection/connection-manager.test.ts`、`tests/unit/core/connection/heartbeat.test.ts`、`tests/unit/core/message/message-sender.test.ts`

**Checkpoint**: 小程序运行时不再被浏览器原生 `WebSocket` 绑定阻塞，后续用户故事可并行推进

---

## Phase 3: User Story 1 - 在微信小程序中完成初始化与登录（Priority: P1） 🎯 MVP

**Goal**: 在微信开发者工具中完成初始化、登录、登出，并得到明确状态与日志反馈

**Independent Test**: 导入 `miniprogram-demo/` 后，填写初始化和登录信息即可完成初始化、登录、登出，不依赖消息发送能力也能独立验收

### Tests for User Story 1

- [x] T010 [P] [US1] 补充初始化/登录/登出状态守卫与会话切换单测 `tests/unit/miniapp-demo/session-controller.test.ts`
- [x] T011 [P] [US1] 补充固定服务地址初始化、登录、登出主路径集成测试 `tests/integration/miniapp-demo/init-login.integration.test.ts`
- [x] T012 [US1] 在 `specs/030-wechat-miniapp-demo/tasks.md` 记录 US1 不新增自动化 E2E、仅使用微信开发者工具手工验证初始化/登录/登出的依据（本特性统一以 `quickstart.md`、`miniprogram-demo/README.md` 手工验证清单承接）

### Implementation for User Story 1

- [x] T013 [P] [US1] 在 `miniprogram-demo/utils/sdk-loader.ts` 和 `miniprogram-demo/utils/env.ts` 实现 demo 级 SDK 启动入口与默认环境读取
- [x] T014 [P] [US1] 在 `miniprogram-demo/pages/index/index.ts` 实现初始化、登录、登出、状态同步与日志写入动作
- [x] T015 [US1] 在 `miniprogram-demo/pages/index/index.wxml` 和 `miniprogram-demo/pages/index/index.wxss` 实现初始化/登录/登出区域、状态展示和日志面板
- [x] T016 [US1] 在 `miniprogram-demo/app.json` 和 `miniprogram-demo/pages/index/index.json` 注册首页并接通最小可运行的小程序页面入口

**Checkpoint**: US1 可独立完成“小程序打开即可初始化、登录、登出”的最小闭环

---

## Phase 4: User Story 2 - 在微信小程序中发送常见消息类型（Priority: P1）

**Goal**: 在小程序 demo 中发送文本、图片、语音、视频、文件、位置、命令、自定义消息，并显示成功或失败反馈

**Independent Test**: 在已初始化并已登录的前提下，分别触发 8 类消息的发送主路径，确认都能得到明确结果；其中附件类消息必须能使用小程序本地素材

### Tests for User Story 2

- [x] T017 [P] [US2] 补充消息草稿校验、JSON 参数解析与 `MiniAppFile` 转换单测 `tests/unit/miniapp-demo/message-drafts.test.ts`
- [x] T018 [P] [US2] 补充小程序 request/socket/upload/runtime/image 适配器单测 `tests/unit/miniapp-demo/platform-adapters.test.ts`
- [x] T019 [P] [US2] 补充文本、附件、位置、命令、自定义消息发送集成测试 `tests/integration/miniapp-demo/message-send.integration.test.ts`
- [x] T020 [US2] 在 `specs/030-wechat-miniapp-demo/tasks.md` 记录 US2 以单元/集成测试 + 开发者工具手工验证替代自动化 E2E 的依据（自动化覆盖逻辑构建与 runtime 协作，真实素材与发送结果由开发者工具手工清单验收）

### Implementation for User Story 2

- [x] T021 [P] [US2] 在 `miniprogram-demo/utils/platform-adapters.ts` 实现小程序 `RequestAdapter`、`SocketAdapter`、`UploadAdapter`、`RuntimeAdapter` 与 `ImageProcessor`
- [x] T022 [P] [US2] 在 `miniprogram-demo/utils/message-drafts.ts` 实现 8 类消息草稿校验、附件选择结果标准化与 SDK 消息参数构建
- [x] T023 [US2] 在 `miniprogram-demo/pages/index/index.ts` 实现文本、位置、命令、自定义消息发送动作
- [x] T024 [US2] 在 `miniprogram-demo/pages/index/index.ts` 实现图片、语音、视频、文件素材选择与发送动作
- [x] T025 [US2] 在 `miniprogram-demo/pages/index/index.wxml` 和 `miniprogram-demo/pages/index/index.wxss` 实现消息类型切换表单、附件选择器和发送结果展示

**Checkpoint**: US2 可独立完成“8 类消息发送 + 附件类消息使用小程序本地素材”的闭环

---

## Phase 5: User Story 3 - 使用简化初始化配置快速联调（Priority: P2）

**Goal**: 初始化配置保持最小化，不暴露自定义 DNS 输入，并默认关闭自动联系人同步

**Independent Test**: 打开 demo 后，只看到 `appKey`、固定 `restApiUrl` / `wsUrl` 和必要初始化选项；无需 DNS 输入也能完成初始化

### Tests for User Story 3

- [x] T026 [P] [US3] 补充简化初始化映射与固定 `serviceConfig.serverUrls` 逻辑单测 `tests/unit/miniapp-demo/init-config.test.ts`
- [x] T027 [P] [US3] 扩展初始化集成测试，覆盖 `serviceConfig.serverUrls` 与 `enableAutoSyncContacts=false` 默认行为 `tests/integration/miniapp-demo/init-login.integration.test.ts`
- [x] T028 [US3] 在 `specs/030-wechat-miniapp-demo/tasks.md` 记录 US3 仅依赖手工页面检查的 E2E 验收依据（UI 裁剪和初始化字段最小化需在微信开发者工具页面上最终确认）

### Implementation for User Story 3

- [x] T029 [US3] 在 `miniprogram-demo/utils/env.ts` 和 `miniprogram-demo/pages/index/index.ts` 固化简化初始化输入到 `ChatClient.init()` 的映射，默认使用 `serviceConfig.serverUrls`、`enableAutoSyncContacts=false`
- [x] T030 [P] [US3] 在 `miniprogram-demo/pages/index/index.wxml` 和 `miniprogram-demo/pages/index/index.wxss` 去除自定义 DNS 输入并保留最小初始化字段
- [x] T031 [US3] 在 `miniprogram-demo/pages/index/index.ts` 和 `miniprogram-demo/pages/index/index.wxml` 更新简化初始化文案与错误提示，避免暴露无关 DNS 概念

**Checkpoint**: US3 可独立完成“更简单的小程序初始化入口”验收

---

## Phase 6: User Story 4 - 在导入方式受限时仍可运行 demo（Priority: P2）

**Goal**: 在源码直引不可用时，demo 仍可通过 build 后 SDK 产物稳定运行，并向开发者说明当前模式

**Independent Test**: 按文档执行构建步骤后，微信开发者工具能够使用 build 后产物启动 demo，完成初始化和登录主路径

### Tests for User Story 4

- [x] T032 [P] [US4] 补充 dist 模式加载器与运行模式标识单测 `tests/unit/miniapp-demo/sdk-loader.test.ts`
- [ ] T033 [P] [US4] 扩展初始化集成测试，覆盖 build 产物驱动的 demo 启动路径 `tests/integration/miniapp-demo/init-login.integration.test.ts`
- [x] T034 [US4] 在 `specs/030-wechat-miniapp-demo/tasks.md` 记录 US4 以开发者工具启动清单代替自动化 E2E 的依据（dist 模式可通过自动化 loader 测试校验，开发者工具真实启动仍以手工清单为准）

### Implementation for User Story 4

- [x] T035 [US4] 在 `miniprogram-demo/utils/sdk-loader.ts` 实现 dist 优先的 SDK 导入策略与运行模式暴露
- [x] T036 [P] [US4] 在 `miniprogram-demo/README.md` 和 `docs/demos/wechat-miniapp-demo.md` 记录构建步骤、导入方式、备用路径与手工验证清单

**Checkpoint**: US4 可独立完成“即使源码直引受限，demo 仍有稳定运行路径”的验收

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 收尾验证、文档同步、版本治理与提交

- [x] T037 [P] 对齐最终手工验证步骤与术语于 `specs/030-wechat-miniapp-demo/quickstart.md`、`specs/030-wechat-miniapp-demo/plan.md`、`specs/030-wechat-miniapp-demo/tasks.md`
- [x] T038 执行 `npm run test:run -- tests/unit/core/connection/connection-manager.test.ts tests/unit/core/connection/heartbeat.test.ts tests/unit/core/message/message-sender.test.ts tests/unit/miniapp-demo tests/integration/miniapp-demo && npm run lint && npm run type-check`，并将结果记录到 `specs/030-wechat-miniapp-demo/quickstart.md`
- [ ] T039 记录微信开发者工具手工验收结果到 `miniprogram-demo/README.md` 和 `specs/030-wechat-miniapp-demo/quickstart.md`
- [x] T040 更新版本与变更记录 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T041 基于 `specs/030-wechat-miniapp-demo/`、`src/`、`miniprogram-demo/`、`tests/` 和 `docs/` 提交 030 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-6 (User Stories)**: 依赖 Phase 2 完成；可按优先级推进，也可在团队允许时并行
- **Phase 7 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 完成后即可开始，是 MVP 主路径
- **US2 (P1)**: 依赖 US1 的会话和页面基础，但消息发送与附件适配可独立实现
- **US3 (P2)**: 建议在 US1 之后推进，用于收紧初始化 UI 和默认行为
- **US4 (P2)**: 可在 US1 主路径稳定后推进，主要影响导入策略与文档

### Within Each User Story

- 先写故事级单元/集成测试并确认失败预期
- 再实现工具层与页面动作
- 最后补齐文档和手工验证依据

### Parallel Opportunities

- Phase 1 中所有标记 `[P]` 的任务可并行
- Phase 2 中 `T006` 与 `T009` 可在 `T005` 后并行推进
- US1 中 `T013` 和 `T014` 可并行
- US2 中 `T021` 和 `T022` 可并行，随后接入页面发送逻辑
- US3 中 UI 裁剪与初始化映射可并行
- US4 中 loader 实现与文档更新可并行

---

## Parallel Example: User Story 1

```bash
Task: "T010 tests/unit/miniapp-demo/session-controller.test.ts"
Task: "T011 tests/integration/miniapp-demo/init-login.integration.test.ts"
Task: "T013 miniprogram-demo/utils/sdk-loader.ts and miniprogram-demo/utils/env.ts"
Task: "T014 miniprogram-demo/pages/index/index.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T017 tests/unit/miniapp-demo/message-drafts.test.ts"
Task: "T018 tests/unit/miniapp-demo/platform-adapters.test.ts"
Task: "T021 miniprogram-demo/utils/platform-adapters.ts"
Task: "T022 miniprogram-demo/utils/message-drafts.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T026 tests/unit/miniapp-demo/init-config.test.ts"
Task: "T029 miniprogram-demo/utils/env.ts and miniprogram-demo/pages/index/index.ts"
Task: "T030 miniprogram-demo/pages/index/index.wxml and miniprogram-demo/pages/index/index.wxss"
```

## Parallel Example: User Story 4

```bash
Task: "T032 tests/unit/miniapp-demo/sdk-loader.test.ts"
Task: "T035 miniprogram-demo/utils/sdk-loader.ts"
Task: "T036 miniprogram-demo/README.md and docs/demos/wechat-miniapp-demo.md"
```

---

## Implementation Strategy

### MVP First（建议）

1. 完成 Phase 1-2，建立小程序 demo 骨架和 SDK 连接抽象
2. 交付 US1，先保证初始化、登录、登出可跑
3. **停止并验证**：在微信开发者工具中确认基础接入主路径成立
4. 再进入 US2 补齐 8 类消息发送

### Incremental Delivery

1. Setup + Foundational 完成后，先交付 US1
2. 交付 US2，让 demo 真正具备消息联调价值
3. 交付 US3，降低初始化成本
4. 交付 US4，补齐稳定运行路径与文档
5. 最后完成 Phase 7 收尾与版本治理

### Parallel Team Strategy

1. 一人先完成 Phase 1-2
2. Foundation 完成后：
   - 开发者 A: US1 / US3
   - 开发者 B: US2
   - 开发者 C: US4 / 文档

---

## Notes

- `[P]` 任务表示不同文件、可并行推进
- 每个用户故事都包含单元、集成和 E2E 依据任务；E2E 在本 feature 中统一以手工验证清单承接
- 实现完成后必须先验证，再更新版本号和 `CHANGELOG.md`，最后提交中文 commit
