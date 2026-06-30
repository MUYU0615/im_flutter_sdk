---
description: '029 图片发送压缩、原图开关与附件预检秒传实现任务清单'
---

# Tasks: 图片发送压缩、原图开关与附件预检秒传

**Input**: 设计文档来自 `/specs/029-image-attachment-upload-optimization/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试与按 spec 评估的 E2E / 真实环境验证记录  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US5]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 029 所需测试与文档骨架

- [x] T001 创建 029 相关测试文件骨架 `tests/unit/message/create-image-message.test.ts`、`tests/unit/upload/attachment-uploader.test.ts`、`tests/unit/protocol/image-content-codec.test.ts`
- [x] T002 [P] 创建 029 集成测试骨架 `tests/integration/image-attachment-upload.integration.test.ts`
- [x] T003 [P] 创建 029 契约测试骨架 `tests/contract/image-attachment-upload.contract.test.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的基础能力（未完成前禁止进入 US 实现）

**⚠️ CRITICAL**: 此阶段完成后，用户故事才能并行推进

- [x] T004 扩展图片消息公开类型与视图字段于 `src/types/index.ts`
- [x] T005 [P] 扩展图片消息创建参数 `imageType` 于 `src/types/message-create.ts`
- [x] T006 [P] 扩展图片创建参数校验规则于 `src/validators/message-create.ts`
- [x] T007 [P] 定义图片预处理、预检决策与远端资源内部类型于 `src/upload/types.ts`
- [x] T008 [P] 扩展平台图片处理能力抽象于 `src/platform/types.ts`
- [x] T009 在 `src/upload/utils.ts` 增加图片 URL 派生与预检命中判定工具
- [x] T010 [P] 新增基础类型与工具单测 `tests/unit/upload/image-upload-utils.test.ts`

**Checkpoint**: 029 的共享模型、类型和工具基线可用，后续用户故事可并行

---

## Phase 3: User Story 1 - 默认发送图片时自动生成大图语义（Priority: P1） 🎯 MVP

**Goal**: 默认图片发送走大图语义；GIF 强制原图；大图生成失败回退原图并记录日志

**Independent Test**: 创建一条未设置 `imageType` 的图片消息并执行发送，验证默认走大图语义；若大图生成失败则回退原图且有日志；GIF 一律按原图发送

### Tests for User Story 1

- [x] T011 [P] [US1] 补充默认大图 / GIF 强制原图 / 大图失败回退的单测于 `tests/unit/message/create-image-message.test.ts`
- [x] T012 [P] [US1] 补充图片预处理与日志分支单测于 `tests/unit/upload/attachment-uploader.test.ts`
- [x] T013 [P] [US1] 补充默认大图发送主路径集成测试于 `tests/integration/image-attachment-upload.integration.test.ts`
- [x] T014 [US1] 记录 US1 暂不新增仓库级 E2E、仅在后续 Web smoke 验证的依据于 `specs/029-image-attachment-upload-optimization/tasks.md`
  说明：US1 的默认大图、GIF 原图与大图失败回退均已由单元测试和集成测试覆盖，仓库当前无需再新增独立 E2E；后续仅评估 Web demo smoke。

### Implementation for User Story 1

- [x] T015 [US1] 在 `src/message/create-message.ts` 记录并归一图片消息 `imageType` 发送语义
- [x] T016 [P] [US1] 在 `src/upload/attachment-uploader.ts` 实现默认大图语义、GIF 强制原图与大图失败回退逻辑
- [x] T017 [P] [US1] 在 `src/upload/utils.ts` 实现 `imageType` 与图片候选资源决策辅助逻辑
- [x] T018 [US1] 在 `src/utils/logger.ts` 接入 029 所需的大图失败回退与图片策略日志字段
  说明：029 复用现有结构化 `logger.debug / logger.warn` 能力，在 `src/upload/attachment-uploader.ts` 已输出 `upload.image.policy` 与 `upload.image.big-fallback` 字段，并由 `tests/unit/upload/attachment-uploader.test.ts` 锁定。

