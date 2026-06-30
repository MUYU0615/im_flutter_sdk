# E2E 测试

## 概述

E2E 测试使用 Playwright 在真实浏览器中运行，连接真实服务器验证 SDK 功能。

测试分为两类：

### 1. SDK API 测试（robot 迁移）

直接调用 SDK API，不依赖 demo UI。每个用户在独立浏览器页面中运行，天然隔离 SDK 单例/WebSocket/localStorage。

| 文件 | 模块 | 用例数 | 需要双账号 |
|------|------|--------|-----------|
| auth.spec.ts | 登录注册 | 8 | ❌ |
| contact.spec.ts | 好友管理 | 10 | ✅ |
| presence.spec.ts | 在线状态 | 11 | ✅ |
| message-single.spec.ts | 单聊消息 | 11 | ✅ |
| message-group.spec.ts | 群聊消息 | 5 | ✅ |
| chat-manager-advanced.spec.ts | ChatManager 进阶 API | 9 | ✅ |
| user-info.spec.ts | 用户信息 | 4 | ✅ |
| group.spec.ts | 群组管理 | 25 | ✅ |
| conversation-manage.spec.ts | 会话管理 | 6 | ✅ |
| chatroom.spec.ts | 聊天室 | 17 | ✅（需 CHATROOM_ID） |
| push.spec.ts | PushManager | 8 | ✅ |
| reaction.spec.ts | Reaction | 7 | ✅ |
| multi-device.spec.ts | 多设备事件 | 1 | ✅ |

使用 `fixtures/sdk-api.ts` 提供 `userA`/`userB` fixture，通过 `page.evaluate` 调用 SDK。

当前 `tests/e2e/api/` 共 13 个 spec 文件、121 个 Playwright API case。`PushManager` 已补齐真实环境 E2E；`ChatThreadManager` 仍作为独立后续阶段处理，不计入 041 robot 主迁移收口。

Public API 覆盖矩阵见 `api/public-api-coverage-matrix.md`。该矩阵按 manager/API 维度记录已覆盖、部分覆盖、缺错误场景、环境阻塞和未覆盖项，后续补 case 以该文件为基线。

### 2. Demo UI 测试

通过 demo 页面的 UI 控件操作 SDK，验证 demo 交互流程是否正常。

| 文件 | 验证内容 |
|------|---------|
| init-connect.spec.ts | 初始化与登录 UI 流程 |
| send-receive.spec.ts | 消息发送 UI 流程 |
| logout.spec.ts | 登出 UI 流程 |
| message-actions.spec.ts | 消息动作（标记已读） |
| conversation-rest.spec.ts | 会话 REST + 消息置顶 UI |
| profile-sync.spec.ts | 资料补位 UI |
| profile-sync-group.spec.ts | 群名片补位 UI |
| session-list.spec.ts | 会话列表 UI |
| voice-to-text.spec.ts | 语音转文字 UI |

使用 `fixtures/sdk-flow.ts` 提供 demo 页面操作封装。

## 运行

```bash
# 运行全部 E2E
npm run test:e2e

# 只运行 SDK API 测试（nightly 定时跑这个）
npm run test:e2e:api

# 只运行 Demo UI 测试
npm run test:e2e:demo
```

## 环境配置

在项目根目录 `.env` 中配置（参考 `.env.example`）：

```env
# 必填
EASEMOB_APPKEY=your-appkey
EASEMOB_USERID=user1
EASEMOB_TOKEN=token1

# 双账号测试（contact/presence/message 等）
EASEMOB_SECOND_USERID=user2
EASEMOB_SECOND_TOKEN=token2

# 三账号测试（部分群组/邀请/多成员场景）
EASEMOB_THIRD_USERID=user3
EASEMOB_THIRD_TOKEN=token3

# 聊天室测试
EASEMOB_CHATROOM_ID=chatroom-id

# 可选
EASEMOB_PASSWORD=          # 未配置 token 时可通过密码换 token
EASEMOB_SECOND_PASSWORD=
EASEMOB_THIRD_PASSWORD=
EASEMOB_TARGET_ID=          # 消息发送目标，默认发给自己
EASEMOB_GROUP_ID=           # 预置群组 ID
EASEMOB_REST_URL=https://a1.easemob.com  # REST API 地址
```

## 载体页面

SDK API 测试使用 `demo/test-harness.html` 作为最小载体页面，只加载 SDK bundle 并暴露全局 API，不包含任何 UI。

Demo UI 测试使用 `demo/index.html`（完整 React demo 页面）。

## 设计原则

- 每个测试文件串行执行（`workers: 1`，`fullyParallel: false`）
- 双账号测试通过独立浏览器页面实现隔离，不受 SDK 单例限制
- 缺少必要配置时自动 skip，不会报错
- 事件通过 `window.__EVENTS__` 缓冲池收集，支持乱序到达
- API case 必须区分稳定字段与动态字段：稳定字段精确相等，动态字段断类型/格式/正数，不用单纯 `toBeDefined()` 作为结束断言
- 错误 case 断 `name/code/message/details`，事件 case 断事件名对应的关键 payload 字段
- Nightly 定时执行：`npm run test:e2e`
