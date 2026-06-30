# 025 快速验证指南（Phase 1）

## 目标

验证联系人管理 API 满足以下核心约束：

- `getContacts()` 继续保持同步快照读取，不触发额外网络请求
- 5 个联系人写接口当前统一成功返回 `void`
- `getBlocklist()` 固定返回`UserInfo[]`
- 黑名单写接口统一使用 `userIds: string[]`，重复值先去重
- `deleteContact`、`setContactRemark` 成功后同会话联系人快照立即一致
- `acceptContactInvite` 成功后通过受控刷新拿到完整联系人快照
- `addUsersToBlocklist` 成功返回 `succeeded: UserInfo[]` 与 `failed: UserInfo[]` 两个数组；服务端整单业务错误仍抛统一 SDK 错误

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

3. 准备三类测试账号或 fixture：

- 账号 A：已有联系人，可执行删除、备注修改
- 账号 B：可接受/拒绝好友申请
- 账号 C：可用于黑名单增删与不存在用户错误验证

4. 准备真实 REST 样例或等价 fixture：

- `getBlocklist` 成功响应
- `addUsersToBlocklist` 成功响应
- `removeUserFromBlocklist` 成功响应
- `addUsersToBlocklist` 404 not found 错误响应

## 验证步骤

### 步骤 1：基础静态检查

```bash
npm run lint
npm run type-check
```

期望：025 相关类型、JSDoc、导出与文档产物通过静态检查。

### 步骤 2：单元测试

```bash
npm run test:run -- tests/unit/contact-manager
```

期望：

- `userId/userIds/message/remark` 参数校验正确
- `userIds` 重复值去重且顺序保持
- `getBlocklist` 归一化为`UserInfo[]`
- `addUsersToBlocklist` 归一化为 `BlocklistAddResult`
- `removeUserFromBlocklist` 成功返回 `void`
- `deleteContact` / `setContactRemark` 的本地缓存补丁正确

### 步骤 3：集成测试

```bash
npm run test:run -- tests/integration/contact-manager
```

期望：

- `ContactManager` 能通过 `ChatClient` 获取 REST 上下文并发起请求
- 联系人写操作成功后，同会话 `getContacts()` 读取结果与最新状态一致
- `getBlocklist()` 在资料缺失时会补拉用户属性并回退最小 `UserInfo`
- `acceptContactInvite` 成功后会触发受控联系人刷新
- 黑名单写操作成功后，同会话 `getBlocklist()` 可读取更新后的结果
- `addUsersToBlocklist` 的已知 404 样例被稳定映射为统一 SDK 错误

### 步骤 4：契约/fixture 校验

```bash
npm run test:run -- tests/contract/contact-manager.contract.test.ts
```

期望：

- 真实服务端 envelope 与 `contracts/contact-manager.openapi.yaml` 保持一致
- `data: string[]` 被正确映射为 `BlocklistAddResult.succeeded[]` 或 `UserInfo[]`
- `removeUserFromBlocklist` 成功 envelope 不会被错误拼装成业务对象

### 步骤 5：联系人快照一致性手工验证

1. 登录后读取 `client.contactManager.getContacts()`
2. 对某个现有联系人执行 `setContactRemark`
3. 再次读取 `client.contactManager.getContacts()`
4. 对另一个联系人执行 `deleteContact`
5. 再次读取 `client.contactManager.getContacts()`
6. 处理一条待接受好友申请，调用 `acceptContactInvite`
7. 刷新完成后再次读取 `client.contactManager.getContacts()`

期望：

- 备注修改立即可见
- 删除后的联系人不再出现
- 接受申请后联系人列表可看到新增联系人，且不是旧值或半更新状态

### 步骤 6：黑名单语义手工验证

1. 调用 `getBlocklist()`，记录初始结果
2. 调用 `addUsersToBlocklist({ userIds: ['user-x', 'user-x'] })`
3. 再次调用 `getBlocklist()`
4. 调用 `removeUserFromBlocklist({ userIds: ['user-x'] })`
5. 再次调用 `getBlocklist()`
6. 调用 `addUsersToBlocklist({ userIds: ['not-exists-user'] })`
7. 调用 `removeUserFromBlocklist({ userIds: ['not-exists-user'] })`

期望：

- 重复 ID 会在本地先去重
- 添加后黑名单能读到 `user-x`
- 移除后黑名单不再包含 `user-x`
- 添加接口若服务端返回部分失败语义，应成功返回并填充 `failed[]`；若服务端返回整单错误，应抛统一错误
- 移除不存在用户仍返回成功

## 验收清单（对应 spec）

- `getContacts()` 同步读取语义未破坏：通过率 100%
- 联系人写接口成功返回 `void`：通过率 100%
- `getBlocklist()` 返回 `UserInfo[]`：通过率 100%
- 黑名单添加部分成功结构与整单失败错误映射：通过率 100%
- 黑名单移除幂等成功：通过率 100%
- 联系人快照同会话一致性：通过率 100%

## 待记录实测

- `npm run test:run -- tests/unit/contact-manager tests/integration/contact-manager`
- `npm run lint`
- `npm run type-check`
- `npm run test:gate:pr`
