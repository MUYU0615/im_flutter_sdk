# 实施方案：语音转文字迁移

**Branch**: `036-voice-to-text` | **Date**: 2026-05-07 | **Spec**: `specs/036-voice-to-text/spec.md`  
**Input**: Feature specification from `/specs/036-voice-to-text/spec.md`

## Summary

本特性把旧 `websdk` 中的语音转文字能力迁移到 `WEBSDK2`，目标是保留旧方法名 `voiceMessageToText` / `voiceFileToText` 与旧错误码兼容语义，同时把实现改造为符合 `WEBSDK2` 当前架构的 `ChatManager + REST/上传适配 + 严格类型 + demo 面板` 方案。根据已完成的需求澄清，本期采用“旧入参语义 + 新成功返回风格 + 旧错误码映射到 `SDKError`”的组合方案。迁移重点不只是“能调通接口”，还包括：

1. 公开入口从旧 `conn.contact.*` 收敛到 `client.chatManager.*`，但方法名保持不变；
2. `voiceMessageToText` 保持旧入参语义，接收语音消息体；`voiceFileToText` 明确承诺支持浏览器 `File` 与当前 `WEBSDK2` 的 `MiniAppFile`；
3. `voiceMessageToText` 继续走 `speech/transcriptions`，`voiceFileToText` 继续走 `speech/recognitions`；
4. `voiceFileToText` 底层上传优先复用现有 SDK2 上传能力；若现有能力不足，可按当前架构补齐，但不能把旧 `XHR / mini upload` 分叉逻辑原样搬回来；
5. 成功返回按 `WEBSDK2` 当前风格返回业务对象 `{ text }`；失败统一抛出挂载旧兼容错误码的 `SDKError`；
6. `PCM` 缺少 `audioParams` 时不新增本地强校验，继续交由服务端决定；
7. Web demo 新增独立标签页，以旧 demo 为交互参考完成主路径验证。

当前唯一明确风险是：`speech/transcriptions` 的真实成功/失败样例尚未补齐，因此其 REST 解析与 contract 只能先基于旧 SDK 实现、旧 HLD 和已确认的 `speech/recognitions` 响应形态做保守设计；实现与测试中必须显式记录这一风险，避免误判为“已与真实样例完全对齐”。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `ChatClient`、`ChatManager`、`RestClient`、当前 SDK2 上传能力（含 `src/platform/upload` 等现有实现）、`CacheManager`、`EventHub`、Vitest、Vite、Playwright  
**Storage**: N/A（本特性不新增持久化；仅读取现有消息列表用于 demo 展示）  
**Testing**: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`、必要时 `npm run test:e2e`  
**Target Platform**: Web SDK 主库（浏览器 + 小程序等跨端共享逻辑），Web demo 页面  
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`）  
**Performance Goals**: 本地参数错误 fail-fast；消息转写与文件转写不引入额外同步阻塞；不增加重复上传通道或额外中间缓存  
**Constraints**:

- 公开方法名必须保持 `voiceMessageToText` / `voiceFileToText`
- 错误码以旧 SDK 当前实现为唯一标准
- `voiceMessageToText` 入参保持旧语音消息体语义，不切换为当前完整 `Message`
- 成功返回 `{ text: string }`，失败统一抛出 `SDKError`
- `voiceFileToText` 优先复用当前 SDK2 已有上传能力；如有缺口，可在同一架构内补齐
- `voiceFileToText` 本期只明确承诺 `File` + `MiniAppFile`
- `PCM` 缺少 `audioParams` 时不新增本地强校验
- demo 仅改 Web demo，不新增小程序 demo
- `speech/transcriptions` 真实样例尚缺，必须作为风险追踪
- 变更完成后需补版本号、`CHANGELOG.md` 和中文 commit
  **Scale/Scope**: 涉及 `ChatManager` 公开 API、speech REST/上传适配封装、错误码体系、类型导出、Web demo、unit/integration/e2e 测试与文档更新

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

验证本实现方案是否符合 IM SDK Web Constitution 的核心原则：

