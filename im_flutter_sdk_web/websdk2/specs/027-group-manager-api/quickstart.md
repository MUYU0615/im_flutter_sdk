# 027 快速验证指南（Phase 1）

## 目标

验证 GroupManager 满足以下核心约束：

- 所有群组域入口能力通过 `client.groupManager` 访问
- 单群上下文能力通过 `groupManager.getGroup(groupId)` 返回的 `Group` 对象访问
- 旧 group API 名字、白名单旧命名与单/多用户双入口已从公开 API 面移除
- 群列表统一返回分页结果对象
- 原本返回 `userId` 的接口和事件都已对象化为 `UserInfo`
- 群事件名与移动端对齐，但载荷保持 Web 对象化语义
- `onGroupInfoChanged` / `onGroupDisabledChanged` 返回完整群对象，必要时受控补拉详情
- 用户资料补齐失败不会吞掉主业务结果或群事件

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

- 已确认样例来源：`docs/reference/group-api.md`
- 已确认：已加入群列表、群详情、群成员列表、群管理员列表、群禁言列表、群黑名单、群 allowlist、群公告、群共享文件列表、单成员/批量成员属性
- 仍待确认：公开群列表、群详情批量查询

4. 准备 MUC 事件 fixture：

- 邀请/申请类 operation
- 成员加入/退出/移除类 operation
- 管理员/群主变更类 operation
- 全员禁言、禁言列表、allowlist 变更类 operation
- 公告、共享文件、群规格、群状态、成员属性变更类 operation

## 验证步骤

### 步骤 1：基础静态检查

```bash
npm run lint
npm run type-check
```

期望：027 相关导出、类型、JSDoc 与文档校验通过；旧 group API 名字不再出现在公开类型面。

### 步骤 2：单元测试

```bash
npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/group tests/types/group-manager-types.test.ts
```

期望：

- GroupManager 参数校验正确
- `getGroup(groupId)` 返回轻量 `Group` 对象
- `userIds` 去重且顺序保持
- 群列表归一化为分页结果对象
- `Group` 上的成员/管理员/黑名单/allowlist/禁言列表对象化补齐正确
- MUC operation 到移动端对齐事件名映射正确
- `onGroupInfoChanged` / `onGroupDisabledChanged` 在“字段足够/字段不足”两类场景下都走正确分支

### 步骤 3：集成测试

```bash
npm run test:run -- tests/integration/group-manager tests/integration/mock/manager-public-api.test.ts
```

期望：

- `client.use(GroupManager)` 后通过 `client.groupManager` 调用公开 API
- `client.groupManager.getGroup(groupId)` 后可通过 `group.getMembers()` 等单群方法继续调用
- 群组 REST 请求 path/body/query 组装符合旧 upstream endpoint
- 对象化用户补齐优先命中缓存，缺口时按批量补拉
- 用户资料补齐失败时主业务结果仍返回
- 群事件通过 `EventHub` 派发到 `groupManager.addEventHandler()`
- `onGroupInfoChanged` / `onGroupDisabledChanged` 在需要时会触发受控详情补拉

### 步骤 4：契约/fixture 校验

```bash
npm run test:run -- tests/contract/group-manager.contract.test.ts
```

期望：

- `contracts/group-manager.openapi.yaml` 与公开逻辑契约一致
- `docs/reference/group-api.md` 中已确认的真实样例能够映射到 SDK 逻辑模型
- 仍未完全确认的 upstream endpoint 只限公开群列表、群详情批量查询

### 步骤 5：群事件手工验证

1. 注册 GroupManager 事件：

```ts
client.groupManager.addEventHandler('group-ui', {
  onInvitationReceived: payload => console.log(payload.inviter?.userId),
  onMembersJoined: payload => console.log(payload.members[0]?.userId),
  onGroupInfoChanged: payload => console.log(payload.groupInfo.groupId),
});

const group = client.groupManager.getGroup('group-1');
await group.getMembers();
await group.getAnnouncement();
```

2. 依次喂入邀请、成员加入、群规格变更三类 MUC fixture
3. 对一个资料缓存缺失用户重复触发成员变更事件
4. 模拟 `fetchUserInfoByUserId` 失败分支

期望：

- 事件名与移动端一致
- 事件载荷中用户字段为 `UserInfo`
- 资料补齐失败时事件仍派发，且用户字段至少包含 `userId`
- 群规格变更事件最终返回完整 `group`

## 验收清单（对应 spec）

