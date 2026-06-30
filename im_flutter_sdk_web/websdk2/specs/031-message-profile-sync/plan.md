# 实施方案：消息驱动的用户资料补位与群名片同步

**Branch**: `031-message-profile-sync` | **Date**: 2026-04-20 | **Spec**: `specs/031-message-profile-sync/spec.md`  
**Input**: Feature specification from `/specs/031-message-profile-sync/spec.md`

## Summary

本特性为 SDK 增加“由 `enableUserInfoSync` 控制的消息资料版本同步链路”，覆盖两条相互独立但会在消息接收侧汇合的同步路径：一条是全局用户资料版本 `userInfoUpdateTime`，另一条是群维度名片版本 `namecardUpdateTime`。实现上采用“对外初始化开关 `enableUserInfoSync` + `MessageBody` 内部版本字段 + 接收侧缓存优先 hydrated view + 异步补拉队列 + 缓存落盘后再发事件”的方案：当 `enableUserInfoSync=true` 时，登录后同步本人资料版本，发送侧按消息类型挂载版本字段，接收侧基于版本做 cache-first 展示、去重入队、异步补拉与缓存/事件收敛；当 `enableUserInfoSync=false` 时，消息主链路继续保持可用，但发送侧不写入 `userInfoUpdateTime` / `namecardUpdateTime`，接收侧也不进入由版本驱动的比较、补拉、缓存回写与资料同步事件派发链路。消息主链路继续把消息本身视为业务真值，`senderInfo` 仅作为接收侧运行时拼装的展示视图，不入消息真值与持久化；当本地资料已存在且版本不新于消息时，SDK 先用本地旧资料完成当前消息展示，再把命中对象投入异步补拉队列。用户资料补拉按 `userId` 去重，支持“默认 7 秒、可配置窗口 + 默认 20、可配置阈值”的批量收敛；群名片补拉按 `groupId + userId` 去重，支持“默认 7 秒、可配置窗口 + 同群串行 + 跨群并行，默认并行度 5、可配置”的调度语义。两条链路都遵循“先更新运行时缓存与 localStorage，再派发对外事件”的顺序，其中对外事件只保留一层：`onSelfUserInfoUpdated`、`onUserInfoUpdated`、`onUserGroupNamecardUpdated`。冷启动重载到的新消息与实时消息进入同一套补拉队列统一去重；补位结果只更新本轮新加载消息相关视图与缓存，不主动回刷未参与本轮加载的历史消息。缓存层继续复用现有 localStorage 架构：用户资料缓存扩展内部版本元数据，群名片新增独立缓存键与 TTL/LRU 策略，并继续兼容小程序/uni-app/React Native 的存储适配，不依赖浏览器 `URL` 对象或原生 `localStorage` 直连。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient`、`CacheManager`、`EventHub`、`UserInfoManager`、`GroupManager`、MSync protobuf 编解码  
**Storage**: 继续复用现有 localStorage `CacheManager`；用户资料缓存扩展版本元数据；新增群名片独立缓存键与缓存类；不引入新的持久化介质  
**Testing**: Vitest（unit + integration + contract/logic + types），必要时进入 `test:gate:pr`  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 消息主链路不因资料补位阻塞；用户资料批量补拉减少重复请求；群名片跨群并行但同群串行；冷启动重载消息不触发额外无界补拉  
**Constraints**: `userInfoUpdateTime` 与 `namecardUpdateTime` 仅存在于内部 `MessageBody` 协议；秒级时间语义；单聊仅使用 `userInfoUpdateTime`，群消息同时支持两个版本字段，聊天室不使用 `namecardUpdateTime`；对外新增开关为 `InitConfig.enableUserInfoSync?: boolean`，默认值为 `false`；资料补位窗口、批量门槛与并行度由 SDK 内部默认值控制，并仅在 `enableUserInfoSync=true` 时生效；关闭开关时不得进入版本比较、补拉、基于版本的缓存更新与消息驱动事件派发；不新增公开 manager；不直接修改当前内存中的消息对象；时间配置必须集中在 `src/config/timeouts.ts`；事件名与状态名不得散落硬编码；公开事件只保留 `onSelfUserInfoUpdated`、`onUserInfoUpdated`、`onUserGroupNamecardUpdated` 三个入口；群名片缓存不得混入头像、昵称等个人资料字段
**Scale/Scope**: 覆盖 `enableUserInfoSync` 开关、mSync 协议字段扩展、接收侧补位队列、用户资料/群名片缓存收敛、会话摘要版本投影、对外事件派发、冷启动重载消息补位与跨平台存储兼容；不包含新的长期全量成员数据库、历史消息主动回刷器或新的公开 manager

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 消息接收主链路与资料补位链路解耦；用户资料批量补拉、群名片按群收敛与跨群并行可避免大群场景请求风暴
- [x] **类型安全**: 版本字段、缓存记录、补拉队列、事件 payload 与内部 sidecar metadata 全部按 strict TypeScript 建模，不向公开 `Message` 泄露内部协议字段
- [x] **测试驱动**: 计划覆盖协议编解码、消息接收补位、冷启动重载、缓存落盘、事件顺序、部分成功与失败重试语义
- [x] **可靠性**: 资料/名片补拉失败仅影响最终一致性，不阻塞消息派发；补拉结果先写缓存后发事件；同一对象按最大版本去重，避免乱序回退
- [x] **可扩展性**: 用户资料补位与群名片补位拆分为独立协调器，未来可扩展到联系人 remark、群成员属性等额外版本链路
- [x] **可观测性**: 补拉入队、窗口触发、批量/并行调度、部分成功、缓存写回失败、版本比较与事件派发都可接入结构化日志
- [x] **版本管理**: 本期新增内部协议字段、缓存结构与对外事件行为约束；实现阶段必须同步版本号、CHANGELOG 与迁移说明

Phase 1 设计复检结果：待 `research.md`、`data-model.md`、`quickstart.md` 与 `contracts/` 产出后复检。

## Project Structure

### Documentation (this feature)

```text
specs/031-message-profile-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── message-profile-sync.contract.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
│   └── message/
│       ├── message-receiver.ts
│       └── profile-sync/
│           ├── profile-version-sidecar.ts
│           ├── user-info-hydrator.ts
│           ├── user-info-hydration-queue.ts
│           ├── group-namecard-hydrator.ts
│           ├── group-namecard-hydration-queue.ts
│           └── latest-message-version-projector.ts
├── protocol/
│   └── msync/
│       ├── proto-source.json
│       ├── proto.ts
│       ├── codec.ts
│       └── types.ts
├── cache/
│   ├── cache-keys.ts
│   ├── cache-types.ts
│   ├── cache-manager.ts
│   ├── user-info-cache.ts
│   └── group-namecard-cache.ts
├── config/
│   ├── cache.ts
│   └── timeouts.ts
├── managers/
│   ├── user-info-manager.ts
│   └── group-manager.ts
├── types/
│   ├── user-info.ts
│   ├── group.ts
│   ├── event-system.ts
│   └── index.ts
├── chat-client.ts
└── rest/
    ├── user-info.ts
    └── group-management.ts