- [x] **性能优先**: 转写 API 采用异步请求；本地非法输入 fail-fast；不引入额外阻塞链路或重复上传实现
- [x] **类型安全**: 公开 `AudioParams`、语音文件输入与兼容结果类型都按 strict TypeScript 建模，不使用 `any`
- [x] **测试驱动**: 将补 unit / integration / e2e 三层测试，覆盖参数校验、错误映射、上传适配协作和 demo 主路径
- [x] **可靠性**: 复用或扩展当前 SDK2 已有上传能力与 `RestClient`，保持超时/错误处理基础能力；对未知 speech 错误做旧版兼容兜底
- [x] **可扩展性**: 公开入口收敛到 `ChatManager`，底层 speech REST / 映射逻辑独立模块化，后续可继续承接其他媒体辅助 REST 能力
- [x] **可观测性**: 可复用现有结构化日志，在 speech 请求、错误映射和 demo 调试输出中记录关键路径
- [x] **版本管理**: 本期新增公开 API 和 demo 标签，后续实现必须同步更新版本号、`CHANGELOG.md` 和双语文档

Phase 1 设计复检预期：通过。唯一非阻塞风险为 `speech/transcriptions` 真实样例缺失，但该项会在 research、contract 和测试备注中显式保留。

## Project Structure

### Documentation (this feature)

```text
specs/036-voice-to-text/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── voice-to-text.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── managers/
│   └── chat-manager.ts
├── rest/
│   ├── api-errors.json
│   ├── client.ts
│   ├── errors.ts
│   └── chat-management.ts
├── platform/
│   └── upload/
├── types/
│   ├── chat-manager.ts
│   ├── index.ts
│   └── message-create.ts
└── index.ts

tests/
├── unit/
│   ├── managers/
│   ├── rest/
│   └── platform/
├── integration/
│   ├── chat-manager/
│   └── miniapp-demo/
└── e2e/

demo/
├── src/App.tsx
├── src/types.ts
└── src/components/
```

**Structure Decision**: 保持单仓库单项目结构。本特性不新建独立 manager，而是在现有 `ChatManager` 上增量补齐公开入口；speech 能力的请求映射与错误兼容逻辑下沉到 `rest` 与 helper 模块；demo 在现有 tab 式页面中新增独立面板。

## Phase 0: Research

输出：

- `specs/036-voice-to-text/research.md`

研究与确认项：

1. 固化旧 SDK 兼容面
   - 旧公开方法签名、旧错误码映射与旧失败语义
   - 本地参数校验场景与直接返回的错误码
   - 已知 speech 错误码到旧 `Code` 的映射表
2. 固化当前 `WEBSDK2` 实现落点
   - `ChatManager` 是否直接承接公开 API
   - speech REST 请求应放在 `chat-management` 还是独立 speech 模块
   - demo 是否复用当前消息列表与日志系统
   - 当前已有上传能力哪些可直接复用，哪些需要按现有抽象补齐
3. 固化跨端文件输入模型
   - 旧 `MiniProgramVoiceFile` 如何并入当前 `MiniAppFile` / `CompatibleFile`
   - 浏览器 `File`、小程序 `path`、RN `uri` 中哪些本期要显式支持
4. 固化真实样例与风险边界
   - 已确认 `speech/recognitions` 成功/失败样例
   - `speech/transcriptions` 样例缺口与保守假设
   - `4001001` 复合错误场景如何继续按旧逻辑识别
5. 固化 demo 交互边界
   - 最近语音消息筛选策略
   - 本地文件选择与错误展示方式
   - 与现有消息面板/发送面板的数据共享方式

## Phase 1: Design & Contracts

输出：

- `specs/036-voice-to-text/data-model.md`
- `specs/036-voice-to-text/contracts/voice-to-text.openapi.yaml`
- `specs/036-voice-to-text/quickstart.md`

设计要点：

### 1. 公开 API 收敛到 ChatManager

- 在 `ChatManager` 上新增：
  - `voiceMessageToText(messageBody, audioParams?)`
  - `voiceFileToText(file, audioParams?)`