- GroupManager 成为群组域唯一入口，`Group` 成为单群上下文对象：通过率 100%
- 旧 group API 名字与 `whitelist` 旧命名已移除：通过率 100%
- 群列表统一返回分页结果对象：通过率 100%
- 用户相关读取结果与事件载荷均对象化：通过率 100%
- 群事件名与移动端对齐：通过率 100%
- `onGroupInfoChanged` / `onGroupDisabledChanged` 返回完整群对象：通过率 100%
- 资料补齐失败不吞主业务结果与事件：通过率 100%

## 实测结果（2026-04-16）

- `npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/managers/group.test.ts tests/unit/rest/group-management.test.ts tests/unit/chat-client/group-events.test.ts tests/unit/group/group-event-mapper.test.ts tests/unit/group/group-event-user-info-resolver.test.ts tests/unit/protocol/msync-muc-notify.test.ts tests/unit/core/message/message-receiver-group.test.ts tests/types/group-manager-types.test.ts tests/integration/mock/manager-public-api.test.ts tests/integration/group-manager/group-manager.integration.test.ts tests/integration/group-manager/group-events.integration.test.ts tests/contract/group-manager.contract.test.ts`
  - 结果：通过
  - 摘要：`13` 个测试文件、`81` 个用例全部通过，耗时约 `1.95s`
- `npm run lint`
  - 结果：通过
- `npm run type-check`
  - 结果：通过
- `npm run docs:api:check`
  - 结果：通过
  - 备注：仅保留既有 TypeDoc warning，均与 `PresenceManager` 对 `ManagerBase`、`ChatClient`、`SDKError` 的引用未纳入文档有关；本轮 027 改动未新增文档错误
- `npm run test:gate:pr`
  - 结果：通过
  - 摘要：`18` 个测试文件、`58` 个用例全部通过，耗时约 `6.80s`

## 增量回写（2026-04-17）

- `T013`
  - 状态：已完成
  - 摘要：群组 REST 业务错误映射已补齐到 `src/rest/api-errors.json` 与 `src/utils/error-codes.ts`，覆盖创建群、群详情、更新/解散/退群、加群、邀请、共享文件、成员属性等群组域常见业务错误。
- `npm run test:run -- tests/unit/errors/error-handling.test.ts tests/unit/managers/group-manager.test.ts tests/integration/group-manager/group-manager.integration.test.ts`
  - 结果：通过
  - 摘要：`3` 个测试文件、`38` 个用例全部通过；其中集成测试需在允许监听本地 `127.0.0.1` mock server 的提权环境下执行。
- `npm run type-check`
  - 结果：通过
- `npm run lint`
  - 结果：通过

## 已知限制

- 生成型 API site 当前未产出 `GroupManager` 独立页面检索结果；现状下也不存在把 `Group` 单群方法错误暴露到 `GroupManager` 页面中的问题。
- 本期仍不新增 E2E：仓库暂无稳定的 demo 群组主路径、群成员列表 UI、群事件浏览器路径或群高阶功能入口，风险主要由单元、mock 集成、契约与类型测试承接。

## Fixture 接入位点

- 逻辑契约：`specs/027-group-manager-api/contracts/group-manager.openapi.yaml`
- 真实样例来源：`docs/reference/group-api.md`
- 当前 fixture / 样例仍需继续补强的 endpoint：
  - `getGroupInfoList`
- 已补充高阶 endpoint 占位：
  - `getGroupMembersAttributes`

## 样例确认状态

- 已确认样例文件：`docs/reference/group-api.md`
- 已确认字段映射：
  - 已加入群列表：`groupid/groupname/disabled` -> `groupId/name/disabled`
  - 群详情：`membersonly/allowinvites/maxusers/custom/mute/affiliations_count/created` -> `joinApprovalRequired/allowInvites/maxMembers/ext/muteAllMembers/memberCount/createdAt`
  - 群成员：`member|owner` -> `user + role`
  - 禁言列表：`string[]` -> `GroupMuteEntry[]`
  - 黑名单：`string[]` -> `GroupBlocklistEntry[]`
  - allowlist：`string[]` -> `GroupAllowlistEntry[]`
  - 公告：`data.announcement` -> `announcement`
  - 共享文件：`file_id/file_owner/file_name/file_size/created` -> `fileId/fileOwner/fileName/fileSize/createdAt`
  - 单成员/批量成员属性：返回同构，均为 `data[userId] -> attribute map`
- 仍待补样例：
  - 公开群列表
  - 群详情批量查询