tests/
├── unit/
│   ├── core/message/
│   ├── cache/
│   ├── protocol/
│   └── chat-client/
├── integration/
│   ├── message-profile-sync/
│   ├── user-info-manager/
│   ├── group-manager/
│   └── cache/
├── contract/
│   └── message-profile-sync.contract.test.ts
└── types/
    └── chat-client-events.d.ts
```

**Structure Decision**: 沿用单项目结构。协议改动收敛在 `src/protocol/msync/`；消息接收入口仍位于 `src/core/message/message-receiver.ts`，但资料补位逻辑拆入新的 `src/core/message/profile-sync/` 私有模块，避免把接收器本体继续膨胀。`enableUserInfoSync` 的对外配置、校验与内部归一化继续沿用 `src/types/chat-client.ts`、`src/validators/chat-client.ts` 与 `src/chat-client.ts` 现有初始化链路；缓存层在 `src/cache/` 新增群名片缓存并扩展用户资料与会话摘要结构；配置沿用 `src/config/cache.ts` 与 `src/config/timeouts.ts`；对外事件类型与 payload 统一收口到 `src/types/event-system.ts`、`src/types/user-info.ts`、`src/types/group.ts`。实现阶段不新增新的公开 manager，而是由 `ChatClient` 在既有事件体系与 manager 能力之上编排“开关控制 + 补位逻辑”。

## Phase 0: Research

输出：`specs/031-message-profile-sync/research.md`

- 固化 `MessageBody` 内部版本字段与公开 `Message` 隔离策略：协议可解码、接收侧可消费，但不进入公开消息模型
- 固化 `enableUserInfoSync` 的开关边界：开启/关闭时分别哪些发送、接收、缓存与事件行为生效，哪些必须静默
- 固化用户资料/群名片补拉队列的配置归属：窗口、阈值、跨群并行度分别落到哪些配置常量，确保不在业务逻辑中硬编码
- 固化用户资料缓存、群名片缓存与会话摘要投影之间的边界：哪些字段持久化、哪些仅做运行时 sidecar
- 固化冷启动重载消息的补位语义：如何与实时消息共享队列、如何限定“只更新本轮新加载消息”
- 固化群名片缓存淘汰策略与优先级：自己/联系人/最近活跃保留如何在用户资料与群名片两个缓存域保持一致
- 固化事件顺序与日志边界：缓存写回、对外事件派发、部分成功与失败日志的先后顺序
- 固化跨平台兼容策略：避免直接依赖原生 `localStorage` / `URL` 的落点，并明确小程序环境如何复用同一套语义

## Phase 1: Design & Contracts

输出：

- `specs/031-message-profile-sync/data-model.md`
- `specs/031-message-profile-sync/contracts/message-profile-sync.contract.yaml`
- `specs/031-message-profile-sync/quickstart.md`

设计要点：

1. 设计对外开关与初始化配置归一化
   - 在 `src/types/chat-client.ts` / `src/validators/chat-client.ts` / `src/chat-client.ts` 增加 `enableUserInfoSync` 配置，默认值为 `false`
   - 明确 `enableUserInfoSync` 与内部资料补位调度的关系：窗口、批量门槛与并行度仅在开关开启时生效
   - 明确开关关闭时，发送侧、接收侧、缓存收敛与消息驱动事件链路整体静默
2. 扩展 mSync 协议与内部 sidecar metadata
   - 在 `src/protocol/msync/proto-source.json` / `proto.ts` 中为 `MessageBody` 增加 `userInfoUpdateTime` 与 `namecardUpdateTime`
   - 在 `codec.ts` / `types.ts` 中把两个字段解码到内部 sidecar metadata
   - 明确这两个字段不会出现在公开 `Message` 类型上
3. 设计接收侧资料补位入口
   - 在 `message-receiver.ts` 中引入 profile sync 协调器，并受 `enableUserInfoSync` 总开关约束
   - 先用缓存或最小身份信息构造当前消息展示所需 hydrated view
   - 再异步把命中对象投入对应补拉队列，不阻塞消息派发
4. 设计用户资料补拉队列
   - 按 `userId` 去重
   - 默认 7 秒窗口、默认 20 阈值，且都可配置
   - 冷启动重载消息与实时消息共用同一队列，并以最大 `userInfoUpdateTime` 为目标版本
   - 支持部分成功：成功项写缓存并发事件，失败项仅记日志
5. 设计群名片补拉队列
   - 按 `groupId + userId` 去重
   - 默认 7 秒窗口、可配置
   - 同群串行、跨群并行，默认并行度 5、可配置
   - 每次只拉本轮命中的用户，不跨群合批
   - 支持部分成功与按处理顺序依次派发 `onUserGroupNamecardUpdated`
6. 扩展缓存与会话摘要投影
   - 扩展 `UserInfoSummary` 内部元数据，至少支持 `userInfoUpdateTime` 与必要的同步时间
   - 新增 `GroupNamecardCacheRecord` 与独立缓存 key、缓存类
   - 扩展 `MessageSnippet` / `ConversationSummary.lastMessage` 的版本字段投影：群会话保留两个版本字段，单聊仅保留 `userInfoUpdateTime`
7. 设计事件与回写顺序
   - 用户资料：先写运行时缓存与 localStorage，再派发 `onSelfUserInfoUpdated` / `onUserInfoUpdated`
   - 群名片：先写运行时缓存与 localStorage，再派发 `onUserGroupNamecardUpdated`
   - 当前用户自己的群名片更新不触发 `onUserGroupNamecardUpdated`
   - 当前用户自己的资料更新必须触发 `onSelfUserInfoUpdated`
8. 设计当前用户主动更新链路
   - `UserInfoManager.updateOwnInfo` 成功后立即更新本端缓存；仅当 `enableUserInfoSync=true` 时，保证下一条消息携带最新 `userInfoUpdateTime`
   - 群名片更新成功后立即更新对应 `groupId + userId` 缓存；仅当 `enableUserInfoSync=true` 时，保证下一条该群消息携带最新 `namecardUpdateTime`
9. 测试切面
   - 单元：版本比较、去重、窗口触发、跨群并行、缓存投影、事件顺序、最小身份信息兜底
   - 单元补充：`enableUserInfoSync=true/false` 对消息挂载、接收侧静默与事件派发的分支覆盖
   - 集成：mSync 编解码 -> message-receiver -> UserInfoManager/GroupManager -> CacheManager -> 对外事件整链路
   - 契约：内部版本字段、事件序列与部分成功/失败语义的逻辑契约
   - 类型：对外 `Message` 不泄露内部版本字段；`InitConfig.enableUserInfoSync` 与事件类型收口正确

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=031-message-profile-sync .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 031 的协议字段、资料补位队列、群名片缓存与事件语义补充到仓库 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 增加 `enableUserInfoSync` 对外初始化配置、校验与内部归一化
2. 扩展 mSync `MessageBody` 版本字段与内部 sidecar metadata
3. 新增接收侧 profile sync 协调器，把资料补位从 `message-receiver` 主体中拆分出来，并统一受开关控制
4. 实现用户资料补拉队列、阈值/窗口配置、冷启动与实时消息统一去重
5. 实现群名片补拉队列、同群串行/跨群并行调度、部分成功与事件顺序
6. 扩展用户资料缓存、群名片缓存与会话摘要版本投影
7. 接入 `UserInfoManager` / `GroupManager` 主动更新链路，在开关开启时保证本端后续消息携带最新版本
8. 补齐单元/集成/契约/类型测试与小程序兼容回归说明，覆盖开关开启/关闭两种模式
9. 实现收尾：版本号、CHANGELOG、验证与提交

## Complexity Tracking

无额外豁免项。