**Checkpoint**: US1 可独立完成默认大图发送与失败回退验证

---

## Phase 4: User Story 2 - 显式发送原图时保留原图语义（Priority: P1）

**Goal**: `imageType='original'` 时以原图为候选资源，不在端上生成大图，且不改变现有分片阈值逻辑

**Independent Test**: 创建一条 `imageType='original'` 的图片消息并执行发送，验证不生成大图、最终对外 `imageType='original'`，且简单上传/分片上传仍沿用现有阈值逻辑

### Tests for User Story 2

- [x] T019 [P] [US2] 补充 `imageType='original'` 行为单测于 `tests/unit/message/create-image-message.test.ts`
- [x] T020 [P] [US2] 补充原图发送不生成大图的上传器单测于 `tests/unit/upload/attachment-uploader.test.ts`
- [x] T021 [P] [US2] 补充原图发送集成测试于 `tests/integration/image-attachment-upload.integration.test.ts`
- [x] T022 [US2] 记录 US2 复用 US1 Web smoke、无需单独新增 E2E 用例的依据于 `specs/029-image-attachment-upload-optimization/tasks.md`
  说明：`imageType='original'` 仅改变候选资源选择，不新增独立页面交互；已由单元测试与集成测试覆盖，继续复用 US1 的 Web smoke 即可。

### Implementation for User Story 2

- [x] T023 [US2] 在 `src/upload/attachment-uploader.ts` 实现 `imageType='original'` 分支绕过大图生成
- [x] T024 [P] [US2] 在 `src/upload/types.ts` 完善原图发送候选资源与原因枚举
- [x] T025 [US2] 在 `src/upload/utils.ts` 固化“候选资源”和“分片阈值”两层决策分离

**Checkpoint**: US2 可独立完成原图发送语义验证

---

## Phase 5: User Story 3 - 附件预检秒传覆盖图片与普通附件（Priority: P1）

**Goal**: 使用 `GET /{orgName}/{appName}/chatfiles/exists` 作为附件预检接口；命中后跳过上传，未命中后继续现有上传流程；原有分片 init 接口恢复为仅承担 multipart init 职责，不再被预检额外复用

**Independent Test**: 分别验证图片与普通附件在达到门槛时触发 `chatfiles/exists` 预检、命中时跳过上传、未命中时继续上传，且分片 init limit 逻辑恢复为只初始化一次

说明：本节已完成任务反映的是 2026-04-15 版方案；针对 2026-04-17 的接口切换和 init 职责恢复，以下新增 follow-up 任务见 Phase 8A。

### Tests for User Story 3

- [x] T026 [P] [US3] 补充预检门槛与命中判定单测于 `tests/unit/upload/image-upload-utils.test.ts`
- [x] T027 [P] [US3] 补充“发送链路按规则调用原有阈值接口”的上传器单测于 `tests/unit/upload/attachment-uploader.test.ts`
- [x] T028 [P] [US3] 补充图片/普通附件预检命中与未命中集成测试于 `tests/integration/image-attachment-upload.integration.test.ts`
- [x] T029 [P] [US3] 完成上传协商契约测试于 `tests/contract/image-attachment-upload.contract.test.ts`
- [x] T030 [US3] 记录 US3 无需新增仓库级 E2E、以集成测试与 quickstart 验证兜底的依据于 `specs/029-image-attachment-upload-optimization/tasks.md`
  说明：US3 主要是上传协商与分支判定，契约测试 + 集成测试更稳定；仓库级 E2E 对该类 REST/上传分支增益有限，使用 quickstart 记录联调步骤兜底。

### Implementation for User Story 3

