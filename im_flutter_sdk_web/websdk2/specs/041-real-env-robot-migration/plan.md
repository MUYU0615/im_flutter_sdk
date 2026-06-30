# Implementation Plan: Real-Env Robot Test Migration

**Branch**: `041-real-env-robot-migration` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/041-real-env-robot-migration/spec.md`

## Summary

将 im-auto-test/wayang/TestCase 中的 robot 测试用例迁移到 `tests/e2e/api/`，使用 Playwright 在浏览器里直接调用 SDK API 连接真实服务器验证。核心工作包括：对齐真实 demo 页面、支持多账号与多浏览器上下文、补齐事件缓冲与数据清理，然后按模块逐一迁移测试用例。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: Playwright、真实 demo 页面、ChatClient、ContactManager、GroupManager、ChatRoomManager、PresenceManager、ChatManager、浏览器上下文隔离  
**Storage**: N/A（纯测试代码，不引入持久化）  
**Testing**: Playwright（`npm run test:e2e`）  
**Target Platform**: 浏览器（真实 demo 页面，不再依赖 Node polyfill）  
**Project Type**: 单仓库 SDK 项目内的测试子目录  
**Performance Goals**: 单次完整运行 < 5 分钟  
**Constraints**: 依赖真实服务器网络连通性；需要有效的测试账号凭证  
**Scale/Scope**: 当前已落地 121 个 Playwright API 测试用例，覆盖 13 个 `tests/e2e/api/` spec 文件；041 robot 主迁移已收口，ChatThreadManager 作为独立后续阶段

## Constitution Check

- [x] **性能优先**: 测试代码不影响 SDK 性能；事件缓冲池使用异步等待不阻塞
- [x] **类型安全**: 所有 helper 和测试文件使用 TypeScript strict，无 any（仅单例绕过处使用 `as unknown as`）
- [x] **测试驱动**: 本 spec 产出即为测试代码
- [x] **可靠性**: 事件缓冲池容忍乱序；超时机制防止测试挂起
- [x] **可扩展性**: helper 模块化设计，新增模块只需新建测试文件
- [x] **可观测性**: 测试失败时输出连接状态、已收事件、错误详情
- [x] **版本管理**: N/A（测试代码不发布）

## Project Structure

### Documentation (this feature)

```text
specs/041-real-env-robot-migration/
├── spec.md              # 功能规格
├── plan.md              # 本文件
└── tasks.md             # 任务清单（后续生成）
```

### Source Code

```text
tests/e2e/
├── fixtures/
│   ├── sdk-flow.ts               # 真实 demo 页面流程封装
│   └── sdk-api.ts                # 多页面多账号 API 封装与事件收集
└── api/
    ├── auth.spec.ts              # 登录注册
    ├── contact.spec.ts           # 好友管理
    ├── user-info.spec.ts         # 用户信息
    ├── presence.spec.ts          # 在线状态
    ├── conversation-manage.spec.ts # 会话管理（含 REST 相关断言）
    ├── chat-manager-advanced.spec.ts # ChatManager 进阶 API / media / pin / translation / validation
    ├── group.spec.ts             # 群组管理
    ├── chatroom.spec.ts          # 聊天室管理（含聊天室消息 case）
    ├── message-single.spec.ts    # 单聊消息
    ├── message-group.spec.ts     # 群聊消息
    ├── reaction.spec.ts          # Reaction
    └── multi-device.spec.ts      # 多设备事件 listener smoke
