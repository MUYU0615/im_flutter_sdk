# 实施方案：ChatClient Token 续期与 RTC Token 能力

**Branch**: `039-chatclient-token-rtc` | **Date**: 2026-05-13 | **Spec**: `specs/039-chatclient-token-rtc/spec.md`
**Input**: Feature specification from `/specs/039-chatclient-token-rtc/spec.md`

## Summary

本期在 `ChatClient` 上补齐 IM token 生命周期与 RTC 辅助能力：`renewToken` 更新当前登录 token 并返回续期结果；`onTokenWillExpire` / `onTokenExpired` 通过现有事件系统对外派发；token 过期后断开当前长连接但不执行完整 `logout`；`getRTCTokenInfo` 和 `getUserIdsWithRTCUids` 复用当前登录态发起 REST 请求，并以 SDK 稳定业务对象返回。

技术方案保持现有分层：`ChatClient` 只承载公开 API、参数校验和编排；连接 token 生命周期进入 `ConnectionManager/CoreSDK`；RTC REST 调用放入独立 helper；事件名、类型和返回结构集中在 `types`；测试覆盖单元、集成与真实环境可行性记录。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 ChatClient、CoreSDK、ConnectionManager、EventHub、RestClient、MSync codec、zod/Validator、Vitest、Vite、eslint
**Storage**: N/A；本功能只维护当前登录会话内 token 生命周期状态和计时器，不新增持久化
**Testing**: Vitest 单元/集成测试；必要时补充 Playwright E2E 或 quickstart 真实环境记录
**Target Platform**: Web SDK 库，兼容浏览器与已接入的平台适配器环境
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`specs/`、`docs/`）
**Performance Goals**: `renewToken` 本地状态更新和事件派发保持毫秒级；RTC REST 调用只做一次网络请求，不引入轮询或额外重试风暴
**Constraints**:
- 公共 API 必须返回业务对象或抛出 `SDKError` 子类，不透传服务端包装
- token 值不得进入日志、错误 details 或事件 payload
- `onTokenWillExpire` 在 token 生命周期剩余最后 20% 时触发，每个 token 生命周期正常只触发一次
- token 过期只断开当前长连接，不执行完整 `logout`，不清理本地登录态、缓存和已注册事件
- 过期后不得使用旧 token 自动重连
**Scale/Scope**: 3 个 ChatClient 公开方法、2 个公开连接事件、3 个 REST 映射、连接层 token 生命周期状态、对应类型与测试

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **性能优先**: token 计时器和状态更新为本地轻量操作；REST 调用按需触发，不新增后台轮询
- [x] **类型安全**: 新增公开入参、返回值、事件 payload 均使用显式 TypeScript 类型，禁止 `any`
- [x] **测试驱动**: 计划覆盖公开 API、连接状态机、事件派发、REST normalizer 与错误路径
- [x] **可靠性**: token 过期与普通断线、重连、logout 边界独立；过期后暂停旧 token 重连
- [x] **可扩展性**: RTC REST helper 与 token 生命周期逻辑分层，后续可扩展更多 RTC 参数或 token 元数据
- [x] **可观测性**: 记录续期/过期关键事件但必须脱敏 token；断开原因可诊断
- [x] **版本管理**: 已规划版本号和 CHANGELOG 更新；本期为新增 API，非破坏性变更

## Project Structure

### Documentation (this feature)

```text
specs/039-chatclient-token-rtc/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── chatclient-token-rtc.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── core/
│   ├── index.ts
│   └── connection/
│       └── connection-manager.ts
├── rest/
│   └── rtc-token.ts
├── types/
│   ├── chat-client.ts
│   ├── connection.ts
│   ├── event-system.ts
│   └── index.ts
└── utils/
    ├── error-codes.ts
    └── errors.ts

tests/
├── unit/
│   ├── chat-client-token-rtc/
│   ├── core/connection/
│   ├── rest/
│   └── types/
└── integration/
    └── chat-client-token-rtc/
```

**Structure Decision**: 使用现有单包 SDK 结构。公开入口继续放在 `ChatClient`；连接状态和 token 计时器归属 `ConnectionManager`；REST 映射集中到 `src/rest/rtc-token.ts`；公共类型和事件扩展在 `src/types/*`，避免跨层硬编码字符串。

## Phase 0: Research

研究结论见 `research.md`，覆盖：

- token 过期时间获取与续期返回结果
- `onTokenWillExpire` 最后 20% 生命周期触发模型
- token 过期断开但不 logout 的边界
- RTC token 和 RTC UID mapper 的 REST 契约
- 公开返回字段命名与敏感信息脱敏

## Phase 1: Design & Contracts

设计产物：

- `data-model.md`：定义 TokenLifecycle、TokenRenewalResult、RtcTokenInfo、RtcUidUserIdMap、TokenExpiredDisconnect
- `contracts/chatclient-token-rtc.openapi.yaml`：记录 REST 依赖路径和原始响应到 SDK 业务对象的映射
- `quickstart.md`：记录建议验证命令、单元/集成/E2E 或真实环境验证路径

## Post-Design Constitution Check

- [x] **性能优先**: 设计不引入持久化和后台拉取；计时器随 token 生命周期重置
- [x] **类型安全**: 所有新增对象和事件均在类型层建模，旧服务端字段不作为主公开契约
- [x] **测试驱动**: 每个用户故事都有对应单元/集成测试位置，E2E 风险记录在 quickstart
- [x] **可靠性**: 过期断开与 logout、普通网络断开、自动重连有明确边界
- [x] **可扩展性**: RTC options object 可扩展；映射对象允许部分缺失结果
- [x] **可观测性**: 只记录脱敏状态和原因，不打印 token
- [x] **版本管理**: 版本与 CHANGELOG 已纳入本次变更范围

## Complexity Tracking

无 Constitution 例外。