- [x] T031 [US3] 改造 `src/upload/attachment-uploader.ts`：在单次发送中先判定是否需调用原 init/threshold 接口
- [x] T032 [P] [US3] 改造 `src/upload/multipart-upload.ts`：复用原 init 接口承载预检协商并保留阈值解析
- [x] T033 [P] [US3] 改造 `src/upload/simple-upload.ts`：接入预检后的资源复用与普通上传衔接
- [x] T034 [P] [US3] 改造 `src/upload/types.ts`：补充预检请求、响应与命中规则结构
- [x] T035 [US3] 改造 `src/upload/utils.ts`：实现 `share-secret` 非空命中规则与远端资源组装

**Checkpoint**: US3 可独立完成预检秒传与现有上传流程协作验证

---

## Phase 6: User Story 4 - 接收图片消息时统一获得原图/大图/缩略图语义（Priority: P1）

**Goal**: 协议新增 `imageType`，接收侧在默认模式下稳定输出 `localUrl / originalImageUrl / largeImageUrl / thumbnailUrl`，并允许自有上传模式关闭 `largeImageUrl / thumbnailUrl` 自动派生；协议 `imageType=1|2` 继续映射到对外 `imageType='original'|'large'`

**Independent Test**: 构造协议 `imageType=1` 与 `imageType=2` 的下行图片消息，验证默认模式下会派生三条图片 URL，自有上传模式下不会自动派生 `largeImageUrl / thumbnailUrl`

说明：本节已完成任务反映的是 2026-04-15 版字段设计；针对 2026-04-17 的固定三 URL 和 `originalImageUrl` 命名调整，以下新增 follow-up 任务见 Phase 8A。

### Tests for User Story 4

- [x] T036 [P] [US4] 补充图片协议上行/下行编解码单测于 `tests/unit/protocol/image-content-codec.test.ts`
- [x] T037 [P] [US4] 补充接收侧图片地址视图集成测试于 `tests/integration/image-attachment-upload.integration.test.ts`
- [x] T038 [US4] 记录 US4 以协议单测和集成测试替代 E2E 的依据于 `specs/029-image-attachment-upload-optimization/tasks.md`
  说明：US4 关注协议编解码与地址派生，不依赖页面交互；使用 codec 单测和 integration decode case 比 E2E 更直接且可重复。

### Implementation for User Story 4

- [x] T039 [US4] 更新 `src/protocol/msync/proto-source.json` 与生成产物 `src/protocol/msync/proto.ts`：新增 `imageType`
- [x] T040 [US4] 改造 `src/protocol/msync/codec.ts`：实现图片 `imageType` 上行编码与下行解码
- [x] T041 [P] [US4] 改造 `src/types/index.ts`：固化 `localUrl / originalImageUrl / largeImageUrl / thumbnailUrl` 语义
- [x] T042 [US4] 改造 `src/upload/utils.ts`：统一发送回写与接收派生时的图片地址规则

**Checkpoint**: US4 可独立完成图片协议和接收视图语义验证

---

## Phase 7: User Story 5 - 小程序端与 Web 端保持一致的图片发送语义（Priority: P2）

**Goal**: 通过平台能力注入支持小程序图片信息读取、大图生成和 MD5 计算，并在能力缺失时明确失败

**Independent Test**: 在小程序文件源场景下，验证能力完整时主路径成功，能力缺失时返回明确错误

### Tests for User Story 5

- [x] T043 [P] [US5] 补充平台图片处理能力单测于 `tests/unit/platform/image-processing-capability.test.ts`
- [x] T044 [P] [US5] 补充小程序文件源图片发送集成测试于 `tests/integration/image-attachment-upload.integration.test.ts`
- [x] T045 [US5] 记录小程序自动化 E2E 不适用、需真实环境联调验证的依据于 `specs/029-image-attachment-upload-optimization/tasks.md`
  说明：当前仓库没有小程序自动化运行基座；US5 已由平台能力单测与 miniapp-path 集成测试覆盖 SDK 逻辑，宿主侧仍需真实环境联调验收。

