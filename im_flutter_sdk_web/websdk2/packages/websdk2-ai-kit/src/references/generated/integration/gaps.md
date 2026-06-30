---
id: generated/integration/gaps
title: websdk2 Integration - 缺少功能清单
description: 来自 SDK 集成文档 docs/integration/GAPS.md，用于回答 缺少功能清单 相关接入问题。
---

# 缺少的功能（模板有但 SDK 未实现）

本文档记录 easemob-doc 模板中涉及但当前 SDK 尚未实现或无专用 API 的功能。

## 无专用 API（通过其他方式实现）

| 功能 | 模板文档 | 当前状态 | 替代方案 |
|------|----------|----------|----------|
| 输入指示器 | `typing_indication.md` | 无专用 API | 通过 CMD 透传消息实现，详见 [typing_indication.md](./typing-indication.md) |
| 消息引用/回复 | `message_quote.md` | 无专用 API | 通过消息 `ext.msgQuote` 字段实现 |
| 消息转发 | - | 无专用 API | 可通过创建新消息并复制内容实现；合并转发使用 `createCombineMessage` |

## 未实现的功能

| 功能 | 模板文档 | 说明 |
|------|----------|------|
| 消息搜索 | - | 无本地全文搜索能力 |
| 会话草稿 | - | 无草稿存储 API |
| 端到端加密 | - | 未实现 |
| 消息压缩 | - | 未实现 |
| 断点续传 | - | 附件上传不支持断点续传/暂停/秒传 |
| 消息去重 | - | 本地消息去重未实现 |
| 创建聊天室 | `room_manage.md` | 模板中有 `createChatRoom`，当前 SDK 未暴露（仅超级管理员可创建，通常通过 REST API） |

## 模板有但当前 SDK 行为差异

| 功能 | 差异说明 |
|------|----------|
| 消息接收事件 | 模板按类型分事件（`onTextMessage`、`onImageMessage` 等），当前 SDK 统一为 `onMessage` |
| 群组事件 | 模板使用 `onGroupEvent` + `operation` 字段，当前 SDK 使用独立的事件名（`onGroupMemberJoined` 等） |
| 聊天室事件 | 模板使用 `onChatroomEvent` + `operation` 字段，当前 SDK 使用独立的事件名 |
| 会话列表 | 模板使用 `getServerConversations`，当前 SDK 使用 `getConversationList` + WSS 实时同步 |
| 消息创建 | 模板使用 `WebIM.message.create(option)`，当前 SDK 使用 `chatManager.createXxxMessage()` 类型安全方法 |
| 登录方式 | 模板支持密码登录 `conn.open({ user, pwd })`，当前 SDK 仅支持 Token 登录 |

## 建议后续实现优先级

1. **消息搜索** — 常见需求，但 Web 端本地搜索受限于存储
2. **输入指示器专用 API** — 当前 CMD 方案可用但不够优雅
