# 028 快速验证指南

## 目标

验证 ChatRoomManager 满足以下核心约束：

- 所有聊天室域入口能力通过 `client.chatRoomManager` 访问
- 单聊天室上下文能力通过 `chatRoomManager.getChatRoom(chatRoomId)` 返回的 `ChatRoom` 对象访问
- 旧聊天室 API 名字、白名单旧命名与 connection 风格入口已从公开 API 面移除
- `ChatRoom` 只暴露显式方法，不暴露同步属性、同步访问器或字段级 getter
- 与群组同构的聊天室详情、成员、管理员、黑名单、allowlist、禁言、公告、共享文件列表/删除统一复用 027 的对象结构
- 原本返回用户 ID 的接口和事件都已对象化为 `UserInfo`
- 聊天室事件名按 Web SDK 规范收敛，载荷保持 Web 对象化语义
- `onChatRoomInfoChanged` 返回完整聊天室对象，必要时受控补拉详情
- `uploadSharedFile` 已从 028 的公开 API 面移除

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备可用登录态：

- `appKey`
- `userId`
- `token`
- `restBaseUrl`

3. 准备真实 REST 样例或等价 fixture：

- 已确认样例来源：`docs/reference/chatroom-api.md`
- 已通过真实样例确认：
  - `getChatRoomList`
  - `updateChatRoomInfo`
  - `addMembers` / `removeMembers`
  - `blockMembers` / `unblockMembers`
  - `addUsersToAllowlist` / `removeUsersFromAllowlist`
  - `updateAnnouncement`
  - `getAttributes` / `setAttributes` / `removeAttributes`
  - `destroy`
- 已通过 027 群组同构接口确认：
  - `getChatRoomInfo`
  - `getMemberList`
  - `getAdminList`
  - `getMuteList`
  - `getBlocklist`
  - `getAllowlist`
  - `checkIfInAllowList`
  - `isCurrentUserMuted`
  - `getAnnouncement`
  - `getSharedFileList`
  - `deleteSharedFile`
  - 单用户 `setAdmin` / `removeAdmin`
  - `muteMembers` / `unmuteMembers`
  - `muteAllMembers` / `unmuteAllMembers`

4. 准备聊天室 MUC 事件 fixture：

- 聊天室销毁
- 成员加入/退出/被移除
- 管理员新增/移除、群主变更
- 全员禁言、禁言列表、allowlist 变更
- 公告、聊天室规格、聊天室属性更新/删除

## 验证步骤

### 步骤 1：基础静态检查

```bash
npm run lint
npm run type-check
```

期望：028 相关导出、类型、JSDoc 与文档校验通过；旧聊天室 API 名字和 `uploadSharedFile` 不再出现在公开类型面。

### 步骤 2：单元测试

```bash
npm run test:run -- tests/unit/managers/chatroom-manager.test.ts tests/unit/chatroom tests/unit/rest/chatroom-management.test.ts tests/types/chatroom-manager-types.test.ts
```

期望：

- ChatRoomManager 参数校验正确
- `getChatRoom(chatRoomId)` 返回轻量 `ChatRoom` 对象
- `ChatRoom` 只暴露显式方法，不存在同步 getter 模型
- `getChatRoomList()` 正确归一化为分页结果对象
- `owner` 的 `appKey_` 前缀剥离、字符串布尔/数字转换正确
- `ChatRoom` 上的成员/管理员/黑名单/allowlist/禁言列表对象化补齐正确
- 公告、共享文件列表/删除、属性结果归一化正确
- `uploadSharedFile` 未出现在公开 API、类型和文档中
- MUC operation 到 Web SDK 收敛后的聊天室事件名映射正确

### 步骤 3：集成测试

```bash
npm run test:run -- tests/integration/chatroom-manager tests/integration/mock/manager-public-api.test.ts
```

期望：

- `client.use(ChatRoomManager)` 后通过 `client.chatRoomManager` 调用公开 API
- `client.chatRoomManager.getChatRoom(chatRoomId)` 后可通过 `chatRoom.getInfo()`、`chatRoom.getMemberList()`、`chatRoom.getAnnouncement()` 等单聊天室方法继续调用
- 聊天室 REST 请求 path/body/query 组装符合旧 upstream endpoint
- 对象化用户补齐优先命中缓存，缺口时按批量补拉
- 用户资料补齐失败时主业务结果仍返回
- 聊天室事件通过 `EventHub` 派发到 `chatRoomManager.addEventHandler()`
- `onChatRoomInfoChanged` 在需要时会触发受控详情补拉

### 步骤 4：契约/fixture 校验

```bash
npm run test:run -- tests/contract/chatroom-manager.contract.test.ts
```

期望：

- `contracts/chatroom-manager.openapi.yaml` 与公开逻辑契约一致
- `docs/reference/chatroom-api.md` 中已确认的真实样例能够映射到 SDK 逻辑模型
- 与群组同构的聊天室接口使用和 027 一致的业务结构

### 步骤 5：聊天室事件手工验证

1. 注册 ChatRoomManager 事件：

```ts
client.chatRoomManager.addEventHandler('chatroom-ui', {
  onChatRoomDestroyed: payload => console.log(payload.chatRoomId),
  onMembersJoined: payload => console.log(payload.members[0]?.userId, payload.ext),
  onChatRoomInfoChanged: payload => console.log(payload.chatRoomInfo.chatRoomId),
});

const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
await chatRoom.getInfo();
await chatRoom.getAnnouncement();
await chatRoom.getSharedFileList();
```

2. 依次喂入成员加入、公告变更、聊天室规格变更三类 MUC fixture
3. 对一个资料缓存缺失用户重复触发成员变更事件
4. 模拟 `fetchUserInfoByUserId` 失败分支

