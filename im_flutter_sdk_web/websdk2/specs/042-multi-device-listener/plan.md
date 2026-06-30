# 实施方案：ChatClient Multi-Device Listener

**Branch**: `042-multi-device-listener` | **Date**: 2026-05-22 | **Spec**: `specs/042-multi-device-listener/spec.md`  
**Input**: Feature specification from `/specs/042-multi-device-listener/spec.md`

## Summary

本期在 `ChatClient.addEventHandler/removeEventHandler` 现有事件模型上新增 MultiDevice 专用监听面，用于把“当前账号在其他设备上的操作”从普通联系人、群组、子区、会话和消息事件中明确拆出来。公开回调采用分类形态：`onMultiDeviceContact`、`onMultiDeviceGroup`、`onMultiDeviceThread`、`onMultiDeviceConversation`、`onMultiDeviceMessageRemoved`。

技术方案保持现有分层：`MsyncCodec` 负责把 ROSTER/MUC/NOTIFY 协议载荷解码为标准 notify；新增 `multi-device` 类型和 normalizer 承担 operation、目标 ID、`deviceId?: string`、时间戳和 raw 信息归一；`MessageReceiver` 只做校验、同设备回声过滤和事件派发；`EventHub` 继续负责多 handler 隔离。现有业务事件保持兼容，不要求补 `deviceId` 才能表达多设备语义；本期也不把 MultiDevice 事件派发和本地缓存强制收敛绑定。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `ChatClient`、`CoreSDK`、`MessageReceiver`、`EventHub`、`MSync codec/proto`、`ContactManager`、`GroupManager`、`ChatThreadManager`、`ChatManager`、Vitest、Vite、Playwright  
**Storage**: N/A；本功能只派发事件，不新增持久化，不改变现有联系人/群组/会话/消息缓存所有权  
**Testing**: Vitest 单元测试、Vitest 集成测试、TypeScript 类型测试、Playwright E2E API 测试；必要时记录真实双设备触发限制  
**Target Platform**: Web SDK 库，兼容浏览器与现有平台适配器环境  
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`specs/`、`docs/`）  
**Performance Goals**: 每个 notify 只执行一次轻量归一和同设备判断；事件派发不阻塞消息接收主链路；不得为 MultiDevice 事件触发额外 REST 全量刷新  
**Constraints**:
- MultiDevice 使用 ChatClient 级别 `addEventHandler/removeEventHandler`，不新增独立 manager
- 公开来源设备字段统一为 `deviceId?: string`，上游 `resource` / `clientResource` 归一到该字段
- 服务端缺少来源设备时 `deviceId` 保持 `undefined`，不得伪造当前设备或空字符串
- 当前设备回声在可识别时默认过滤，不向业务派发 MultiDevice 事件
- 本期只保证事件派发，不要求联系人、群组、子区、会话或消息缓存新增强制收敛
- 聊天室事件不纳入 MultiDevice 监听范围
- 现有业务事件字段和类型保持兼容，业务 actor 字段不得被复用为设备字段
**Scale/Scope**: 5 个 ChatClient 公开事件回调、5 类 MultiDevice payload、移动端 operation 映射表、协议 fixture、事件派发链路、类型导出、单元/集成/E2E/API 文档与发布治理

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **性能优先**: 设计仅在现有 notify 解码后追加轻量归一和派发，不引入同步阻塞、轮询或隐式全量刷新
- [x] **类型安全**: 新增 operation、payload、handler map 均使用显式 TypeScript 类型；禁止使用 `any`
- [x] **测试驱动**: spec 已要求 unit / integration / E2E / types；tasks 将逐层落到具体文件
- [x] **可靠性**: 同设备回声、缺失 deviceId、unknown operation、单 handler 抛错不影响其他 handler 都纳入测试
- [x] **可扩展性**: MultiDevice normalizer 与业务事件 mapper 解耦，后续可扩展更多 operation 或缓存同步策略
- [x] **可观测性**: unknown/丢弃路径记录脱敏结构化日志，不输出 token 或敏感载荷
- [x] **版本管理**: 实现完成后必须更新版本号、`CHANGELOG.md` 并提交中文 commit

## Project Structure

### Documentation (this feature)

```text
specs/042-multi-device-listener/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── multi-device-listener.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── core/
│   └── message/
│       └── message-receiver.ts
├── protocol/
│   └── msync/
│       ├── codec.ts
│       └── types.ts
├── types/
│   ├── event-system.ts
│   ├── multi-device.ts
│   └── index.ts
└── utils/
    └── logger.ts

tests/
├── unit/
│   ├── multi-device/
│   └── core/message/
├── integration/
│   └── multi-device/
├── types/
└── e2e/
    └── api/
```

