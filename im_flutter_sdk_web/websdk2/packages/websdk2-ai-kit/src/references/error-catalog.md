---
id: error-catalog
title: websdk2 Error Catalog
description: 按症状整理登录、连接、消息发送、群组权限与 CI 失败的常见原因和首选排查动作。
---
# websdk2 Error Catalog

按症状整理登录、连接、消息发送、群组权限与 CI 失败的常见原因和首选排查动作。

## 登录与鉴权

| 症状 | 优先判断 |
|------|----------|
| `Provision rejected` | token 过期、token/userId/appKey 不匹配、环境不一致 |
| `currentUserId` 为空 | 登录未成功、断言等得太早、连接仍在重试 |
| `initialized: false` | `appKey` 错误或初始化未完成 |

## 连接与路由

| 症状 | 优先判断 |
|------|----------|
| 一直 `connecting` | DNS、WebSocket、网络限制、固定地址配置 |
| 连接建立后又断开 | 多端互踢、服务端状态、网络抖动 |

## 消息与业务 API

| 症状 | 优先判断 |
|------|----------|
| 发消息报目标不存在 | `targetId` 与 `channelType` 不匹配 |
| 群/聊天室接口 403 | 当前用户无权限、目标对象不存在、管理员限制 |
| 会话/置顶断言失败 | 测试数据未准备好、消息链路未完成、列表缓存未刷新 |

## CI 与测试

| 症状 | 优先判断 |
|------|----------|
| coverage 未达门禁 | 最近改动缺关键路径测试、分支覆盖不足 |
| nightly E2E 失败 | secrets、demo 依赖、真实环境凭证、固定地址 |
| workflow skip | 触发条件、schedule、job if 条件 |

## 待补结构

- 群组/聊天室 REST 错误码更细分映射
- 用户资料订阅与联系人相关限流/权限错误
- 平台适配器与上传链路错误清单
