---
id: upgrade
name: websdk2-upgrade
title: websdk2 SDK Upgrade Guide
description: Use when upgrading from the old Easemob Web SDK to im-sdk-web, migrating old SDK APIs, replacing WebIM/conn usage, or explaining breaking changes.
cursorGlobs: **/*.{ts,tsx,js,jsx,md}
referenceIds:
  - generated/integration/migration-guide
  - generated/integration/whats-new
  - generated/api-reference-index
  - upgrade-and-compatibility
---
# websdk2 SDK Upgrade Guide

Use when upgrading an application from the old Easemob Web SDK to `im-sdk-web`.

## 迁移工作流

1. 先识别旧 SDK 入口和调用形态：`new SDK.connection(...)`、`WebIM.message.create(...)`、`conn.open(...)`、`conn.send(...)`、`conn.addEventHandler(...)`、`conn.*Group*`、`conn.*ChatRoom*`、`conn.*Contact*`。
2. 打开 `websdk2 Integration - 旧 SDK 迁移指南`，按模块读取旧写法到新写法的映射。
3. 需要精确新 API 签名、参数、返回值或错误码时，打开 `websdk2 API Reference Index`，再读取对应 manager/API 分段。
4. 给出迁移建议时优先输出“旧写法 -> 新写法”的小 diff 或替换片段。
5. 标出破坏性变化、已移除能力和需要业务确认的行为。
6. 代码修改后建议运行类型检查和相关登录、消息、manager 测试。

## 高频映射

| 旧 SDK | 新 SDK |
|--------|--------|
| `new SDK.connection({ appKey })` | `ChatClient.init({ appKey, managers })` |
| `conn.open({ user, accessToken })` | `client.login({ userId, token })` |
| `conn.close()` | `await client.logout()` |
| `WebIM.message.create({ type: 'txt', msg })` | `client.chatManager.createTextMessage({ content })` |
| `conn.send(msg)` | `client.chatManager.sendMessage(message)` |
| `to + chatType` | `conversationId + conversationType` |
| `conn.addContact(...)` | `client.contactManager.addContact(...)` |
| `conn.createGroup(...)` | `client.groupManager.createGroup(...)` |
| `conn.joinChatRoom(...)` | `client.chatRoomManager.joinChatRoom(...)` |

## 回答要求

- 先确认用户是在“旧 SDK 迁移”而不是“新项目接入”
- 不凭旧 SDK 记忆猜测新 API，精确签名以 API Reference 为准
- 对返回值变化要明确说明：旧 SDK 常见包装结果迁移为直接 `Promise<T>`
- 对密码登录、已移除配置、事件名变化等破坏性差异要单独列出
- 用户给出旧代码时，优先提供可直接替换的新代码
