# 035 快速验证指南（Phase 1）

## 目标

验证会话列表同步与 `SessionItem` 满足以下核心约束：

- `ChatManager` 同时提供 `getSessionList()` 与 `refreshSessionList()`
- `getSessionList()` 纯读缓存，不触发网络
- 登录后优先进行新会话列表同步，再进入好友同步与漫游消息调度
- 新链路失败时仅会话列表能力回退，不影响其他同步链路
- 同一登录周期确认 unsupported/unconfigured 后不再重复探测
- `SessionItem.conversationName` / `conversationAvatar`、`SessionMessageSnippet`、`SessionListRemindType` 的公开形态稳定
- demo 保留旧 `ConversationPanel`，同时并行展示新的 `SessionListPanel`

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可用登录态（`appKey`、`userId`、`token`、REST 地址、`syncDataWSHost` / `syncDataWSPort`）。

3. 准备以下测试环境：

- 环境 A：支持新会话列表 WSS 协议
- 环境 B：未配置 session-list 同步链路
- 环境 C：服务端明确返回 unsupported

4. 准备可控测试数据：

- 置顶会话
- 新增会话 / 删除会话
- 群名称 / 群头像 / 单聊 metadata 变化
- 同步期间 MSync 又收到新消息或会话删除事件

## 验证步骤

### 步骤 1：基础静态检查

```bash
npm run lint
npm run type-check
```

期望：035 相关文件通过静态检查。

### 步骤 2：单元与集成测试

```bash
npm run test:run -- tests/unit/session-list-sync tests/unit/cache/session-list-cache.test.ts tests/unit/managers/chat-manager-session-list.test.ts tests/integration/session-list-sync
```

期望：

- `SessionItem` 字段归一化正确
- checkpoint 推进与完整快照覆盖正确
- unsupported/unconfigured 登录周期探测缓存正确
- Promise 复用、不重复派发 start 正确

### 步骤 3：`getSessionList()` 纯缓存读取

- 初始化并登录 SDK
- 不主动调用 `refreshSessionList()`
- 直接读取 `chatManager.getSessionList()`

期望：

- 同步返回 `ReadonlyArray<SessionItem>`
- 不发起额外网络请求
- 返回内容与当前 session-list 缓存一致

### 步骤 4：登录后前置同步

- 在支持新链路环境中登录
- 观察结构化日志与 demo 面板

期望：

- 先触发 `onSyncDataStart`
- 完成新会话列表同步
- 再继续好友同步与后续消息调度
- `onSyncDataFinished({ dataType: 'conversation', status: 'success' })` 仅在最后一批成功入库并推进 checkpoint 后触发

### 步骤 5：主动刷新与 Promise 复用

- 连续两次快速调用 `chatManager.refreshSessionList()`

期望：

- 第二次调用复用第一次的在途 Promise
- 不重复发起第二个 WSS 请求
- 不重复触发 `onSyncDataStart`

### 步骤 6：unsupported / unconfigured 回退

- 使用未配置同步链路环境，或让服务端明确返回 unsupported
- 登录并多次点击 `refreshSessionList()`

期望：

- 首次探测后回退旧逻辑
- 同一登录周期后续刷新不再重复探测
- 仍返回统一 `SessionItem[]`
- 好友同步与漫游消息链路继续执行

### 步骤 7：完整快照覆盖与删除语义

- 预置本地存在会话 A/B/C
- 服务端完整快照只返回 A/B

期望：

- 同步成功后 session-list 缓存仅保留 A/B
- 会话 C 被删除
- 排序仍保持 `pinnedTimestamp desc -> updatedAt desc`

### 步骤 8：WSS 与 MSync 并发收敛

- WSS 同步过程中，让 MSync 再收到：
  - 新消息
  - 新会话
  - 会话删除
  - 未读数变化

期望：

- 新消息/新会话按更晚更新时间优先
- 删除/退出在完整快照结束后统一收敛
- 最终 `SessionItem` 与完整快照 + 更晚本地事实一致

### 步骤 9：demo 浏览器验证

```bash
npm run dev
```

- 登录 demo
- 观察旧 `ConversationPanel`
- 观察新 `SessionListPanel`
- 点击 `refreshSessionList()`

期望：

- 旧面板保持可用
- 新面板显示 `conversationName` / `conversationAvatar`、未读数、置顶状态、最后消息摘要
- 控制台/日志能看到 `onSyncDataStart` 与 `onSyncDataFinished`

### 步骤 10：E2E

```bash
npx playwright test tests/e2e/session-list.spec.ts --project=chromium
```

期望：

- 登录后新面板可见
- 主动刷新可触发同步日志
- 回退模式下新面板仍能显示 `SessionItem` 列表
- 旧 `ConversationPanel` 不被破坏

## 验收清单（对应 spec）