```

**Structure Decision**: 沿用已有的 `tests/e2e/api/` 目录结构，按功能模块平铺 spec；共享逻辑统一放在 `tests/e2e/fixtures/`。

## Implementation Snapshot

- 截至 2026-05-25，041 的实现已经从 Node real-env / polyfill 路线完全收敛到浏览器 E2E。
- 当前真实落点为 `tests/e2e/api/`，共有 13 个 spec 文件、121 个 Playwright API case。
- 聊天室配置已可用，最近一次 `chatroom.spec.ts` 定向回归为 `17 passed`，已覆盖 `消息/聊天室.robot` 的 text/cmd/custom 合并 case。
- 当前完成状态：
  - 041 robot 主模块迁移已完成；
  - 主要断言已收紧到成功结果、错误结果、事件 payload、动态字段四类；
  - `ChatClient`、`ContactManager`、`PresenceManager`、`ChatManager`、`GroupManager`、`ChatRoomManager`、`UserInfoManager`、Reaction 与消息收发热路径均已有浏览器 real-env case；
  - `PushManager` 已补真实环境 E2E，覆盖 token 上传、免打扰、语言偏好、提醒类型分页与 validation 错误；
  - `ChatThreadManager` 需要专用父群消息/thread fixture，按当前用户确认 deferred，不纳入本轮 041 主线收口；
  - 其他 partial/gap 以 `tests/e2e/api/public-api-coverage-matrix.md` 为准。

---

## 实现方案

### Phase 0: 基础设施与断言策略

先统一浏览器 E2E 的运行方式，再迁移具体 case。

#### 0.0 断言规则对齐 robot

对标 `wayang/Resource/*.resource` 的 `Resp_*` + `Exclude` 机制：

- 成功 case 断言返回对象中的稳定字段，动态字段仅断类型/格式
- 错误 case 断 `error/code/message/reason`，包含 robot 资源中明确出现的嵌套 `reason.data`
- 事件 case 断事件名与关键 payload，不只断事件“出现了”
- 不允许只用 `toBeDefined()`、`toContainText()` 结束一个 API case
- 每个模块至少保留一组“成功 + 失败 + 事件”的组合覆盖，且每个 case 要写清楚成功/错误/事件/动态字段

#### 0.1 Token 获取（fixtures/sdk-flow.ts / 真实环境配置）

对标 robot 的 `Get User Token With Password`，通过 REST API 用密码换 token：

```ts
interface TokenResult {
  accessToken: string;
  expireTimestamp: number;
}

/**
 * 通过 REST API 获取用户 token
 * POST /{orgName}/{appName}/token
 * body: { grant_type: "password", username, password, timestamp }
 */
export async function fetchUserToken(
  appKey: string,
  userId: string,
  password: string
): Promise<TokenResult>;
```

逻辑：
- 从 appKey 解析 orgName/appName
- 从 `.env` 读取 `EASEMOB_REST_URL`（默认 `https://a1.easemob.com`），支持私有部署
- 构造 REST URL：`{restUrl}/{orgName}/{appName}/token`
- POST `{ grant_type: "password", username, password, timestamp: Date.now() }`
- 返回 `{ accessToken, expireTimestamp }`
- 如果 `.env` 中已配置 `EASEMOB_TOKEN`，直接使用不请求

#### 0.2 事件缓冲池（fixtures/sdk-api.ts）

对标 robot 的 WebSocket Cache Mode（`wayangutils.py` 中的 `cache_dictionary`），但运行在浏览器页面内：

```ts
export class EventCollector {
  private buffer: Map<string, unknown[]> = new Map();
  private waiters: Map<string, Array<{ resolve: (v: unknown) => void; predicate?: (v: unknown) => boolean }>>;

  /** 绑定到 client.addEventHandler */
  bind(client: ChatClient, handlerId: string): void;

  /** 等待指定事件，先查缓存再等新事件 */
  async waitForEvent<T = unknown>(eventName: string, timeoutMs?: number): Promise<T>;

  /** 等待满足条件的事件 */
  async waitForEventMatching<T = unknown>(
    eventName: string,
    predicate: (payload: unknown) => boolean,
    timeoutMs?: number
  ): Promise<T>;

  /** 断言：在超时内未收到指定事件 */
  async assertNoEvent(eventName: string, waitMs?: number): Promise<void>;

  /** 清空缓存 */
  clear(): void;

  /** 解绑 */
  unbind(client: ChatClient, handlerId: string): void;
}
```

