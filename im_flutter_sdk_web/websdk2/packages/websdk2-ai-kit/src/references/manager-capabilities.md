---
id: manager-capabilities
title: websdk2 Manager Capabilities
description: 汇总各 manager 的职责、典型 API 和常见误用，方便快速判断该走哪个入口。
---
# websdk2 Manager Capabilities

汇总各 manager 的职责、典型 API 和常见误用，方便快速判断该走哪个入口。

## Manager 对照表

| Manager | 主要职责 | 常见 API / 动作 |
|---------|----------|-----------------|
| `ChatManager` | 会话与消息扩展操作 | 会话已读、置顶、会话 REST |
| `ContactManager` | 联系人、黑名单、备注 | 获取联系人、添加好友、黑名单管理 |
| `GroupManager` | 群组资料、成员、公告、属性 | 获取群信息、成员管理、群公告 |
| `ChatroomManager` | 聊天室成员与属性 | 获取聊天室、成员列表、属性操作 |
| `PresenceManager` | 在线状态 | 订阅/查询 presence |
| `PushManager` | 推送配置 | 免打扰、推送展示配置 |
| `UserInfoManager` | 用户资料 | 查询、订阅、资料补位 |
| `ChatThreadManager` | 线程消息 | 创建/查询 thread、thread 消息链路 |

## 常见误用

- 把会话操作直接写成 `client` 自定义逻辑，而不是走 `ChatManager`
- 把联系人资料和用户资料订阅当成同一套能力
- 在群聊场景中传单聊 `channelType`
- 忽略 manager 自身的登录前置条件

## 待补结构

- 每个 manager 的更完整 API 速查
- 与旧 SDK 命名差异的迁移对照
- 典型测试入口与测试层建议