**Structure Decision**: 使用现有单包 SDK 结构。新增公开类型集中到 `src/types/multi-device.ts` 并由 `src/types/index.ts`、`src/index.ts` 导出；事件名和 handler map 扩展在 `src/types/event-system.ts`；协议归一优先在 `src/protocol/msync/codec.ts` 与新增 normalizer helper 内完成；最终派发在 `src/core/message/message-receiver.ts`，避免 `ChatClient` 承载复杂协议逻辑。

## Phase 0: Research

研究结论见 `research.md`，覆盖：

1. 公开监听面为何采用分类回调而不是单一总线回调
2. `resource` / `clientResource` / `deviceId` 的对外归一规则
3. 现有业务事件与 MultiDevice 事件的边界
4. 本期不强制缓存收敛的原因和后续扩展点
5. 移动端 `EMMultiDeviceListener` operation 到 Web operation 的映射策略
6. 真实环境 E2E 中双设备触发的可行性和 fixture 兜底策略

## Phase 1: Design & Contracts

设计产物：

- `data-model.md`：定义 MultiDevice 事件 envelope、五类 payload、operation union、device source 与 raw diagnostic 数据
- `contracts/multi-device-listener.md`：记录 ChatClient handler contract、payload 字段、operation 映射、过滤规则和兼容边界
- `quickstart.md`：记录推荐验证命令、分层测试入口和真实环境 E2E 注意事项

设计要点：

1. **事件 surface**：扩展 `EventName`、`EventPayloadMap`、`EventHandlerMap`，让 `ChatClient.addEventHandler` 直接接受五个 MultiDevice 回调。
2. **协议 normalizer**：新增纯函数把 ROSTER/MUC/NOTIFY 载荷归一为 `MultiDeviceEvent`，并保留必要 raw 字段用于诊断；unknown operation 只进入 `UNKNOWN` 或被安全丢弃。
3. **同设备过滤**：如果上游 `deviceId/resource/clientResource` 等于当前 `msyncCodec.getContext().clientResource`，不派发 MultiDevice 事件。
4. **业务事件兼容**：现有联系人、群组、子区、会话、消息业务事件继续走原有 mapper 和 manager；本期不删除 `source: 'multiDevice'` 这类历史兼容提示。
5. **漫游删除**：`onMultiDeviceMessageRemoved` payload 支持 `messageIds?: string[]` 与 `beforeTimestamp?: number`，并在派发前保证至少一个存在。
6. **测试策略**：unit 覆盖 pure normalizer 和 EventHub 类型；integration 覆盖 codec -> receiver -> ChatClient handler；E2E API 覆盖 handler 注册/移除和可稳定触发或 fixture 注入路径。

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=042-multi-device-listener .specify/scripts/bash/update-agent-context.sh codex
```

预期：将 042 的 TypeScript 事件扩展、MSync notify 归一、MultiDevice 不强制缓存收敛和测试分层要求同步到 `AGENTS.md` 的最近技术上下文。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 拆解为：

1. 先落公开类型、事件名、handler map 和导出面
2. 再落 MultiDevice operation 映射与 payload normalizer
3. 接入 `MsyncCodec` / `MessageReceiver` 整链路和同设备过滤
4. 补 ChatClient 类型测试、unit normalizer 测试、integration 链路测试
5. 补 E2E API handler 注册/移除 case 和真实环境可行性记录
6. 更新 API 文档、quickstart、版本号、`CHANGELOG.md`
7. 跑分层验证并提交中文 commit

## Post-Design Constitution Check

- [x] **性能优先**: 设计不引入额外网络请求或缓存刷新；normalizer 为同步轻量纯函数
- [x] **类型安全**: 所有公开 payload 有独立类型，`deviceId` 可选语义明确
- [x] **测试驱动**: 每类事件都有 unit 或 integration 映射测试，公开 handler 有 type/E2E 覆盖
- [x] **可靠性**: 缺失来源、unknown operation、同设备回声、handler 异常隔离均有任务覆盖
- [x] **可扩展性**: MultiDevice 类型与 normalizer 独立，后续缓存收敛可在 manager 层增量定义
- [x] **可观测性**: 丢弃/unknown 路径只记录脱敏 operation/category/device 信息
- [x] **版本管理**: release 治理纳入最终任务

## Complexity Tracking

无 Constitution 例外。