核心算法（对标 robot 的 `wayang_websocket_recv`）：
1. 事件到达 → 检查是否有 waiter 匹配 → 有则 resolve，无则存入 buffer
2. `waitForEvent` 调用 → 先检查 buffer 有无匹配 → 有则 shift 返回，无则注册 waiter
3. 超时后 reject，错误信息包含已缓存的所有事件名列表

#### 0.3 多账号支持（浏览器上下文）

```ts
export interface ClientInstance {
  client: ChatClient;
  userId: string;
  token: string;
}

/** 创建新的 ChatClient 实例（绕过单例） */
export function createFreshClient(appKey: string): ChatClient;

/** 创建并登录，返回 ClientInstance */
export async function createAndLogin(
  appKey: string,
  userId: string,
  tokenOrPassword: string,
  options?: { usePassword?: boolean }
): Promise<ClientInstance>;

/** 批量登出并清理 */
export async function cleanupClients(...instances: ClientInstance[]): Promise<void>;
```

#### 0.4 数据清理（fixtures/sdk-api.ts / 具体 spec 内置 teardown）

```ts
/** 清除两个用户间的好友关系（忽略错误） */
export async function cleanupContacts(clientA: ChatClient, clientB: ChatClient): Promise<void>;

/** 销毁群组（忽略不存在错误） */
export async function destroyGroupSafe(client: ChatClient, groupId: string): Promise<void>;

/** 销毁聊天室（忽略不存在错误） */
export async function destroyChatroomSafe(client: ChatClient, chatroomId: string): Promise<void>;

/** 退出聊天室（忽略错误） */
export async function leaveChatroomSafe(client: ChatClient, chatroomId: string): Promise<void>;
```

#### 0.5 扩展真实环境配置

在 `tests/e2e/fixtures/` 与真实环境配置入口中扩展：

```ts
export interface RealEnvConfig {
  // 已有
  readonly appKey: string;
  readonly userId: string;
  readonly token: string;
  readonly targetId: string | null;
  readonly expectInbound: boolean;
  readonly secondUserId: string | null;
  readonly secondToken: string | null;
  readonly groupId: string | null;
  // 新增
  readonly password: string | null;
  readonly secondPassword: string | null;
  readonly thirdUserId: string | null;
  readonly thirdToken: string | null;
  readonly thirdPassword: string | null;
  readonly chatroomId: string | null;
}
```

对应 `.env` 新增变量：
```
EASEMOB_REST_URL=https://a1.easemob.com
EASEMOB_PASSWORD=
EASEMOB_SECOND_PASSWORD=
EASEMOB_THIRD_USERID=
EASEMOB_THIRD_TOKEN=
EASEMOB_THIRD_PASSWORD=
EASEMOB_CHATROOM_ID=
```

---

### Phase 1: 模块迁移

每个模块都放在 `tests/e2e/api/*.spec.ts`，统一通过 Playwright + 真实 demo 页面执行；多账号通过不同 browser context 管理。

```ts
import { test, expect } from '@playwright/test';
import { openDemo, runInitAndLogin, waitForLoginSuccess } from './fixtures/sdk-flow';

test.describe('模块名', () => {
  test('具体用例', async ({ page, browser }) => {
    // 打开真实 demo
    // 登录 / 多账号初始化
    // 调用 API
    // 等待事件
    // 逐字段精确断言
  });
});
```

#### 1.1 好友管理（tests/e2e/api/contact.spec.ts）

对标 robot `好友.robot` / `Friends.resource`：
- 添加好友：`addContact` 后断 `onContactInvited` 的 `from/to/status/type`
- 接受/拒绝好友：断 `onContactAgreed` / `onContactRefuse` 的 `from/to/status`
- 删除好友：断 `onContactDeleted`，并校验联系人列表变化
- 黑名单：断 `addUsersToBlocklist` / `removeUserFromBlocklist` 返回值与 `getBlocklist` 内容，`userIds` 和列表项 `userId` 都要对齐
- 分页联系人：断 `getContacts`、`getAllContacts`、`getContactsWithCursor` 的 `cursor/contacts/remark`、空分页与 `remark=null/""`
- 错误分支：空 userId、不存在用户、pageSize 越界、非法 cursor、非好友备注修改等错误体要逐项对齐 robot