- `getSessionList()` 纯缓存读取：通过率 100%
- 登录后前置同步顺序：通过率 100%
- unsupported/unconfigured 登录周期内不重复探测：通过率 100%
- 完整快照覆盖与删除语义：正确率 100%
- `conversationName` / `conversationAvatar` / `lastMessage` / `SessionListRemindType`：字段稳定率 100%
- WSS/MSync 并发收敛：最终一致性正确率 100%
- demo 新旧面板并行：通过率 100%

## 待记录实测

- `npm run test:run -- tests/unit/session-list-sync tests/unit/cache/session-list-cache.test.ts tests/unit/managers/chat-manager-session-list.test.ts tests/integration/session-list-sync`
- `npx playwright test tests/e2e/session-list.spec.ts --project=chromium`
- `npm run test:gate:pr`

## 本轮实测记录（2026-04-30）

- `npm run type-check`
  - 结果：通过
- `npm run test:run -- tests/unit/managers/chat-manager-session-list.test.ts tests/unit/session-list-sync/session-list-sync-controller.test.ts tests/integration/session-list-sync/session-list-fallback.integration.test.ts`
  - 结果：通过（3 files / 14 tests）
- `npm run lint`
  - 结果：无 error；仍存在仓库既有 warning
  - 说明：warning 位于 `src/core/contact-sync/roster-sync-client.ts`、`src/managers/chatroom-manager.ts`、`src/rest/chat-thread-management.ts`、`src/rest/conversation-management.ts`
- `npm run test:e2e -- tests/e2e/session-list.spec.ts`
  - 结果：Playwright 启动成功，但当前真实环境 E2E 全部 skipped，未形成有效浏览器断言结果
- `npm run test:gate:pr`
  - 当前状态：已通过 unit（153 files / 716 tests）与已输出的 integration / contract 阶段，等待命令最终退出状态

## 本轮补测记录（2026-05-06）

- `npm run test:run -- tests/unit/session-list-sync/session-item-normalizer.test.ts tests/unit/session-list-sync/session-list-sync-controller.test.ts tests/integration/session-list-sync/session-list-sync.integration.test.ts tests/integration/session-list-sync/session-list-fallback.integration.test.ts tests/integration/session-list-sync/session-list-msync-merge.integration.test.ts`
  - 结果：通过（5 files / 20 tests）
  - 覆盖补齐：
    - 登录后先 session-list sync，再进入 contact sync
    - 服务端空快照/无变化时形成 `start -> finish` 闭环且保留本地列表
    - WSS 快照与实时消息 patch 并发时保留更晚本地事实
    - 完整快照覆盖时删除本地多余会话并保持排序
- `npm run type-check`
  - 结果：未通过
  - 失败原因：仓库现有无关错误 `[src/core/message/message-receiver.ts](/Users/wangmeng/IdeaProjects/easemob-font/WEBSDK2/src/core/message/message-receiver.ts:19)` 仍在从 `../../types` 导入不存在的 `ConversationType`，不属于本轮 035 变更引入的问题
- `tests/e2e/session-list.spec.ts`
  - 结果：已补强断言，增加 `refreshSessionList` 按钮可见性检查
  - 说明：仓库当前 `npm run test:run` 配置排除 `tests/e2e/**`，需继续通过 Playwright 真实环境执行

## 本轮浏览器复测记录（2026-05-07）

- `npm run type-check`
  - 结果：通过
- `npm run test:run -- tests/unit/cache/cache-manager.test.ts`
  - 结果：通过（1 file / 11 tests）
- `E2E_BASE_URL='http://127.0.0.1:43173' EASEMOB_APPKEY='easemob-demo#chatdemoui' EASEMOB_USERID='tst' EASEMOB_TOKEN='***' EASEMOB_TARGET_ID='tst01' EASEMOB_SECOND_USERID='tst01' EASEMOB_SECOND_TOKEN='***' EASEMOB_GROUP_ID='307266346614785' npx playwright test tests/e2e/profile-sync-group.spec.ts --project=chromium --output=/tmp/pw-profile-sync-group-rerun`
  - 结果：通过（1 passed / 10.9s）
  - 说明：无头 Chromium 复跑通过，确认 `031-message-profile-sync` 群名片补位与 `035-session-list-sync` refresh 后保留群会话仍稳定
- `open -a 'Google Chrome'` 启动独立可见浏览器窗口后，执行
  `E2E_BASE_URL='http://127.0.0.1:43173' ... PLAYWRIGHT_CHROMIUM_CONNECT_OVER_CDP='http://127.0.0.1:9223' npx playwright test tests/e2e/profile-sync-group.spec.ts --project=chromium --headed --output=/tmp/pw-profile-sync-group-headed`
  - 结果：通过（1 passed / 12.4s）
  - 说明：真实 Google Chrome 有头窗口中同样通过，确认群场景不仅在无头模式通过，在可见浏览器交互链路里也通过
