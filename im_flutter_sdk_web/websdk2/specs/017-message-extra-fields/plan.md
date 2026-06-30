# 实施方案：消息扩展字段（direct / receiverList / isBroadcast / isContentReplaced / deliverOnlineOnly / priority）

**Branch**: `017-message-extra-fields` | **Date**: 2026-02-13 | **Spec**: `specs/017-message-extra-fields/spec.md`  
**Input**: 规范文档 `/specs/017-message-extra-fields/spec.md`

## 概述

在现有 Message 创建与 protobuf 收发链路中补充 6 个扩展字段能力，保证发送侧可设置策略、接收侧可感知语义、ACK 仅内部处理且不触发 `onMessage`。

## 技术背景

- **语言/版本**: TypeScript 5.x（strict）
- **测试框架**: Vitest
- **协议基础**: `src/protocol/msync/proto.ts` / `src/protocol/msync/codec.ts`
- **相关模块**:
  - 创建链路：`src/types/message-create.ts`、`src/validators/message-create.ts`、`src/message/create-message.ts`
  - 接收链路：`src/protocol/msync/codec.ts`、`src/core/message/message-receiver.ts`

## 设计要点

1. **类型与创建参数对齐**
   - `Message` 增加扩展字段：`direct/receiverList/deliverOnlineOnly/priority/isBroadcast/isContentReplaced`
   - 创建参数层支持 `receiverList/deliverOnlineOnly/priority`
   - 创建结果默认 `direct = SEND`

2. **发送协议映射**
   - `receiverList` → `Meta.directedUsers` + `routetype=ROUTE_DIRECT`
   - `deliverOnlineOnly` → `routetype=ROUTE_ONLINE`
   - `priority`（聊天室）→ `Meta.ext.chatroom_msg_tag`
   - 优先级：`receiverList > deliverOnlineOnly > 默认路由`

3. **接收语义解析**
   - 下行真实消息补充 `direct = RECEIVE`
   - 解析聊天室扩展：`isBroadcast`、`priority`
   - 解析消息元信息：`isContentReplaced`
   - ACK/内部回执继续仅内部处理，不进入 `onMessage`

4. **兼容策略**
   - 不传新增字段保持当前行为
   - `CmdMessageBody.deliverOnlineOnly` 作为兼容输入，Message 顶层字段作为统一出口

## 工程结构

```text
src/
├── types/
│   ├── index.ts
│   └── message-create.ts
├── validators/
│   └── message-create.ts
├── message/
│   └── create-message.ts
└── protocol/msync/
    └── codec.ts

tests/
├── unit/message/
│   ├── create-text-message.test.ts
│   └── create-cmd-custom-message.test.ts
└── unit/core/message/
    └── message-receiver.test.ts
```

## 测试策略

- 创建链路：校验 `direct` 默认值与 `receiverList/deliverOnlineOnly/priority` 透传
- 协议链路：校验上行映射与下行解析（广播、内容替换、方向）
- 回归场景：ACK 不触发 `onMessage`

## 风险与权衡

- **风险**: `meta.meta` 解码格式兼容差异导致 `isContentReplaced` 解析失败  
  **应对**: 使用容错解析，失败时返回默认值不阻断主链路
- **风险**: 路由优先级定义不一致  
  **应对**: 在编码逻辑中固定优先级并补充测试断言