- `ChatManager` 负责：
  - 参数校验与旧入参语义兼容
  - 调用 speech REST / 上传能力
  - 成功返回业务对象 `{ text }`
  - 失败抛出挂载旧兼容错误码的 `SDKError`
- `ChatClient` 不直接新增同名公开方法，避免重复入口与职责漂移。

### 2. 统一 speech 请求封装

- 为 `speech/transcriptions` 与 `speech/recognitions` 建立统一 helper：
  - 构造 endpoint
  - 构造 JSON body / multipart fields
  - 解析 `data.text`
  - 解析 `error.code/error.message`
- `voiceMessageToText` 走普通 REST JSON 请求；
- `voiceFileToText` 走当前 SDK2 已有上传能力或其同一抽象下的扩展实现，再把响应体按 speech 服务结构解析；
- 不复制旧 SDK 的 `recognizeSpeechByXHR` / `recognizeSpeechByMiniUpload` 双实现。

### 3. 错误码兼容层独立化

- 在当前错误体系中补齐语音转文字所需兼容错误码常量；
- 新增 speech 专属 mapper，将服务端 `error.code` 与平台/transport 错误映射成挂载兼容 code/message 的 `SDKError`；
- 明确三类来源：
  - 本地参数错误
  - speech 服务业务错误
  - 底层 transport / 平台上传错误
- 对未知 speech 错误继续兜底 `409 FILE_VOICE_TO_TEXT_FAILED`。

### 4. 跨端语音文件类型设计

- 对外提供 `AudioParams`；
- 语音文件输入优先复用现有 `CompatibleFile` 体系，必要时增加语音转文字专用别名类型，避免重复定义小程序文件结构；
- `voiceFileToText` 应显式支持：
  - 浏览器 `File`
  - 小程序 `MiniAppFile`
- `PCM` 文件缺少 `audioParams` 时不新增本地强校验，保留服务端裁决与错误映射策略；
- RN `uri` 是否可直接复用当前上传适配，需要在 research 中确认；若本期不承诺，必须在 quickstart 与 spec 中说明范围。

### 5. Demo 页面扩展

- 在 `demo/src/App.tsx` 新增独立 tab，例如“语音转文字”；
- 新增面板组件，能力参考旧 demo，但适配当前数据流：
  - 从当前消息列表中筛出最近语音消息
  - 支持本地音频文件选择
  - 展示 `audioParams` 表单
  - 结果和错误码直接显示在页面与日志中
- 不新增 demo 专属 mock 数据。

### 6. 文档与测试面

- `contracts/voice-to-text.openapi.yaml` 记录 SDK-facing 的两个动作、成功返回 `{ text }` 以及失败抛错时的兼容错误码语义；
- `quickstart.md` 说明：
  - 如何在 `ChatClient` 上注册 `ChatManager`
  - 如何调用两条 API
  - demo 如何验证
  - 当前 `speech/transcriptions` 真实样例风险
- 测试分层：
  - unit：参数校验、映射、类型守卫、fileId 提取
  - integration：manager + rest/upload adapter 协作
  - e2e：demo 页面主路径

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=036-voice-to-text .specify/scripts/bash/update-agent-context.sh codex
```

预期：将“旧语音转文字迁移、ChatManager 入口、旧语音消息体入参、`File`/`MiniAppFile` 范围、成功返回 `{ text }`、失败抛 `SDKError`、speech 错误码兼容、跨端上传能力复用、demo 新标签页”同步到 agent context，避免后续 tasks/implement 阶段继续沿用旧 `conn.contact.*` 心智。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 新增公开类型、错误码常量与双语注释
2. 落 speech REST / 上传适配封装与兼容结果构造 helper
3. 在 `ChatManager` 上新增 `voiceMessageToText` / `voiceFileToText`
4. 补 `api-errors.json`、错误映射与测试 fixture
5. 新增 demo 标签页与语音转文字面板
6. 补 unit / integration / e2e 测试
7. 最后执行验证、更新版本号、`CHANGELOG.md` 并提交中文 commit

## Complexity Tracking

无额外豁免项。
