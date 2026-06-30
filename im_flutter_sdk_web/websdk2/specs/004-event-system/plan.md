# 实施方案：统一事件系统（addEventHandler 模式）

**Branch**: `004-event-system` | **Date**: 2026-01-22 | **Spec**: `specs/004-event-system/spec.md`  
**Input**: 规范文档 `/specs/004-event-system/spec.md`

## 概述

实现统一事件系统，提供 `addEventHandler/removeEventHandler` 的批量注册/移除能力，迁移现有连接与消息事件到新模式，替换对外 `on/off` 专用方法。事件命名采用 `onX` 规范。ChatClient 仅保留连接事件监听，其余业务事件通过各 Manager 的语法糖入口注册，并通过类型限制只允许本 Manager 的事件。

## 技术背景

- **语言/版本**: TypeScript 5.x
- **主要依赖**: Vitest
- **目标平台**: Web SDK
- **约束**: 仅迁移已有事件，不新增业务事件类型

## 方案要点

1. **EventHub 事件枢纽**
   - 新增 `EventHub`，支持 `addEventHandler(id, handlers)` 与 `removeEventHandler(id)`。
   - 内部维护 `id -> handlers` 映射，并提供 `dispatch(event, payload)`。

2. **事件命名规范**
   - 使用 `onX` 风格（如 `onConnecting`、`onConnected`、`onDisconnected`、`onMessage`）。

3. **对外 API 统一**
   - ChatClient 对外仅暴露连接事件的 `addEventHandler/removeEventHandler`。
   - 非连接类事件通过各 Manager 提供的 `addEventHandler/removeEventHandler` 语法糖监听。
   - 移除 `onConnectionStateChange` 等专用订阅方法。

4. **Manager 事件语法糖与类型限制**
   - 在各 Manager 定义 `ManagerEventMap`（如 Channel 事件），并导出对应的 handler 类型。
   - `Manager.addEventHandler/removeEventHandler` 仅允许注册本 Manager 事件，类型校验在编译期生效。

5. **事件迁移策略**
   - CoreSDK 作为统一事件出口，将内部事件映射到 `EventHub`。
   - 内部模块也迁移到 EventHub，逐步移除 EventEmitter 依赖。

## 现有代码参考

- 旧工程事件系统：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/eventHandler.ts`
- 关键行为：
  - 通过 `addEventHandler(id, handlerObj)` 批量注册
  - `removeEventHandler(id)` 一次性移除
  - dispatch 遍历所有 handler 对象并调用对应事件回调

## 工程结构

```text
src/
├── core/
│   └── events/
│       ├── event-emitter.ts
│       └── event-hub.ts          # 新增：统一事件系统
├── types/
│   └── event-system.ts           # 新增：事件名称、payload 与 Manager 事件映射
└── chat-client.ts                # 更新：改用 add/remove 事件接口
```

## 测试策略

- add/remove 行为覆盖：重复注册、移除不存在 id、不影响其他 handler。
- 连接状态事件：`onConnecting/onConnected/onDisconnected` 顺序与触发验证。
- Manager 语法糖：`client.channelManager.addEventHandler` 可订阅 `onMessage`，注册连接事件应在类型层报错。

## 风险与权衡

- 事件命名规范收敛为 `onX`，需要同步迁移调用方。
- 内部模块全面迁移 EventHub，需避免短期内双路事件导致重复触发。