#### 1.2 用户信息（tests/e2e/api/user-info.spec.ts）

对标 robot `用户.robot`：
- 获取自己的用户信息：逐字段验证 `userId/nickname/avatarUrl/mail/phone/gender/birth/sign/ext`
- 批量获取用户信息：验证数组长度、顺序与字段内容
- 不存在用户：验证返回空结果或特定错误结构，错误时也要对齐 `reason.data`

#### 1.3 在线状态（tests/e2e/api/presence.spec.ts）

对标 robot `在线状态.robot` / `Presence.resource`：
- 发布状态：断返回成功与 `customStatus`
- 订阅/取消订阅：断 `subscribePresence` / `unsubscribePresence` 返回体，返回的 `expiry/status/ext/last_time` 要逐项验证
- 事件：断 `onPresenceStatusChange` 的 `userId/ext/statusDetails/lastTime/expire`
- 查询：断 `getPresenceStatus`、`getSubscribedPresenceList` 的列表与总数，`totalnum/sublist` 要逐项验证
- 错误分支：订阅自己、订阅不存在用户、超限、未登录，错误码/消息/嵌套 data 要对齐 robot

#### 1.4 单聊消息（tests/e2e/api/message-single.spec.ts）

对标 robot `消息/单聊.robot` / `ChatMessage.resource`：
- 文本消息：断 `type/from/to/body.content/msgId`
- location/cmd/custom：断各自 body 关键字段与事件 payload
- 撤回：断 `onRecallMessage.messageId`，并对比原消息 `msgId/serverMsgId`
- 已读/修改：断返回值与回调字段
- 漫游/加载消息：断列表长度、顺序、`timestamp/localTime/msgId` 动态字段类型
- 错误分支：对不存在消息、非法参数、无权限撤回等错误体做精确断言

#### 1.5 群聊消息（tests/e2e/api/message-group.spec.ts）

对标 robot `消息/群聊.robot`：
- 群文本消息：断 `type/from/to/body.content/msgId`
- 群 location/cmd/custom：断关键 body 字段与事件 payload
- 群撤回：断 `onRecallMessage.messageId`
- 群 ack / 已读相关：若当前 SDK 暴露则补齐精确断言

#### 1.6 群组管理（tests/e2e/api/group.spec.ts）

对标 robot `群组/群组基础操作.robot` 与 `群组操作.robot`：
- 创建/销毁群组：断 `groupid/groupname/disabled/memberCount`、成员列表与销毁后的列表变化
- 群详情/列表：断 `id/name/description/membersonly/allowinvites/maxusers/owner/created/custom/mute/affiliations_count/avatar/public/shieldgroup`
- 管理员/群主：断权限变化与错误分支，`newadmin/oldadmin` 要校验
- 公告/白名单/黑名单/禁言：断列表和属性变更，`successKeys/errorKeys` 要校验
- 成员邀请：断成员加入事件与成员列表
- 错误分支：权限错误、资源不存在、参数错误等要对齐 robot，`reason.data` 要细化

#### 1.7 会话管理（tests/e2e/api/conversation-manage.spec.ts）

对标 robot `会话/会话.robot` 与 `Conversation.resource`：
- getConversation / getConversationList：断 `convId/type/isPinned/pinnedTime/marks/ext/unreadMessagesCount/messagesCount/latestMessage`
- 置顶/取消置顶：断列表变化与 `isPinned/pinnedTime`
- 标记/取消标记：断 `marks`
- unread / latestMessage / deleteConversation / syncConversationExt：断返回结构与动态字段
- 错误分支：空会话、不存在会话、非法 messageId、非法 conversationType 等错误体要对齐 robot

#### 1.8 聊天室管理（tests/e2e/api/chatroom.spec.ts）

对标 robot `聊天室/聊天室操作.robot`：
- 创建/销毁聊天室：断基础字段与销毁结果
- 属性/公告/管理员/禁言/白名单：断变更结果与回调事件
- 成员加入/退出：断成员事件与列表变化
- 权限错误：非 owner 修改类操作的错误体要精确校验
- 聊天室消息 case 若存在，必须并入该 spec 而不是单独拆文件

