# 026 快速验证指南（Phase 1）

## 目标

验证 UserInfoManager 满足以下核心约束：

- 查询侧已切换到 `fetchUserInfoByUserId` / `fetchUserInfoByAttribute`
- 更新侧已切换到 `updateOwnInfo` / `updateOwnInfoByAttribute`
- 旧 `fetchUserInfoById` / `updateUserInfo` / `updateOwnUserInfo` 已从公开 API 中移除
- 查询与更新都基于已确认真实 envelope 归一化
- `updateOwnInfoByAttribute` 的返回与 `updateOwnInfo` 保持一致
- 查询/更新成功后，当前会话缓存与后续读取结果保持一致
- `client.use(UserInfoManager)` 的公开访问方式符合 009：通过 `client.userInfoManager`

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

- 查询成功响应：

```json
{
  "timestamp": 1774495493846,
  "data": {
    "zd1": {
      "avatarurl": "http:/11.com/a/png"
    }
  },
  "lastModified": {
    "zd1": 1774495459340
  },
  "duration": 14
}
```

- 更新成功响应：

```json
{
  "timestamp": 1774496262484,
  "data": {
    "avatarurl": "http:/11.com/a/png",
    "nickname": "1111"
  },
  "lastModified": 1774496262500,
  "duration": 52
}
```

## 验证步骤

### 步骤 1：基础静态检查

```bash
npm run lint
npm run type-check
```

期望：026 相关导出、类型、JSDoc 与文档校验通过，旧 API 名称不再出现在公开类型面。

### 步骤 2：单元测试

```bash
npm run test:run -- tests/unit/managers/user-info-manager-fetch.test.ts tests/unit/managers/user-info-manager-update.test.ts tests/contract/user-info-manager.contract.test.ts tests/types/user-info-manager-types.test.ts
```

期望：

- `userIds`、`attributes`、`attribute/value` 参数校验正确
- `attributes` 仅接受驼峰公开字段名
- 查询 envelope `{ timestamp, data, lastModified, duration }` 被正确归一化
- 更新 envelope `{ timestamp, data, lastModified, duration }` 被正确归一化
- `''`、`false`、`0` 这些值不会在更新时被吞掉
- 旧查询名与旧更新名不再出现在公开类型与测试主路径

### 步骤 3：集成测试

```bash
npm run test:run -- tests/integration/user-info-manager/user-info-manager.integration.test.ts tests/integration/mock/manager-public-api.test.ts
```

期望：

- `client.use(UserInfoManager)` 后通过 `client.userInfoManager` 调用公开 API
- `fetchUserInfoByUserId` 请求 `/metadata/user/get` 时不带显式属性集
- `fetchUserInfoByAttribute` 请求 `/metadata/user/get` 时携带显式属性集
- `updateOwnInfo` 与 `updateOwnInfoByAttribute` 都请求 `/metadata/user/{userId}`
- 更新成功后返回的 `UserInfo` 与服务端 `data` 一致
- 查询/更新成功后缓存写回与同会话后续读取一致

### 步骤 4：契约/fixture 校验

```bash
npm run test:run -- tests/contract/user-info-manager.contract.test.ts
```

期望：

- 查询与更新真实 envelope 与 `contracts/user-info-manager.openapi.yaml` 保持一致
- `data` 与 `lastModified` 的形态与类型契约一致
- SDK 不直接透出 `timestamp`、`duration` 等包装字段

### 步骤 5：手工调用验证

```ts
const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager);

const users = await client.userInfoManager.fetchUserInfoByUserId({
  userIds: ['zd1'],
});

const selected = await client.userInfoManager.fetchUserInfoByAttribute({
  userIds: ['zd1'],
  attributes: ['avatarUrl'],
});

const updated = await client.userInfoManager.updateOwnInfo({
  nickname: '1111',
  avatarUrl: 'http:/11.com/a/png',
});

const updatedAvatar = await client.userInfoManager.updateOwnInfoByAttribute(
  'avatarUrl',
  'http:/11.com/a/png'
);
```

期望：

- `users` / `selected` 为 `ReadonlyArray<UserInfo>`
- `updated` / `updatedAvatar` 都是 `UserInfo`
- `updatedAvatar` 的返回结构与 `updated` 一致
- 旧 API 名称无法再作为主入口使用

## 验收清单（对应 spec）

- 查询/更新 API 命名已完成移动端对齐：通过率 100%
- 旧查询名/旧更新名已从公开 API 面移除：通过率 100%
- 查询/更新 envelope 都按真实样例归一化：通过率 100%
- `updateOwnInfoByAttribute` 返回与 `updateOwnInfo` 一致：通过率 100%
- `client.userInfoManager` 的公开访问方式符合 009：通过率 100%

## 待记录实测

### 本期不新增 E2E 的依据

- 当前 demo 未提供用户资料查询/更新入口，也没有独立的 manager 注册演示页。
- 026 已通过单元测试、契约测试、类型测试、专属集成测试与公开入口集成测试覆盖查询/更新/导出/009 访问方式主链路。
- 因此本期显式记录“不新增 E2E”，后续若 demo 增加用户资料页面，再补更高层 E2E。

### 实测结果

- `npm run test:run -- tests/unit/managers/user-info-manager-fetch.test.ts tests/unit/managers/user-info-manager-update.test.ts tests/contract/user-info-manager.contract.test.ts tests/types/user-info-manager-types.test.ts`
  - 结果：通过（4 个文件，16 个测试）
- `npm run test:run -- tests/integration/user-info-manager/user-info-manager.integration.test.ts tests/integration/mock/manager-public-api.test.ts`
  - 结果：通过（2 个文件，6 个测试）
  - 说明：由于沙箱内 `127.0.0.1 listen EPERM`，该组测试使用提权环境运行
- `npm run lint`
  - 结果：通过
- `npm run docs:api:check`
  - 结果：通过
  - 说明：TypeDoc 生成阶段存在仓库既有 warning 3 条（`PresenceManager` 相关引用未纳入文档），无新增 error
- `npm run test:gate:pr`
  - 结果：通过（unit 102 文件 / 420 测试；integration+contract 13 文件 / 33 测试）
  - 说明：该命令同样需要提权环境以启动本地 mock server
- `npm run type-check`
  - 结果：未完全通过
  - 说明：仓库存在 026 之外的既有 strict 报错，集中在 `src/cache/*`、`src/platform/factory.ts` 及多处历史测试文件；本次新增的 `UserInfoManager` 相关类型错误已收敛