### Implementation for User Story 5

- [x] T046 [US5] 在 `src/platform/types.ts` 定义 `getImageInfo / generateBigImage / computeMd5` 平台图片处理能力
- [x] T047 [P] [US5] 在 `src/upload/attachment-uploader.ts` 接入平台图片处理能力并处理缺失能力错误
- [x] T048 [P] [US5] 在 `src/platform/upload/upload-source.ts` 完善小程序图片文件源元信息标准化
- [x] T049 [US5] 在 `src/platform/factory.ts` 装配 029 所需图片处理能力并补 fail-fast 校验

**Checkpoint**: US5 可独立完成小程序能力注入和错误语义验证

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、回归与发布

- [x] T050 [P] 同步 quickstart 验证步骤与最终命令记录于 `specs/029-image-attachment-upload-optimization/quickstart.md`
- [x] T051 [P] 校准 `spec.md / plan.md / data-model.md / contracts/` 字段一致性于 `specs/029-image-attachment-upload-optimization/`
  说明：已移除 `data-model.md` 中不存在的 `supportsLocalPath`，并同步修正 `spec.md` 中“小程序端生成缩略图”的残留表述，使其与 plan / contracts / 实现一致。
- [x] T052 执行 029 关键测试并记录结果于 `specs/029-image-attachment-upload-optimization/quickstart.md`
- [x] T053 执行 lint 并修复 029 相关告警（涉及 `src/` 与 `tests/`）
- [x] T054 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T055 提交 029 实现变更（不 push）

---

## Phase 8A: Change Request 2026-04-17（029 文档变更后的增量实现）

**Purpose**: 对齐新的预检接口、图片 URL 字段和协议语义，补齐 2026-04-17 变更后的实现与验证任务

### Tests for Change Request

- [x] T056 [P] [US3] 更新 `tests/unit/upload/image-upload-utils.test.ts`：补充 `chatfiles/exists` 命中规则从 `exists=true` 判定、`share-secret` 非唯一命中条件，并同步三条图片 URL 的固定派生规则
- [x] T057 [P] [US3] 更新 `tests/integration/image-attachment-upload.integration.test.ts`：补充 `chatfiles/exists` 预检命中/未命中与“预检不再复用分片 init”协作场景
- [x] T058 [P] [US3] 更新 `tests/contract/image-attachment-upload.contract.test.ts`：切换为 `GET /chatfiles/exists` 契约，并覆盖当前占位 `exists=false` 与未来 `exists=true` 两种响应
- [x] T059 [P] [US4] 更新 `tests/unit/protocol/image-content-codec.test.ts`：校验协议 `imageType=1|2` 与对外 `imageType='original'|'large'` 的映射，以及 `localUrl / originalImageUrl / largeImageUrl / thumbnailUrl` 固定派生规则
- [x] T060 [P] [US4] 更新 `tests/integration/image-attachment-upload.integration.test.ts`：校验接收侧始终包含三条远端图片 URL 与空 `localUrl`，且 `largeImageUrl` 固定使用 `?size=large`、`thumbnailUrl` 固定使用 `?size=small`
- [x] T061 [P] [US1] 更新 `tests/unit/upload/attachment-uploader.test.ts`：校验图片上传请求中的必填 `imagetype` 改为 `origin | large`

### Implementation for Change Request