期望：

- 事件名按 Web SDK 规范收敛
- 事件载荷中用户字段为 `UserInfo`
- 资料补齐失败时事件仍派发，且用户字段至少包含 `userId`
- 聊天室信息变更事件最终返回完整 `chatRoomInfo`

## 验收清单（对应 spec）

- ChatRoomManager 成为聊天室域唯一入口，`ChatRoom` 成为单聊天室上下文对象：通过率 100%
- 旧聊天室 API 名字与 `whitelist` 旧命名已移除：通过率 100%
- `ChatRoom` 方法模型与 027 对齐：通过率 100%
- 聊天室列表统一返回分页结果对象：通过率 100%
- 用户相关读取结果与事件载荷均对象化：通过率 100%
- 聊天室事件名按 Web SDK 规范收敛：通过率 100%
- `onChatRoomInfoChanged` 返回完整聊天室对象：通过率 100%
- 资料补齐失败不吞主业务结果与事件：通过率 100%
- `uploadSharedFile` 不再出现在 028 公开范围内：通过率 100%

## 实测记录（2026-04-10）

- `npm run test:run -- tests/unit/chatroom/chatroom-normalizers.test.ts tests/unit/rest/chatroom-management.test.ts tests/unit/managers/chatroom-manager.test.ts`
  - 结果：通过，`3` 个测试文件、`31` 条用例全部通过
- `npm run type-check`
  - 结果：通过
- `npm run build`
  - 结果：通过；`proto:check` 同步通过，`MSync` / `Roster` 静态 protobuf 产物校验通过
- `npm run lint`
  - 结果：通过
- `npm run docs:api:check`
  - 结果：通过；仅保留仓库既有 TypeDoc warning，集中在 `PresenceManager` 的引用项未纳入文档，不影响 028 聊天室域验收
- `npm run test:coverage`
  - 结果：通过；`150` 个测试文件通过、`2` 个跳过，`594` 条用例通过、`2` 条跳过；总覆盖率 `statements 87.02% / functions 93.8% / lines 87.02%`
  - 说明：该命令需要允许本机 mock server 监听 `127.0.0.1`
- `npm run test:gate:pr`
  - 结果：通过；unit 层 `118` 个测试文件、`506` 条用例全部通过；integration/contract 层 `15` 个测试文件、`41` 条用例全部通过
  - 说明：该命令同样需要允许本机 mock server 监听 `127.0.0.1`

## 实测记录（2026-05-26）

- `npm run type-check`
  - 结果：通过
- `npm run test:run -- tests/unit/chatroom/chatroom-event-mapper.test.ts tests/unit/chat-client/chatroom-events.test.ts tests/integration/chatroom-manager/chatroom-events.integration.test.ts tests/types/chatroom-manager-types.test.ts tests/unit/protocol/msync-chatroom-notify.test.ts tests/unit/core/message/message-receiver-chatroom.test.ts`
  - 结果：通过，`6` 个测试文件、`27` 条用例全部通过
- `npm run lint`
  - 结果：通过；保留仓库既有 `5` 条 warning，不阻断门禁
- `npm run docs:api:check`
  - 结果：通过；仅保留仓库既有 TypeDoc warning
- `npm run docs:api:md`
  - 结果：通过，已同步 `docs/reference/api-reference.zh-CN.md` 与 `docs/reference/api-reference.en-US.md`
- `npm run test:gate:pr`
  - 结果：首次在受限沙箱失败，原因是本地 mock server 监听 `127.0.0.1` 被 `EPERM` 拦截；提升权限重跑后通过，`32` 个测试文件、`94` 条用例全部通过
- `npm run test:e2e:api -- tests/e2e/api/chatroom.spec.ts`
  - 结果：首次在受限沙箱失败，原因是 Playwright dev server 监听 `127.0.0.1` 被 `EPERM` 拦截；提升权限重跑后通过
  - 说明：由于 npm script 固定包含 `tests/e2e/api` 目录，实际执行了完整 API E2E 套件，`122` 条用例全部通过

## 样例确认状态

- 已确认样例文件：`docs/reference/chatroom-api.md`
- 已确认字段映射：
  - 公开聊天室列表：`id/name/owner/affiliations_count/disabled` -> `chatRoomId/name/owner/memberCount/disabled`
  - 聊天室详情：`id/name/description/maxusers/owner/created/custom/affiliations_count/disabled` -> `chatRoomId/name/description/maxMembers/owner/createdAt/ext/memberCount/disabled`
  - 创建聊天室：`data.id` -> `chatRoomId`
  - 更新聊天室信息：`data.groupname/description/maxusers` -> 标准化更新结果
  - 成员/黑名单/allowlist 批量操作：`result/action/user/id|chatroomid/reason` -> `ChatRoomMemberActionResult`
  - 公告更新：`data.id/result` -> 标准化公告更新结果
  - 属性读取：`data` -> `attributes`
  - 属性写入/删除：`successKeys/errorKeys` -> `appliedKeys/failedKeys`
  - 销毁聊天室：`data.success/id` -> 最小销毁结果或 `void`
- 通过 027 同构复用的字段映射：
  - 聊天室详情
  - 成员列表
  - 管理员列表
  - 禁言列表
  - 黑名单
  - allowlist
  - 公告读取
  - 共享文件列表
  - 共享文件删除
- 已明确移除：
  - `uploadSharedFile`

## 已知限制

- `docs:api:check` 当前仍会输出 `PresenceManager` 相关的 3 条 TypeDoc warning，这是仓库既有问题，不属于 028 聊天室域回归
- `test:coverage`、`test:gate:pr` 在受限沙箱下会因为本地 mock server 无法绑定 `127.0.0.1` 而失败，执行时需允许本机监听