#### 1.9 Reaction（tests/e2e/api/reaction.spec.ts）

对标 robot `消息/Reaction.robot`：
- 添加 Reaction：断 detail/list 的内容与关联 messageId，`reaction/count/isAddedBySelf/userList/cursor` 不能只断存在
- 移除 Reaction：断列表为空或目标项消失
- 重复添加 / 不存在消息 / 超上限 / 无权限：断错误码、错误消息、reason 结构

---

### Phase 2: 断言策略

对标 robot 的 DeepDiff + Exclude 模式，迁移为浏览器 E2E 的 TypeScript 精确断言：

| robot 模式 | 迁移后模式 |
|-----------|-----------|
| `Resp_Diff(actual, expected, exclude_paths)` | 逐字段 `expect(x).toBe(y)` |
| `root['info']['return']['accessToken']` 排除 | 对动态字段用 `expect(typeof x).toBe('string')` |
| `$variable` 模板替换 | 直接使用 TypeScript 变量 |
| `error: 0` 成功判断 | 验证无异常抛出 + 返回值结构 |
| `error: 3` + reason 错误判断 | `expect(err.code).toBe(ERROR_CODES.XXX)` + `expect(err.message).toBe('...')` |

补充规则：
- robot 里有 `Resp_*` 但浏览器端拿不到的内部字段，不强行补造
- 对页面日志只能断“辅助定位信息”，不能代替 API 返回值断言
- 每个迁移用例都要明确写出“哪些字段精确断、哪些字段只断类型”

---

### Phase 3: 条件跳过与门禁

浏览器 E2E 仍然按账号配置分层跳过，避免假通过。

```ts
// 需要第二账号的测试
const hasSecondUser = Boolean(config.secondUserId && config.secondToken);
const describeMultiUser = hasSecondUser ? describe : describe.skip;

// 需要第三账号的测试（ThreeUsers）
const hasThirdUser = Boolean(config.thirdUserId && config.thirdToken);
const describeThreeUsers = hasThirdUser ? describe : describe.skip;

// 需要 AllFeatureEnabled 的测试
const allFeatureEnabled = process.env.EASEMOB_ALL_FEATURE_ENABLED === '1';
const describeAllFeature = allFeatureEnabled ? describe : describe.skip;
```

---

## 依赖关系

```
Phase 0 (基础设施)
  ├── 0.1 token 相关封装
  ├── 0.2 事件缓冲
  ├── 0.3 多账号浏览器上下文
  ├── 0.4 数据清理
  └── 0.5 扩展真实环境配置
        │
Phase 1 (模块迁移，可并行)
  ├── 1.1 contact (依赖 0.*)
  ├── 1.2 user-info (依赖 0.1, 0.3)
  ├── 1.3 presence (依赖 0.*)
  ├── 1.4 single-chat (依赖 0.*)
  ├── 1.5 group-chat (依赖 0.*, 1.6)
  ├── 1.6 group (依赖 0.*)
  ├── 1.7 conversation (依赖 0.*, 1.4)
  ├── 1.8 chatroom (依赖 0.*)
  └── 1.9 reaction (依赖 0.*, 1.4)
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 真实服务器不稳定导致测试偶发失败 | 测试结果不可靠 | 事件等待设置合理超时（10s）；失败时输出详细日志 |
| Token 过期导致中途失败 | 后续用例全部失败 | token.ts 支持按需刷新；单次运行时间控制在 5 分钟内 |
| 测试间数据残留 | 用例互相影响 | 每个 describe 块独立 cleanup；不依赖全局状态 |
| 单例绕过可能导致内存泄漏 | 长时间运行 OOM | afterAll 中显式 logout + 清理引用 |
| 事件乱序或丢失 | 断言失败 | EventCollector 缓冲池 + 超时后输出已收事件列表 |

---

## Complexity Tracking

无 Constitution 违反项。本 spec 产出为纯测试代码，不修改 SDK 源码。