- [x] T062 [US3] 改造 `src/upload/attachment-uploader.ts`：按门槛调用 `GET /{orgName}/{appName}/chatfiles/exists`，并从发送链路中移除“init 兼做预检”的逻辑
- [x] T063 [P] [US3] 改造 `src/upload/multipart-upload.ts`：恢复分片 init 的单一职责语义，不再让预检额外复用该链路
- [x] T064 [P] [US3] 改造 `src/upload/types.ts`、`src/upload/utils.ts`：将预检命中规则从 `share-secret` 改为 `exists=true`，并兼容可选 `share-secret`
- [x] T065 [P] [US1] 改造 `src/upload/simple-upload.ts`、`src/upload/multipart-upload.ts`：图片上传请求统一改为必填 `imagetype=origin|large`，去除 `big`
- [x] T066 [US4] 改造 `src/types/index.ts`、`src/upload/utils.ts`：将图片消息视图字段调整为 `localUrl / originalImageUrl / largeImageUrl / thumbnailUrl`，并始终回写远端三条 URL
- [x] T067 [P] [US4] 改造 `src/protocol/msync/proto-source.json`、`src/protocol/msync/proto.ts`、`src/protocol/msync/codec.ts`：固化协议 `imageType=1` 表示原图、`imageType=2` 表示压缩图，并映射到对外 `imageType='original'|'large'`
- [x] T068 [P] 同步 `specs/029-image-attachment-upload-optimization/data-model.md`、`specs/029-image-attachment-upload-optimization/quickstart.md`、`specs/029-image-attachment-upload-optimization/contracts/image-attachment-upload.openapi.yaml`，消除与本次变更要求的字段和接口差异

说明：本轮将“init 只调用一次”的规格表述收敛为“预检不再复用 multipart init；单次 multipart 上传流程仅保留一次 init 调用”，以对齐当前服务端 `uuid + limit` 返回模型与实际实现。

**Checkpoint**: 029 的实现与文档可完全对齐 2026-04-17 变更要求

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-7 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 8 (Polish)**: 依赖已选用户故事完成
- **Phase 8A (Change Request 2026-04-17)**: 依赖 US1 / US3 / US4 已有实现完成后执行，属于 029 的增量修订

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: 依赖 US1 的基础图片策略模型，但可在 US1 开始后并行推进
- **US3 (P1)**: 依赖 US1 / US2 的候选资源决策稳定后推进；若执行 2026-04-17 修订，则先完成 `chatfiles/exists` 接口切换
- **US4 (P1)**: 建议在 US1 / US3 主链路成型后推进协议与接收语义；若执行 2026-04-17 修订，则同步改为固定三 URL 语义
- **US5 (P2)**: 建议在 P1 主路径稳定后推进平台能力注入

### Within Each User Story

- 先写测试（应先失败）
- 再实现类型/工具/协议或上传逻辑
- 再接入主链路
- 最后完成故事级独立验证

### Parallel Opportunities

- Phase 1、2 中所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1 和 US4 可由不同人分别处理“发送策略”和“协议语义”
- US3 的契约测试与上传链路改造可并行
- US5 的平台测试与平台工厂接入可并行
- Phase 8A 中，`T056/T057/T058`、`T059/T060`、`T065/T067` 可并行

---

## Parallel Example: User Story 3

```bash
Task: "T026 tests/unit/upload/image-upload-utils.test.ts"
Task: "T027 tests/unit/upload/attachment-uploader.test.ts"
Task: "T028 tests/integration/image-attachment-upload.integration.test.ts"
Task: "T029 tests/contract/image-attachment-upload.contract.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 P1 主路径）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（默认大图发送与回退）
3. 完成 US3（预检秒传）
4. 完成 US4（协议与接收语义）
5. **STOP and VALIDATE**：验证图片主路径闭环

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（默认大图 / GIF / 回退）
3. 交付 US2（显式原图发送）
4. 交付 US3（预检秒传）
5. 交付 US4（协议与接收）
6. 交付 US5（小程序适配）

### Parallel Team Strategy

- 开发 A：US1 / US2 图片发送策略
- 开发 B：US3 上传链路与预检接口复用
- 开发 C：US4 协议与接收视图
- 开发 D：US5 平台能力注入与小程序适配

---

## Notes

- 所有任务遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段保留 `[USx]` 标签，便于追踪与独立验收
- E2E 任务按 spec 要求显式记录“不适用 / 复用依据”，不默认省略
